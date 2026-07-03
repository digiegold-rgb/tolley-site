/**
 * Dossier Pipeline — orchestrates plugin execution for deep lead research.
 *
 * Flow:
 * 1. Load listing data
 * 2. Get enabled + ready plugins
 * 3. Resolve dependency order
 * 4. Execute each plugin, passing prior results
 * 5. Aggregate into DossierResult
 * 6. Compute motivation score
 */

import { PrismaClient, Prisma } from "@prisma/client";
import type {
  DossierContext,
  DossierListing,
  DossierPlugin,
  DossierPluginResult,
  OwnerInfo,
  MotivationFlag,
  SourceLink,
} from "./types";
import { getReadyPlugins } from "./plugins/registry";
import { runSynthesis } from "./synthesis";

const prisma = new PrismaClient();

// ── Per-step execution detail (persisted into DossierJob.stepDetails) ──

type StepStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface StepDetail {
  status: StepStatus;
  source: "worker" | "plugin";
  tier?: number;
  attempt?: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  warnings?: string[];
  confidence?: number;
}

type StepDetails = Record<string, StepDetail>;

type Phase =
  | "initializing"
  | "health_check"
  | "research_worker"
  | "local_plugins"
  | "aggregating"
  | "done";

/**
 * PipelineTracker — owns all DB writes for a dossier job's progress state.
 *
 * Every mutation (phase change, step start, step finish) is flushed to the
 * DossierJob row immediately so live-polling clients see real-time state.
 * Writes are awaited serially to avoid race conditions on the JSON field.
 */
class PipelineTracker {
  readonly jobId: string;
  private stepDetails: StepDetails = {};
  private stepsCompleted: string[] = [];
  private stepsFailed: string[] = [];
  private currentPhase: Phase = "initializing";
  private currentStep: string | null = null;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /** Mark a plugin/worker step as queued but not yet running. */
  register(name: string, source: "worker" | "plugin", tier?: number) {
    this.stepDetails[name] = {
      status: "pending",
      source,
      tier,
    };
  }

