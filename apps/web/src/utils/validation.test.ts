import { describe, expect, it } from "vitest";
import { validateTaskForm } from "./validation";

describe("validateTaskForm", () => {
  it("accepts valid task input", () => {
    expect(
      validateTaskForm({
        title: "Estudar DNS",
        description: "Validar ACM",
        dueDate: "2026-11-27",
        priority: "high",
        status: "pending",
      })
    ).toBeNull();
  });

  it("rejects empty title, oversized description and invalid calendar dates", () => {
    expect(
      validateTaskForm({ title: "   ", priority: "low", status: "pending" })
    ).toBeTruthy();
    expect(
      validateTaskForm({
        title: "Ok",
        description: "a".repeat(1001),
        priority: "low",
        status: "pending",
      })
    ).toBeTruthy();
    expect(
      validateTaskForm({
        title: "Ok",
        dueDate: "2026-02-30",
        priority: "low",
        status: "pending",
      })
    ).toBeTruthy();
  });
});
