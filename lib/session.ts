export const AUTH_EVENT = "loccao-auth-change";
export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem("loccao_token") || ""; } catch { return ""; }
}
export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem("loccao_token", token);
    else localStorage.removeItem("loccao_token");
  } catch { throw new Error("Your browser could not save the sign-in. Allow site storage and try again."); }
  window.dispatchEvent(new Event(AUTH_EVENT));
}
