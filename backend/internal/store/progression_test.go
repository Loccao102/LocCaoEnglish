package store

import (
	"context"
	"testing"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestProgressionUsesRealPlayerState(t *testing.T){
	ctx:=context.Background();st,err:=New("");if err!=nil{t.Fatal(err)};defer st.Close();if err=st.EnsureProgression(ctx);err!=nil{t.Fatal(err)}
	u,err:=st.CreateUser(ctx,"progression@example.test","hash","Progression Tester");if err!=nil{t.Fatal(err)}
	state,err:=st.GetProgression(ctx,u.ID);if err!=nil{t.Fatal(err)};if !state.Worlds[0].Unlocked{t.Fatal("training grounds should always be open")};if state.Worlds[1].Unlocked{t.Fatal("travel should be locked for a new non-travel player")}
	_,err=st.SavePlayerProfile(ctx,u.ID,model.PlayerProfile{Goal:"travel",CEFRLevel:"B1",DailyMinutes:15,TargetBand:7,Interests:[]string{"travel"}});if err!=nil{t.Fatal(err)}
	state,err=st.GetProgression(ctx,u.ID);if err!=nil{t.Fatal(err)};if !state.Worlds[1].Unlocked{t.Fatal("travel goal should unlock Travel District")}
	if _,err=st.EquipCosmetic(ctx,u.ID,"ielts-aura");err==nil{t.Fatal("locked cosmetic must not be equippable")}
	if _,err=st.EquipCosmetic(ctx,u.ID,"rookie-title");err!=nil{t.Fatal(err)}
}
