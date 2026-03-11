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

import { PrismaClient } from "@prisma/client";
import type {
  DossierContext,
  DossierListing,
  DossierPlugin,
  DossierPluginResult,
  OwnerInfo,
  MotivationFlag,
} from "./types";
import { getReadyPlugins } from "./plugins/registry";

const prisma = new PrismaClient();

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
    data: { status: "running", startedAt: new Date() },
  });

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

  const priorResults: Record<string, DossierPluginResult> = {};
  const knownOwners: OwnerInfo[] = [];
  const stepsCompleted: string[] = [];
  const stepsFailed: string[] = [];

  // ── DGX Research Worker (primary — uses Playwright browser automation) ──
  const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL; // e.g. http://localhost:8900 or tunnel URL
  const RESEARCH_AUTH = process.env.SYNC_SECRET || "";

  if (RESEARCH_WORKER_URL) {
    await prisma.dossierJob.update({
      where: { id: jobId },
      data: { currentStep: "dgx-research-worker", progress: 10 },
    });

    try {
      console.log(`[Dossier] Calling DGX research worker: ${RESEARCH_WORKER_URL}/research`);
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
        }),
        signal: AbortSignal.timeout(300000), // 5 min timeout
      });

      if (workerRes.ok) {
        const workerData = await workerRes.json();
        console.log(`[Dossier] Research worker returned: status=${workerData.status}, duration=${workerData.duration_ms}ms`);

        // Map worker results into plugin result format for downstream aggregation
        // Property data → county-assessor result
        if (workerData.owners?.length > 0) {
          for (const owner of workerData.owners) {
            if (!knownOwners.some((o: OwnerInfo) => o.name.toLowerCase() === owner.name.toLowerCase())) {
              knownOwners.push(owner);
            }
          }
          priorResults["county-assessor"] = {
            pluginName: "county-assessor",
            success: true,
            data: {
              owners: workerData.owners,
              rawEntityName: workerData.owners[0]?.name,
              assessedValue: workerData.property?.assessedValue,
              marketValue: workerData.property?.marketValue,
            },
            sources: workerData.sources?.filter((s: { category: string }) => s.category === "property") || [],
            confidence: 0.8,
            warnings: [],
            durationMs: workerData.duration_ms,
          };
          stepsCompleted.push("county-assessor");
        }

        // Court records
        if (workerData.courtRecords?.length > 0) {
          priorResults["court-records"] = {
            pluginName: "court-records",
            success: true,
            data: { courtCases: workerData.courtRecords, liens: [], bankruptcies: [] },
            sources: workerData.sources?.filter((s: { category: string }) => s.category === "legal") || [],
            confidence: 0.7,
            warnings: [],
            durationMs: 0,
          };
          stepsCompleted.push("court-records");
        }

        // Social profiles
        if (workerData.socialProfiles?.length > 0) {
          priorResults["people-search"] = {
            pluginName: "people-search",
            success: true,
            data: { socialProfiles: workerData.socialProfiles, webMentions: [] },
            sources: workerData.sources?.filter((s: { category: string }) => s.category === "social") || [],
            confidence: 0.6,
            warnings: [],
            durationMs: 0,
          };
          stepsCompleted.push("people-search");
        }

        // Property history
        if (workerData.propertyHistory?.length > 0) {
          priorResults["property-history"] = {
            pluginName: "property-history",
            success: true,
            data: { deedHistory: workerData.propertyHistory },
            sources: workerData.sources?.filter((s: { label: string }) => /zillow|redfin|realtor|homes/i.test(s.label)) || [],
            confidence: 0.7,
            warnings: [],
            durationMs: 0,
          };
          stepsCompleted.push("property-history");
        }

        // Background check + obituaries → skip-trace result
        if (workerData.backgroundCheck || workerData.obituaries?.length > 0) {
          priorResults["skip-trace"] = {
            pluginName: "skip-trace",
            success: true,
            data: {
              backgroundCheck: workerData.backgroundCheck,
              obituaries: workerData.obituaries,
              relatedPeople: workerData.backgroundCheck?.relatives?.map((r: string) => ({ name: r, relationship: "associate" })) || [],
            },
            sources: workerData.sources?.filter((s: { category: string }) => s.category === "people" || s.category === "obituary") || [],
            confidence: 0.6,
            warnings: [],
            durationMs: 0,
          };
          stepsCompleted.push("skip-trace");
        }

        // Street view from property data
        if (workerData.property?.streetViewUrl || workerData.property?.photos?.length > 0) {
          priorResults["street-view"] = {
            pluginName: "street-view",
            success: true,
            data: {
              streetViewUrl: workerData.property.streetViewUrl,
              satelliteUrl: workerData.property.satelliteUrl,
              neighborhoodPhotos: workerData.property.photos || [],
            },
            sources: [],
            confidence: 0.8,
            warnings: [],
            durationMs: 0,
          };
          stepsCompleted.push("street-view");
        }

        // Store all worker sources as a meta result
        priorResults["dgx-research-worker"] = {
          pluginName: "dgx-research-worker",
          success: true,
          data: {
            workerStatus: workerData.status,
            allSources: workerData.sources,
            allErrors: workerData.errors,
            motivationScore: workerData.motivationScore,
            motivationFlags: workerData.motivationFlags,
          },
          sources: workerData.sources || [],
          confidence: 0.8,
          warnings: workerData.errors?.map((e: { scraper: string; error: string }) => `${e.scraper}: ${e.error}`) || [],
          durationMs: workerData.duration_ms,
        };
        stepsCompleted.push("dgx-research-worker");
      } else {
        const errText = await workerRes.text().catch(() => "");
        console.error(`[Dossier] Research worker error: ${workerRes.status} ${errText}`);
        stepsFailed.push("dgx-research-worker");
      }
    } catch (err) {
      console.error(`[Dossier] Research worker call failed:`, err);
      stepsFailed.push("dgx-research-worker");
    }
  }

  // ── Local plugins (fallback for any steps the worker didn't cover) ──
  const ordered = resolveDependencies(plugins);
  const coveredSteps = new Set(stepsCompleted);

  if (notReady.length > 0) {
    console.log(
      `[Dossier] Skipping plugins missing config: ${notReady.map((n) => `${n.plugin.name} (needs: ${n.missing.join(", ")})`).join("; ")}`
    );
  }

  for (let i = 0; i < ordered.length; i++) {
    const plugin = ordered[i];

    // Skip if the research worker already covered this step
    if (coveredSteps.has(plugin.name)) {
      console.log(`[Dossier] Skipping local plugin ${plugin.name} — covered by research worker`);
      continue;
    }

    const progressPct = RESEARCH_WORKER_URL
      ? 50 + Math.round(((i + 1) / ordered.length) * 45) // 50-95% for local plugins
      : Math.round(((i + 1) / ordered.length) * 95);

    await prisma.dossierJob.update({
      where: { id: jobId },
      data: {
        currentStep: plugin.name,
        progress: Math.min(progressPct, 95),
      },
    });

    const context: DossierContext = {
      listing,
      priorResults,
      knownOwners: [...knownOwners],
      jobId,
      updateProgress: async (message: string) => {
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
          if (!knownOwners.some((o) => o.name.toLowerCase() === owner.name.toLowerCase())) {
            knownOwners.push(owner);
          }
        }
      }

      if (result.success && result.data.updatedOwners) {
        const updated = result.data.updatedOwners as OwnerInfo[];
        for (const upd of updated) {
          const idx = knownOwners.findIndex((o) => o.name.toLowerCase() === upd.name.toLowerCase());
          if (idx >= 0) knownOwners[idx] = { ...knownOwners[idx], ...upd };
        }
      }

      if (result.success) {
        stepsCompleted.push(plugin.name);
      } else {
        stepsFailed.push(plugin.name);
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
      stepsFailed.push(plugin.name);
    }
  }

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

  // Financial data from financial-analysis plugin
  const finResult = priorResults["financial-analysis"];
  const financialData = finResult?.success && finResult.data.financialData
    ? JSON.parse(JSON.stringify(finResult.data.financialData))
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

  // Save result — cast arrays to JSON for Prisma Json fields
  await prisma.dossierResult.create({
    data: {
      jobId,
      owners: knownOwners.length > 0 ? JSON.parse(JSON.stringify(knownOwners)) : undefined,
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
      financialData,
      pluginData: JSON.parse(JSON.stringify(pluginData)),
    },
  });

  // Mark job complete
  const finalStatus = stepsFailed.length === ordered.length ? "failed"
    : stepsFailed.length > 0 ? "partial"
    : "complete";

  await prisma.dossierJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      progress: 100,
      currentStep: null,
      stepsCompleted,
      stepsFailed,
      completedAt: new Date(),
    },
  });

  console.log(
    `[Dossier] Job ${jobId} ${finalStatus}: ${stepsCompleted.length} completed, ${stepsFailed.length} failed`
  );
}

