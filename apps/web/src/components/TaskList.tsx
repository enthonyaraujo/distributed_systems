import type { Task, TaskStatus } from "../types/task";
import { formatShortDate, TASK_PRIORITY_LABELS } from "../utils/formatters";
import { IconCalendar, IconEdit, IconTasks, IconTrash } from "./Icons";
import { EmptyState } from "./ui/EmptyState";

interface TaskListProps {
  tasks: Task[];
  busyTaskId: string | null;
  onStatusChange: (task: Task, nextStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => Promise<void>;
}

export function TaskList({
  tasks,
  busyTaskId,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<IconTasks size={24} />}
        title="Nenhuma atividade cadastrada"
        description="Registre sua primeira atividade acadêmica com prazo e prioridade para acompanhar o progresso."
      />
    );
  }

  return (
    <ul className="task-list" aria-label="Lista de atividades">
      {tasks.map((task) => {
        const isBusy = busyTaskId === task.id;
        const isDone = task.status === "done";
        return (
          <li key={task.id} className={`card task-item status-${task.status}`}>
            <div className="task-main">
              <div className="task-header">
                <div className="task-title-wrap">
                  <span
                    className="task-status-indicator"
                    aria-hidden="true"
                  />
                  <h3 className="task-title">{task.title}</h3>
                </div>
                <span
                  className={`badge ${isDone ? "priority-muted" : `priority-${task.priority}`}`}
                >
                  Prioridade {TASK_PRIORITY_LABELS[task.priority]}
                </span>
              </div>

              {task.description && (
                <p className="task-description">{task.description}</p>
              )}
            </div>

            <div className="task-footer">
              <div className="task-meta">
                <span className="meta-chip">
                  <IconCalendar size={14} />
                  <span>
                    {task.dueDate
                      ? `Prazo: ${formatShortDate(task.dueDate)}`
                      : "Sem prazo definido"}
                  </span>
                </span>
              </div>

              <div className="task-controls">
                <label className="sr-only" htmlFor={`status-${task.id}`}>
                  Status de {task.title}
                </label>
                <select
                  id={`status-${task.id}`}
                  className={`task-status-select select-${task.status}`}
                  value={task.status}
                  disabled={isBusy}
                  onChange={(e) =>
                    void onStatusChange(task, e.target.value as TaskStatus)
                  }
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="done">Concluída</option>
                </select>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isBusy}
                  onClick={() => onEdit(task)}
                >
                  <IconEdit size={14} />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={isBusy}
                  onClick={() => void onDelete(task)}
                >
                  <IconTrash size={14} />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
