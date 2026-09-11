import PlayerProfilePanel from "@/components/PlayerProfilePanel";
import AuthPanel from "@/components/AuthPanel";

export default function AccountPage(){return <div className="page-wrap"><PlayerProfilePanel/><details className="sync-drawer"><summary>Account & sync</summary><div className="sync-drawer-body"><AuthPanel/></div></details></div>}
