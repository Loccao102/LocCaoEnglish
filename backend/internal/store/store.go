package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/adventure"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

var ErrNotFound = errors.New("not found")
var ErrEmailExists = errors.New("email already exists")

var defaultSkills = []string{"Vocabulary", "Grammar", "Reading", "Listening", "Speaking", "Writing", "Dictation"}

type account struct {
	user         model.User
	passwordHash string
}

type memoryState struct {
	users   map[string]account
	emails  map[string]string
	skills  map[string]map[string]model.Skill
	reviews map[string]map[string]model.ReviewItem
}

type Store struct {
	fairMu      sync.Mutex
	fairs       map[string]fair.Save
	fairRuns    map[string]map[string]fair.Completion
	adventureMu sync.Mutex
	adventures  map[string]adventure.Save
	db          *sql.DB
	mu          sync.RWMutex
	mem         memoryState
	demoID      string
}

func New(databaseURL string) (*Store, error) {
	s := &Store{mem: memoryState{users: map[string]account{}, emails: map[string]string{}, skills: map[string]map[string]model.Skill{}, reviews: map[string]map[string]model.ReviewItem{}}}
	if databaseURL != "" {
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, err
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			db.Close()
			return nil, fmt.Errorf("postgres ping: %w", err)
		}
		s.db = db
		if _, err := db.ExecContext(ctx, schemaSQL); err != nil {
			db.Close()
			return nil, fmt.Errorf("apply schema: %w", err)
		}
	}
	if _, err := s.EnsureDemo(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() {
	if s.db != nil {
		_ = s.db.Close()
	}
}
func (s *Store) Mode() string {
	if s.db != nil {
		return "postgres"
	}
	return "memory"
}

func (s *Store) EnsureDemo(ctx context.Context) (model.User, error) {
	if s.db != nil {
		var u model.User
		err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,xp,streak,created_at FROM users WHERE email=$1`, "demo@loccao.local").Scan(&u.ID, &u.Email, &u.DisplayName, &u.XP, &u.Streak, &u.CreatedAt)
		if err == nil {
			s.demoID = u.ID
			return u, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return u, err
		}
		u, err = s.CreateUser(ctx, "demo@loccao.local", "", "Demo Learner")
		if err == nil {
			s.demoID = u.ID
		}
		return u, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.mem.emails["demo@loccao.local"]; ok {
		s.demoID = id
		return s.mem.users[id].user, nil
	}
	u := model.User{ID: newID(), Email: "demo@loccao.local", DisplayName: "Demo Learner", XP: 4280, Streak: 17, CreatedAt: time.Now()}
	s.mem.users[u.ID] = account{user: u}
	s.mem.emails[u.Email] = u.ID
	s.mem.skills[u.ID] = seedSkills()
	s.mem.reviews[u.ID] = map[string]model.ReviewItem{}
	s.demoID = u.ID
	return u, nil
}

func (s *Store) DemoID() string { return s.demoID }

func (s *Store) CreateUser(ctx context.Context, email, passwordHash, displayName string) (model.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if email == "" || displayName == "" {
		return model.User{}, errors.New("email and display name are required")
	}
	u := model.User{ID: newID(), Email: email, DisplayName: displayName, XP: 0, Streak: 1, CreatedAt: time.Now().UTC()}
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return u, err
		}
		defer tx.Rollback()
		_, err = tx.ExecContext(ctx, `INSERT INTO users(id,email,password_hash,display_name,xp,streak,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, u.ID, u.Email, passwordHash, u.DisplayName, u.XP, u.Streak, u.CreatedAt)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				return model.User{}, ErrEmailExists
			}
			return model.User{}, err
		}
		for _, name := range defaultSkills {
			conf := initialConfidence(name)
			_, err = tx.ExecContext(ctx, `INSERT INTO user_skills(user_id,skill,confidence,level,updated_at) VALUES($1,$2,$3,$4,NOW())`, u.ID, name, conf, levelFor(conf))
			if err != nil {
				return model.User{}, err
			}
		}
		if err := tx.Commit(); err != nil {
			return model.User{}, err
		}
		return u, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.mem.emails[email]; ok {
		return model.User{}, ErrEmailExists
	}
	s.mem.users[u.ID] = account{user: u, passwordHash: passwordHash}
	s.mem.emails[email] = u.ID
	s.mem.skills[u.ID] = seedSkills()
	s.mem.reviews[u.ID] = map[string]model.ReviewItem{}
	return u, nil
}

