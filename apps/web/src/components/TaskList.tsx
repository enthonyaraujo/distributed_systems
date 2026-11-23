import type { Task, TaskPriority, TaskStatus } from "../types/task";

interface TaskListProps {
  tasks: Task[];
  busyTaskId: string | null;
  onStatusChange: (task: Task, nextStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => Promise<void>;
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export function TaskList({
  tasks,
  busyTaskId,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <section className="card empty-state" aria-live="polite">
        <h3>Nenhuma atividade cadastrada</h3>
        <p className="muted">
          Use o formulário acima para registrar sua primeira atividade acadêmica.
        </p>
      </section>
    );
  }

  return (
    <ul className="task-list" aria-label="Lista de atividades">
      {tasks.map((task) => {
        const isBusy = busyTaskId === task.id;
        return (
          <li key={task.id} className={`card task-item status-${task.status}`}>
            <div className="task-main">
              <div className="task-header">
                <h3 className="task-title">{task.title}</h3>
                <span className={`badge priority-${task.priority}`}>
                  Prioridade: {PRIORITY_LABELS[task.priority]}
                </span>
              </div>

              {task.description && (
                <p className="task-description">{task.description}</p>
              )}

              <div className="task-meta">
                <span>
                  Prazo: {task.dueDate ? task.dueDate : "Sem prazo definido"}
                </span>
              </div>
            </div>

            <div className="task-controls">
              <label className="sr-only" htmlFor={`status-${task.id}`}>
                Alterar status de {task.title}
              </label>
              <select
                id={`status-${task.id}`}
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
                className="btn btn-secondary"
                disabled={isBusy}
                onClick={() => onEdit(task)}
              >
                Editar
              </button>

              <button
                type="button"
                className="btn btn-danger"
                disabled={isBusy}
                onClick={() => void onDelete(task)}
              >
                Excluir
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
