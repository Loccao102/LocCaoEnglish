"use client";

import { useEffect, useState } from "react";
import PlayerProfilePanel from "@/components/PlayerProfilePanel";
import AuthPanel from "@/components/AuthPanel";

export default function AccountPage() {
  const [signedIn, setSignedIn] = useState(false), [revision, setRevision] = useState(0);
  function refresh() { try { setSignedIn(!!localStorage.getItem("loccao_token")); } catch { setSignedIn(false); } setRevision(value => value + 1); }
  useEffect(() => { refresh(); }, []);
  return <div className="page-wrap"><AuthPanel onAuthChange={refresh}/>{signedIn && <PlayerProfilePanel key={revision}/>}</div>;
}
