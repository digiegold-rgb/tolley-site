"use client";

import { useState, useMemo, useCallback } from "react";
import type { CrmTask } from "@/lib/crm-types";

interface TaskPanelProps {
  initialTasks: CrmTask[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const TYPE_ICONS: Record<string, string> = {
  call: "Ph",
  email: "Em",
  sms: "Tx",
  showing: "Sh",
  follow_up: "FU",
  task: "Tk",
  meeting: "Mt",
  document: "Dc",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-white/10 text-white/40",
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
}

function getContactName(task: CrmTask): string {
  if (task.lead?.ownerName) return task.lead.ownerName;
  if (task.lead?.listing?.address) return task.lead.listing.address;
  if (task.client) return `${task.client.firstName} ${task.client.lastName}`;
  if (task.deal) return task.deal.title;
  return "";
}

export default function TaskPanel({ initialTasks }: TaskPanelProps) {
  const [tasks, setTasks] = useState<CrmTask[]>(initialTasks);
  const [collapsed, setCollapsed] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  // Quick-add form
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending"),
    [tasks]
  );

  const { overdue, today, thisWeek, later } = useMemo(() => {
    const o: CrmTask[] = [];
    const td: CrmTask[] = [];
    const tw: CrmTask[] = [];
    const lt: CrmTask[] = [];

    for (const task of pendingTasks) {
      if (!task.dueDate) {
        lt.push(task);
      } else if (isOverdue(task.dueDate)) {
        o.push(task);
      } else if (isToday(task.dueDate)) {
        td.push(task);
      } else if (isThisWeek(task.dueDate)) {
        tw.push(task);
      } else {
        lt.push(task);
      }
    }
    return { overdue: o, today: td, thisWeek: tw, later: lt };
  }, [pendingTasks]);

  const completeTask = useCallback(async (taskId: string) => {
    setCompleting(taskId);
    try {
      const res = await fetch("/api/leads/crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          status: "completed",
          completedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "completed",
                  completedAt: new Date().toISOString(),
                }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Complete task error:", err);
    } finally {
      setCompleting(null);
    }
  }, []);

  const addTask = useCallback(async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/leads/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: "task",
          priority: "medium",
          dueDate: newDueDate || null,
        }),
      });
      if (res.ok) {
        const created: CrmTask = await res.json();
        setTasks((prev) => [created, ...prev]);
        setNewTitle("");
        setNewDueDate("");
      }
    } catch (err) {
      console.error("Add task error:", err);
    } finally {
      setAdding(false);
    }
  }, [newTitle, newDueDate]);

  if (collapsed) {
    return (
      <div className="w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Show tasks"
        >
          <span className="text-xs font-bold">T</span>
        </button>
        {pendingTasks.length > 0 && (
          <div className="mt-1 text-center">
            <span className="text-[10px] text-white/40 font-medium">
              {pendingTasks.length}
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderTaskCard(task: CrmTask) {
    const icon = TYPE_ICONS[task.type] || "Tk";
    const priorityClass =
      PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
    const contactName = getContactName(task);

    return (
      <div
        key={task.id}
        className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/8 transition-colors group"
      >
        {/* Checkbox */}
        <button
          onClick={() => completeTask(task.id)}
          disabled={completing === task.id}
          className={`mt-0.5 w-4 h-4 rounded border border-white/20 shrink-0 flex items-center justify-center hover:border-white/40 transition-colors ${
            completing === task.id ? "opacity-50" : ""
          }`}
        >
          {completing === task.id && (
            <span className="w-2 h-2 bg-white/40 rounded-sm animate-pulse" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-white/30 bg-white/5 px-1 rounded">
              {icon}
            </span>
            <span className="text-xs text-white/80 truncate">{task.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.dueDate && (
              <span
                className={`text-[10px] ${
                  isOverdue(task.dueDate)
                    ? "text-red-300"
                    : isToday(task.dueDate)
                      ? "text-yellow-300"
                      : "text-white/40"
                }`}
              >
                {formatDate(task.dueDate)}
              </span>
            )}
            {contactName && (
              <span className="text-[10px] text-white/30 truncate">
                {contactName}
              </span>
            )}
            <span className={`text-[10px] px-1 rounded ${priorityClass} ml-auto shrink-0`}>
              {task.priority}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderSection(
    label: string,
    items: CrmTask[],
    colorClass: string
  ) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
            {label}
          </span>
          <span className="text-[10px] text-white/30">{items.length}</span>
        </div>
        <div className="space-y-1.5">{items.map(renderTaskCard)}</div>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border-l border-white/10 bg-[#0a0914] flex flex-col max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Tasks</h3>
          <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full">
            {pendingTasks.length}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          x
        </button>
      </div>

      {/* Quick add */}
      <div className="p-3 border-b border-white/10 space-y-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Quick add task..."
          className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/30 focus:outline-none focus:border-white/20"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="flex-1 text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 focus:outline-none focus:border-white/20 [color-scheme:dark]"
          />
          <button
            onClick={addTask}
            disabled={!newTitle.trim() || adding}
            className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded hover:bg-blue-500/30 disabled:opacity-30 transition-colors"
          >
            {adding ? "..." : "Add"}
          </button>
        </div>
      </div>

      {/* Task sections */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderSection("Overdue", overdue, "text-red-300")}
        {renderSection("Today", today, "text-yellow-300")}
        {renderSection("This Week", thisWeek, "text-blue-300")}
        {renderSection("Later", later, "text-white/40")}

        {pendingTasks.length === 0 && (
          <p className="text-center text-white/20 text-xs py-8">
            No pending tasks
          </p>
        )}
      </div>
    </div>
  );
}
