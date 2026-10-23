"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { APIError, getDashboard, getPlan, type Dashboard, type SkillPractice } from "@/lib/api";
import { getAuthToken } from "@/lib/session";
import useSignedInToken from "./useSignedInToken";

type AccountResource<T> = {
  data: T | null;
  status: "loading" | "guest" | "ready" | "error";
  needsSignIn: boolean;
  refresh: () => void;
};

function useAccountResource<T>(token: string | null, load: () => Promise<T>): AccountResource<T> {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    token: string;
    data: T | null;
    status: "loading" | "ready" | "error";
    needsSignIn: boolean;
  }>({ token: "", data: null, status: "loading", needsSignIn: false });

  useEffect(() => {
    let active = true;
    if (!token) return;
    setState({ token, data: null, status: "loading", needsSignIn: false });
    load().then(data => {
      if (active && token === getAuthToken()) setState({ token, data, status: "ready", needsSignIn: false });
    }).catch(error => {
      if (active && token === getAuthToken()) setState({
        token, data: null, status: "error",
        needsSignIn: error instanceof APIError && (error.status === 401 || error.status === 403),
      });
    });
    return () => { active = false; };
  }, [token, revision, load]);

  const refresh = () => setRevision(value => value + 1);
  if (token === null) return { data: null, status: "loading", needsSignIn: false, refresh };
  if (!token) return { data: null, status: "guest", needsSignIn: false, refresh };
  if (state.token !== token || token !== getAuthToken()) return { data: null, status: "loading", needsSignIn: false, refresh };
  return { data: state.data, status: state.status, needsSignIn: state.needsSignIn, refresh };
}

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

async function loadPracticePlan() {
  const plan = await getPlan();
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
