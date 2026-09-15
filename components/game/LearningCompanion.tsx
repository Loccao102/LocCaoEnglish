"use client";

import Link from "next/link";
import { companionForPath } from "@/lib/game/companions";
import CompanionPortrait from "./CompanionPortrait";

export default function LearningCompanion({ pathname }: { pathname: string }) {
  const friend=companionForPath(pathname);
  if(!friend)return null;
  return <aside className="learning-companion"><CompanionPortrait id={friend.id}/><div><span>{friend.activity} · with {friend.name}</span><p>{friend.greeting}</p></div><Link href="/characters">Meet the friends ↗</Link></aside>;
}
