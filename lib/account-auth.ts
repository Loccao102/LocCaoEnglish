import { apiFetch } from "./api";

type AuthResult = { token: string; user: { displayName: string; email: string } };

/** The caller commits a response only while its sign-in intent is still current. */
export async function requestAuthentication(mode: "login" | "register", input: { email: string; password: string; displayName: string }): Promise<AuthResult> {
  const result = await apiFetch<AuthResult>(`/v1/auth/${mode}`, {
    method: "POST", headers: { Authorization: "" },
    body: JSON.stringify(mode === "register" ? input : { email: input.email, password: input.password }),
  });
  if (!result || typeof result.token !== "string" || !result.token.trim() || !result.user || typeof result.user.displayName !== "string" || typeof result.user.email !== "string") {
    throw new Error("Sign-in could not be confirmed. Please try again.");
  }
  return result;
}