func (s *Store) FindUserByEmail(ctx context.Context, email string) (model.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if s.db != nil {
		var u model.User
		var hash string
		err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,xp,streak,created_at,password_hash FROM users WHERE email=$1`, email).Scan(&u.ID, &u.Email, &u.DisplayName, &u.XP, &u.Streak, &u.CreatedAt, &hash)
		if errors.Is(err, sql.ErrNoRows) {
			return u, "", ErrNotFound
		}
		return u, hash, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.mem.emails[email]
	if !ok {
		return model.User{}, "", ErrNotFound
	}
	acc := s.mem.users[id]
	return acc.user, acc.passwordHash, nil
}

func (s *Store) Dashboard(ctx context.Context, userID string) (model.Dashboard, error) {
	u, err := s.user(ctx, userID)
	if err != nil {
		return model.Dashboard{}, err
	}
	skills, err := s.Skills(ctx, userID)
	if err != nil {
		return model.Dashboard{}, err
	}
	reviews, err := s.ReviewQueue(ctx, userID, 100)
	if err != nil {
		return model.Dashboard{}, err
	}
	due := 0
	now := time.Now()
	for _, r := range reviews {
		if !r.DueAt.After(now) {
			due++
		}
	}
	return model.Dashboard{User: u, Skills: skills, DueReviews: due, IELTSBand: 6.0, TargetBand: 7.0}, nil
}

func (s *Store) Skills(ctx context.Context, userID string) ([]model.Skill, error) {
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT skill,confidence,level,updated_at FROM user_skills WHERE user_id=$1 ORDER BY confidence ASC`, userID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []model.Skill
		for rows.Next() {
			var sk model.Skill
			if err := rows.Scan(&sk.Name, &sk.Confidence, &sk.Level, &sk.UpdatedAt); err != nil {
				return nil, err
			}
			out = append(out, sk)
		}
		return out, rows.Err()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := s.mem.skills[userID]
	if m == nil {
		return nil, ErrNotFound
	}
	out := make([]model.Skill, 0, len(m))
	for _, sk := range m {
		out = append(out, sk)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Confidence < out[j].Confidence })
	return out, nil
}

func (s *Store) RecordAttempt(ctx context.Context, userID string, in model.AttemptInput) (model.AttemptResult, error) {
	accuracy := math.Max(0, math.Min(1, in.Accuracy))
	xp := 10 + int(math.Round(20*accuracy))
	review := accuracy < 0.85
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return model.AttemptResult{}, err
		}
		defer tx.Rollback()
		var old float64
		err = tx.QueryRowContext(ctx, `SELECT confidence FROM user_skills WHERE user_id=$1 AND skill=$2 FOR UPDATE`, userID, in.Skill).Scan(&old)
		if errors.Is(err, sql.ErrNoRows) {
			old = .35
			_, err = tx.ExecContext(ctx, `INSERT INTO user_skills(user_id,skill,confidence,level,updated_at) VALUES($1,$2,$3,$4,NOW())`, userID, in.Skill, old, levelFor(old))
		}
		if err != nil {
			return model.AttemptResult{}, err
		}
		next := old*.75 + accuracy*.25
		level := levelFor(next)
		_, err = tx.ExecContext(ctx, `UPDATE user_skills SET confidence=$3,level=$4,updated_at=NOW() WHERE user_id=$1 AND skill=$2`, userID, in.Skill, next, level)
		if err != nil {
			return model.AttemptResult{}, err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO attempts(id,user_id,skill,activity,item_key,prompt,answer,accuracy,duration_sec,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, newID(), userID, in.Skill, in.Activity, in.ItemKey, in.Prompt, in.Answer, accuracy, in.DurationSec)
		if err != nil {
			return model.AttemptResult{}, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, userID, xp)
		if err != nil {
			return model.AttemptResult{}, err
		}
		if review {
			_, err = tx.ExecContext(ctx, `INSERT INTO review_items(user_id,item_key,kind,prompt,answer,due_at,interval_days,ease,failures) VALUES($1,$2,$3,$4,$5,NOW(),1,2.5,1) ON CONFLICT(user_id,item_key) DO UPDATE SET prompt=EXCLUDED.prompt,answer=EXCLUDED.answer,due_at=NOW(),failures=review_items.failures+1`, userID, in.ItemKey, in.Activity, in.Prompt, in.Answer)
			if err != nil {
				return model.AttemptResult{}, err
			}
		}
		if err := tx.Commit(); err != nil {
			return model.AttemptResult{}, err
		}
		return model.AttemptResult{XPDelta: xp, NewConfidence: next, Level: level, ReviewAdded: review}, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	skmap := s.mem.skills[userID]
	if skmap == nil {
		return model.AttemptResult{}, ErrNotFound
	}
	sk, ok := skmap[in.Skill]
	if !ok {
		sk = model.Skill{Name: in.Skill, Confidence: .35, Level: levelFor(.35), UpdatedAt: time.Now()}
	}
	next := sk.Confidence*.75 + accuracy*.25
	sk.Confidence = next
	sk.Level = levelFor(next)
	sk.UpdatedAt = time.Now()
	skmap[in.Skill] = sk
	acc := s.mem.users[userID]
	acc.user.XP += xp
	s.mem.users[userID] = acc
	if review {
		if s.mem.reviews[userID] == nil {
			s.mem.reviews[userID] = map[string]model.ReviewItem{}
		}
		r := s.mem.reviews[userID][in.ItemKey]
		r.ItemKey = in.ItemKey
		r.Kind = in.Activity
		r.Prompt = in.Prompt
		r.Answer = in.Answer
		r.DueAt = time.Now()
		r.IntervalDays = 1
		if r.Ease == 0 {
			r.Ease = 2.5
		}
		r.Failures++
		s.mem.reviews[userID][in.ItemKey] = r
	}
	return model.AttemptResult{XPDelta: xp, NewConfidence: next, Level: sk.Level, ReviewAdded: review}, nil
}

