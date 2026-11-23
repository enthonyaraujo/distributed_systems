import type { Task, TaskPriority, TaskStatus } from "../types/task";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formata datas ISO (YYYY-MM-DD ou timestamp ISO) em pt-BR via Intl.DateTimeFormat
 * sem desvio de fuso horário.
 */
export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Sem prazo";
  const datePart = isoDate.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return datePart;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return datePart;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const parts = SHORT_DATE_FORMATTER.formatToParts(utcDate);
  const d = parts.find((p) => p.type === "day")?.value ?? match[3];
  const m = (parts.find((p) => p.type === "month")?.value ?? "").replace(
    /\.$/,
    ""
  );
  const y = parts.find((p) => p.type === "year")?.value ?? match[1];
  return `${d} ${m} ${y}`;
}

export function getUserInitials(label: string | null | undefined): string {
  if (!label) return "AF";
  const clean = label.trim();
  if (!clean) return "AF";
  const base = clean.includes("@") ? clean.split("@")[0] : clean;
  const tokens = base.split(/[._\-\s]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluída",
};

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface DashboardTaskMetrics {
  totalTasks: number;
  pendingCount: number;
  inProgressCount: number;
  doneCount: number;
  highPendingCount: number;
  openHighCount: number;
  openMediumCount: number;
  openLowCount: number;
  completionPct: number;
  inProgressPct: number;
  pendingPct: number;
  activeTasks: Task[];
  nextDueTask: Task | null;
}

/**
 * Consolida todas as contagens e o próximo foco acadêmico em uma única passagem O(n).
 */
export function computeDashboardMetrics(tasks: Task[]): DashboardTaskMetrics {
  let pendingCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;
  let highPendingCount = 0;
  let openHighCount = 0;
  let openMediumCount = 0;
  let openLowCount = 0;
  const activeTasks: Task[] = [];
  let nearestDated: Task | null = null;
  let firstOpen: Task | null = null;

  for (const task of tasks) {
    if (task.status === "done") {
      doneCount += 1;
      continue;
    }

    if (task.status === "pending") {
      pendingCount += 1;
      if (task.priority === "high") highPendingCount += 1;
    } else if (task.status === "in_progress") {
      inProgressCount += 1;
    }

    if (task.priority === "high") openHighCount += 1;
    else if (task.priority === "medium") openMediumCount += 1;
    else openLowCount += 1;

    if (!firstOpen) firstOpen = task;
    if (activeTasks.length < 5) activeTasks.push(task);

    if (
      task.dueDate &&
      (!nearestDated ||
        task.dueDate.localeCompare(nearestDated.dueDate ?? "") < 0)
    ) {
      nearestDated = task;
    }
  }

  const totalTasks = tasks.length;
  const completionPct =
    totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
  const inProgressPct =
    totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0;
  const pendingPct =
    totalTasks > 0 ? Math.max(0, 100 - completionPct - inProgressPct) : 0;

  return {
    totalTasks,
    pendingCount,
    inProgressCount,
    doneCount,
    highPendingCount,
    openHighCount,
    openMediumCount,
    openLowCount,
    completionPct,
    inProgressPct,
    pendingPct,
    activeTasks,
    nextDueTask: nearestDated ?? firstOpen,
  };
}
