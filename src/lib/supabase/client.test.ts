// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { keepaliveAwareFetch } from "./client";

/**
 * Regression test for a live bug: uploadArticleImage's file uploads share
 * this same browser Supabase client with every other (small, JSON-bodied)
 * write, which requests `keepalive` so an in-flight save survives a page
 * unload. Every browser enforces a ~64KB cap on keepalive request bodies
 * per the Fetch spec, and Safari fails the request outright once a real
 * photo exceeds it — this test locks in the fix: keepalive only for
 * string (JSON) bodies, never for File/Blob/FormData bodies.
 */
describe("keepaliveAwareFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests keepalive for a plain JSON string body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    await keepaliveAwareFetch("https://example.com/rest/v1/foo", { method: "POST", body: JSON.stringify({ a: 1 }) });

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/rest/v1/foo", expect.objectContaining({ keepalive: true }));
  });

  it("does not request keepalive for a FormData/file body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
    const form = new FormData();
    form.append("file", new File(["a".repeat(200_000)], "photo.png", { type: "image/png" }));

    await keepaliveAwareFetch("https://example.com/storage/v1/object/insights-images/foo.png", { method: "POST", body: form });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/storage/v1/object/insights-images/foo.png",
      expect.objectContaining({ keepalive: false })
    );
  });

  it("does not request keepalive for a bodyless GET", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    await keepaliveAwareFetch("https://example.com/rest/v1/foo");

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/rest/v1/foo", expect.objectContaining({ keepalive: false }));
  });
});
