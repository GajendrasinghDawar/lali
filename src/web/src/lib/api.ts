let cachedCsrfToken: string | null = null;

export async function initCsrfToken(): Promise<void> {
  if (cachedCsrfToken) return;
  const res = await fetch("/csrf-token");
  const data = await res.json();
  cachedCsrfToken = data.csrfToken;
}

export async function getCsrfToken(): Promise<string> {
  if (!cachedCsrfToken) await initCsrfToken();
  return cachedCsrfToken!;
}

export async function fetchWithCsrf(url: string, options: RequestInit = {}) {
  const token = await getCsrfToken();
  const headers = new Headers(options.headers || {});
  headers.set("x-csrf-token", token);
  
  return fetch(url, {
    ...options,
    headers,
  });
}

export async function uploadFile(sessionId: string, file: File): Promise<string> {
  const token = await getCsrfToken();
  const res = await fetch(`/api/artifacts?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: {
      "x-csrf-token": token,
      "x-file-name": encodeURIComponent(file.name),
      "x-file-type": file.type || "application/octet-stream",
      "Content-Type": "application/octet-stream"
    },
    body: file
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.id;
}

export async function approveEffect(id: string, digest: string): Promise<void> {
  const res = await fetchWithCsrf(`/api/effects/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ digest })
  });
  if (!res.ok) throw new Error("Failed to approve effect");
}

export async function rejectEffect(id: string): Promise<void> {
  const res = await fetchWithCsrf(`/api/effects/${id}/reject`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to reject effect");
}
