"use client";

import { useState, useCallback, useEffect } from "react";
import { PIPELINE_STAGES } from "@/lib/crm-types";
import type { CrmTask } from "@/lib/crm-types";
import { useToast } from "@/components/ui/Toast";
import ActivityTimeline from "./crm/ActivityTimeline";

interface LeadDetailSidebarProps {
  leadId: string;
  status: string;
  stageLabel: string;
  source: string | null;
  createdAt: string;
  contactedAt: string | null;
  referredTo: string | null;
  referralStatus: string | null;
  ownerPhone: string | null;
  onStageChange: (stage: string) => void;
  onResearch: () => void;
  researching: boolean;
  hasDossier: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-400",
  contacted: "bg-yellow-400",
  interested: "bg-orange-400",
  referred: "bg-purple-400",
  closed: "bg-emerald-400",
  dead: "bg-red-400",
};

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

export default function LeadDetailSidebar({
  leadId,
  status,
  source,
  createdAt,
  contactedAt,
  referredTo,
  referralStatus,
  ownerPhone,
  onStageChange,
  onResearch,
  researching,
  hasDossier,
}: LeadDetailSidebarProps) {
  const { toast } = useToast();

  // Note form
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [tasks, setTasks] = useState<CrmTask[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);

  // Load tasks once on mount + whenever the lead id changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/crm/tasks?leadId=${leadId}`);
        if (!res.ok) {
          if (!cancelled) {
            toast({
              title: "Couldn't load tasks",
              description: `Server returned ${res.status}`,
              variant: "error",
            });
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setTasks(Array.isArray(data) ? data : data.tasks || []);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Network error loading tasks",
            description: err instanceof Error ? err.message : undefined,
            variant: "error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, toast]);

  const submitNote = useCallback(async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/leads/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          type: "note_added",
          title: "Note added",
          description: noteText.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't save note",
          description: err?.error ?? `Server returned ${res.status}`,
          variant: "error",
        });
        return;
      }
      setNoteText("");
      setRefreshKey((k) => k + 1);
      toast({ title: "Note added", variant: "success" });
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSavingNote(false);
    }
  }, [leadId, noteText, toast]);

  const submitTask = useCallback(async () => {
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/leads/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          title: taskTitle.trim(),
          type: "task",
          priority: "medium",
          dueDate: taskDueDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't save task",
          description: err?.error ?? `Server returned ${res.status}`,
          variant: "error",
        });
        return;
      }
      const created: CrmTask = await res.json();
      setTasks((prev) => [created, ...prev]);
      setTaskTitle("");
      setTaskDueDate("");
      toast({ title: "Task added", variant: "success" });
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSavingTask(false);
    }
  }, [leadId, taskTitle, taskDueDate, toast]);

  const logSms = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          type: "sms_sent",
          title: "SMS sent",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't log SMS",
          description: err?.error ?? `Server returned ${res.status}`,
          variant: "error",
        });
        return;
      }
      setRefreshKey((k) => k + 1);
      toast({ title: "SMS logged", variant: "success" });
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }, [leadId, toast]);

  return (
    <div className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
      {/* Pipeline stepper */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="text-xs font-medium text-white/40 uppercase mb-3">
          Pipeline Stage
        </h3>
        <div className="space-y-1">
          {PIPELINE_STAGES.map((stage) => {
            const isActive = status === stage.id;
            const isPast =
              PIPELINE_STAGES.findIndex((s) => s.id === status) >
              PIPELINE_STAGES.findIndex((s) => s.id === stage.id);

            return (
              <button
                key={stage.id}
                onClick={() => onStageChange(stage.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : isPast
                      ? "text-white/40 hover:bg-white/5"
                      : "text-white/25 hover:bg-white/5"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive
                      ? STAGE_COLORS[stage.id] || "bg-white"
                      : isPast
                        ? "bg-white/30"
                        : "bg-white/10"
                  }`}
                />
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick info */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-white/40">Source</span>
          <span className="text-white/70 capitalize">{source || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Created</span>
          <span className="text-white/70">{timeAgo(createdAt)}</span>
        </div>
        {contactedAt && (
          <div className="flex justify-between">
            <span className="text-white/40">Last Contact</span>
            <span className="text-white/70">{timeAgo(contactedAt)}</span>
          </div>
        )}
        {referredTo && (
          <div className="flex justify-between">
            <span className="text-white/40">Referred To</span>
            <span className="text-white/70">{referredTo}</span>
          </div>
        )}
        {referralStatus && (
          <div className="flex justify-between">
            <span className="text-white/40">Referral</span>
            <span className="text-white/70 capitalize">{referralStatus}</span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="text-xs font-medium text-white/40 uppercase mb-3">
          Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ownerPhone && (
            <a
              href={`tel:${ownerPhone}`}
              className="rounded-lg bg-emerald-600/20 text-emerald-300 px-3 py-2 text-xs text-center hover:bg-emerald-600/30 transition-colors"
            >
              Call
            </a>
          )}
          {ownerPhone && (
            <button
              onClick={logSms}
              className="rounded-lg bg-blue-600/20 text-blue-300 px-3 py-2 text-xs hover:bg-blue-600/30 transition-colors"
            >
              Log SMS
            </button>
          )}
          {!hasDossier && (
            <button
              onClick={onResearch}
              disabled={researching}
              className="rounded-lg bg-purple-600/20 text-purple-300 px-3 py-2 text-xs hover:bg-purple-600/30 transition-colors disabled:opacity-40 col-span-2"
            >
              {researching ? "Researching..." : "Run Research"}
            </button>
          )}
        </div>
      </div>

      {/* Add note */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="text-xs font-medium text-white/40 uppercase mb-2">
          Add Note
        </h3>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Type a note..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
          rows={2}
        />
        <button
          onClick={submitNote}
          disabled={savingNote || !noteText.trim()}
          className="mt-2 w-full rounded-lg bg-white/10 text-white/60 py-1.5 text-xs hover:bg-white/20 transition-colors disabled:opacity-30"
        >
          {savingNote ? "Saving..." : "Save Note"}
        </button>
      </div>

      {/* Tasks */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="text-xs font-medium text-white/40 uppercase mb-2">
          Tasks
        </h3>
        {tasks.length > 0 && (
          <div className="space-y-1 mb-3">
            {tasks.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 text-xs ${
                  t.status === "completed"
                    ? "text-white/30 line-through"
                    : "text-white/70"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    t.status === "completed"
                      ? "bg-emerald-400"
                      : t.priority === "high"
                        ? "bg-red-400"
                        : "bg-white/30"
                  }`}
                />
                <span className="truncate">{t.title}</span>
                {t.dueDate && (
                  <span className="text-white/20 shrink-0">
                    {new Date(t.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="New task..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20"
            onKeyDown={(e) => e.key === "Enter" && submitTask()}
          />
          <input
            type="date"
            value={taskDueDate}
            onChange={(e) => setTaskDueDate(e.target.value)}
            className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/50 focus:outline-none [color-scheme:dark]"
          />
        </div>
        <button
          onClick={submitTask}
          disabled={savingTask || !taskTitle.trim()}
          className="mt-2 w-full rounded-lg bg-white/10 text-white/60 py-1.5 text-xs hover:bg-white/20 transition-colors disabled:opacity-30"
        >
          {savingTask ? "Adding..." : "Add Task"}
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="text-xs font-medium text-white/40 uppercase mb-3">
          Activity
        </h3>
        <ActivityTimeline leadId={leadId} key={refreshKey} />
      </div>
    </div>
  );
}
