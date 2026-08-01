import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("leaves bodyless request headers alone and normalizes the method", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api<{ ok: boolean }>("/health", { method: "head" })).resolves.toEqual({ ok: true });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("HEAD");
    expect(new Headers(options.headers).has("Content-Type")).toBe(false);
  });

  it("adds JSON content type for a body while preserving caller headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/jobs", {
      method: "post",
      body: "{}",
      headers: { Authorization: "Bearer test-token" },
    });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(options.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("does not replace an explicit content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/upload", { body: "raw", headers: { "Content-Type": "text/plain" } });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get("Content-Type")).toBe("text/plain");
  });

  it("reports response text for an unsuccessful request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("job missing", { status: 404, statusText: "Not Found" })));

    await expect(api("/missing")).rejects.toThrow("API 404: job missing");
  });

  it("falls back to status text when reading the error body fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Unavailable",
      text: vi.fn().mockRejectedValue(new Error("stream failed")),
    }));

    await expect(api("/down")).rejects.toThrow("API 503: Unavailable");
  });
});
