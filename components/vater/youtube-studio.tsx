"use client";

/**
 * YouTube Studio shell. Three tabs:
 *   - Transcribe: manual URL + RSS panel + projects list
 *   - Topic: tubegen-style topic form + topic-mode projects list
 *   - Voices: voice clone management
 */

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { YouTubeImportTracker } from "./youtube-import-tracker";
import { YouTubeProjectCard } from "./youtube-project-card";
import { YouTubeProjectDetail } from "./youtube-project-detail";
import { YouTubeRssPanel } from "./youtube-rss-panel";
import { YouTubeTopicForm } from "./youtube-topic-form";
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import { YouTubeLibrary } from "./youtube-library";

interface YouTubeProject {
  id: string;
  mode: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceChannel: string | null;
  topic: string | null;
  transcript: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transcriptMeta: any;
  goal: string | null;
  targetDuration: number;
  targetWordCount: number;
  stylePreset: string | null;
  customStylePrompt: string | null;
  voiceName: string | null;
  script: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scriptMeta: any;
  audioUrl: string | null;
  audioDuration: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scenesJson: any;
  finalVideoUrl: string | null;
  verifiedScript: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verificationReport: any;
  status: string;
  progress: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stepDetails: any;
  errorMessage: string | null;
  autopilotJobId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  thumbnailUrl: string | null;
}

export function YouTubeStudio() {
  const [projects, setProjects] = useState<YouTubeProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeProject = projects.find((p) => p.id === activeId) || null;

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/vater/youtube");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreated = (project: YouTubeProject) => {
    setProjects((prev) => [project, ...prev]);
    setActiveId(project.id);
  };

  const handleProjectUpdate = (updated: YouTubeProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/vater/youtube/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const transcribeProjects = projects.filter(
    (p) => (p.mode || "transcribe") === "transcribe",
  );
  const topicProjects = projects.filter((p) => p.mode === "topic");
  const libraryProjects = projects.filter((p) => p.status === "ready");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="vater-neon text-2xl font-bold tracking-wide">
          Content Studio
        </h2>
        <div className="flex items-center gap-3">
          <a
            href="/vater/youtube/styles"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            title="Manage reusable Styles — voice, references, characters, visual defaults"
          >
            🎨 Styles
          </a>
          <span className="vater-badge">{projects.length} projects</span>
        </div>
      </div>

      <Tabs defaultValue="transcribe" syncUrl="tab" className="space-y-6">
        <TabList>
          <TabTrigger value="transcribe">Transcribe</TabTrigger>
          <TabTrigger value="topic">Topic</TabTrigger>
          <TabTrigger value="voices">Voices</TabTrigger>
          <TabTrigger value="library">
            Library
            {libraryProjects.length > 0 && (
              <span className="ml-1.5 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
                {libraryProjects.length}
              </span>
            )}
          </TabTrigger>
        </TabList>

        {/* ----- Transcribe tab ----- */}
        <TabPanel value="transcribe" className="space-y-6">
          <YouTubeImportTracker
            projects={projects}
            onCreated={handleCreated}
          />

          <YouTubeRssPanel onProjectCreated={handleCreated} />

          <ProjectsAndDetail
            loading={loading}
            projects={projects}
            activeProject={activeProject}
            activeId={activeId}
            onSelect={setActiveId}
            onDelete={handleDelete}
            onUpdate={handleProjectUpdate}
            emptyMessage="No projects yet. Paste a YouTube URL or add an RSS feed."
          />
        </TabPanel>

        {/* ----- Topic tab ----- */}
        <TabPanel value="topic" className="space-y-6">
          <YouTubeTopicForm onProjectCreated={handleCreated} />
          <ProjectsAndDetail
            loading={loading}
            projects={topicProjects}
            activeProject={
              activeProject && (activeProject.mode || "transcribe") === "topic"
                ? activeProject
                : null
            }
            activeId={activeId}
            onSelect={setActiveId}
            onDelete={handleDelete}
            onUpdate={handleProjectUpdate}
            emptyMessage="No topic-mode projects yet. Use the form above."
            transcribeOnlyHint
          />
          <p className="text-[10px] text-zinc-600">
            Showing {topicProjects.length} topic-mode project
            {topicProjects.length === 1 ? "" : "s"}. Transcribe-mode projects
            live in the Transcribe tab. Total: {projects.length} (
            {transcribeProjects.length} transcribe, {topicProjects.length}{" "}
            topic).
          </p>
        </TabPanel>

        {/* ----- Voices tab ----- */}
        <TabPanel value="voices" className="space-y-6">
          <YouTubeVoiceClonePanel mode="manage" />
        </TabPanel>

        {/* ----- Library tab ----- */}
        <TabPanel value="library" className="space-y-6">
          <div className="max-w-2xl">
            <p className="text-sm text-zinc-400">
              Every completed video in one place — play, download, or delete.
            </p>
          </div>
          {loading ? (
            <div className="vater-card p-6 text-center text-sm text-zinc-500">
              Loading library…
            </div>
          ) : (
            <YouTubeLibrary
              projects={libraryProjects}
              onDelete={handleDelete}
            />
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared list + detail layout
// ---------------------------------------------------------------------------

function ProjectsAndDetail({
  loading,
  projects,
  activeProject,
  activeId,
  onSelect,
  onDelete,
  onUpdate,
  emptyMessage,
  transcribeOnlyHint,
}: {
  loading: boolean;
  projects: YouTubeProject[];
  activeProject: YouTubeProject | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (project: YouTubeProject) => void;
  emptyMessage: string;
  transcribeOnlyHint?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        {loading ? (
          <div className="vater-card p-4 text-center text-zinc-500">
            Loading...
          </div>
        ) : projects.length === 0 ? (
          <div className="vater-card p-6 text-center text-zinc-500">
            {emptyMessage}
          </div>
        ) : (
          projects.map((p) => (
            <YouTubeProjectCard
              key={p.id}
              project={{
                id: p.id,
                sourceUrl: p.sourceUrl ?? p.topic ?? "",
                sourceTitle: p.sourceTitle,
                status: p.status,
                targetDuration: p.targetDuration,
                createdAt: p.createdAt,
                progress: p.progress,
                stylePreset: p.stylePreset,
                mode: p.mode,
                topic: p.topic,
              }}
              isActive={p.id === activeId}
              onClick={() => onSelect(p.id)}
              onDelete={() => onDelete(p.id)}
            />
          ))
        )}
      </div>

      <div>
        {activeProject ? (
          <YouTubeProjectDetail
            project={activeProject}
            onUpdate={onUpdate}
          />
        ) : (
          <div className="vater-card flex min-h-[400px] items-center justify-center p-8 text-center text-zinc-500">
            {transcribeOnlyHint
              ? "Pick a topic-mode project from the list, or create a new one above."
              : "Select a project to view the pipeline"}
          </div>
        )}
      </div>
    </div>
  );
}
