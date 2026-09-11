package realtime
import("context";"testing")
func TestMemoryChallengeCompletesWithWinner(t *testing.T){s:=New("");ctx:=context.Background();ch,err:=s.CreateChallenge(ctx,"u1","One","Sprint","Vocabulary","word-link");if err!=nil{t.Fatal(err)};if _,err=s.Submit(ctx,ch.ID,"u1","One",80);err!=nil{t.Fatal(err)};done,err:=s.Submit(ctx,ch.ID,"u2","Two",95);if err!=nil{t.Fatal(err)};if done.Status!="completed"||done.WinnerID!="u2"{t.Fatalf("unexpected challenge result: %+v",done)}}
