import { fetchWithCsrf } from "../../lib/api";

export type EmailItem = {
  id: string;
  sender: string;
  subject: string;
  session_id: string | null;
  received_at: string;
};

export async function fetchEmails(): Promise<EmailItem[]> {
  const res = await fetchWithCsrf("/api/emails");
  if (!res.ok) throw new Error("Failed to fetch emails");
  const data = await res.json();
  return data.emails;
}

export async function checkEmails(): Promise<void> {
  const res = await fetchWithCsrf("/api/emails/check", { method: "POST" });
  if (!res.ok) throw new Error("Failed to check emails");
}

export async function openEmail(id: string): Promise<string> {
  const res = await fetchWithCsrf(`/api/emails/${id}/open`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to open email");
  const data = await res.json();
  return data.sessionId;
}
