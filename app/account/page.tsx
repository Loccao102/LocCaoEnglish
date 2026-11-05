"use client";

import PlayerProfilePanel from "@/components/PlayerProfilePanel";
import AuthPanel from "@/components/AuthPanel";
import useSignedInToken from "@/components/learning/useSignedInToken";

export default function AccountPage() {
  const token = useSignedInToken();
  return <div className="page-wrap"><AuthPanel/>{token && <PlayerProfilePanel key={token}/>}</div>;
}
