import { describe, expect, it, vi } from "vitest";
import { PageConflictError, PagesApiClient } from "./pagesApi";
import { AuthSessionExpiredError } from "./tasksApi";

describe("PagesApiClient", () => {
  it("sends Bearer access token and lists page summaries", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(String(input)).toBe("https://api.example.test/pages");
      expect(headers.get("Authorization")).toBe("Bearer access-token-a");
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "p1",
              title: "Notas de SD",
              icon: "📘",
              version: 1,
              createdAt: "2026-11-22T18:00:00Z",
              updatedAt: "2026-11-22T18:00:00Z",
            },
          ],
        }),
        { status: 200 }
      );
    });

    const client = new PagesApiClient({
      apiUrl: "https://api.example.test/",
      getAccessToken: () => "access-token-a",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const pages = await client.listPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Notas de SD");
  });

  it("throws PageConflictError on 409 optimistic version conflict", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "VERSION_CONFLICT",
            message: "Page was modified by another session.",
          },
        }),
        { status: 409 }
      );
    });

    const client = new PagesApiClient({
      apiUrl: "https://api.example.test",
      getAccessToken: () => "access-token-a",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.updatePage("p1", { title: "Conflito", expectedVersion: 1 })
    ).rejects.toBeInstanceOf(PageConflictError);
  });

  it("handles 401 session expiration and 204 delete", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "Expired" },
          }),
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new PagesApiClient({
      apiUrl: "https://api.example.test",
      getAccessToken: () => "token",
      onUnauthorized,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getPage("p1")).rejects.toBeInstanceOf(
      AuthSessionExpiredError
    );
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(client.deletePage("p1")).resolves.toBeUndefined();
  });
});