  /** Mark a step as running (sets startedAt). */
  async start(name: string) {
    const existing = this.stepDetails[name] ?? {
      status: "pending" as StepStatus,
      source: "plugin" as const,
    };
    this.stepDetails[name] = {
      ...existing,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.currentStep = name;
    await this.flush({ updateCurrentStep: true });
  }

  /** Mark a step as completed successfully. */
  async succeed(
    name: string,
    opts?: { durationMs?: number; warnings?: string[]; confidence?: number }
  ) {
    const existing = this.stepDetails[name];
    const durationMs =
      opts?.durationMs ??
      (existing?.startedAt
        ? Date.now() - new Date(existing.startedAt).getTime()
        : undefined);
    this.stepDetails[name] = {
      ...(existing ?? { source: "plugin" }),
      status: "success",
      finishedAt: new Date().toISOString(),
      durationMs,
      warnings: opts?.warnings,
      confidence: opts?.confidence,
    };
    if (!this.stepsCompleted.includes(name)) this.stepsCompleted.push(name);
    await this.flush();
  }

  /** Mark a step as failed and record the error message. */
  async fail(name: string, error: string, opts?: { attempt?: number }) {
    const existing = this.stepDetails[name];
    const durationMs = existing?.startedAt
      ? Date.now() - new Date(existing.startedAt).getTime()
      : undefined;
    this.stepDetails[name] = {
      ...(existing ?? { source: "plugin" }),
      status: "failed",
      finishedAt: new Date().toISOString(),
      durationMs,
      error: error.slice(0, 500),
      attempt: opts?.attempt,
    };
    if (!this.stepsFailed.includes(name)) this.stepsFailed.push(name);
    await this.flush();
  }

  /** Mark a step as skipped (e.g. no config, workflow excluded it). */
  async skip(name: string, reason: string) {
    this.stepDetails[name] = {
      ...(this.stepDetails[name] ?? { source: "plugin" }),
      status: "skipped",
      error: reason,
    };
    await this.flush();
  }

  async setPhase(phase: Phase) {
    this.currentPhase = phase;
    await this.flush();
  }

  async setProgress(progress: number) {
    await prisma.dossierJob.update({
      where: { id: this.jobId },
      data: { progress: Math.min(Math.max(progress, 0), 100) },
    });
  }

  /** Write the current tracker state to the job row. */
  private async flush(opts?: { updateCurrentStep?: boolean }) {
    const data: Record<string, unknown> = {
      stepDetails: this.stepDetails as unknown as object,
      stepsCompleted: this.stepsCompleted,
      stepsFailed: this.stepsFailed,
      currentPhase: this.currentPhase,
    };
    if (opts?.updateCurrentStep && this.currentStep) {
      data.currentStep = this.currentStep;
    }
    await prisma.dossierJob.update({
      where: { id: this.jobId },
      data,
    });
  }

  /** Final flush used on pipeline completion. */
  async finalize(opts: {
    status: "complete" | "partial" | "failed";
    errorMessage?: string;
  }) {
    this.currentPhase = "done";
    this.currentStep = null;
    await prisma.dossierJob.update({
      where: { id: this.jobId },
      data: {
        status: opts.status,
        progress: 100,
        currentStep: null,
        currentPhase: "done",
        stepDetails: this.stepDetails as unknown as object,
        stepsCompleted: this.stepsCompleted,
        stepsFailed: this.stepsFailed,
        errorMessage: opts.errorMessage ?? null,
        completedAt: new Date(),
      },
    });
  }

  getCompleted(): string[] {
    return [...this.stepsCompleted];
  }

  getFailed(): string[] {
    return [...this.stepsFailed];
  }
}

/** Ping a research worker health endpoint with a short timeout. */
async function healthCheckResearchWorker(
  url: string,
  auth: string
): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/health`, {
      headers: { "x-auth-token": auth },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { ok: false, error: `health returned ${res.status}`, latencyMs };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
      latencyMs: Date.now() - start,
    };
  }
}

export async function runDossierPipeline(jobId: string): Promise<void> {
  // Load job + listing
  const job = await prisma.dossierJob.findUnique({
    where: { id: jobId },
    include: { listing: { include: { enrichment: true, leads: true } } },
  });

  if (!job || !job.listing) {
    await prisma.dossierJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: "Job or listing not found" },
    });
    return;
  }

  // Mark running
  await prisma.dossierJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
      currentPhase: "initializing",
      stepDetails: {},
      stepsCompleted: [],
      stepsFailed: [],
      errorMessage: null,
    },
  });

  const tracker = new PipelineTracker(jobId);

  // Extract useful fields from MLS rawData
  const raw = (job.listing.rawData || {}) as Record<string, unknown>;
  const parcelNumber = typeof raw.ParcelNumber === "string" ? raw.ParcelNumber : null;

  const listing: DossierListing = {
    id: job.listing.id,
    mlsId: job.listing.mlsId,
    address: job.listing.address,
    city: job.listing.city,
    state: job.listing.state,
    zip: job.listing.zip,
    lat: job.listing.lat,
    lng: job.listing.lng,
    listPrice: job.listing.listPrice,
    originalListPrice: job.listing.originalListPrice,
    beds: job.listing.beds,
    baths: job.listing.baths,
    sqft: job.listing.sqft,
    propertyType: job.listing.propertyType,
    daysOnMarket: job.listing.daysOnMarket,
    status: job.listing.status,
    photoUrls: job.listing.photoUrls,
    listAgentName: job.listing.listAgentName,
    rawData: job.listing.rawData,
  };

  // Get plugins that are enabled + have config (local fallback)
  const { ready: plugins, notReady } = getReadyPlugins();

  // ── Resolve owner name from available sources ──
  // Priority: rawData.ownerName (user-provided) → linked Lead.ownerName → MLS rawData
  let seedOwnerName: string | undefined;
  if (typeof raw.ownerName === "string" && raw.ownerName.trim()) {
    seedOwnerName = raw.ownerName.trim();
  }
  if (!seedOwnerName && job.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: job.leadId }, select: { ownerName: true } });
    if (lead?.ownerName) seedOwnerName = lead.ownerName;
  }
  if (seedOwnerName) {
    console.log(`[Dossier] Seed owner name: "${seedOwnerName}"`);
  }

  const priorResults: Record<string, DossierPluginResult> = {};
  const knownOwners: OwnerInfo[] = [];

  // Pre-seed known owners from user-provided or lead data
  if (seedOwnerName) {
    knownOwners.push({
      name: seedOwnerName,
      role: "owner",
      confidence: 0.9,
    });
  }

  // ── Load active workflow config (if any) ──
  let enabledScrapers: string[] | undefined;
  let enabledLocalPlugins: Set<string> | undefined;
  try {
    const activeWorkflow = await prisma.pipelineWorkflow.findFirst({
      where: { userId: job.requestedBy || "", isActive: true },
      select: { nodes: true },
    });
    if (activeWorkflow?.nodes) {
      const workflowNodes = activeWorkflow.nodes as { data?: { scraperId?: string; pluginType?: string } }[];
      const scraperIds = workflowNodes
        .map((n) => n.data?.scraperId)
        .filter((s): s is string => !!s && s !== "mls" && s !== "score-profile" && s !== "owner-verification");
      if (scraperIds.length > 0) {
        enabledScrapers = scraperIds;
        console.log(`[Dossier] Active workflow limits scrapers to: ${enabledScrapers.join(", ")}`);

        // Build set of local plugin names from workflow nodes
        const localPluginNames = new Set(plugins.map((p) => p.name));
        enabledLocalPlugins = new Set(
          scraperIds.filter((id) => localPluginNames.has(id))
        );
        if (enabledLocalPlugins.size > 0) {
          console.log(`[Dossier] Active workflow limits local plugins to: ${[...enabledLocalPlugins].join(", ")}`);
        }
      }
    }
  } catch { /* no workflow config — run all scrapers */ }

  // ── DGX Research Worker (primary — uses Playwright browser automation) ──
  const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL;
  const RESEARCH_AUTH = process.env.SYNC_SECRET || "";

  tracker.register("dgx-research-worker", "worker");
  await tracker.setProgress(5);

  if (RESEARCH_WORKER_URL) {
    // ── Phase 1: Health precheck ──
    // If the worker is unreachable there's no point burning a 5-minute
    // timeout waiting on it. A fast fail here lets the local-plugin
    // fallbacks start ~5 minutes earlier.
    await tracker.setPhase("health_check");
    tracker.register("health-check", "worker");
    await tracker.start("health-check");
    const health = await healthCheckResearchWorker(RESEARCH_WORKER_URL, RESEARCH_AUTH);
    if (health.ok) {
      await tracker.succeed("health-check", { durationMs: health.latencyMs });
    } else {
      await tracker.fail(
        "health-check",
        `research worker unreachable: ${health.error}`
      );
      // Also mark the main worker step as failed so the user sees the cause
      await tracker.start("dgx-research-worker");
      await tracker.fail(
        "dgx-research-worker",
        `skipped — health check failed (${health.error}). Falling back to local plugins.`
      );
    }

    if (health.ok) {
      // ── Phase 2: Run the worker with one retry on transient failure ──
      await tracker.setPhase("research_worker");
      await tracker.start("dgx-research-worker");
      await tracker.setProgress(10);

      const workerStart = Date.now();
      let workerData: Record<string, unknown> | null = null;
      let workerError: string | null = null;
      let wasConflict = false;
      let conflictJobId: string | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `[Dossier] Calling DGX research worker (attempt ${attempt}): ${RESEARCH_WORKER_URL}/research`
          );
          const workerRes = await fetch(`${RESEARCH_WORKER_URL}/research`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-auth-token": RESEARCH_AUTH,
            },
            body: JSON.stringify({
              jobId,
              address: listing.address,
              city: listing.city,
              state: listing.state,
              zip: listing.zip,
              county: job.listing.enrichment?.countyName || undefined,
              lat: listing.lat,
              lng: listing.lng,
              listPrice: listing.listPrice,
              ownerName: seedOwnerName,
              enabledScrapers,
            }),
            signal: AbortSignal.timeout(1_200_000), // 20 min — CBC + court + obit can take 5-10 min when an owner is found
          });

          if (workerRes.ok) {
            workerData = (await workerRes.json()) as Record<string, unknown>;
            workerError = null;
            break;
          }

          const errText = await workerRes.text().catch(() => "");

          // 409 = worker is already running a job for this address. Don't
          // retry and don't mark as failed — this is expected behavior when
          // the user re-runs research while a previous call is still in
          // flight. Try to grab the conflicting jobId so we can fetch its
          // results once it finishes.
          if (workerRes.status === 409) {
            wasConflict = true;
            try {
              const errJson = JSON.parse(errText) as { jobId?: string };
              if (errJson.jobId) conflictJobId = errJson.jobId;
            } catch {
              /* response wasn't JSON, that's fine */
            }
            workerError = conflictJobId
              ? `worker is already processing this address (existing job ${conflictJobId})`
              : "worker is already processing this address";
            console.warn(`[Dossier] ${workerError} — skipping worker phase`);
            break;
          }

          workerError = `worker returned ${workerRes.status}: ${errText.slice(0, 200)}`;
          console.error(`[Dossier] Research worker error: ${workerError}`);

          // Only retry on 5xx (transient server error). 4xx won't improve.
          if (workerRes.status < 500) break;
        } catch (err) {
          workerError = err instanceof Error ? err.message : "unknown error";
          console.error(`[Dossier] Research worker attempt ${attempt} failed:`, err);
        }

        if (attempt < 2) {
          // Short backoff before retry
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // ── Concurrency conflict — poll the existing job's results ──
      // If the worker said "already processing", try polling for ~90 seconds
      // to see if the conflicting job finishes and returns data we can use.
      // This gives the user the worker's output instead of making them wait
      // and re-run.
      if (wasConflict && conflictJobId) {
        console.log(
          `[Dossier] Polling worker for conflict job ${conflictJobId}...`
        );
        const pollStart = Date.now();
        const POLL_TIMEOUT_MS = 90_000;
        const POLL_INTERVAL_MS = 3_000;

        while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
          try {
            const statusRes = await fetch(
              `${RESEARCH_WORKER_URL}/research/${conflictJobId}`,
              {
                headers: { "x-auth-token": RESEARCH_AUTH },
                signal: AbortSignal.timeout(10_000),
              }
            );
            if (statusRes.ok) {
              const statusData = (await statusRes.json()) as Record<string, unknown>;
              const status = statusData.status as string | undefined;
              if (
                status === "complete" ||
                status === "partial" ||
                status === "done"
              ) {
                workerData = statusData;
                workerError = null;
                console.log(
                  `[Dossier] Adopted results from conflict job ${conflictJobId}`
                );
                break;
              }
            }
          } catch (err) {
            console.warn(
              `[Dossier] Poll for conflict job failed:`,
              err instanceof Error ? err.message : err
            );
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      }

      const workerDuration = Date.now() - workerStart;

      if (workerData) {
        console.log(
          `[Dossier] Research worker returned: status=${workerData.status}, duration=${workerDuration}ms`
        );

        const wd = workerData as {
          status?: string;
          owners?: OwnerInfo[];
          courtRecords?: { type: string }[];
          socialProfiles?: unknown[];
          propertyHistory?: unknown[];
          backgroundCheck?: { relatives?: string[] } | null;
          obituaries?: unknown[];
          property?: {
            streetViewUrl?: string;
            satelliteUrl?: string;
            photos?: string[];
            assessedValue?: number;
            marketValue?: number;
          };
          sources?: (SourceLink & { category: string })[];
          errors?: { scraper: string; error: string }[];
          blockedSources?: unknown[];
          motivationScore?: number;
          motivationFlags?: string[];
          intelligenceBrief?: string;
          llmTokensUsed?: number;
          duration_ms?: number;
        };

        // Map worker results into plugin result format for downstream aggregation
        if (wd.owners && wd.owners.length > 0) {
          for (const owner of wd.owners) {
            if (
              !knownOwners.some(
                (o: OwnerInfo) => o.name.toLowerCase() === owner.name.toLowerCase()
              )
            ) {
              knownOwners.push(owner);
            }
          }
          priorResults["county-assessor"] = {
            pluginName: "county-assessor",
            success: true,
            data: {
              owners: wd.owners,
              rawEntityName: wd.owners[0]?.name,
              assessedValue: wd.property?.assessedValue,
              marketValue: wd.property?.marketValue,
            },
            sources:
              wd.sources?.filter((s) => s.category === "property") || [],
            confidence: 0.8,
            warnings: [],
            durationMs: wd.duration_ms ?? 0,
          };
          tracker.register("county-assessor", "worker");
          await tracker.succeed("county-assessor", { confidence: 0.8 });
        }

        if (wd.courtRecords && wd.courtRecords.length > 0) {
          priorResults["court-records"] = {
            pluginName: "court-records",
            success: true,
            data: { courtCases: wd.courtRecords, liens: [], bankruptcies: [] },
            sources: wd.sources?.filter((s) => s.category === "legal") || [],
            confidence: 0.7,
            warnings: [],
            durationMs: 0,
          };
          tracker.register("court-records", "worker");
          await tracker.succeed("court-records", { confidence: 0.7 });
        }

        if (wd.socialProfiles && wd.socialProfiles.length > 0) {
          // Seed the worker's social profiles, but DELIBERATELY do not mark
          // people-search as covered (no tracker.register/succeed here).
          // Leaving it uncovered lets the local people-search plugin run its
          // full pass — the live SerpAPI google-engine owner lookup
          // (serpapiSearchProfiles, tag "dossier-people-search") plus Google
          // CSE + Brave + manual skip-trace links. The plugin folds these seed
          // profiles back in at the start of its run, so nothing is lost.
          // Previously this block called tracker.succeed("people-search"),
          // which put it in coveredSteps and filtered the plugin out entirely,
          // silently zeroing the paid SerpAPI people-search path — the #1
          // motivated-seller owner-identification lever (0 calls in 30 days).
          priorResults["people-search"] = {
            pluginName: "people-search",
            success: true,
            data: { socialProfiles: wd.socialProfiles, webMentions: [] },
            sources: wd.sources?.filter((s) => s.category === "social") || [],
            confidence: 0.6,
            warnings: [],
            durationMs: 0,
          };
        }

        if (wd.propertyHistory && wd.propertyHistory.length > 0) {
          priorResults["property-history"] = {
            pluginName: "property-history",
            success: true,
            data: { deedHistory: wd.propertyHistory },
            sources:
              wd.sources?.filter((s) =>
                /zillow|redfin|realtor|homes/i.test(s.label)
              ) || [],
            confidence: 0.7,
            warnings: [],
            durationMs: 0,
          };
          tracker.register("property-history", "worker");
          await tracker.succeed("property-history", { confidence: 0.7 });
        }

        if (wd.backgroundCheck || (wd.obituaries && wd.obituaries.length > 0)) {
          priorResults["skip-trace"] = {
            pluginName: "skip-trace",
            success: true,
            data: {
              backgroundCheck: wd.backgroundCheck,
              obituaries: wd.obituaries,
              relatedPeople:
                wd.backgroundCheck?.relatives?.map((r: string) => ({
                  name: r,
                  relationship: "associate",
                })) || [],
            },
            sources:
              wd.sources?.filter(
                (s) => s.category === "people" || s.category === "obituary"
              ) || [],
            confidence: 0.6,
            warnings: [],
            durationMs: 0,
          };
          tracker.register("skip-trace", "worker");
          await tracker.succeed("skip-trace", { confidence: 0.6 });
        }

        if (
          wd.property?.streetViewUrl ||
          (wd.property?.photos && wd.property.photos.length > 0)
        ) {
          priorResults["street-view"] = {
            pluginName: "street-view",
            success: true,
            data: {
              streetViewUrl: wd.property.streetViewUrl,
              satelliteUrl: wd.property.satelliteUrl,
              neighborhoodPhotos: wd.property.photos || [],
            },
            sources: [],
            confidence: 0.8,
            warnings: [],
            durationMs: 0,
          };
          tracker.register("street-view", "worker");
          await tracker.succeed("street-view", { confidence: 0.8 });
        }

        // Store all worker sources as a meta result
        priorResults["dgx-research-worker"] = {
          pluginName: "dgx-research-worker",
          success: true,
          data: {
            workerStatus: wd.status,
            allSources: wd.sources,
            allErrors: wd.errors,
            blockedSources: wd.blockedSources || [],
            motivationScore: wd.motivationScore,
            motivationFlags: wd.motivationFlags,
            intelligenceBrief: wd.intelligenceBrief,
            llmTokensUsed: wd.llmTokensUsed,
          },
          sources: wd.sources || [],
          confidence: 0.8,
          warnings:
            wd.errors?.map((e) => `${e.scraper}: ${e.error}`) || [],
          durationMs: wd.duration_ms ?? workerDuration,
        };
        await tracker.succeed("dgx-research-worker", {
          durationMs: wd.duration_ms ?? workerDuration,
          warnings: wd.errors?.map((e) => `${e.scraper}: ${e.error}`),
          confidence: 0.8,
        });
      } else if (wasConflict) {
        // Concurrency conflict and we couldn't adopt results — skip, don't fail
        await tracker.skip(
          "dgx-research-worker",
          workerError ??
            "another dossier run is already processing this address; local plugins will fill in"
        );
      } else {
        await tracker.fail(
          "dgx-research-worker",
          workerError ?? "Unknown worker error"
        );
      }
    }
  } else {
    await tracker.skip(
      "dgx-research-worker",
      "RESEARCH_WORKER_URL env var not configured"
    );
  }

  // ── Local plugins (fallback for any steps the worker didn't cover) ──
  await tracker.setPhase("local_plugins");

  // Filter plugins by workflow config (if active)
  const workflowFilteredPlugins = enabledLocalPlugins
    ? plugins.filter((p) => enabledLocalPlugins!.has(p.name))
    : plugins;

  if (enabledLocalPlugins) {
    const skipped = plugins
      .filter((p) => !enabledLocalPlugins!.has(p.name))
      .map((p) => p.name);
    if (skipped.length > 0) {
      console.log(`[Dossier] Workflow skipping local plugins: ${skipped.join(", ")}`);
      for (const name of skipped) {
        await tracker.skip(name, "excluded by active workflow");
      }
    }
  }

  if (notReady.length > 0) {
    console.log(
      `[Dossier] Skipping plugins missing config: ${notReady
        .map((n) => `${n.plugin.name} (needs: ${n.missing.join(", ")})`)
        .join("; ")}`
    );
    for (const nr of notReady) {
      await tracker.skip(
        nr.plugin.name,
        `missing required config: ${nr.missing.join(", ")}`
      );
    }
  }

  const coveredSteps = new Set(tracker.getCompleted());

  // ── Tier-based parallel execution ──
  const tiers = resolveExecutionTiers(workflowFilteredPlugins);

  // Pre-register every plugin with its tier so the UI can group/order them
  for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
    for (const plugin of tiers[tierIdx]) {
      if (!coveredSteps.has(plugin.name)) {
        tracker.register(plugin.name, "plugin", tierIdx);
      }
    }
  }

  let pluginsProcessed = 0;
  const totalPlugins = workflowFilteredPlugins.filter(
    (p) => !coveredSteps.has(p.name)
  ).length;
  const progressBase = RESEARCH_WORKER_URL ? 50 : 15;
  const progressRange = 95 - progressBase;

  for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
    const tier = tiers[tierIdx];
    const tierPlugins = tier.filter((p) => !coveredSteps.has(p.name));

    if (tierPlugins.length === 0) continue;

    console.log(
      `[Dossier] Tier ${tierIdx}: running ${tierPlugins.map((p) => p.name).join(", ")} in parallel`
    );

    await Promise.allSettled(
      tierPlugins.map(async (plugin) => {
        await tracker.start(plugin.name);
        const context: DossierContext = {
          listing,
          priorResults,
          knownOwners: [...knownOwners],
          jobId,
          updateProgress: async (message: string) => {
            // Context updates now only modify the currentStep label for the
            // active plugin — tracker keeps the canonical step map.
            await prisma.dossierJob.update({
              where: { id: jobId },
              data: { currentStep: `${plugin.name}: ${message}` },
            });
          },
        };

        try {
          console.log(`[Dossier] Running local plugin: ${plugin.name}`);
          const result = await plugin.run(context);
          priorResults[plugin.name] = result;

          if (result.success && result.data.owners) {
            const newOwners = result.data.owners as OwnerInfo[];
            for (const owner of newOwners) {
              if (
                !knownOwners.some(
                  (o) => o.name.toLowerCase() === owner.name.toLowerCase()
                )
              ) {
                knownOwners.push(owner);
              }
            }
          }

          if (result.success && result.data.updatedOwners) {
            const updated = result.data.updatedOwners as OwnerInfo[];
            for (const upd of updated) {
              const idx = knownOwners.findIndex(
                (o) => o.name.toLowerCase() === upd.name.toLowerCase()
              );
              if (idx >= 0) knownOwners[idx] = { ...knownOwners[idx], ...upd };
            }
          }

          if (result.success) {
            await tracker.succeed(plugin.name, {
              durationMs: result.durationMs,
              warnings: result.warnings?.length ? result.warnings : undefined,
              confidence: result.confidence,
            });
          } else {
            await tracker.fail(
              plugin.name,
              result.error ?? "plugin reported failure"
            );
          }
        } catch (err) {
          console.error(`[Dossier] Plugin ${plugin.name} crashed:`, err);
          priorResults[plugin.name] = {
            pluginName: plugin.name,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
            data: {},
            sources: [],
            confidence: 0,
            warnings: [],
            durationMs: 0,
          };
          await tracker.fail(
            plugin.name,
            err instanceof Error ? err.message : "Unknown crash"
          );
        } finally {
          pluginsProcessed++;
          const progressPct =
            progressBase + Math.round((pluginsProcessed / Math.max(totalPlugins, 1)) * progressRange);
          await tracker.setProgress(Math.min(progressPct, 95));
        }
      })
    );
  }

  await tracker.setPhase("aggregating");

  // Compute motivation score
  const { score: motivationScore, flags: motivationFlags } = computeMotivation(
    priorResults,
    listing,
    job.listing.leads[0]?.scoreFactors as Record<string, number> | null
  );

  // Aggregate results into DossierResult
  const pluginData: Record<string, unknown> = {};
  for (const [name, result] of Object.entries(priorResults)) {
    pluginData[name] = {
      success: result.success,
      data: result.data,
      sources: result.sources,
      confidence: result.confidence,
      warnings: result.warnings,
      durationMs: result.durationMs,
      error: result.error,
    };
  }

  // Build aggregated fields
  const courtCases = collectFromPlugins(priorResults, "courtCases");
  const liens = collectFromPlugins(priorResults, "liens");
  const bankruptcies = collectFromPlugins(priorResults, "bankruptcies");
  const taxRecords = collectFromPlugins(priorResults, "taxRecords");
  const deedHistory = collectFromPlugins(priorResults, "deedHistory");
  const socialProfiles = collectFromPlugins(priorResults, "socialProfiles");
  const webMentions = collectFromPlugins(priorResults, "webMentions");
  const relatedPeople = collectFromPlugins(priorResults, "relatedPeople");

  // Intelligence brief from research worker LLM analysis
  const workerResult = priorResults["dgx-research-worker"];
  const researchSummary = workerResult?.data?.intelligenceBrief as string | undefined;

  // Financial data from financial-analysis plugin
  const finResult = priorResults["financial-analysis"];
  const financialData = finResult?.success && finResult.data.financialData
    ? JSON.parse(JSON.stringify(finResult.data.financialData))
    : undefined;

  // New plugin data extraction
  const neighborhoodResult = priorResults["neighborhood"];
  const neighborhoodData = neighborhoodResult?.success
    ? JSON.parse(JSON.stringify(neighborhoodResult.data))
    : undefined;

  const permitsResult = priorResults["permits"];
  const permitData = permitsResult?.success
    ? JSON.parse(JSON.stringify(permitsResult.data))
    : undefined;

  const rentalResult = priorResults["rental"];
  const rentalData = rentalResult?.success
    ? JSON.parse(JSON.stringify(rentalResult.data))
    : undefined;

  const businessResult = priorResults["business"];
  const businessData = businessResult?.success
    ? JSON.parse(JSON.stringify(businessResult.data))
    : undefined;

  const envResult = priorResults["environmental"];
  const environmentalData = envResult?.success
    ? JSON.parse(JSON.stringify(envResult.data))
    : undefined;

  const marketResult = priorResults["market"];
  const marketData = marketResult?.success
    ? JSON.parse(JSON.stringify(marketResult.data))
    : undefined;

  const aiSummaryResult = priorResults["ai-summary"];
  const customData = aiSummaryResult?.success
    ? JSON.parse(JSON.stringify(aiSummaryResult.data))
    : undefined;

  // Street view / satellite from street-view plugin
  const svResult = priorResults["street-view"];
  const streetViewUrl = svResult?.data?.streetViewUrl as string | undefined;
  const satelliteUrl = svResult?.data?.satelliteUrl as string | undefined;
  const neighborhoodPhotos = (svResult?.data?.neighborhoodPhotos as string[]) || [];

  // Determine entity type from owners
  let entityType = "individual";
  let entityName: string | null = null;
  if (knownOwners.length > 0) {
    const firstOwner = knownOwners[0];
    if (firstOwner.role === "trustee") {
      entityType = "trust";
      entityName = priorResults["county-assessor"]?.data?.entityName as string || null;
    } else if (knownOwners.length > 1) {
      entityType = "joint";
    }
    // Check for LLC/corp patterns
    const rawEntity = priorResults["county-assessor"]?.data?.rawEntityName as string;
    if (rawEntity) {
      const lower = rawEntity.toLowerCase();
      if (lower.includes("llc")) entityType = "llc";
      else if (lower.includes("corp") || lower.includes("inc")) entityType = "corporate";
      else if (lower.includes("trust")) entityType = "trust";
      else if (lower.includes("estate")) entityType = "estate";
      if (entityType !== "individual" && entityType !== "joint") {
        entityName = rawEntity;
      }
    }
  }

  // Save result — upsert so concurrent pipeline runs for the same jobId
  // merge instead of crashing with "Unique constraint failed on (jobId)".
  // This happens when both the /api/leads/dossier after() handler AND the
  // dossier-process cron pick up the same queued job simultaneously.
  const resultData = {
    // Use JsonNull (not undefined) so a re-run with no owner found CLEARS any prior
    // value on upsert.update — undefined is a Prisma no-op and would leave stale
    // (e.g. demo placeholder) owners in the row, leaking into the digest.
    owners: knownOwners.length > 0 ? JSON.parse(JSON.stringify(knownOwners)) : Prisma.JsonNull,
    entityType,
    entityName,
    courtCases: courtCases.length > 0 ? JSON.parse(JSON.stringify(courtCases)) : undefined,
    liens: liens.length > 0 ? JSON.parse(JSON.stringify(liens)) : undefined,
    bankruptcies: bankruptcies.length > 0 ? JSON.parse(JSON.stringify(bankruptcies)) : undefined,
    taxRecords: taxRecords.length > 0 ? JSON.parse(JSON.stringify(taxRecords)) : undefined,
    deedHistory: deedHistory.length > 0 ? JSON.parse(JSON.stringify(deedHistory)) : undefined,
    socialProfiles: socialProfiles.length > 0 ? JSON.parse(JSON.stringify(socialProfiles)) : undefined,
    webMentions: webMentions.length > 0 ? JSON.parse(JSON.stringify(webMentions)) : undefined,
    relatedPeople: relatedPeople.length > 0 ? JSON.parse(JSON.stringify(relatedPeople)) : undefined,
    streetViewUrl,
    satelliteUrl,
    neighborhoodPhotos,
    motivationScore,
    motivationFlags,
    researchSummary,
    financialData,
    neighborhoodData,
    permitData,
    rentalData,
    businessData,
    environmentalData,
    marketData,
    customData,
    pluginData: JSON.parse(JSON.stringify(pluginData)),
  };
  await prisma.dossierResult.upsert({
    where: { jobId },
    create: { jobId, ...resultData },
    update: resultData,
  });

  // ── Pre-register synthesis step so the UI sees it from the start ──
  // Synthesis is a long-running OpenManus call (60-90s when it works). We
  // finalize the job BEFORE running it so the user gets a usable dossier
  // even if Vercel kills the function mid-synthesis. Narrative is best-
  // effort — the cron safety net won't reap a completed job.
  tracker.register("synthesis-narrative", "worker");

  // Mark job complete — classification:
  // "failed"   = zero real data collected (every attempted step failed)
  // "partial"  = some steps failed but core data exists
  // "complete" = every attempted step succeeded
  const completed = tracker.getCompleted();
  const failed = tracker.getFailed();
  const attempted = completed.length + failed.length;

  const finalStatus =
    attempted === 0 || completed.length === 0
      ? "failed"
      : failed.length > 0
        ? "partial"
        : "complete";

  const errorMessage =
    finalStatus === "failed"
      ? failed.length > 0
        ? `All attempted steps failed (${failed.join(", ")})`
        : "No steps executed"
      : undefined;

  await tracker.finalize({ status: finalStatus, errorMessage });

  console.log(
    `[Dossier] Job ${jobId} ${finalStatus}: ${completed.length} completed, ${failed.length} failed`
  );

  // ── Post-finalization: best-effort synthesis narrative ──────
  // Runs AFTER the job is marked terminal so the user can view the dossier
  // regardless of whether synthesis completes. If Vercel kills the function
  // mid-synthesis, the DossierResult is already persisted; the narrative
  // just stays null until the user re-triggers research.
  //
  // We write synthesis state into stepDetails directly (not via tracker,
  // since the tracker has already finalized the job). Success updates the
  // DossierResult with narrativeReport; failure/skip updates stepDetails.
  try {
    const synStart = Date.now();

    // Mark as running in the JSON map
    await markSynthesisStatus(jobId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const synthesis = await runSynthesis(
      {
        jobId,
        listing,
        priorResults,
        knownOwners,
        motivationScore,
        motivationFlags,
        courtCases: courtCases as unknown as import("./types").CourtCase[],
        liens: liens as unknown as import("./types").LienRecord[],
        bankruptcies: bankruptcies as unknown as import("./types").BankruptcyRecord[],
        taxRecords: taxRecords as unknown as import("./types").TaxRecord[],
        deedHistory: deedHistory as unknown as import("./types").DeedRecord[],
        financialData,
        neighborhoodData,
        marketData,
        researchSummary,
        entityType,
        entityName,
      },
      // ── Critical: persist pending state IMMEDIATELY on task submission ──
      // If Vercel kills this function during the 90s poll loop, the
      // /api/cron/dossier-synthesis-poll cron needs the taskId to
      // reconcile the eventually-completed Manus task. Writing the meta
      // here (instead of after the poll returns) ensures the poll cron
      // can always find orphaned tasks even when the function dies
      // mid-poll.
      async (taskId) => {
        await prisma.dossierResult.update({
          where: { jobId },
          data: {
            narrativeMeta: {
              status: "pending",
              taskId,
              submittedAt: new Date().toISOString(),
              inlineDurationMs: 0, // filled in if the poll completes
            },
          },
        });
      }
    );

    if (synthesis.success && synthesis.narrativeReport) {
      await prisma.dossierResult.update({
        where: { jobId },
        data: {
          narrativeReport: synthesis.narrativeReport,
          narrativeMeta: {
            status: "completed",
            taskId: synthesis.taskId,
            stepsUsed: synthesis.stepsUsed,
            durationMs: synthesis.durationMs,
            generatedAt: new Date().toISOString(),
          },
        },
      });
      await markSynthesisStatus(jobId, {
        status: "success",
        durationMs: synthesis.durationMs,
        confidence: 0.85,
      });
    } else if (!synthesis.success && synthesis.taskId) {
      // ── Inline timeout with a live Manus task ──────────────
      // The 90s inline budget ran out but the task is still cooking on the
      // DGX side (real runs take 6-9 min). Stash the taskId so the async
      // poll cron (/api/cron/dossier-synthesis-poll) can finish the job by
      // fetching the narrative when Manus actually completes.
      //
      // We still mark the step as "failed" in stepDetails (the inline call
      // honestly did time out) — the poller will upgrade it to "success"
      // when it writes the narrative back. narrativeMeta.status carries the
      // real async lifecycle state.
      await prisma.dossierResult.update({
        where: { jobId },
        data: {
          narrativeMeta: {
            status: "pending",
            taskId: synthesis.taskId,
            submittedAt: new Date().toISOString(),
            inlineDurationMs: synthesis.durationMs,
          },
        },
      });
      await markSynthesisStatus(jobId, {
        status: "failed",
        durationMs: synthesis.durationMs,
        error: `inline timed out, async reconciliation pending (taskId=${synthesis.taskId})`,
      });
    } else {
      const err = synthesis.error ?? "synthesis returned no narrative";
      const isSkip = /unreachable|not configured|skipped/i.test(err);
      await markSynthesisStatus(jobId, {
        status: isSkip ? "skipped" : "failed",
        durationMs: Date.now() - synStart,
        error: err,
      });
    }
  } catch (err) {
    // Never let synthesis errors derail anything — the dossier is already
    // finalized and persisted.
    console.error(`[Dossier] Post-finalize synthesis crashed for ${jobId}:`, err);
    try {
      await markSynthesisStatus(jobId, {
        status: "failed",
        error: err instanceof Error ? err.message : "unknown synthesis crash",
      });
    } catch {
      /* tolerate DB errors during cleanup */
    }
  }
}

/**
 * Write synthesis status into the DossierJob.stepDetails JSON without going
 * through PipelineTracker (which has already finalized the job and would
 * reset status/progress). Merges over the existing stepDetails map.
 */
async function markSynthesisStatus(
  jobId: string,
  patch: {
    status: "running" | "success" | "failed" | "skipped";
    startedAt?: string;
    durationMs?: number;
    error?: string;
    confidence?: number;
  }
): Promise<void> {
  const current = await prisma.dossierJob.findUnique({
    where: { id: jobId },
    select: { stepDetails: true },
  });
  const existing =
    (current?.stepDetails as Record<string, Record<string, unknown>> | null) ?? {};
  const prior = existing["synthesis-narrative"] ?? { source: "worker" };

  const merged: Record<string, unknown> = {
    ...prior,
    ...patch,
  };
  if (patch.status === "success" || patch.status === "failed" || patch.status === "skipped") {
    merged.finishedAt = new Date().toISOString();
  }

  existing["synthesis-narrative"] = merged;

  await prisma.dossierJob.update({
    where: { id: jobId },
    data: { stepDetails: existing as unknown as object },
  });
}

// ── Helpers ─────────────────────────────────────────────────

/** Topological sort into parallel execution tiers.
 * Tier 0 = no deps, Tier 1 = depends only on Tier 0 plugins, etc. */
function resolveExecutionTiers(plugins: DossierPlugin[]): DossierPlugin[][] {
  const pluginMap = new Map(plugins.map((p) => [p.name, p]));
  const assigned = new Set<string>();
  const tiers: DossierPlugin[][] = [];

  // Keep assigning until all plugins are placed
  let remaining = [...plugins];
  while (remaining.length > 0) {
    const tier: DossierPlugin[] = [];
    for (const plugin of remaining) {
      // Plugin can go in this tier if all its deps are already assigned
      const depsResolved = plugin.dependsOn.every(
        (dep) => assigned.has(dep) || !pluginMap.has(dep) // dep not in our list = external, treat as resolved
      );
      if (depsResolved) {
        tier.push(plugin);
      }
    }

    if (tier.length === 0) {
      // Circular dep or missing dep — dump remaining into final tier
      tier.push(...remaining);
      remaining = [];
    } else {
      for (const p of tier) assigned.add(p.name);
      remaining = remaining.filter((p) => !assigned.has(p.name));
    }

    // Sort within tier by priority
    tier.sort((a, b) => a.priority - b.priority);
    tiers.push(tier);
  }

  return tiers;
}

function resolveDependencies(plugins: DossierPlugin[]): DossierPlugin[] {
  const sorted: DossierPlugin[] = [];
  const visited = new Set<string>();
  const pluginMap = new Map(plugins.map((p) => [p.name, p]));

  function visit(plugin: DossierPlugin) {
    if (visited.has(plugin.name)) return;
    visited.add(plugin.name);
    for (const dep of plugin.dependsOn) {
      const depPlugin = pluginMap.get(dep);
      if (depPlugin) visit(depPlugin);
    }
    sorted.push(plugin);
  }

  // Sort by priority first, then resolve deps
  const byPriority = [...plugins].sort((a, b) => a.priority - b.priority);
  for (const p of byPriority) visit(p);
  return sorted;
}

function collectFromPlugins(results: Record<string, DossierPluginResult>, field: string): unknown[] {
  const collected: unknown[] = [];
  for (const result of Object.values(results)) {
    if (result.success && result.data[field]) {
      const items = result.data[field];
      if (Array.isArray(items)) collected.push(...items);
    }
  }
  return collected;
}

function computeMotivation(
  results: Record<string, DossierPluginResult>,
  listing: DossierListing,
  existingScoreFactors: Record<string, number> | null
): { score: number; flags: MotivationFlag[] } {
  const flags: MotivationFlag[] = [];
  let score = 0;

  // ── Listing Metrics ──
  if (listing.daysOnMarket && listing.daysOnMarket > 90) {
    flags.push("high_dom");
    score += Math.min(25, Math.floor(listing.daysOnMarket / 10));
  }
  if (listing.originalListPrice && listing.listPrice &&
      listing.originalListPrice > listing.listPrice) {
    flags.push("price_drop");
    const dropPct = ((listing.originalListPrice - listing.listPrice) / listing.originalListPrice) * 100;
    score += Math.min(25, Math.floor(dropPct * 2));
  }

  // ── MLS rawData analysis (PublicRemarks keyword scanning) ──
  const raw = (listing.rawData || {}) as Record<string, unknown>;
  const remarks = (typeof raw.PublicRemarks === "string" ? raw.PublicRemarks : "").toLowerCase();
  const ownership = (typeof raw.Ownership === "string" ? raw.Ownership : "").toLowerCase();

  // Estate / probate keywords in remarks
  if (/\b(estate|probate|heir|inherited|deceased|personal representative|executor)\b/.test(remarks)) {
    if (!flags.includes("estate_probate")) { flags.push("estate_probate"); score += 15; }
  }
  // Divorce / separation keywords
  if (/\b(divorce|divorc|separation|marital)\b/.test(remarks)) {
    if (!flags.includes("divorce")) { flags.push("divorce"); score += 15; }
  }
  // Relocation keywords
  if (/\b(relocat|transfer|moving out|must sell|motivated|job transfer)\b/.test(remarks)) {
    if (!flags.includes("job_relocation")) { flags.push("job_relocation"); score += 10; }
  }
  // Vacant / unoccupied
  if (/\b(vacant|unoccupied|empty|no one living|move.in ready)\b/.test(remarks)) {
    if (!flags.includes("vacant")) { flags.push("vacant"); score += 10; }
  }
  // Investor / non-owner occupied
  if (ownership === "investment" || ownership === "other" || /\b(investor|investment|rental property|tenant occupied|currently rented)\b/.test(remarks)) {
    if (!flags.includes("tired_landlord")) { flags.push("tired_landlord"); score += 10; }
  }
  // As-is / handyman / fixer
  if (/\b(as.is|as is|handyman|fixer|needs work|needs repair|needs updating|cash only|investor special)\b/.test(remarks)) {
    score += 10; // No specific flag, just adds to score
  }

  // ── Court Records ──
  const courtResult = results["court-records"];
  if (courtResult?.success) {
    const cases = (courtResult.data.courtCases || []) as { type: string }[];
    if (cases.some((c) => c.type === "divorce")) { if (!flags.includes("divorce")) { flags.push("divorce"); score += 20; } }
    if (cases.some((c) => c.type === "foreclosure")) { flags.push("pre_foreclosure"); score += 25; }
    if (cases.some((c) => c.type === "probate")) { if (!flags.includes("estate_probate")) { flags.push("estate_probate"); score += 15; } }
    if (cases.some((c) => c.type === "eviction")) { if (!flags.includes("tired_landlord")) { flags.push("tired_landlord"); score += 10; } }

    const liens = (courtResult.data.liens || []) as { type: string }[];
    if (liens.some((l) => l.type === "tax_lien")) { flags.push("tax_lien"); score += 20; }

    const bankruptcies = (courtResult.data.bankruptcies || []) as unknown[];
    if (bankruptcies.length > 0) { flags.push("bankruptcy"); score += 20; }
  }

  // ── Regrid Signals ──
  const regridResult = results["regrid"];
  if (regridResult?.success) {
    // Absentee owner from Regrid
    if (regridResult.data.isAbsentee === true) {
      if (!flags.includes("absentee_owner")) {
        flags.push("absentee_owner");
        score += 15;
      }
    }
    // USPS Vacant from Regrid
    if (regridResult.data.isVacant === true) {
      if (!flags.includes("vacant")) {
        flags.push("vacant");
        score += 15;
      }
    }
    // Portfolio owner (multiple properties)
    const portfolioSize = regridResult.data.portfolioSize as number;
    if (portfolioSize >= 3) {
      if (!flags.includes("multiple_properties")) {
        flags.push("multiple_properties");
        score += 10;
      }
    }
  }

  // ── Owner Analysis ──
  const assessorResult = results["county-assessor"];
  if (assessorResult?.success) {
    const owners = (assessorResult.data.owners || []) as OwnerInfo[];
    // Out of state owner
    if (owners.some((o) => o.address && !o.address.toLowerCase().includes(listing.state?.toLowerCase() || "mo"))) {
      if (!flags.includes("out_of_state_owner")) {
        flags.push("out_of_state_owner");
        score += 10;
      }
    }
    // Absentee owner (mailing differs from property)
    const rawEntity = assessorResult.data.rawEntityName as string;
    if (rawEntity) {
      const lower = rawEntity.toLowerCase();
      if (lower.includes("estate") || lower.includes("trust")) {
        if (!flags.includes("estate_probate") && !flags.includes("inherited")) {
          flags.push("inherited"); score += 10;
        }
      }
    }
  }

  // ── Property History — inherited indicator ──
  const historyResult = results["property-history"];
  if (historyResult?.success) {
    const deeds = (historyResult.data.deedHistory || []) as { type: string }[];
    if (deeds.some((d) => d.type === "trustee" || d.type === "personal_representative")) {
      if (!flags.includes("inherited")) {
        flags.push("inherited");
        score += 15;
      }
    }
  }

  // ── NARRPR Distress Signals ──
  const narrprResult = results["narrpr-import"];
  if (narrprResult?.success) {
    const distress = narrprResult.data.narrprDistress as { nodDate?: string; auctionDate?: string } | undefined;
    if (distress?.nodDate) {
      if (!flags.includes("pre_foreclosure")) {
        flags.push("pre_foreclosure");
        score += 25;
      }
    }
    if (distress?.auctionDate) {
      score += 10; // Additional urgency for scheduled auction
    }

    // Absentee owner from NARRPR CSV (mailing != property address)
    const owners = narrprResult.data.owners as { name: string }[] | undefined;
    if (owners && owners.length > 0) {
      // If NARRPR provided owner data, check if any CSV import had absentee detection
      // (absentee flag is set during CSV import merge)
    }
  }

  return { score: Math.min(100, score), flags: [...new Set(flags)] };
}
