"use client";

import { useState, useCallback } from "react";
import type { CrmLead, CrmTag, CrmTask } from "@/lib/crm-types";
import { PIPELINE_STAGES } from "@/lib/crm-types";
import ActivityTimeline from "./ActivityTimeline";

interface CardDetailDrawerProps {
  lead: CrmLead | null;
  onClose: () => void;
  onStageChange: (leadId: string, newStage: string) => void;
  tags: CrmTag[];
}

type TabId =
  | "contact"
  | "property"
  | "tags"
  | "activity"
  | "tasks"
  | "notes"
  | "actions";

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

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

const STAGE_BADGE: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-yellow-500/20 text-yellow-300",
  interested: "bg-orange-500/20 text-orange-300",
  referred: "bg-purple-500/20 text-purple-300",
  closed: "bg-emerald-500/20 text-emerald-300",
  dead: "bg-red-500/20 text-red-300",
};

export default function CardDetailDrawer({
  lead,
  onClose,
  onStageChange,
  tags,
}: CardDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("contact");
  const [refreshKey, setRefreshKey] = useState(0);

  // Note form
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Call log form
  const [showCallForm, setShowCallForm] = useState(false);
  const [callOutcome, setCallOutcome] = useState("connected");
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  // Task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  // Fetch tasks for this lead
  const fetchTasks = useCallback(async () => {
    if (!lead) return;
    try {
      const res = await fetch(
        `/api/leads/crm/tasks?leadId=${lead.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : data.tasks || []);
        setTasksLoaded(true);
      }
    } catch (err) {
      console.error("Fetch tasks error:", err);
    }
  }, [lead]);

  // Load tasks when switching to tasks tab
  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      if (tab === "tasks" && !tasksLoaded && lead) {
        fetchTasks();
      }
    },
    [tasksLoaded, lead, fetchTasks]
  );

  const submitNote = useCallback(async () => {
    if (!lead || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/leads/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type: "note_added",
          title: "Note added",
          description: noteText.trim(),
        }),
      });
      if (res.ok) {
        setNoteText("");
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error("Note save error:", err);
    } finally {
      setSavingNote(false);
    }
  }, [lead, noteText]);

  const submitCall = useCallback(async () => {
    if (!lead) return;
    setSavingCall(true);
    try {
      const res = await fetch("/api/leads/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type: "call_logged",
          title: `Call - ${callOutcome}`,
          description: callNotes || null,
          metadata: {
            outcome: callOutcome,
            duration: callDuration ? parseInt(callDuration) : null,
          },
        }),
      });
      if (res.ok) {
        setShowCallForm(false);
        setCallOutcome("connected");
        setCallNotes("");
        setCallDuration("");
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error("Call log error:", err);
    } finally {
      setSavingCall(false);
    }
  }, [lead, callOutcome, callNotes, callDuration]);

  const submitTask = useCallback(async () => {
    if (!lead || !taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/leads/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          title: taskTitle.trim(),
          type: "task",
          priority: "medium",
          dueDate: taskDueDate || null,
        }),
      });
      if (res.ok) {
        const created: CrmTask = await res.json();
        setTasks((prev) => [created, ...prev]);
        setTaskTitle("");
        setTaskDueDate("");
      }
    } catch (err) {
      console.error("Task create error:", err);
    } finally {
      setSavingTask(false);
    }
  }, [lead, taskTitle, taskDueDate]);

  const logSms = useCallback(async () => {
    if (!lead) return;
    await fetch("/api/leads/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        type: "sms_sent",
        title: "SMS sent",
      }),
    });
    setRefreshKey((k) => k + 1);
  }, [lead]);

  const createDeal = useCallback(async () => {
    if (!lead) return;
    try {
      const res = await fetch("/api/leads/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          title: `${lead.ownerName || "Unknown"} - ${lead.listing?.address || "Deal"}`,
          type: "listing",
          stage: "prospect",
          salePrice: lead.listing?.listPrice || null,
        }),
      });
      if (res.ok) {
        await fetch("/api/leads/crm/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            type: "deal_created",
            title: "Deal created",
          }),
        });
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error("Deal create error:", err);
    }
  }, [lead]);

  if (!lead) return null;

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "contact", label: "Contact" },
    { id: "property", label: "Property" },
    { id: "tags", label: "Tags" },
    { id: "activity", label: "Activity" },
    { id: "tasks", label: "Tasks" },
    { id: "notes", label: "Notes" },
    { id: "actions", label: "Actions" },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-[#06050a] border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">
              {lead.ownerName || "Unknown Owner"}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {lead.listing?.address || "No address"}
              {lead.listing?.city ? `, ${lead.listing.city}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Stage selector */}
            <select
              value={lead.status}
              onChange={(e) => onStageChange(lead.id, e.target.value)}
              className={`text-xs px-2 py-1 rounded-lg border border-white/10 focus:outline-none cursor-pointer ${
                STAGE_BADGE[lead.status] || "bg-white/10 text-white/60"
              } [color-scheme:dark]`}
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              X
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-400 text-blue-300"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Contact Info */}
          {activeTab === "contact" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <InfoRow
                  label="Name"
                  value={lead.ownerName || "Unknown"}
                />
                <InfoRow
                  label="Phone"
                  value={
                    lead.ownerPhone ? (
                      <a
                        href={`tel:${lead.ownerPhone}`}
                        className="text-blue-300 hover:text-blue-200 underline"
                      >
                        {lead.ownerPhone}
                      </a>
                    ) : (
                      "-"
                    )
                  }
                />
                <InfoRow
                  label="Email"
                  value={
                    lead.ownerEmail ? (
                      <a
                        href={`mailto:${lead.ownerEmail}`}
                        className="text-blue-300 hover:text-blue-200 underline"
                      >
                        {lead.ownerEmail}
                      </a>
                    ) : (
                      "-"
                    )
                  }
                />
                <InfoRow label="Source" value={lead.source || "-"} />
                <InfoRow
                  label="Score"
                  value={
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        lead.score >= 61
                          ? "bg-emerald-500/20 text-emerald-300"
                          : lead.score >= 31
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {lead.score}
                    </span>
                  }
                />
                <InfoRow
                  label="Created"
                  value={timeAgo(lead.createdAt)}
                />
                {lead.contactedAt && (
                  <InfoRow
                    label="Last Contact"
                    value={timeAgo(lead.contactedAt)}
                  />
                )}
                {lead.referredTo && (
                  <InfoRow label="Referred To" value={lead.referredTo} />
                )}
                {lead.referralStatus && (
                  <InfoRow
                    label="Referral Status"
                    value={lead.referralStatus}
                  />
                )}
              </div>
            </div>
          )}

          {/* Property Details */}
          {activeTab === "property" && (
            <div className="space-y-4">
              {lead.listing ? (
                <>
                  {/* Photo */}
                  {lead.listing.photoUrls &&
                    lead.listing.photoUrls.length > 0 && (
                      <div className="rounded-lg overflow-hidden border border-white/10">
                        <img
                          src={lead.listing.photoUrls[0]}
                          alt={lead.listing.address}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}

                  <div className="space-y-3">
                    <InfoRow
                      label="Address"
                      value={lead.listing.address}
                    />
                    {lead.listing.city && (
                      <InfoRow label="City" value={lead.listing.city} />
                    )}
                    {lead.listing.zip && (
                      <InfoRow label="ZIP" value={lead.listing.zip} />
                    )}
                    <InfoRow
                      label="List Price"
                      value={
                        <span className="text-emerald-300 font-medium">
                          {formatCurrency(lead.listing.listPrice)}
                        </span>
                      }
                    />

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-white/40 uppercase">
                          Beds
                        </p>
                        <p className="text-sm font-bold text-white">
                          {lead.listing.beds ?? "-"}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-white/40 uppercase">
                          Baths
                        </p>
                        <p className="text-sm font-bold text-white">
                          {lead.listing.baths ?? "-"}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-white/40 uppercase">
                          SqFt
                        </p>
                        <p className="text-sm font-bold text-white">
                          {lead.listing.sqft
                            ? lead.listing.sqft.toLocaleString()
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <InfoRow
                      label="Status"
                      value={
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                          {lead.listing.status}
                        </span>
                      }
                    />

                    <InfoRow
                      label="MLS ID"
                      value={
                        <span className="text-xs text-white/50 font-mono">
                          {lead.listing.id}
                        </span>
                      }
                    />
                  </div>
                </>
              ) : (
                <p className="text-center text-white/30 text-xs py-8">
                  No property linked
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {activeTab === "tags" && (
            <div className="text-center text-white/30 text-xs py-8">
              Tags coming soon
            </div>
          )}

          {/* Activity Timeline */}
          {activeTab === "activity" && (
            <ActivityTimeline key={refreshKey} leadId={lead.id} />
          )}

          {/* Tasks */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Quick-add task */}
              <div className="space-y-2 p-3 bg-white/5 rounded-lg border border-white/10">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTask()}
                  placeholder="Add task..."
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="flex-1 text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60 focus:outline-none [color-scheme:dark]"
                  />
                  <button
                    onClick={submitTask}
                    disabled={!taskTitle.trim() || savingTask}
                    className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded hover:bg-blue-500/30 disabled:opacity-30 transition-colors"
                  >
                    {savingTask ? "..." : "Add"}
                  </button>
                </div>
              </div>

              {/* Task list */}
              {!tasksLoaded ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-center text-white/30 text-xs py-6">
                  No tasks
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border border-white/10 ${
                        task.status === "completed"
                          ? "bg-white/3 opacity-50"
                          : "bg-white/5"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 mt-0.5 rounded-full border shrink-0 ${
                          task.status === "completed"
                            ? "bg-emerald-500 border-emerald-400"
                            : "border-white/20"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs ${
                            task.status === "completed"
                              ? "line-through text-white/40"
                              : "text-white/80"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {task.dueDate && (
                            <span className="text-[10px] text-white/30">
                              Due:{" "}
                              {new Date(task.dueDate).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-1 rounded ${
                              task.priority === "high"
                                ? "bg-red-500/20 text-red-300"
                                : task.priority === "medium"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-white/10 text-white/40"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              {lead.notes && (
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Existing Notes
                  </p>
                  <p className="text-xs text-white/70 whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={4}
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
                />
                <button
                  onClick={submitNote}
                  disabled={!noteText.trim() || savingNote}
                  className="text-xs bg-blue-500/20 text-blue-300 px-4 py-1.5 rounded-lg hover:bg-blue-500/30 disabled:opacity-30 transition-colors"
                >
                  {savingNote ? "Saving..." : "Add Note"}
                </button>
              </div>

              {/* Show note activities */}
              <div className="mt-4">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Note History
                </p>
                <ActivityTimeline key={`notes-${refreshKey}`} leadId={lead.id} />
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCallForm(true)}
                  className="flex flex-col items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/15 transition-colors"
                >
                  <span className="text-lg">Ph</span>
                  <span className="text-xs text-yellow-300 font-medium">
                    Log Call
                  </span>
                </button>

                <button
                  onClick={logSms}
                  className="flex flex-col items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/15 transition-colors"
                >
                  <span className="text-lg">Tx</span>
                  <span className="text-xs text-emerald-300 font-medium">
                    Send Text
                  </span>
                </button>

                <button
                  onClick={() => {
                    handleTabChange("tasks");
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition-colors"
                >
                  <span className="text-lg">Tk</span>
                  <span className="text-xs text-blue-300 font-medium">
                    Add Task
                  </span>
                </button>

                <button
                  onClick={createDeal}
                  className="flex flex-col items-center gap-2 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/15 transition-colors"
                >
                  <span className="text-lg">D+</span>
                  <span className="text-xs text-indigo-300 font-medium">
                    Create Deal
                  </span>
                </button>
              </div>

              {/* Call log form */}
              {showCallForm && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white">
                      Log Call
                    </h4>
                    <button
                      onClick={() => setShowCallForm(false)}
                      className="text-white/30 hover:text-white/60 text-xs transition-colors"
                    >
                      X
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider">
                      Outcome
                    </label>
                    <select
                      value={callOutcome}
                      onChange={(e) => setCallOutcome(e.target.value)}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none mt-1 [color-scheme:dark]"
                    >
                      <option value="connected">Connected</option>
                      <option value="voicemail">Voicemail</option>
                      <option value="no_answer">No Answer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={callDuration}
                      onChange={(e) => setCallDuration(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider">
                      Notes
                    </label>
                    <textarea
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      rows={3}
                      placeholder="Call notes..."
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none resize-none mt-1"
                    />
                  </div>

                  <button
                    onClick={submitCall}
                    disabled={savingCall}
                    className="w-full text-xs bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded-lg py-2 transition-colors disabled:opacity-50"
                  >
                    {savingCall ? "Saving..." : "Log Call"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white/80">{value}</span>
    </div>
  );
}
