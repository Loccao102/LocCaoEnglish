package httpapi

import (
	"context"
	"encoding/json"
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

func TestVocabularyLoadoutRequiresOwnerAndPreservesDemoReadPolicy(t *testing.T) {
	t.Setenv("ALLOW_ANONYMOUS_DEMO", "true")
	ctx := context.Background()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	social := realtime.New("")
	defer social.Close()
	authn := auth.New("vocabulary-http-only", time.Hour)
	handler := New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler()
	u, err := st.CreateUser(ctx, "vocabulary-http@example.test", "hash", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	other, err := st.CreateUser(ctx, "vocabulary-http-other@example.test", "hash", "Other")
	if err != nil {
		t.Fatal(err)
	}
	token, _ := authn.Issue(u.ID)
	otherToken, _ := authn.Issue(other.ID)
	call := func(method, path, body, bearer string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.RemoteAddr = "192.0.2.145:1"
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	decodeState := func(w *httptest.ResponseRecorder) model.ProgressionState {
		t.Helper()
		if w.Code != 200 {
			t.Fatal("progression request", w.Code, w.Body.String())
		}
		var state model.ProgressionState
		if err := json.Unmarshal(w.Body.Bytes(), &state); err != nil {
			t.Fatal(err)
		}
		return state
	}
	demoBefore := decodeState(call("GET", "/v1/player/progression", "", ""))
	for _, bearer := range []string{"", "invalid-token"} {
		if w := call("PUT", "/v1/player/loadout", `{"cosmeticId":"rookie-title"}`, bearer); w.Code != 401 {
			t.Fatal("unauthenticated demo loadout mutation accepted", w.Code, w.Body.String())
		}
	}
	if got := decodeState(call("GET", "/v1/player/progression", "", "")); !reflect.DeepEqual(got, demoBefore) {
		t.Fatal("guest equip changed demo state")
	}
	newState := decodeState(call("GET", "/v1/player/progression", "", token))
	for _, c := range newState.Inventory {
		if c.ID == "wordsmith-pin" && (c.Unlocked || c.Unlock == nil || c.Unlock.Receipt != nil) {
			t.Fatal("seeded confidence granted a pin", c)
		}
	}
	if w := call("PUT", "/v1/player/loadout", `{"cosmeticId":"wordsmith-pin"}`, token); w.Code != 409 {
		t.Fatal("locked pin equip accepted", w.Code, w.Body.String())
	}
	for i := 0; i < 2; i++ {
		state := decodeState(call("PUT", "/v1/player/loadout", `{"cosmeticId":"rookie-title"}`, token))
		equipped := false
		for _, c := range state.Inventory {
			if c.ID == "rookie-title" {
				equipped = c.Equipped
			}
		}
		if !equipped {
			t.Fatal("owner equip was not confirmed")
		}
	}
	for _, c := range decodeState(call("GET", "/v1/player/progression", "", otherToken)).Inventory {
		if c.Equipped {
			t.Fatal("loadout leaked to other owner", c)
		}
	}
	t.Setenv("ALLOW_ANONYMOUS_DEMO", "false")
	if w := call("GET", "/v1/player/progression", "", ""); w.Code != 401 {
		t.Fatal("disabled anonymous demo read accepted", w.Code)
	}
	if w := call("PUT", "/v1/player/loadout", `{"cosmeticId":"rookie-title"}`, ""); w.Code != 401 {
		t.Fatal("guest equip accepted without demo mode", w.Code)
	}
}
