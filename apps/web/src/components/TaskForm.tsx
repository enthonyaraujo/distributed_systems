import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
} from "../types/task";
import { validateTaskForm } from "../utils/validation";
import { IconAlert, IconClose, IconPlus, IconSave } from "./Icons";

interface TaskFormProps {
  editingTask: Task | null;
  submitting: boolean;
  onSubmit: (input: CreateTaskInput) => Promise<boolean>;
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

  const titleInputRef = useRef<HTMLInputElement | null>(null);

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
      titleInputRef.current?.focus();
      return;
    }

    setLocalError(null);
    const saved = await onSubmit(payload);
    if (saved && !editingTask) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setStatus("pending");
    }
  }

  return (
    <section
      className={`card task-form-card ${editingTask ? "is-editing" : ""}`}
      aria-labelledby="task-form-heading"
    >
      <div className="section-header">
        <div className="section-heading-group">
          <h2 id="task-form-heading" className="section-title">
            {editingTask ? "Editar atividade" : "Nova atividade"}
          </h2>
          <p className="section-caption">
            {editingTask
              ? "Atualize os dados e salve as alterações."
              : "Cadastre uma entrega, prova ou etapa de estudo."}
          </p>
        </div>
        {editingTask && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancelEdit}
            disabled={submitting}
          >
            <IconClose size={14} />
            <span>Cancelar</span>
          </button>
        )}
      </div>

      <form className="task-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="task-title">Título *</label>
          <input
            ref={titleInputRef}
            id="task-title"
            name="title"
            type="text"
            autoComplete="off"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (localError) setLocalError(null);
            }}
            maxLength={120}
            required
            aria-invalid={Boolean(localError)}
            aria-describedby={localError ? "task-title-error" : undefined}
            placeholder="Ex.: Entregar projeto de Sistemas Distribuídos…"
            disabled={submitting}
          />
          {localError && (
            <p id="task-title-error" className="field-error" role="alert">
              <IconAlert size={14} />
              <span>{localError}</span>
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="task-description">Descrição (opcional)</label>
          <textarea
            id="task-description"
            name="description"
            autoComplete="off"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Detalhes, observações ou etapas da atividade…"
            disabled={submitting}
          />
        </div>

        <div className="form-row">
          <div className="field field-full">
            <label htmlFor="task-due">Prazo (opcional)</label>
            <input
              id="task-due"
              name="dueDate"
              type="date"
              autoComplete="off"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label htmlFor="task-priority">Prioridade</label>
            <select
              id="task-priority"
              name="priority"
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
              name="status"
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

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {editingTask ? <IconSave size={15} /> : <IconPlus size={15} />}
            <span>
              {submitting
                ? "Salvando…"
                : editingTask
                  ? "Salvar alterações"
                  : "Criar atividade"}
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
