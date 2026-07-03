import Link from "next/link";

interface OverdueTask {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  leadId: string | null;
}

export default function OverdueTasksWidget({
  tasks,
}: {
  tasks: OverdueTask[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-rose-500/5 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-rose-400/15 via-pink-400/10 to-transparent px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Overdue tasks</h2>
        {tasks.length > 0 && (
          <span className="rounded-full border border-rose-400/40 bg-gradient-to-br from-rose-400/25 to-pink-400/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200 shadow-sm shadow-rose-500/20">
            {tasks.length}
          </span>
        )}
      </div>
      <div className="divide-y divide-white/5">
        {tasks.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-emerald-300/80">
            ✓ Nothing overdue. Nice.
          </div>
        )}
        {tasks.slice(0, 8).map((task) => (
          <Link
            key={task.id}
            href={task.leadId ? `/leads/${task.leadId}` : "/leads/pipeline"}
            className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-rose-400/5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">{task.title}</div>
              {task.dueDate && (
                <div className="mt-0.5 text-[11px] text-rose-300">
                  {formatRelative(task.dueDate)}
                </div>
              )}
            </div>
            <PriorityDot priority={task.priority} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "high"
      ? "bg-rose-400 shadow-sm shadow-rose-400/60"
      : priority === "low"
      ? "bg-white/30"
      : "bg-amber-400 shadow-sm shadow-amber-400/60";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "overdue";
  const diff = Date.now() - then;
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}d overdue`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours}h overdue`;
  return "just overdue";
}
