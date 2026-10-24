package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

const VocabularyUnlockMethod = "vocabulary-unlocks.v1"

// Keep identical to the SQL between BEGIN/COMMIT in migration 022. The marker
// freezes negative decisions too: later startups never grandfather new seeds.
const vocabularyUnlockSchemaSQL = `
SELECT pg_advisory_xact_lock(140014,1);
CREATE TABLE IF NOT EXISTS player_loadout(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot TEXT NOT NULL,cosmetic_id TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,slot));
CREATE TABLE IF NOT EXISTS progression_cutovers(policy TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS player_unlock_grants(
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 unlock_id TEXT NOT NULL CHECK(unlock_id IN ('word-network','wordsmith')),
 receipt JSONB NOT NULL,
 PRIMARY KEY(user_id,unlock_id)
);
WITH cutover AS (
 INSERT INTO progression_cutovers(policy,applied_at) VALUES('vocabulary-unlocks.v1',clock_timestamp())
 ON CONFLICT DO NOTHING RETURNING applied_at
), old_players AS (
 SELECT u.id,u.xp,
 EXISTS(SELECT 1 FROM user_skills s WHERE s.user_id=u.id AND lower(s.skill)='vocabulary' AND s.confidence>=0.55) AS words,
 EXISTS(SELECT 1 FROM user_skills s WHERE s.user_id=u.id AND lower(s.skill)='vocabulary' AND s.confidence>=0.70) AS smith,
 EXISTS(SELECT 1 FROM player_loadout l WHERE l.user_id=u.id AND l.cosmetic_id='wordsmith-pin') AS pin
 FROM users u
), candidates AS (
 SELECT id,'word-network' AS unlock_id FROM old_players WHERE words OR xp>=300 OR pin
 UNION ALL SELECT id,'wordsmith' AS unlock_id FROM old_players WHERE smith OR pin
)
INSERT INTO player_unlock_grants(user_id,unlock_id,receipt)
 SELECT c.id,c.unlock_id,jsonb_build_object('unlockId',c.unlock_id,'method','vocabulary-unlocks.v1','source','legacy-personal','recordedAt',cutover.applied_at)
 FROM candidates c CROSS JOIN cutover ON CONFLICT DO NOTHING;
`

