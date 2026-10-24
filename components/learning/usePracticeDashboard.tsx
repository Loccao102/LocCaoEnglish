"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDashboard, getPlan, type Dashboard, type SkillPractice } from "@/lib/api";
import useSignedInToken from "./useSignedInToken";
import useAccountResource, { type AccountResource } from "./useAccountResource";

const PracticeDashboardContext = createContext<(AccountResource<Dashboard> & { token: string | null }) | null>(null);

export function PracticeDashboardProvider({ children }: { children: ReactNode }) {
  const token = useSignedInToken();
  const dashboard = useAccountResource(token, getDashboard);
  return <PracticeDashboardContext.Provider value={{ ...dashboard, token }}>{children}</PracticeDashboardContext.Provider>;
}

export default function usePracticeDashboard() {
  const state = useContext(PracticeDashboardContext);
  if (!state) throw new Error("Practice dashboard needs its account provider.");
  return state;
}

export function usePracticePlan() {
  const { token } = usePracticeDashboard();
  return useAccountResource(token, loadPracticePlan);
}

async function loadPracticePlan(token: string) {
  const plan = await getPlan(token);
  if (plan.method !== "skill-practice.v1") throw new Error("Practice suggestions need an updated summary.");
  return plan;
}

/** Older API responses must never fall back to seeded or legacy confidence. */
export function currentSkillPractice(value?: SkillPractice): SkillPractice | null {
  if (!value || value.method !== "skill-practice.v1" || value.windowSize !== 20) return null;
  if (!Number.isInteger(value.sampleCount) || !Number.isInteger(value.correctCount)
    || value.sampleCount < 0 || value.sampleCount > value.windowSize
    || value.correctCount < 0 || value.correctCount > value.sampleCount) return null;
  if (!["guided-practice", "transcript-match", "not-supported"].includes(value.evidenceKind)) return null;
  if (value.sampleCount === 0 && value.lastCompletedAt !== null) return null;
  if (value.sampleCount > 0 && value.lastCompletedAt === null) return null;
  if (value.evidenceKind === "not-supported" && value.sampleCount !== 0) return null;
  if (value.lastCompletedAt !== null && !Number.isFinite(Date.parse(value.lastCompletedAt))) return null;
  return value;
}
