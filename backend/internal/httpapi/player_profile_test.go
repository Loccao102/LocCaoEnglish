package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

type profileHTTPFixture struct {
	store   *store.Store
	handler http.Handler
	auth    *auth.Service
	a, b    model.User
	token   string
}

func newProfileHTTPFixture(t *testing.T) profileHTTPFixture {
	t.Helper()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	social := realtime.New("")
	t.Cleanup(social.Close)
	authn := auth.New("profile-http-only", time.Hour)
	a, err := st.CreateUser(context.Background(), "profile-a@example.test", "hash", "Profile A")
	if err != nil {
		t.Fatal(err)
	}
	b, err := st.CreateUser(context.Background(), "profile-b@example.test", "hash", "Profile B")
	if err != nil {
		t.Fatal(err)
	}
	token, err := authn.Issue(a.ID)
	if err != nil {
		t.Fatal(err)
	}
	return profileHTTPFixture{st, New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler(), authn, a, b, token}
}

func (f profileHTTPFixture) call(t *testing.T, method, path string, input any, authorization string) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
	r.RemoteAddr = "192.0.2.152:1"
	if authorization != "" {
		r.Header.Set("Authorization", authorization)
	}
	w := httptest.NewRecorder()
	f.handler.ServeHTTP(w, r)
	return w
}

