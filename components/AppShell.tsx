"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import LearningCompanion from "@/components/game/LearningCompanion";

const navigation = [["/camp", "Learning journal"], ["/learn", "Lessons"], ["/progress", "Progress"], ["/review", "Review"], ["/account", "Account"]];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (["/", "/play", "/worlds"].includes(pathname) || pathname.startsWith("/festival/")) return <main className="adventure-shell">{children}</main>;
  return <div className="study-shell"><header className="study-header"><Link href="/" className="study-return"><img src="/assets/sunlit-village/village-mark.svg" alt="" width="35" height="35"/><span>← Back to village</span></Link><nav aria-label="Learning navigation">{navigation.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav></header><main className="study-content"><LearningCompanion pathname={pathname}/>{children}</main></div>;
}