func (s *Store) ReviewQueue(ctx context.Context, userID string, limit int) ([]model.ReviewItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT item_key,kind,prompt,answer,due_at,interval_days,ease,failures FROM review_items WHERE user_id=$1 ORDER BY due_at ASC LIMIT $2`, userID, limit)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []model.ReviewItem
		for rows.Next() {
			var r model.ReviewItem
			if err := rows.Scan(&r.ItemKey, &r.Kind, &r.Prompt, &r.Answer, &r.DueAt, &r.IntervalDays, &r.Ease, &r.Failures); err != nil {
				return nil, err
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := s.mem.reviews[userID]
	var out []model.ReviewItem
	for _, r := range m {
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DueAt.Before(out[j].DueAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *Store) GradeReview(ctx context.Context, userID, itemKey string, quality int) error {
	if quality < 0 {
		quality = 0
	}
	if quality > 5 {
		quality = 5
	}
	if s.db != nil {
		var interval int
		var ease float64
		var failures int
		err := s.db.QueryRowContext(ctx, `SELECT interval_days,ease,failures FROM review_items WHERE user_id=$1 AND item_key=$2`, userID, itemKey).Scan(&interval, &ease, &failures)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		interval, ease, failures = nextReview(interval, ease, failures, quality)
		_, err = s.db.ExecContext(ctx, `UPDATE review_items SET interval_days=$3,ease=$4,failures=$5,due_at=NOW()+($3 || ' days')::interval WHERE user_id=$1 AND item_key=$2`, userID, itemKey, interval, ease, failures)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.mem.reviews[userID][itemKey]
	if !ok {
		return ErrNotFound
	}
	r.IntervalDays, r.Ease, r.Failures = nextReview(r.IntervalDays, r.Ease, r.Failures, quality)
	r.DueAt = time.Now().Add(time.Duration(r.IntervalDays) * 24 * time.Hour)
	s.mem.reviews[userID][itemKey] = r
	return nil
}

func (s *Store) user(ctx context.Context, id string) (model.User, error) {
	if s.db != nil {
		var u model.User
		err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,xp,streak,created_at FROM users WHERE id=$1`, id).Scan(&u.ID, &u.Email, &u.DisplayName, &u.XP, &u.Streak, &u.CreatedAt)
		if errors.Is(err, sql.ErrNoRows) {
			return u, ErrNotFound
		}
		return u, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	acc, ok := s.mem.users[id]
	if !ok {
		return model.User{}, ErrNotFound
	}
	return acc.user, nil
}

func seedSkills() map[string]model.Skill {
	out := map[string]model.Skill{}
	for _, name := range defaultSkills {
		c := initialConfidence(name)
		out[name] = model.Skill{Name: name, Confidence: c, Level: levelFor(c), UpdatedAt: time.Now()}
	}
	return out
}
func initialConfidence(name string) float64 {
	switch name {
	case "Speaking":
		return .42
	case "Writing":
		return .46
	case "Dictation":
		return .51
	case "Grammar":
		return .62
	case "Listening":
		return .68
	case "Vocabulary":
		return .74
	case "Reading":
		return .78
	}
	return .5
}
func levelFor(conf float64) int { return 1 + int(math.Round(conf*19)) }
func nextReview(interval int, ease float64, failures, quality int) (int, float64, int) {
	if ease == 0 {
		ease = 2.5
	}
	if quality < 3 {
		return 1, math.Max(1.3, ease-.2), failures + 1
	}
	if interval < 1 {
		interval = 1
	} else if interval == 1 {
		interval = 3
	} else {
		interval = int(math.Round(float64(interval) * ease))
	}
	ease = math.Max(1.3, ease+.1-float64(5-quality)*.08)
	return interval, ease, failures
}
func newID() string { b := make([]byte, 16); _, _ = rand.Read(b); return hex.EncodeToString(b) }

const schemaSQL = `
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL DEFAULT '',display_name TEXT NOT NULL,xp INTEGER NOT NULL DEFAULT 0,streak INTEGER NOT NULL DEFAULT 1,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS user_skills(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,skill TEXT NOT NULL,confidence DOUBLE PRECISION NOT NULL DEFAULT .35,level INTEGER NOT NULL DEFAULT 1,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,skill));
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,skill TEXT NOT NULL,activity TEXT NOT NULL,item_key TEXT NOT NULL,prompt TEXT NOT NULL DEFAULT '',answer TEXT NOT NULL DEFAULT '',accuracy DOUBLE PRECISION NOT NULL,duration_sec INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON attempts(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS review_items(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_key TEXT NOT NULL,kind TEXT NOT NULL,prompt TEXT NOT NULL DEFAULT '',answer TEXT NOT NULL DEFAULT '',due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),interval_days INTEGER NOT NULL DEFAULT 1,ease DOUBLE PRECISION NOT NULL DEFAULT 2.5,failures INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,item_key));
CREATE INDEX IF NOT EXISTS idx_reviews_user_due ON review_items(user_id,due_at);
`
