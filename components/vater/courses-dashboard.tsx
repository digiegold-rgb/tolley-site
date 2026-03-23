"use client";

import { useState, useMemo } from "react";
import {
  DEMO_COURSE_ENROLLMENTS,
  DEMO_COURSE_AFFILIATES,
  DEMO_REVENUE_HISTORY,
  getDemoCourseStats,
  timeAgo,
  type DemoCourseEnrollment,
} from "@/lib/vater/demo-data";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MODULE_NAMES_PILOT = [
  "Is Flying for You?", "License Types", "Ground School", "Choosing a School",
  "Medical Certificate", "Written Exam", "Flight Hours", "Solo & Cross-Country",
  "Checkride Prep", "Career Paths",
];

const MODULE_NAMES_NEWDAD = [
  "Before Baby Arrives", "Hospital Essentials", "First Week Home", "Sleep Strategies",
  "Feeding Basics", "Developmental Milestones", "Dad's Mental Health", "Work-Life Balance",
  "Partner Communication", "Year Two & Beyond",
];

export function CoursesDashboard() {
  const [enrollments, setEnrollments] = useState<DemoCourseEnrollment[]>(DEMO_COURSE_ENROLLMENTS);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [courseView, setCourseView] = useState<"pilot" | "newdad" | null>(null);

  const stats = getDemoCourseStats(enrollments);

  const recentEnrollments = useMemo(
    () => [...enrollments].sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()).slice(0, 15),
    [enrollments]
  );

  const moduleCompletionRates = (course: "pilot" | "newdad") => {
    const students = enrollments.filter((e) => e.course === course);
    const names = course === "pilot" ? MODULE_NAMES_PILOT : MODULE_NAMES_NEWDAD;
    return names.map((name, i) => {
      const completed = students.filter((s) => s.modulesCompleted > i).length;
      return { name, rate: students.length ? Math.round((completed / students.length) * 100) : 0 };
    });
  };

  const simulateEnrollment = () => {
    const firstNames = ["Alex", "Jordan", "Casey", "Taylor", "Morgan", "Riley", "Avery", "Quinn"];
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`;
    const course = Math.random() > 0.5 ? "pilot" as const : "newdad" as const;
    const newEnrollment: DemoCourseEnrollment = {
      id: `demo-enroll-sim-${Date.now()}`,
      name,
      course,
      modulesCompleted: 0,
      totalModules: 10,
      rating: null,
      source: "organic",
      enrolledAt: new Date().toISOString(),
    };
    setEnrollments((prev) => [newEnrollment, ...prev]);
  };

  const selectedStudentData = enrollments.find((e) => e.id === selectedStudent);
  const selectedModuleNames = selectedStudentData?.course === "pilot" ? MODULE_NAMES_PILOT : MODULE_NAMES_NEWDAD;

  const initialsColor = (name: string) => {
    const colors = ["#38bdf8", "#f59e0b", "#22c55e", "#a78bfa", "#ec4899", "#06b6d4", "#ef4444"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="vater-section-title mb-3">Courses Dashboard</h2>
      <p className="vater-section-subtitle mb-8">
        Student enrollments, revenue, and affiliate performance.
        <span className="ml-2 text-xs text-sky-400/60">(Demo Data)</span>
      </p>

      {/* Course Overview Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {/* Pilot Course */}
        <div className="vater-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">✈️</span>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">How to Become a Pilot</h3>
              <span className="text-xs text-slate-500">$27 · 10 modules</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-lg font-bold text-sky-400">{stats.pilot.enrollments}</div>
              <div className="text-[10px] uppercase text-slate-500">Enrolled</div>
            </div>
            <div>
              <div className="text-lg font-bold text-sky-400">{stats.pilot.completionPercent}%</div>
              <div className="text-[10px] uppercase text-slate-500">Completion</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-400">{stats.pilot.avgRating} ★</div>
              <div className="text-[10px] uppercase text-slate-500">Rating</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">${stats.pilot.revenue}</div>
              <div className="text-[10px] uppercase text-slate-500">Revenue</div>
            </div>
          </div>
          <button
            onClick={() => setCourseView(courseView === "pilot" ? null : "pilot")}
            className="mt-3 text-xs font-semibold uppercase tracking-wider text-sky-400 hover:text-sky-300 transition"
          >
            {courseView === "pilot" ? "Hide" : "View"} Module Analytics →
          </button>
        </div>

        {/* New Dad Course */}
        <div className="vater-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">👶</span>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">New Dad&apos;s First 2 Years</h3>
              <span className="text-xs text-slate-500">$27 · 10 modules</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-lg font-bold text-sky-400">{stats.newdad.enrollments}</div>
              <div className="text-[10px] uppercase text-slate-500">Enrolled</div>
            </div>
            <div>
              <div className="text-lg font-bold text-sky-400">{stats.newdad.completionPercent}%</div>
              <div className="text-[10px] uppercase text-slate-500">Completion</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-400">{stats.newdad.avgRating} ★</div>
              <div className="text-[10px] uppercase text-slate-500">Rating</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">${stats.newdad.revenue}</div>
              <div className="text-[10px] uppercase text-slate-500">Revenue</div>
            </div>
          </div>
          <button
            onClick={() => setCourseView(courseView === "newdad" ? null : "newdad")}
            className="mt-3 text-xs font-semibold uppercase tracking-wider text-sky-400 hover:text-sky-300 transition"
          >
            {courseView === "newdad" ? "Hide" : "View"} Module Analytics →
          </button>
        </div>
      </div>

      {/* Module Analytics Drill-Down */}
      {courseView && (
        <div className="mb-8 vater-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
            {courseView === "pilot" ? "✈️ Pilot" : "👶 New Dad"} — Module Completion
          </h3>
          <div className="space-y-2">
            {moduleCompletionRates(courseView).map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-40 truncate text-xs text-slate-400 sm:w-52">{m.name}</div>
                <div className="flex-1">
                  <div className="vater-progress">
                    <div
                      className="vater-progress-fill"
                      style={{ width: `${m.rate}%` }}
                    />
                  </div>
                </div>
                <div className="w-10 text-right text-xs font-semibold text-slate-400">{m.rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="mb-8 vater-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
          Revenue — 12 Month Trend
        </h3>
        <div className="vater-chart" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DEMO_REVENUE_HISTORY}>
              <defs>
                <linearGradient id="pilotGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="newdadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="affGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Area type="monotone" dataKey="pilot" name="Pilot Course" stroke="#38bdf8" fill="url(#pilotGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="newdad" name="New Dad Course" stroke="#f59e0b" fill="url(#newdadGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="affiliate" name="Affiliate" stroke="#22c55e" fill="url(#affGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Enrollments + Student Detail */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="vater-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Recent Enrollments
            </h3>
            <button
              onClick={simulateEnrollment}
              className="rounded-lg border border-sky-500/40 bg-transparent px-3 py-1.5 text-[10px] font-semibold uppercase text-sky-400 transition hover:bg-sky-500/10"
            >
              + Simulate
            </button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {recentEnrollments.map((e) => (
              <div
                key={e.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition ${
                  selectedStudent === e.id ? "bg-sky-500/10 border border-sky-500/20" : "hover:bg-slate-800/50"
                }`}
                onClick={() => setSelectedStudent(selectedStudent === e.id ? null : e.id)}
              >
                {/* Avatar */}
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: initialsColor(e.name) }}
                >
                  {e.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200 truncate">{e.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      e.course === "pilot" ? "bg-sky-500/10 text-sky-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {e.course === "pilot" ? "✈️ Pilot" : "👶 Dad"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="vater-progress flex-1" style={{ height: 4 }}>
                      <div className="vater-progress-fill" style={{ width: `${(e.modulesCompleted / e.totalModules) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{e.modulesCompleted}/{e.totalModules}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(e.enrolledAt)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Student Detail / Affiliate Section */}
        <div>
          {selectedStudentData ? (
            <div className="vater-card p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Student: {selectedStudentData.name}
              </h3>
              <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
                <span>Course: {selectedStudentData.course === "pilot" ? "✈️ Pilot" : "👶 New Dad"}</span>
                <span>Source: {selectedStudentData.source}</span>
                {selectedStudentData.rating && (
                  <span className="text-amber-400">★ {selectedStudentData.rating}</span>
                )}
              </div>
              <div className="space-y-1.5">
                {selectedModuleNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 rounded bg-slate-800/30 px-3 py-1.5">
                    <div className={`h-4 w-4 rounded flex items-center justify-center text-[10px] ${
                      i < selectedStudentData.modulesCompleted
                        ? "bg-green-500/20 text-green-400"
                        : "bg-slate-700/50 text-slate-600"
                    }`}>
                      {i < selectedStudentData.modulesCompleted ? "✓" : (i + 1)}
                    </div>
                    <span className={`text-xs ${i < selectedStudentData.modulesCompleted ? "text-slate-300" : "text-slate-500"}`}>
                      {name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-slate-500">
                Enrolled: {new Date(selectedStudentData.enrolledAt).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="vater-card p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
                ClickBank Affiliates
              </h3>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-lg font-bold text-green-400">
                    {DEMO_COURSE_AFFILIATES.reduce((s, a) => s + a.sales, 0)}
                  </div>
                  <div className="text-[10px] uppercase text-slate-500">Total Sales</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">
                    ${DEMO_COURSE_AFFILIATES.reduce((s, a) => s + a.commission, 0).toFixed(0)}
                  </div>
                  <div className="text-[10px] uppercase text-slate-500">Commission Paid</div>
                </div>
              </div>
              <div className="space-y-2">
                {DEMO_COURSE_AFFILIATES.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded bg-slate-800/30 px-3 py-2">
                    <div>
                      <div className="text-xs font-medium text-slate-200">{a.name}</div>
                      <div className="text-[10px] text-slate-500">Top: {a.topCourse === "pilot" ? "✈️ Pilot" : "👶 Dad"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-green-400">{a.sales} sales</div>
                      <div className="text-[10px] text-slate-500">${a.commission} comm</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
