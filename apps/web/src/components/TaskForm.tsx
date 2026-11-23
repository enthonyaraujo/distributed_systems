import { useEffect, useState, type FormEvent } from "react";
import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
} from "../types/task";
import { validateTaskForm } from "../utils/validation";

interface TaskFormProps {
  editingTask: Task | null;
  submitting: boolean;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  onCancelEdit: () => void;
}

export function TaskForm({
  editingTask,
  submitting,
  onSubmit,
  onCancelEdit,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setDueDate(editingTask.dueDate ?? "");
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setLocalError(null);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setStatus("pending");
      setLocalError(null);
    }
  }, [editingTask]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: CreateTaskInput = {
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate ? dueDate : null,
      priority,
      status,
    };

    const validationError = validateTaskForm(payload);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    await onSubmit(payload);
    if (!editingTask) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setStatus("pending");
    }
  }

  return (
    <section className="card" aria-labelledby="task-form-heading">
      <div className="section-header">
        <h2 id="task-form-heading">
          {editingTask ? "Editar atividade" : "Nova atividade"}
        </h2>
        {editingTask && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancelEdit}
            disabled={submitting}
          >
            Cancelar edição
          </button>
        )}
      </div>

      <form className="task-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="task-title">Título *</label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            placeholder="Ex.: Entregar projeto final de Sistemas Distribuídos"
            disabled={submitting}
          />
        </div>

        <div className="field">
          <label htmlFor="task-description">Descrição (opcional)</label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Detalhes, observações ou etapas da atividade"
            disabled={submitting}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="task-due">Prazo (opcional)</label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label htmlFor="task-priority">Prioridade</label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={submitting}
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-status">Status</label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={submitting}
            >
              <option value="pending">Pendente</option>
              <option value="in_progress">Em andamento</option>
              <option value="done">Concluída</option>
            </select>
          </div>
        </div>

        {localError && (
          <p className="alert alert-error" role="alert">
            {localError}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? "Salvando..."
              : editingTask
                ? "Salvar alterações"
                : "Criar atividade"}
          </button>
        </div>
      </form>
    </section>
  );
}
