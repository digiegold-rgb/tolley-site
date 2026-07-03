"use client";

/**
 * YouTube Studio shell. Five tabs:
 *   - Transcribe: manual URL + RSS panel + projects list
 *   - Topic: tubegen-style topic form + topic-mode projects list
 *   - Voices: voice clone management
 *   - Styles: reusable style documents (voice + characters + art + refs)
 *   - Library: completed videos
 */

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { YouTubeRssPanel } from "./youtube-rss-panel";
import { YouTubeImportTracker } from "./youtube-import-tracker";
import { YouTubeProjectCard } from "./youtube-project-card";
import { YouTubeProjectDetail } from "./youtube-project-detail";
import { YouTubeTopicForm } from "./youtube-topic-form";
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import { YouTubeLibrary } from "./youtube-library";
import { StylesGallery } from "./styles/StylesGallery";
import { VaterObserverSidebar } from "./VaterObserverSidebar";

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
  editedAt: string | null;
  thumbnailUrl: string | null;
}

export function YouTubeStudio() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<YouTubeProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeId) || null;

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/vater/youtube");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setFetchError(null);
      } else {
        setFetchError(`Could not load projects (HTTP ${res.status}).`);
      }
    } catch (err) {
      setFetchError(
        err instanceof Error
          ? `Could not load projects: ${err.message}`
          : "Could not load projects — network error.",
      );
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
    // Confirm server delete BEFORE optimistically removing from the list. A
    // 5xx here used to silently ghost-delete projects (they'd reappear on
    // next fetch) which caused users to re-create duplicates.
    try {
      const res = await fetch(`/api/vater/youtube/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({
          title: "Delete failed",
          description: `Server returned HTTP ${res.status}. Try again.`,
          variant: "error",
        });
        return;
      }
    } catch (err) {
      toast({
        title: "Delete failed",
        description:
          err instanceof Error ? err.message : "Network error — try again.",
        variant: "error",
      });
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
  };

  // Fired after the compose-route call succeeds in the final player.
  // Flip status to match what the compose route writes server-side, so the
  // card leaves the Library tab immediately. The /poll route will flip it
  // back to `ready` + bump completedAt once the DGX finishes.
  const handleRecomposeStart = (id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "editing" } : p)),
    );
  };

  const transcribeProjects = projects.filter(
    (p) => (p.mode || "transcribe") === "transcribe",
  );
  const topicProjects = projects.filter((p) => p.mode === "topic");
  const libraryProjects = projects.filter((p) => p.status === "ready");

  return (
    <div>
      <VaterObserverSidebar activeJobId={activeProject?.autopilotJobId ?? null} />
      <div className="mb-6 flex items-center justify-between">
        <h2 className="vater-neon text-2xl font-bold tracking-wide">
          Content Studio
        </h2>
        <div className="flex items-center gap-2">
          <span className="vater-badge">{projects.length} projects</span>
        </div>
      </div>

      {fetchError ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <span className="text-amber-200">{fetchError}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setFetchError(null);
              fetchProjects();
            }}
            className="rounded bg-amber-500/20 px-3 py-1 font-semibold text-amber-100 hover:bg-amber-500/30"
          >
            Retry
          </button>
        </div>
      ) : null}

      <Tabs defaultValue="transcribe" syncUrl="tab" className="space-y-6">
        <TabList>
          <TabTrigger value="transcribe">Transcribe</TabTrigger>
          <TabTrigger value="topic">Topic</TabTrigger>
          <TabTrigger value="voices">Voices</TabTrigger>
          <TabTrigger value="styles">Styles</TabTrigger>
          <TabTrigger value="feeds">Feeds</TabTrigger>
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

          <ProjectsAndDetail
            loading={loading}
            projects={projects}
            activeProject={activeProject}
            activeId={activeId}
            onSelect={setActiveId}
            onDelete={handleDelete}
            onUpdate={handleProjectUpdate}
            onRecomposeStart={handleRecomposeStart}
            emptyMessage="No projects yet. Paste a YouTube URL above, or add a source in the Feeds tab."
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
            onRecomposeStart={handleRecomposeStart}
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

        {/* ----- Styles tab ----- */}
        <TabPanel value="styles" className="space-y-6">
          <StylesTabContent />
        </TabPanel>

        {/* ----- Feeds tab ----- */}
        <TabPanel value="feeds" className="space-y-6">
          <YouTubeRssPanel onProjectCreated={handleCreated} />
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
              onRecomposeStart={handleRecomposeStart}
            />
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles tab — client-side wrapper around StylesGallery
// ---------------------------------------------------------------------------

function StylesTabContent() {
  const [styles, setStyles] = useState<Parameters<typeof StylesGallery>[0]["styles"]>([]);
  const [stylesLoading, setStylesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/vater/youtube/styles");
        if (!r.ok) return;
        const data = await r.json();
        if (active) setStyles(data.styles ?? []);
      } catch {
        // ignore
      } finally {
        if (active) setStylesLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (stylesLoading) {
    return (
      <div className="vater-card p-6 text-center text-sm text-zinc-500">
        Loading styles…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <a
          href="/vater/youtube/custom-art-styles"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          title="Manage custom art styles — upload reference images"
        >
          🖌️ Custom Art Styles
        </a>
      </div>
      <StylesGallery styles={styles} userId="client" />
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
  onRecomposeStart,
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
  onRecomposeStart?: (id: string) => void;
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
                scenesJson: p.scenesJson,
                thumbnailUrl: p.thumbnailUrl,
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
            onRecomposeStart={onRecomposeStart}
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
