import { describe, expect, it } from "vitest";
import type { Task } from "../types/task";
import {
  computeDashboardMetrics,
  formatShortDate,
  getUserInitials,
} from "./formatters";

describe("formatters", () => {
  it("formats ISO dates in pt-BR via Intl without timezone shift", () => {
    expect(formatShortDate("2026-11-27")).toBe("27 nov 2026");
    expect(formatShortDate("2026-01-05T23:59:00Z")).toBe("05 jan 2026");
    expect(formatShortDate(null)).toBe("Sem prazo");
    expect(formatShortDate(undefined)).toBe("Sem prazo");
  });

  it("extracts readable user initials from email or username", () => {
    expect(getUserInitials("estudante.demo@ufersa.edu.br")).toBe("ED");
    expect(getUserInitials("maria")).toBe("MA");
    expect(getUserInitials(null)).toBe("AF");
  });

  it("computes dashboard task metrics in a single pass", () => {
    const sample: Task[] = [
      {
        id: "1",
        title: "Entrega tardia",
        description: "",
        dueDate: "2026-12-01",
        priority: "high",
        status: "pending",
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
      {
        id: "2",
        title: "Entrega próxima",
        description: "",
        dueDate: "2026-11-25",
        priority: "medium",
        status: "in_progress",
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
      {
        id: "3",
        title: "Concluída",
        description: "",
        dueDate: "2026-11-20",
        priority: "high",
        status: "done",
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
    ];

    const m = computeDashboardMetrics(sample);
    expect(m.totalTasks).toBe(3);
    expect(m.pendingCount).toBe(1);
    expect(m.inProgressCount).toBe(1);
    expect(m.doneCount).toBe(1);
    expect(m.highPendingCount).toBe(1);
    expect(m.openHighCount).toBe(1);
    expect(m.openMediumCount).toBe(1);
    expect(m.openLowCount).toBe(0);
    expect(m.nextDueTask?.id).toBe("2");
    expect(m.activeTasks.map((t) => t.id)).toEqual(["1", "2"]);
  });
});
