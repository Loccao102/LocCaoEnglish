"use client";

import { useEffect, useRef, useState } from "react";
import { equipCosmetic, getProgression, type Cosmetic } from "@/lib/api";
import { getAuthToken } from "@/lib/session";
import useSignedInToken from "./useSignedInToken";
import useAccountResource from "./useAccountResource";

export default function useAccountProgression() {
  const token = useSignedInToken();
  const resource = useAccountResource(token, getProgression, true);
  const mutations = useRef(0);
  const pendingOwner = useRef("");
  const [mutation, setMutation] = useState({ token: "", equipping: "", unconfirmed: false, recovering: false, error: "" });

  useEffect(() => {
    mutations.current++;
    pendingOwner.current = "";
    setMutation({ token: token ?? "", equipping: "", unconfirmed: false, recovering: false, error: "" });
  }, [token]);

  const current = mutation.token === token && token === getAuthToken() ? mutation : null;
  async function equip(item: Cosmetic) {
    if (!token || token !== getAuthToken() || pendingOwner.current === token || !resource.data || !item.unlocked || item.equipped || current?.unconfirmed) return;
    const owner = token, request = ++mutations.current;
    pendingOwner.current = owner;
    resource.invalidate();
    setMutation({ token: owner, equipping: item.id, unconfirmed: false, recovering: false, error: "" });
    try {
      const next = await equipCosmetic(item.id, owner);
      if (request !== mutations.current || owner !== getAuthToken()) return;
      pendingOwner.current = "";
      if (resource.replace(owner, next)) setMutation({ token: owner, equipping: "", unconfirmed: false, recovering: false, error: "" });
    } catch {
      if (request !== mutations.current || owner !== getAuthToken()) return;
      pendingOwner.current = "";
      resource.invalidate();
      setMutation({ token: owner, equipping: "", unconfirmed: true, recovering: false, error: "Equipment change could not be confirmed. Refresh your rewards before trying again." });
    }
  }

  function refresh() {
    if (current?.equipping) return;
    // Reading back the saved loadout resolves an uncertain PUT; another PUT is
    // blocked until that read succeeds, including after a failed refresh.
    if (current?.unconfirmed) setMutation(previous => ({ ...previous, recovering: true }));
    resource.refresh();
  }

  useEffect(() => {
    if (resource.status === "ready" && current?.unconfirmed && current.recovering) setMutation(previous => ({ ...previous, unconfirmed: false, recovering: false, error: "" }));
  }, [resource.status, current?.unconfirmed, current?.recovering]);

  return { ...resource, token, refresh, equip, equipping: current?.equipping ?? "", equipmentError: current?.error ?? "", unconfirmed: current?.unconfirmed ?? false };
}
