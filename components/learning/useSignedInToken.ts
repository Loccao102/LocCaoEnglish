"use client";

import { useEffect, useState } from "react";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";

/** null means browser identity has not been read yet; an empty string is signed out. */
export default function useSignedInToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const changed = () => setToken(getAuthToken());
    const storage = (event: StorageEvent) => {
      if (event.key === "loccao_token" || event.key === null) changed();
    };
    changed();
    window.addEventListener(AUTH_EVENT, changed);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(AUTH_EVENT, changed);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return token;
}
