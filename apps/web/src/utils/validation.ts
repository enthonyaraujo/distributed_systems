import type { CreateTaskInput } from "../types/task";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateTaskForm(input: CreateTaskInput): string | null {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 120) {
    return "O título é obrigatório e deve ter entre 1 e 120 caracteres.";
  }

  const description = (input.description ?? "").trim();
  if (description.length > 1000) {
    return "A descrição deve ter no máximo 1.000 caracteres.";
  }

  if (input.dueDate) {
    if (!ISO_DATE_RE.test(input.dueDate)) {
      return "O prazo deve estar no formato AAAA-MM-DD.";
    }
    const [year, month, day] = input.dueDate.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return "A data de prazo informada não é válida.";
    }
  }

  return null;
}
