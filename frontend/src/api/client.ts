const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  // Do NOT set Content-Type for GET/HEAD with no body (avoids preflight)
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody = options.body != null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    method,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}