func (s *Store) ensureVocabularyUnlocksMemory() {
	mem := s.progressionMemory()
	mem.mu.Lock()
	defer mem.mu.Unlock()
	if mem.vocabularyCutover {
		return
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	at := time.Now().UTC()
	for id, account := range s.mem.users {
		confidence := 0.0
		for _, skill := range s.mem.skills[id] {
			if strings.EqualFold(skill.Name, "Vocabulary") && skill.Confidence > confidence {
				confidence = skill.Confidence
			}
		}
		pin := false
		for _, cosmetic := range mem.loadout[id] {
			pin = pin || cosmetic == "wordsmith-pin"
		}
		for unlock, eligible := range map[string]bool{"word-network": confidence >= .55 || account.user.XP >= 300 || pin, "wordsmith": confidence >= .70 || pin} {
			if eligible {
				if mem.grants[id] == nil {
					mem.grants[id] = map[string]model.VocabularyUnlockReceipt{}
				}
				mem.grants[id][unlock] = model.VocabularyUnlockReceipt{UnlockID: unlock, Method: VocabularyUnlockMethod, Source: "legacy-personal", RecordedAt: at}
			}
		}
	}
	mem.vocabularyCutover = true
}

func vocabularyEvidenceLess(a, b model.VocabularyUnlockEvidence) bool {
	if a.CompletedAt.Equal(b.CompletedAt) {
		return a.AttemptID < b.AttemptID
	}
	return a.CompletedAt.Before(b.CompletedAt)
}

func vocabularyEvidenceSQL(ctx context.Context, q dailyQuery, owner string) ([]model.VocabularyUnlockEvidence, error) {
	pairs := []string{"word-link:" + checkedPracticeRules["word-link"], "collocation-factory:" + checkedPracticeRules["collocation-factory"], "word-graph:" + checkedPracticeRules["word-graph"]}
	rows, err := q.QueryContext(ctx, `WITH first_items AS (
 SELECT DISTINCT ON(activity,item_key) id,activity,item_key,content_version,rules_version,completed_at
 FROM learning_attempts WHERE user_id=$1 AND skill='Vocabulary' AND status='completed' AND correct
 AND item_key<>'' AND content_version<>'' AND completed_at>$3 AND activity||':'||rules_version=ANY($2)
 ORDER BY activity,item_key,completed_at ASC,id COLLATE "C" ASC
), ranked AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY activity ORDER BY completed_at ASC,id COLLATE "C" ASC) AS position FROM first_items
)
SELECT id,activity,item_key,content_version,rules_version,completed_at FROM ranked WHERE position<=7 ORDER BY completed_at ASC,id COLLATE "C" ASC`, owner, pq.Array(pairs), time.Time{})
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.VocabularyUnlockEvidence{}
	for rows.Next() {
		var e model.VocabularyUnlockEvidence
		if err := rows.Scan(&e.AttemptID, &e.Activity, &e.ItemKey, &e.ContentVersion, &e.RulesVersion, &e.CompletedAt); err != nil {
			return nil, err
		}
		e.CompletedAt = e.CompletedAt.UTC()
		out = append(out, e)
	}
	return out, rows.Err()
}

// Caller holds s.mu. All-time first-correct items are deliberately separate
// from the latest-20 journal. Content updates never manufacture another item.
func (s *Store) vocabularyEvidenceMemory(owner string) []model.VocabularyUnlockEvidence {
	type key struct{ activity, item string }
	first := map[key]model.VocabularyUnlockEvidence{}
	for _, r := range s.learningAttempts {
		if r.UserID != owner || owner == "" || r.Skill != "Vocabulary" || r.Status != "completed" || !r.Correct || r.ItemKey == "" || r.ContentVersion == "" || !r.CompletedAt.After(time.Time{}) {
			continue
		}
		if r.Activity != "word-link" && r.Activity != "word-graph" && r.Activity != "collocation-factory" {
			continue
		}
		if r.RulesVersion != checkedPracticeRules[r.Activity] {
			continue
		}
		e := model.VocabularyUnlockEvidence{AttemptID: r.ID, Activity: r.Activity, ItemKey: r.ItemKey, ContentVersion: r.ContentVersion, RulesVersion: r.RulesVersion, CompletedAt: r.CompletedAt.UTC()}
		k := key{r.Activity, r.ItemKey}
		if old, ok := first[k]; !ok || vocabularyEvidenceLess(e, old) {
			first[k] = e
		}
	}
	out := make([]model.VocabularyUnlockEvidence, 0, len(first))
	for _, e := range first {
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool { return vocabularyEvidenceLess(out[i], out[j]) })
	bounded := make([]model.VocabularyUnlockEvidence, 0, 21)
	counts := map[string]int{}
	for _, e := range out {
		if counts[e.Activity] < 7 {
			bounded = append(bounded, e)
			counts[e.Activity]++
		}
	}
	return bounded
}

func vocabularyProof(items []model.VocabularyUnlockEvidence, count, activities int) []model.VocabularyUnlockEvidence {
	if len(items) < count {
		return nil
	}
	proof := append([]model.VocabularyUnlockEvidence(nil), items[:count]...)
	seen := map[string]bool{}
	for _, e := range proof {
		seen[e.Activity] = true
	}
	if len(seen) < activities {
		for _, e := range items[count:] {
			if !seen[e.Activity] {
				proof[count-1] = e
				seen[e.Activity] = true
				break
			}
		}
	}
	if len(seen) < activities {
		return nil
	}
	sort.Slice(proof, func(i, j int) bool { return vocabularyEvidenceLess(proof[i], proof[j]) })
	return proof
}

func vocabularyCandidates(items []model.VocabularyUnlockEvidence, xp int, at time.Time) map[string]model.VocabularyUnlockReceipt {
	out := map[string]model.VocabularyUnlockReceipt{}
	for id, target := range map[string][2]int{"word-network": {3, 1}, "wordsmith": {7, 2}} {
		r := model.VocabularyUnlockReceipt{UnlockID: id, Method: VocabularyUnlockMethod, RecordedAt: at}
		if proof := vocabularyProof(items, target[0], target[1]); proof != nil {
			r.Source = "checked-practice"
			r.Evidence = proof
		} else if id == "word-network" && xp >= 300 {
			r.Source = "personal-xp"
			copy := xp
			r.PersonalXP = &copy
		} else {
			continue
		}
		out[id] = r
	}
	return out
}

func cloneVocabularyReceipt(r model.VocabularyUnlockReceipt) model.VocabularyUnlockReceipt {
	r.Evidence = append([]model.VocabularyUnlockEvidence(nil), r.Evidence...)
	if r.PersonalXP != nil {
		xp := *r.PersonalXP
		r.PersonalXP = &xp
	}
	return r
}

func vocabularyUnlockState(items []model.VocabularyUnlockEvidence, receipts map[string]model.VocabularyUnlockReceipt) map[string]model.VocabularyUnlock {
	activities := map[string]bool{}
	for _, e := range items {
		activities[e.Activity] = true
	}
	out := map[string]model.VocabularyUnlock{}
	for id, target := range map[string][2]int{"word-network": {3, 1}, "wordsmith": {7, 2}} {
		state := model.VocabularyUnlock{Method: VocabularyUnlockMethod, CorrectItems: minInt(7, len(items)), TargetItems: target[0], ActivityCount: len(activities), TargetActivities: target[1]}
		if r, ok := receipts[id]; ok {
			copy := cloneVocabularyReceipt(r)
			state.Receipt = &copy
		}
		out[id] = state
	}
	return out
}

// Sync only entitlement receipts; learning XP, confidence and loadout are never
// written here. A user lock serializes competing progression/equip requests.
func (s *Store) syncVocabularyUnlocks(ctx context.Context, owner string) (map[string]model.VocabularyUnlock, error) {
	if owner == "" {
		return nil, ErrNotFound
	}
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		var xp int
		if err = tx.QueryRowContext(ctx, `SELECT xp FROM users WHERE id=$1 FOR UPDATE`, owner).Scan(&xp); errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		} else if err != nil {
			return nil, err
		}
		items, err := vocabularyEvidenceSQL(ctx, tx, owner)
		if err != nil {
			return nil, err
		}
		for id, r := range vocabularyCandidates(items, xp, time.Now().UTC()) {
			raw, err := json.Marshal(r)
			if err != nil {
				return nil, err
			}
			if _, err = tx.ExecContext(ctx, `INSERT INTO player_unlock_grants(user_id,unlock_id,receipt) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, owner, id, raw); err != nil {
				return nil, err
			}
		}
		rows, err := tx.QueryContext(ctx, `SELECT unlock_id,receipt FROM player_unlock_grants WHERE user_id=$1`, owner)
		if err != nil {
			return nil, err
		}
		receipts := map[string]model.VocabularyUnlockReceipt{}
		for rows.Next() {
			var id string
			var raw []byte
			if err = rows.Scan(&id, &raw); err != nil {
				rows.Close()
				return nil, err
			}
			var r model.VocabularyUnlockReceipt
			if err = json.Unmarshal(raw, &r); err != nil {
				rows.Close()
				return nil, err
			}
			receipts[id] = r
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
		if err = tx.Commit(); err != nil {
			return nil, err
		}
		return vocabularyUnlockState(items, receipts), nil
	}
	mem := s.progressionMemory()
	mem.mu.Lock()
	defer mem.mu.Unlock()
	s.mu.RLock()
	defer s.mu.RUnlock()
	account, ok := s.mem.users[owner]
	if !ok {
		return nil, ErrNotFound
	}
	items := s.vocabularyEvidenceMemory(owner)
	if mem.grants[owner] == nil {
		mem.grants[owner] = map[string]model.VocabularyUnlockReceipt{}
	}
	for id, r := range vocabularyCandidates(items, account.user.XP, time.Now().UTC()) {
		if _, exists := mem.grants[owner][id]; !exists {
			mem.grants[owner][id] = r
		}
	}
	return vocabularyUnlockState(items, mem.grants[owner]), nil
}
