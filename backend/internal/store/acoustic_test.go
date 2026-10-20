package store

import (
	"context"
	"errors"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/acoustic"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"os"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func acousticFeedback(r acoustic.Receipt) *acoustic.Feedback {
	z := 0.0
	return &acoustic.Feedback{Provider: acoustic.Provider, Model: acoustic.Model, MethodVersion: acoustic.MethodVersion, Locale: "en-US", AudioSHA256: r.Sample.SHA256, ReferenceSHA256: acoustic.Hash([]byte(r.Reference)), AcousticAssessment: true, Overall: &z, Scores: map[string]*float64{"accuracy": &z, "fluency": &z, "completeness": &z}, Coaching: []string{"Repeat slowly."}}
}
func TestAcousticMemoryAndPostgres(t *testing.T) {
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
			s, e := New(url)
			if e != nil {
				t.Fatal(e)
			}
			defer s.Close()
			for i := 0; i < 2; i++ {
				if e = s.EnsureAcoustic(ctx); e != nil {
					t.Fatal(e)
				}
			}
			if s.db != nil {
				raw, e := os.ReadFile("../../migrations/020_acoustic_receipts.sql")
				if e != nil {
					t.Fatal(e)
				}
				for i := 0; i < 2; i++ {
					if _, e = s.db.ExecContext(ctx, string(raw)); e != nil {
						t.Fatal(e)
					}
				}
			}
			u, e := s.CreateUser(ctx, fmt.Sprintf("acoustic-%d@example.test", time.Now().UnixNano()), "hash", "Speaker")
			if e != nil {
				t.Fatal(e)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			skills, _ := s.Skills(ctx, u.ID)
			snap := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "shadowing", Pack: "cefr-core", CEFRLevel: "B1"}, Prompt: model.LearningAttemptPrompt{Question: "I would like some tea.", Options: []string{}}}
			parent, _, e := s.StartLearningAttempt(ctx, u.ID, "acoustic-parent", "shadowing", "Speaking", "tea", "B1", "saved.v1", "shadowing.v1", snap.Prompt.Question, snap.Prompt.Question, "Practice.", snap)
			if e != nil {
				t.Fatal(e)
			}
			sample := acoustic.Sample{SHA256: strings.Repeat("a", 64), Bytes: 32044, SampleRate: 16000, DurationSec: 1}
			in := acoustic.StartInput{RequestID: "acoustic-request-0001", AttemptID: parent.ID, Transcript: "I like tea", ContentVersion: "saved.v1", TranscriptRulesVersion: "shadowing.v1", RulesVersion: acoustic.RulesVersion, AudioBase64: "never persist this"}
			r, e := s.StartAcoustic(ctx, u.ID, in, sample)
			if e != nil || r.Status != "ready" || r.Reference != snap.Prompt.Question {
				t.Fatal(r, e)
			}
			again, e := s.StartAcoustic(ctx, u.ID, in, sample)
			if e != nil || !reflect.DeepEqual(r, again) {
				t.Fatal("create retry", e)
			}
			bad := in
			bad.Transcript = "changed"
			if _, e = s.StartAcoustic(ctx, u.ID, bad, sample); !errors.Is(e, acoustic.ErrConflict) {
				t.Fatal("changed retry", e)
			}
			bad = in
			bad.RequestID = "acoustic-request-0002"
			bad.ContentVersion = "new"
			if _, e = s.StartAcoustic(ctx, u.ID, bad, sample); !errors.Is(e, acoustic.ErrInput) {
				t.Fatal("version mismatch", e)
			}
			if _, e = s.GetAcoustic(ctx, "other", r.ID); !errors.Is(e, ErrNotFound) {
				t.Fatal("owner leak", e)
			}
			if list, _ := s.ListAcoustic(ctx, "other", ""); len(list) != 0 {
				t.Fatal("list owner leak")
			}
			if _, _, e = s.ClaimAcoustic(ctx, u.ID, r.ID, 0, ""); !errors.Is(e, acoustic.ErrNeedsAudio) {
				t.Fatal("hash-only evaluation", e)
			}
			if _, _, e = s.ClaimAcoustic(ctx, u.ID, r.ID, 0, strings.Repeat("b", 64)); !errors.Is(e, acoustic.ErrConflict) {
				t.Fatal("changed audio", e)
			}
			second := s
			if url != "" {
				second, e = New(url)
				if e != nil {
					t.Fatal(e)
				}
				defer second.Close()
			}
			var wg sync.WaitGroup
			var claimed atomic.Int32
			for i := 0; i < 12; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					st := s
					if i%2 == 0 {
						st = second
					}
					_, ok, e := st.ClaimAcoustic(ctx, u.ID, r.ID, 0, sample.SHA256)
					if e != nil {
						t.Error(e)
					}
					if ok {
						claimed.Add(1)
					}
				}(i)
			}
			wg.Wait()
			if claimed.Load() != 1 {
				t.Fatal("duplicate provider calls", claimed.Load())
			}
			r, e = s.FinishAcoustic(ctx, u.ID, r.ID, 1, nil)
			if e != nil || r.Status != "failed" || r.Feedback != nil {
				t.Fatal("fallback score", r, e)
			}
			if _, ok, e := s.ClaimAcoustic(ctx, u.ID, r.ID, 0, ""); e != nil || ok {
				t.Fatal("old failed retry", e)
			}
			r, ok, e := s.ClaimAcoustic(ctx, u.ID, r.ID, 1, sample.SHA256)
			if e != nil || !ok || r.Generation != 2 {
				t.Fatal("explicit retry", e)
			}
			if _, e = s.FinishAcoustic(ctx, u.ID, r.ID, 1, acousticFeedback(r)); !errors.Is(e, acoustic.ErrConflict) {
				t.Fatal("stale completion", e)
			}
			invalid := acousticFeedback(r)
			invalid.AudioSHA256 = "forged"
			if _, e = s.FinishAcoustic(ctx, u.ID, r.ID, 2, invalid); !errors.Is(e, acoustic.ErrInput) {
				t.Fatal("forged evidence", e)
			}
			r, e = s.FinishAcoustic(ctx, u.ID, r.ID, 2, acousticFeedback(r))
			if e != nil || r.Status != "completed" || *r.Feedback.Overall != 0 || r.CompletedAt == nil {
				t.Fatal(r, e)
			}
			for _, gen := range []int{0, 1, 2} {
				if _, ok, e := s.ClaimAcoustic(ctx, u.ID, r.ID, gen, ""); e != nil || ok {
					t.Fatal("completed assessment repeated", e)
				}
			}
			reopened := second
			if url != "" {
				reopened, e = New(url)
				if e != nil {
					t.Fatal(e)
				}
				defer reopened.Close()
			}
			got, e := reopened.AcousticByRequest(ctx, u.ID, in.RequestID)
			if e != nil || !reflect.DeepEqual(got, r) {
				t.Fatal("restart recovery", got, e)
			}
			got.Feedback.Scores["accuracy"] = nil
			fresh, _ := s.GetAcoustic(ctx, u.ID, r.ID)
			if fresh.Feedback.Scores["accuracy"] == nil {
				t.Fatal("shared mutable feedback")
			}
			list, e := s.ListAcoustic(ctx, u.ID, parent.ID)
			if e != nil || len(list) != 1 {
				t.Fatal("attempt history", e)
			}
			if s.db != nil {
				var raw string
				_ = s.db.QueryRowContext(ctx, "SELECT snapshot::text FROM speaking_assessments WHERE id=$1", r.ID).Scan(&raw)
				if strings.Contains(raw, "audioBase64") || strings.Contains(raw, in.AudioBase64) {
					t.Fatal("raw audio persisted")
				}
			}
			after, _ := s.GetUser(ctx, u.ID)
			afterSkills, _ := s.Skills(ctx, u.ID)
			if after.XP != u.XP || !reflect.DeepEqual(skills, afterSkills) {
				t.Fatal("acoustic feedback awarded learning progress")
			}
		})
	}
}
