import { apiFetch, type Lesson, type Me } from "@/lib/api";

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

export function getContentMe(token: string) {
  return apiFetch<Me>("/v1/me", { headers: headers(token) });
}

export function getAdminLessons(token: string) {
  return apiFetch<{ items: Lesson[] | null }>("/v1/admin/lessons", { headers: headers(token) });
}

export function saveAdminLesson(lesson: Partial<Lesson>, token: string) {
  return apiFetch<Lesson>("/v1/admin/lessons", { method: "POST", headers: headers(token), body: JSON.stringify(lesson) });
}

export async function deleteAdminLesson(slug: string, token: string) {
  const result = await apiFetch<{ ok: boolean }>(`/v1/admin/lessons/${encodeURIComponent(slug)}`, { method: "DELETE", headers: headers(token) });
  if (result?.ok !== true) throw new Error("Deletion was not confirmed");
  return result;
}