func decodeProfileHTTP(t *testing.T, w *httptest.ResponseRecorder) model.PlayerProfile {
	t.Helper()
	if w.Code != 200 {
		t.Fatalf("profile request: %d %s", w.Code, w.Body.String())
	}
	var p model.PlayerProfile
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestPlayerProfileHTTPAuthAndDemoReadCompatibility(t *testing.T) {
	for _, allowed := range []string{"true", "false"} {
		t.Run("demo="+allowed, func(t *testing.T) {
			t.Setenv("ALLOW_ANONYMOUS_DEMO", allowed)
			f := newProfileHTTPFixture(t)
			ctx := context.Background()
			input := model.PlayerProfile{Goal: "travel", CEFRLevel: "B1", DailyMinutes: 15, TargetBand: 7, Interests: []string{"travel"}}
			before, err := f.store.SavePlayerProfile(ctx, f.store.DemoID(), input)
			if err != nil {
				t.Fatal(err)
			}
			read := f.call(t, "GET", "/v1/player/profile", nil, "")
			if allowed == "true" {
				if got := decodeProfileHTTP(t, read); !reflect.DeepEqual(got, before) {
					t.Fatal("demo-compatible GET changed", got, before)
				}
			} else if read.Code != 401 {
				t.Fatal("disabled anonymous GET accepted", read.Code)
			}
			expired, err := auth.New("profile-http-only", -time.Hour).Issue(f.a.ID)
			if err != nil {
				t.Fatal(err)
			}
			unknown, err := f.auth.Issue("missing-profile-owner")
			if err != nil {
				t.Fatal(err)
			}
			input.Goal = "work"
			for _, header := range []string{"", "Basic ignored", "Bearer", "Bearer invalid", "Bearer " + expired, "Bearer " + unknown} {
				if w := f.call(t, "PUT", "/v1/player/profile", input, header); w.Code != 401 {
					t.Fatalf("unauthenticated profile write: %d %s", w.Code, w.Body.String())
				}
				got, err := f.store.GetPlayerProfile(ctx, f.store.DemoID())
				if err != nil || !reflect.DeepEqual(got, before) {
					t.Fatal("rejected PUT changed demo", got, before, err)
				}
			}
			// A real owner can still read and save when anonymous demo is disabled.
			got := decodeProfileHTTP(t, f.call(t, "PUT", "/v1/player/profile", input, "Bearer "+f.token))
			if got.UserID != f.a.ID || got.Goal != "work" {
				t.Fatal("signed-in profile save failed", got)
			}
			if read := decodeProfileHTTP(t, f.call(t, "GET", "/v1/player/profile", nil, "Bearer "+f.token)); !reflect.DeepEqual(read, got) {
				t.Fatal("owner GET did not restore saved profile", read, got)
			}
		})
	}
}

func TestPlayerProfileHTTPOwnerNormalizationAndNoLearningMutation(t *testing.T) {
	f := newProfileHTTPFixture(t)
	ctx := context.Background()
	other, err := f.store.SavePlayerProfile(ctx, f.b.ID, model.PlayerProfile{Goal: "conversation", CEFRLevel: "B1", DailyMinutes: 15, TargetBand: 7, Interests: []string{"daily-life"}})
	if err != nil {
		t.Fatal(err)
	}
	initialDaily := f.call(t, "GET", "/v1/player/daily", nil, "Bearer "+f.token)
	if initialDaily.Code != 200 {
		t.Fatal("snapshot fixture", initialDaily.Code, initialDaily.Body.String())
	}
	var daily model.DailyRun
	if err := json.Unmarshal(initialDaily.Body.Bytes(), &daily); err != nil {
		t.Fatal(err)
	}
	beforePlan, err := f.store.GetDailyPlan(ctx, f.a.ID, daily.Date)
	if err != nil {
		t.Fatal(err)
	}
	beforeUser, err := f.store.GetUser(ctx, f.a.ID)
	if err != nil {
		t.Fatal(err)
	}
	beforeSkills, err := f.store.Skills(ctx, f.a.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name      string
		input     model.PlayerProfile
		goal      string
		level     string
		minutes   int
		band      float64
		interests []string
	}{
		{"upper clamps and interests", model.PlayerProfile{UserID: f.b.ID, Goal: " WORK ", CEFRLevel: " b2 ", DailyMinutes: 999, TargetBand: 99, Interests: []string{" Travel ", "travel", "", "TECHNOLOGY", "work", "daily-life", "movies", "gaming", "education", "business", "ninth"}}, "work", "B2", 120, 9, []string{"travel", "technology", "work", "daily-life", "movies", "gaming", "education", "business"}},
		{"lower clamps", model.PlayerProfile{UserID: f.b.ID, Goal: " TRAVEL ", CEFRLevel: " a1 ", DailyMinutes: -10, TargetBand: 1, Interests: []string{}}, "travel", "A1", 5, 4, []string{}},
		{"half band", model.PlayerProfile{UserID: f.b.ID, Goal: " IELTS ", CEFRLevel: " c1 ", DailyMinutes: 20, TargetBand: 6.26, Interests: []string{" DAILY-LIFE "}}, "ielts", "C1", 20, 6.5, []string{"daily-life"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := decodeProfileHTTP(t, f.call(t, "PUT", "/v1/player/profile", test.input, "Bearer "+f.token))
			if got.UserID != f.a.ID || got.Goal != test.goal || got.CEFRLevel != test.level || got.DailyMinutes != test.minutes || got.TargetBand != test.band || !reflect.DeepEqual(got.Interests, test.interests) || !got.Onboarded || got.UpdatedAt.IsZero() {
				t.Fatal("profile identity/normalization changed", got)
			}
			if read := decodeProfileHTTP(t, f.call(t, "GET", "/v1/player/profile", nil, "Bearer "+f.token)); !reflect.DeepEqual(read, got) {
				t.Fatal("normalized save did not survive GET", read, got)
			}
			b, err := f.store.GetPlayerProfile(ctx, f.b.ID)
			if err != nil || !reflect.DeepEqual(b, other) {
				t.Fatal("body userId targeted foreign owner", b, other, err)
			}
		})
	}
	afterUser, err := f.store.GetUser(ctx, f.a.ID)
	if err != nil {
		t.Fatal(err)
	}
	afterSkills, err := f.store.Skills(ctx, f.a.ID)
	if err != nil {
		t.Fatal(err)
	}
	afterPlan, err := f.store.GetDailyPlan(ctx, f.a.ID, daily.Date)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(beforeUser, afterUser) || !reflect.DeepEqual(beforeSkills, afterSkills) || !reflect.DeepEqual(beforePlan, afterPlan) {
		t.Fatal("profile preference awarded learning progress or moved daily snapshot")
	}
}

func TestPlayerProfileHTTPInvalidFieldsPreserveSavedPreferences(t *testing.T) {
	f := newProfileHTTPFixture(t)
	input := model.PlayerProfile{Goal: "work", CEFRLevel: "B2", DailyMinutes: 30, TargetBand: 7, Interests: []string{"work"}}
	before := decodeProfileHTTP(t, f.call(t, "PUT", "/v1/player/profile", input, "Bearer "+f.token))
	for _, field := range []string{"goal", "cefrLevel"} {
		bad := input
		if field == "goal" {
			bad.Goal = "not-a-goal"
		} else {
			bad.CEFRLevel = "not-a-level"
		}
		if w := f.call(t, "PUT", "/v1/player/profile", bad, "Bearer "+f.token); w.Code != 400 {
			t.Fatal("invalid field accepted", field, w.Code)
		}
		if got := decodeProfileHTTP(t, f.call(t, "GET", "/v1/player/profile", nil, "Bearer "+f.token)); !reflect.DeepEqual(got, before) {
			t.Fatal("invalid field mutated preferences", field, got, before)
		}
	}
}