// ── Helpers ─────────────────────────────────────────────────

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

  // Existing sell score factors (DOM, price drop, expired/withdrawn)
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

  // Court records
  const courtResult = results["court-records"];
  if (courtResult?.success) {
    const cases = (courtResult.data.courtCases || []) as { type: string }[];
    if (cases.some((c) => c.type === "divorce")) { flags.push("divorce"); score += 20; }
    if (cases.some((c) => c.type === "foreclosure")) { flags.push("pre_foreclosure"); score += 25; }
    if (cases.some((c) => c.type === "probate")) { flags.push("estate_probate"); score += 15; }
    if (cases.some((c) => c.type === "eviction")) { flags.push("tired_landlord"); score += 10; }

    const liens = (courtResult.data.liens || []) as { type: string }[];
    if (liens.some((l) => l.type === "tax_lien")) { flags.push("tax_lien"); score += 20; }

    const bankruptcies = (courtResult.data.bankruptcies || []) as unknown[];
    if (bankruptcies.length > 0) { flags.push("bankruptcy"); score += 20; }
  }

  // Owner analysis
  const assessorResult = results["county-assessor"];
  if (assessorResult?.success) {
    const owners = (assessorResult.data.owners || []) as OwnerInfo[];
    // Out of state owner
    if (owners.some((o) => o.address && !o.address.toLowerCase().includes(listing.state?.toLowerCase() || "mo"))) {
      flags.push("out_of_state_owner");
      score += 10;
    }
  }

  // Property history — inherited indicator
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

  return { score: Math.min(100, score), flags: [...new Set(flags)] };
}
