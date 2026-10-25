"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APIError } from "@/lib/api";
import { getAuthToken } from "@/lib/session";

export type AccountResource<T> = {
  data: T | null;
  status: "loading" | "guest" | "ready" | "error";
  needsSignIn: boolean;
  refresh: () => void;
};

/** Every request captures its owner. A newer read or mutation invalidates older reads. */
export default function useAccountResource<T>(token: string | null, load: (token: string) => Promise<T>, keepDataOnRefresh = false) {
  const sequence = useRef(0);
  const [state, setState] = useState<{
    token: string;
    data: T | null;
    status: "loading" | "ready" | "error";
    needsSignIn: boolean;
  }>({ token: "", data: null, status: "loading", needsSignIn: false });

  const refresh = useCallback(() => {
    const request = ++sequence.current;
    if (!token || token !== getAuthToken()) return;
    setState(previous => ({ token, data: keepDataOnRefresh && previous.token === token ? previous.data : null, status: "loading", needsSignIn: false }));
    void load(token).then(data => {
      if (request === sequence.current && token === getAuthToken()) setState({ token, data, status: "ready", needsSignIn: false });
    }).catch(error => {
      const needsSignIn = error instanceof APIError && (error.status === 401 || error.status === 403);
      if (request === sequence.current && token === getAuthToken()) setState(previous => ({
        token, data: !needsSignIn && keepDataOnRefresh && previous.token === token ? previous.data : null, status: "error",
        needsSignIn,
      }));
    });
  }, [token, load, keepDataOnRefresh]);

  useEffect(() => {
    refresh();
    return () => { sequence.current++; };
  }, [refresh]);

  const invalidate = useCallback(() => {
    sequence.current++;
    // A cancelled background refresh must not leave a cached view stuck in
    // loading after a mutation needs an explicit read-back.
    setState(previous => previous.data ? { ...previous, status: "ready" } : previous);
  }, []);
  const replace = useCallback((owner: string, data: T) => {
    if (owner !== token || owner !== getAuthToken()) return false;
    sequence.current++;
    setState({ token: owner, data, status: "ready", needsSignIn: false });
    return true;
  }, [token]);

  const controls = { refresh, invalidate, replace };
  if (token === null) return { data: null, status: "loading" as const, needsSignIn: false, ...controls };
  if (!token) return { data: null, status: "guest" as const, needsSignIn: false, ...controls };
  if (state.token !== token || token !== getAuthToken()) return { data: null, status: "loading" as const, needsSignIn: false, ...controls };
  return { data: state.data, status: state.status, needsSignIn: state.needsSignIn, ...controls };
}
