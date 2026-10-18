package store

import (
	"context"
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

func TestIELTSListeningAudioBoundariesMemoryAndPostgres(t *testing.T) {
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
			if err = s.EnsureIELTS(ctx); err != nil {
				t.Fatal(err)
			}
			u, err := s.CreateUser(ctx, fmt.Sprintf("ielts-audio-%d@example.test", time.Now().UnixNano()), "hash", "Listener")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			other := s
			if url != "" {
				other, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer other.Close()
			}
			start := func(request string) LearningAttemptRecord {
				p, key, transcripts, id, version, e := learning.NewIELTSListening()
				if e != nil {
					t.Fatal(e)
				}
				snap := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: request, Activity: "ielts-listening", Pack: learning.IELTSListeningPack, CEFRLevel: "B2"}, Prompt: model.LearningAttemptPrompt{ListeningPaper: &p}, IELTS: &key, Listening: &ListeningSnapshot{Transcripts: transcripts, Events: []model.ListeningPlayback{}}}
				a, _, e := s.StartLearningAttempt(ctx, u.ID, request, "ielts-listening", "Listening", id, "B2", version, learning.IELTSListeningRulesVersion, p.Title, "", "Practice", snap)
				if e != nil {
					t.Fatal(e)
				}
				return a
			}
			a := start("audio-boundaries")
			versions := model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
			record := func(event model.ListeningPlayback) error {
				_, e := s.RecordListeningPlayback(ctx, u.ID, a.ID, a.ContentVersion, a.RulesVersion, event)
				return e
			}
			blocked := func() {
				if _, e := s.SubmitLearningAttempt(ctx, u.ID, a.ID, "[]", versions); !errors.Is(e, ErrAttemptConflict) {
					t.Fatal("incomplete audio accepted", e)
				}
			}
			blocked()
			failed := model.ListeningPlayback{RequestID: "failed-part", PartID: "listening-part-1", Rate: 1, Status: "requested"}
			if err = record(failed); err != nil {
				t.Fatal(err)
			}
			failed.Status, failed.Provider = "failed", "browser-speech-synthesis"
			if err = record(failed); err != nil {
				t.Fatal(err)
			}
			blocked()
			changed := failed
			changed.Status = "completed"
			if err = record(changed); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("failed event rewritten", err)
			}
			var last model.ListeningPlayback
			for i, part := range a.Snapshot.Prompt.ListeningPaper.Sections {
				event := model.ListeningPlayback{RequestID: part.ID, PartID: part.ID, Rate: 1, Status: "requested"}
				if err = record(event); err != nil {
					t.Fatal(err)
				}
				blocked()
				changed = event
				changed.Rate = .72
				if err = record(changed); !errors.Is(err, ErrAttemptConflict) {
					t.Fatal("request changed rate", err)
				}
				event.Status, event.Provider = "completed", "browser-speech-synthesis"
				if i < 3 {
					if err = record(event); err != nil {
						t.Fatal(err)
					}
				} else {
					last = event
				}
			}
			// The last completion and grading contend on the same lock, through two
			// independent connections when PostgreSQL is configured. A premature
			// submit may conflict, but no result can omit its final audio evidence.
			var wg sync.WaitGroup
			for i := 0; i < 16; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					if i%2 == 0 {
						_, e := other.RecordListeningPlayback(ctx, u.ID, a.ID, a.ContentVersion, a.RulesVersion, last)
						if e != nil {
							t.Error(e)
						}
					} else {
						r, e := s.SubmitLearningAttempt(ctx, u.ID, a.ID, "[]", versions)
						if e != nil && !errors.Is(e, ErrAttemptConflict) {
							t.Error(e)
						}
						if e == nil && (r.Listening == nil || len(r.Listening.Events) != 5 || r.IELTS.RawScore != 0) {
							t.Error("partial evidence receipt", r)
						}
					}
				}(i)
			}
			wg.Wait()
			result, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, "[]", versions)
			if err != nil {
				t.Fatal(err)
			}
			saved, err := other.GetLearningAttempt(ctx, u.ID, a.ID)
			if err != nil || !reflect.DeepEqual(LearningResult(saved), &result) {
				t.Fatal("result not frozen", err)
			}
			if _, err = other.RecordListeningPlayback(ctx, u.ID, a.ID, a.ContentVersion, a.RulesVersion, last); err != nil {
				t.Fatal("completed audio retry lost", err)
			}
			last.RequestID = "new-after-result"
			last.Status = "requested"
			last.Provider = ""
			if err = record(last); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("new audio after result", err)
			}
			history, err := s.IELTSHistory(ctx, u.ID, 30)
			if err != nil || len(history) != 1 {
				t.Fatal("duplicate concurrent history", history, err)
			}
			// Rows produced before the old tally endpoint closed stay unverified.
			raw, max := 20, 40
			legacy, err := s.SaveIELTSAttempt(ctx, u.ID, model.IELTSAttempt{Section: "listening", TestType: "academic", Band: 5.5, RawScore: &raw, MaxScore: &max, Evidence: "client-reported"})
			if err != nil {
				t.Fatal(err)
			}
			history, err = other.IELTSHistory(ctx, u.ID, 30)
			if err != nil || len(history) != 2 || history[0].ID != legacy.ID || history[0].Evidence != "client-reported" || history[0].AttemptID != "" || history[0].Provider != "" || *history[0].RawScore != 20 {
				t.Fatal("old tally provenance lost", history, err)
			}
			limited := start("audio-limit")
			for i := 0; i < 128; i++ {
				e := model.ListeningPlayback{RequestID: fmt.Sprintf("limit-%d", i), PartID: "listening-part-1", Rate: 1, Status: "requested"}
				if _, err = s.RecordListeningPlayback(ctx, u.ID, limited.ID, limited.ContentVersion, limited.RulesVersion, e); err != nil {
					t.Fatal("early limit", i, err)
				}
			}
			extra := model.ListeningPlayback{RequestID: "limit-extra", PartID: "listening-part-1", Rate: 1, Status: "requested"}
			if _, err = s.RecordListeningPlayback(ctx, u.ID, limited.ID, limited.ContentVersion, limited.RulesVersion, extra); !errors.Is(err, ErrAttemptInput) {
				t.Fatal("unbounded audio journal", err)
			}
			extra.RequestID = "limit-127"
			extra.Status = "failed"
			extra.Provider = "browser-speech-synthesis"
			if _, err = s.RecordListeningPlayback(ctx, u.ID, limited.ID, limited.ContentVersion, limited.RulesVersion, extra); err != nil {
				t.Fatal("full journal cannot finish existing event", err)
			}
		})
	}
}
