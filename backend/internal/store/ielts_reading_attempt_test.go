package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestIELTSObjectiveEvidenceMemoryAndPostgres(t *testing.T) {
	for _, activity := range []string{"ielts-reading", "ielts-listening"} {
		t.Run(activity, func(t *testing.T) { testIELTSEvidence(t, activity) })
	}
}

func testIELTSEvidence(t *testing.T, activity string) {
	kind, firstQuestion := "reading", "R1"
	if activity == "ielts-listening" {
		kind, firstQuestion = "listening", "L1"
	}
	urls := map[string]string{"memory": ""}
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		if !strings.Contains(url, "loccao_system_test") {
			t.Fatal("dedicated test database required")
		}
		urls["postgres"] = url
	}
	for mode, url := range urls {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			s, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			for _, ensure := range []func(context.Context) error{s.EnsureIELTS, s.EnsureIELTS, s.EnsurePlayerProfiles} {
				if err = ensure(ctx); err != nil {
					t.Fatal(err)
				}
			}
			if s.db != nil {
				migration, err := os.ReadFile("../../migrations/018_ielts_reading_evidence.sql")
				if err != nil {
					t.Fatal(err)
				}
				for i := 0; i < 2; i++ {
					if _, err = s.db.ExecContext(ctx, string(migration)); err != nil {
						t.Fatal(err)
					}
				}
			}
			u, err := s.CreateUser(ctx, fmt.Sprintf("ielts-%d@example.test", time.Now().UnixNano()), "hash", "Reader")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			beforeSkills, err := s.Skills(ctx, u.ID)
			if err != nil {
				t.Fatal(err)
			}
			dashboard, err := s.Dashboard(ctx, u.ID)
			if err != nil || dashboard.IELTSBand != nil || dashboard.TargetBand != nil {
				t.Fatal("invented dashboard band", dashboard, err)
			}
			if _, err = s.SavePlayerProfile(ctx, u.ID, model.PlayerProfile{Goal: "ielts", CEFRLevel: "B2", DailyMinutes: 15, TargetBand: 7.5}); err != nil {
				t.Fatal(err)
			}
			dashboard, err = s.Dashboard(ctx, u.ID)
			if err != nil || dashboard.TargetBand == nil || *dashboard.TargetBand != 7.5 {
				t.Fatal("lost actual target", dashboard, err)
			}
			legacy, err := s.SaveIELTSAttempt(ctx, u.ID, model.IELTSAttempt{Section: "reading", TestType: "academic", Band: 9, Source: learning.IELTSReadingEvidence})
			if err != nil || !legacy.Legacy || legacy.Evidence != "legacy-unverified" {
				t.Fatal("legacy source promoted to verified", legacy, err)
			}
			// This fixture represents older history. Do not rely on consecutive wall
			// clock reads being distinct on systems with a coarse clock resolution.
			legacy.CreatedAt = time.Now().UTC().Add(-time.Hour)
			if s.db != nil {
				if _, err = s.db.ExecContext(ctx, "UPDATE ielts_attempts SET created_at=$2 WHERE id=$1", legacy.ID, legacy.CreatedAt); err != nil {
					t.Fatal(err)
				}
			} else {
				state := s.ieltsMemory()
				state.mu.Lock()
				for i := range state.attempts[u.ID] {
					if state.attempts[u.ID][i].ID == legacy.ID {
						state.attempts[u.ID][i].CreatedAt = legacy.CreatedAt
					}
				}
				state.mu.Unlock()
			}
			start := func(req string) LearningAttemptRecord {
				p, private, id, version, e := learning.NewIELTSReading()
				pack, rules, skill := learning.IELTSReadingPack, learning.IELTSReadingRulesVersion, "Reading"
				var audio *ListeningSnapshot
				if activity == "ielts-listening" {
					var transcripts map[string]string
					p, private, transcripts, id, version, e = learning.NewIELTSListening()
					audio = &ListeningSnapshot{Transcripts: transcripts, Events: []model.ListeningPlayback{}}
					pack, rules, skill = learning.IELTSListeningPack, learning.IELTSListeningRulesVersion, "Listening"
				}
				if e != nil {
					t.Fatal(e)
				}
				snap := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: req, Activity: activity, Pack: pack, CEFRLevel: "B2", ExcludeItemKeys: []string{}}, Prompt: model.LearningAttemptPrompt{Reading: &p, Options: []string{}}, IELTS: &private, Listening: audio}
				if audio != nil {
					snap.Prompt.ListeningPaper, snap.Prompt.Reading = &p, nil
				}
				rec, _, e := s.StartLearningAttempt(ctx, u.ID, req, activity, skill, id, "B2", version, rules, p.Title, "", "Practice", snap)
				if e != nil {
					t.Fatal(e)
				}
				// The caller keeps its original snapshot; changing it must not change
				// the stored prompt or grading key in memory mode.
				p.Sections[0].Questions[0].Options[0].Text = "changed caller content"
				private.CorrectOptions[firstQuestion] = "changed caller key"
				if audio != nil {
					for _, part := range p.Sections {
						event := model.ListeningPlayback{RequestID: "play-" + part.ID, PartID: part.ID, Rate: 1, Status: "requested"}
						if _, e = s.RecordListeningPlayback(ctx, u.ID, rec.ID, version, rules, event); e != nil {
							t.Fatal(e)
						}
						event.Status, event.Provider = "completed", "browser-speech-synthesis"
						rec, e = s.RecordListeningPlayback(ctx, u.ID, rec.ID, version, rules, event)
						if e != nil {
							t.Fatal(e)
						}
					}
				}
				return rec
			}
			a := start("ielts-evidence-1")
			original := cloneLearningRecord(a)
			retryStart := start("ielts-evidence-1")
			if !reflect.DeepEqual(original, retryStart) {
				t.Fatal("new catalog/option IDs replaced creation retry")
			}
			paper := a.Snapshot.Prompt.Reading
			if activity == "ielts-listening" {
				paper = a.Snapshot.Prompt.ListeningPaper
				a.Snapshot.Listening.Transcripts[paper.Sections[0].ID] = "mutated"
			}
			paper.Sections[0].Questions[0].Options[0].Text = "mutated"
			a.Snapshot.IELTS.CorrectOptions[firstQuestion] = "mutated"
			readStore := s
			if url != "" {
				readStore, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer readStore.Close()
			}
			a, err = readStore.GetLearningAttempt(ctx, u.ID, original.ID)
			if err != nil || !reflect.DeepEqual(a, original) {
				t.Fatal("snapshot mutation/reconnect", err)
			}
			if _, err = s.GetLearningAttempt(ctx, "", a.ID); !errors.Is(err, ErrNotFound) {
				t.Fatal("foreign get", err)
			}
			versions := model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
			bad := versions
			bad.ContentVersion = "different"
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, a.ID, "[]", bad); !errors.Is(err, ErrAttemptInput) {
				t.Fatal("bad version", err)
			}
			if _, err = s.SubmitLearningAttempt(ctx, "foreign", a.ID, "[]", versions); !errors.Is(err, ErrAttemptOwner) {
				t.Fatal("foreign submit", err)
			}
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, a.ID, `[["R1","invalid"]]`, versions); !errors.Is(err, ErrAttemptInput) {
				t.Fatal("bad option", err)
			}
			key := a.Snapshot.IELTS.CorrectOptions[firstQuestion]
			raw, _ := json.Marshal([][]string{{firstQuestion, key}})
			answer := " " + string(raw) + " "
			var wg sync.WaitGroup
			results := make(chan model.LearningAttemptResult, 8)
			for i := 0; i < 8; i++ {
				wg.Add(1)
				st := s
				if i%2 == 1 {
					st = readStore
				}
				go func(st *Store) {
					defer wg.Done()
					result, e := st.SubmitLearningAttempt(ctx, u.ID, a.ID, answer, versions)
					if e != nil {
						t.Error(e)
						return
					}
					results <- result
				}(st)
			}
			wg.Wait()
			close(results)
			var first model.LearningAttemptResult
			count := 0
			for result := range results {
				if count == 0 {
					first = result
				} else if !reflect.DeepEqual(first, result) {
					t.Error("concurrent result changed")
				}
				count++
			}
			if count != 8 || first.IELTS == nil || first.IELTS.Section != kind || first.IELTS.RawScore != 1 || first.Correct || first.ActualAnswer != answer || first.Evidence != learning.IELTSReadingEvidence || first.XPDelta != 0 || first.ProgressionApplied || first.NewConfidence != 0 || first.Level != 0 || first.ReviewAdded {
				t.Fatal("incorrect evidence-only completion", first)
			}
			saved, err := s.GetLearningAttempt(ctx, u.ID, a.ID)
			if err != nil || !reflect.DeepEqual(LearningResult(saved), &first) {
				t.Fatal("result not persisted", err)
			}
			if activity == "ielts-listening" {
				if first.Listening == nil || len(first.Listening.Transcripts) != 4 || len(first.Listening.Events) != 4 {
					t.Fatal("missing immutable audio evidence", first.Listening)
				}
				first.Listening.Transcripts["listening-part-1"] = "mutated"
				event := model.ListeningPlayback{RequestID: "after-completion", PartID: "listening-part-1", Rate: 1, Status: "requested"}
				if _, err = s.RecordListeningPlayback(ctx, u.ID, a.ID, a.ContentVersion, a.RulesVersion, event); !errors.Is(err, ErrAttemptConflict) {
					t.Fatal("audio mutated after completion", err)
				}
			}
			first.IELTS.Answers[0].Correct = false
			saved.Snapshot.IELTS.Result.Band = 99
			retry, err := readStore.SubmitLearningAttempt(ctx, u.ID, a.ID, answer, versions)
			if err != nil || !retry.IELTS.Answers[0].Correct || retry.IELTS.Band == 99 || retry.Listening != nil && retry.Listening.Transcripts["listening-part-1"] == "mutated" {
				t.Fatal("result alias changed receipt", err)
			}
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, a.ID, string(raw), versions); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("different exact wire payload accepted", err)
			}
			history, err := readStore.IELTSHistory(ctx, u.ID, 30)
			if err != nil || len(history) != 2 {
				t.Fatal("duplicate/missing history", history, err)
			}
			if history[0].Section != kind || history[0].AttemptID != a.ID || history[0].Legacy || history[0].Evidence != learning.IELTSReadingEvidence || history[0].ContentVersion != a.ContentVersion || history[0].RulesVersion != a.RulesVersion || history[0].MethodVersion != learning.IELTSReadingMethodVersion || history[0].Provider != learning.IELTSReadingProvider || history[1].ID != legacy.ID || !history[1].Legacy {
				t.Fatal("history provenance", history)
			}
			*history[0].RawScore = 99
			history, err = s.IELTSHistory(ctx, u.ID, 30)
			if err != nil || *history[0].RawScore != 1 {
				t.Fatal("history alias", err)
			}
			other, err := s.IELTSHistory(ctx, "unrelated-owner", 30)
			if err != nil || len(other) != 0 {
				t.Fatal("history owner", err)
			}
			empty := start("ielts-empty")
			zero, err := s.SubmitLearningAttempt(ctx, u.ID, empty.ID, "[]", versions)
			if err != nil || zero.IELTS.RawScore != 0 || zero.IELTS.Band != 0 {
				t.Fatal("blank completion", zero, err)
			}
			// Saved content versions remain authoritative, independently of the
			// currently deployed catalog. The existing v1 grader remains supported.
			archived := start("ielts-archived")
			expired := start("ielts-expired")
			if s.db != nil {
				if _, err = s.db.ExecContext(ctx, `UPDATE learning_attempts SET content_version='archived-catalog' WHERE id=$1`, archived.ID); err != nil {
					t.Fatal(err)
				}
				if _, err = s.db.ExecContext(ctx, `UPDATE learning_attempts SET expires_at=NOW()-INTERVAL '1 hour' WHERE id IN ($1,$2)`, expired.ID, a.ID); err != nil {
					t.Fatal(err)
				}
			} else {
				archived.ContentVersion = "archived-catalog"
				s.learningAttempts[archived.ID] = archived
				expired.ExpiresAt = time.Now().Add(-time.Hour)
				s.learningAttempts[expired.ID] = expired
				completed := s.learningAttempts[a.ID]
				completed.ExpiresAt = time.Now().Add(-time.Hour)
				s.learningAttempts[a.ID] = completed
			}
			archivedVersions := versions
			archivedVersions.ContentVersion = "archived-catalog"
			archivedResult, err := readStore.SubmitLearningAttempt(ctx, u.ID, archived.ID, "[]", archivedVersions)
			if err != nil || archivedResult.ContentVersion != "archived-catalog" {
				t.Fatal("archived snapshot rejected", err)
			}
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, expired.ID, "[]", versions); !errors.Is(err, ErrAttemptExpired) {
				t.Fatal("expired active attempt accepted", err)
			}
			if afterExpiry, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, answer, versions); err != nil || !reflect.DeepEqual(afterExpiry, retry) {
				t.Fatal("expired completed retry lost", err)
			}
			if s.db != nil {
				var receiptJSON []byte
				if err = s.db.QueryRowContext(ctx, `SELECT receipt FROM ielts_attempts WHERE attempt_id=$1`, a.ID).Scan(&receiptJSON); err != nil {
					t.Fatal(err)
				}
				var receipt ieltsReceipt
				if err = json.Unmarshal(receiptJSON, &receipt); err != nil || receipt.ActualAnswer != answer || !reflect.DeepEqual(receipt.Result, retry.IELTS) || !reflect.DeepEqual(receipt.Listening, retry.Listening) {
					t.Fatal("raw receipt lost", err)
				}
				rollback := start("ielts-rollback")
				// A receipt collision forces the second write to fail, after the attempt UPDATE.
				sentinel := newID()
				if _, err = s.db.ExecContext(ctx, `INSERT INTO ielts_attempts(id,user_id,section,band,source,attempt_id) VALUES($1,$2,'reading',0,'test-collision',$3)`, sentinel, u.ID, rollback.ID); err != nil {
					t.Fatal(err)
				}
				if _, err = s.SubmitLearningAttempt(ctx, u.ID, rollback.ID, "[]", versions); err == nil {
					t.Fatal("expected receipt write failure")
				}
				active, err := s.GetLearningAttempt(ctx, u.ID, rollback.ID)
				if err != nil || active.Status != "active" || active.Snapshot.IELTS.Result != nil || active.SubmittedAnswer != "" {
					t.Fatal("partial transaction", active, err)
				}
				if _, err = s.db.ExecContext(ctx, `DELETE FROM ielts_attempts WHERE id=$1`, sentinel); err != nil {
					t.Fatal(err)
				}
				if _, err = s.SubmitLearningAttempt(ctx, u.ID, rollback.ID, "[]", versions); err != nil {
					t.Fatal("retry after rollback", err)
				}
				for _, table := range []string{"learning_daily_rewards", "attempts", "review_items"} {
					var n int
					if err = s.db.QueryRowContext(ctx, "SELECT count(*) FROM "+table+" WHERE user_id=$1", u.ID).Scan(&n); err != nil || n != 0 {
						t.Fatal("unwanted mastery write", table, n, err)
					}
				}
			} else if len(s.learningRewards) != 0 || len(s.mem.reviews[u.ID]) != 0 {
				t.Fatal("memory awarded mastery")
			}
			after, err := s.GetUser(ctx, u.ID)
			if err != nil || after.XP != u.XP {
				t.Fatal("unexpected XP", after, err)
			}
			afterSkills, err := s.Skills(ctx, u.ID)
			if err != nil || !reflect.DeepEqual(beforeSkills, afterSkills) {
				t.Fatal("unexpected skill change", err)
			}
			dashboard, err = s.Dashboard(ctx, u.ID)
			if err != nil || dashboard.IELTSBand != nil {
				t.Fatal("reading/legacy misrepresented as overall", dashboard, err)
			}
		})
	}
}
