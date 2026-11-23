import { describe, expect, it, vi } from "vitest";
import {
  AuthSessionExpiredError,
  TasksApiClient,
} from "./tasksApi";

describe("TasksApiClient", () => {
  it("attaches Authorization Bearer access token and parses list response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(String(input)).toBe("https://api.example.test/tasks");
      expect(headers.get("Authorization")).toBe("Bearer fake-access-token");
      return new Response(JSON.stringify({ items: [{ id: "1", title: "T1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new TasksApiClient({
      apiUrl: "https://api.example.test/",
      getAccessToken: () => "fake-access-token",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const items = await client.listTasks();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("1");
  });

  it("invokes onUnauthorized and throws AuthSessionExpiredError on 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Expired" } }),
        { status: 401 }
      );
    });

    const client = new TasksApiClient({
      apiUrl: "https://api.example.test",
      getAccessToken: () => "expired-token",
      onUnauthorized,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(client.listTasks()).rejects.toBeInstanceOf(
      AuthSessionExpiredError
    );
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("handles 400 validation envelope and 204 delete cleanly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "VALIDATION_ERROR", message: "Title is required." },
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new TasksApiClient({
      apiUrl: "https://api.example.test",
      getAccessToken: () => "valid-token",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.createTask({ title: "", priority: "medium", status: "pending" })
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Title is required.",
    });

    await expect(client.deleteTask("task-123")).resolves.toBeUndefined();
  });
});
