/**
 * Create flow — the 8-step /animate Create screen, end to end, with the API
 * mocked by page.route so it runs without the DGX and spends nothing.
 *
 *   1 Source → 2 Transcript (auto-scroll) → 3 Length (slider) → Confirm →
 *   4 Writing (model picker + quote) → generate → 5 Review → Approve →
 *   6 Engine → confirm modal → 7 Producing → mocked poll → 8 Done
 *   (Library link) → Back clamps to a read-only earlier step.
 *
 * ── HOW TO RUN (isolated copy, per memory doctrine) ────────────────────────
 *   rsync -a --exclude node_modules --exclude .next ~/tolley-site/ /tmp/e2e-create/
 *   cd /tmp/e2e-create && ln -s ~/tolley-site/node_modules node_modules && npx prisma generate
 *   npx next build --webpack && PORT=3219 npx next start &
 *   PLAYWRIGHT_BASE_URL=http://localhost:3219 DATABASE_URL=<neon> \
 *     npx playwright test tests/e2e/create-flow.spec.ts --reporter=list
 */
import { test, expect as baseExpect, type Page, type Route } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  seedAndSignIn,
  cleanupUser,
  landOnStudio,
  mockProject,
  summaryFor,
  json,
  MOCK_STYLE,
  MOCK_TRANSCRIPT,
  MOCK_SCRIPT,
  type MockProject,
  type StudioUser,
  MOCK_BILLING_STATUS,
} from "./_studio-auth";

const expect = baseExpect.configure({ timeout: 60_000 });
const prisma = new PrismaClient();

const SOURCE_URL = "https://www.youtube.com/watch?v=e2e-mock-video";
const PROJECT_ID = "proj_flow_e2e";

/** The API the create flow talks to, backed by one mutable row. */
function installMockApi(
  page: Page,
  state: { project: MockProject | null; finishRender?: boolean; holdAsync?: boolean; cancelHits?: number; deleteHits?: number },
) {
  const plus7d = () => new Date(Date.now() + 7 * 864e5).toISOString();
  return page.route(/\/api\/vater\//, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const body = () => (req.postDataJSON?.() ?? {}) as Record<string, unknown>;
    const before = state.project?.status ?? "-";
    if (process.env.E2E_DEBUG) setTimeout(() => console.log(`[mock] ${method} ${path} ${before} → ${state.project?.status ?? "-"} gate=${state.finishRender ?? false}`), 0);

    if (path === "/api/vater/youtube/styles") {
      return route.fulfill(json({ styles: [MOCK_STYLE], lockedStyleId: MOCK_STYLE.id }));
    }
    if (path === "/api/vater/billing/status") return route.fulfill(json(MOCK_BILLING_STATUS));
    if (path === "/api/vater/youtube/progress-summary") {
      return route.fulfill(json(summaryFor(state.project ? [state.project] : [])));
    }
    if (path === "/api/vater/script/from-url" && method === "POST") {
      return route.fulfill(
        json({ title: "Mock source video", text: MOCK_TRANSCRIPT, source: "youtube", words: MOCK_TRANSCRIPT.split(/\s+/).length }),
      );
    }
    if (path === "/api/vater/youtube/new-from-style" && method === "POST") {
      state.project = mockProject({ id: PROJECT_ID, styleId: String(body().styleId ?? MOCK_STYLE.id) });
      return route.fulfill(json({ project: state.project }, 201));
    }
    if (path === "/api/vater/youtube/from-transcript" && method === "POST") {
      const b = body();
      if (!state.project || b.projectId !== PROJECT_ID) return route.fulfill(json({ error: "expected projectId" }, 400));
      state.project = {
        ...state.project,
        status: "scripting",
        targetDuration: Number(b.targetDuration) || state.project.targetDuration,
        autopilotJobId: "job_script_1",
        stepDetails: { phase: "scripting", jobId: "job_script_1", logs: ["12:00:00 scripting: writing…"] },
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(json({ project: state.project }, 201));
    }

    const writeScript = path.match(/^\/api\/vater\/youtube\/([^/]+)\/write-script$/);
    if (writeScript && writeScript[1] === PROJECT_ID && method === "POST" && state.project) {
      const b = body();
      if (b.dryRun === true) {
        return route.fulfill(json({
          dryRun: true,
          quote: { model: b.model ?? "sonnet", billedCents: 12, providerCostCents: 9, inputTokens: 800, outputTokens: 400, markup: 1.3, apiId: "claude-sonnet-5" },
        }));
      }
      const chargeN = Array.isArray((state.project.scriptMeta as { charges?: unknown[] } | null)?.charges)
        ? ((state.project.scriptMeta as { charges: unknown[] }).charges.length + 1)
        : 1;
      const script = String(b.source === "edited" && b.editedScript ? b.editedScript : MOCK_SCRIPT);
      const charge = {
        at: new Date().toISOString(),
        model: b.model ?? "sonnet",
        apiId: "claude-sonnet-5",
        source: b.source ?? "transcript",
        fidelity: b.fidelity ?? "balanced",
        quotedCents: 12,
        billedCents: 14,
        providerCostCents: 11,
        inputTokens: 900,
        outputTokens: 420,
        markup: 1.3,
        usageId: `usage_${chargeN}`,
      };
      state.project = {
        ...state.project,
        status: "awaiting_script_approval",
        script,
        scriptVersions: [
          ...(state.project.scriptVersions ?? []),
          { ts: new Date().toISOString(), source: "generated", script },
        ],
        scriptMeta: { source: "claude", writer: charge, charges: [charge] },
        approvalExpiresAt: plus7d(),
        flowStep: 5,
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(json({
        project: state.project,
        quote: { model: charge.model, billedCents: charge.quotedCents, providerCostCents: 9, inputTokens: 800, outputTokens: 400, markup: 1.3, apiId: charge.apiId },
        billed: { model: charge.model, billedCents: charge.billedCents, providerCostCents: charge.providerCostCents, inputTokens: charge.inputTokens, outputTokens: charge.outputTokens, markup: 1.3, apiId: charge.apiId },
        charge,
      }, 201));
    }

    const talkScript = path.match(/^\/api\/vater\/youtube\/([^/]+)\/talk-script$/);
    if (talkScript && talkScript[1] === PROJECT_ID && method === "POST" && state.project) {
      const b = body();
      if (b.dryRun === true) {
        return route.fulfill(json({
          dryRun: true,
          quote: { model: b.model ?? "sonnet", billedCents: 8, providerCostCents: 6, inputTokens: 500, outputTokens: 200, markup: 1.3, apiId: "claude-sonnet-5" },
        }));
      }
      const reply = "Tightened the open and kept your facts.";
      const revisedScript = `${MOCK_SCRIPT} Claude applied a sharper opening.`;
      const charge = {
        at: new Date().toISOString(),
        model: b.model ?? "sonnet",
        apiId: "claude-sonnet-5",
        fidelity: b.fidelity ?? "balanced",
        quotedCents: 8,
        billedCents: 9,
        providerCostCents: 7,
        inputTokens: 520,
        outputTokens: 210,
        usageId: "usage_talk_1",
        revised: true,
      };
      const priorChat = (state.project.scriptMeta as { chat?: { turns?: unknown[] } } | null)?.chat;
      const priorTurns = Array.isArray(priorChat?.turns) ? priorChat.turns : [];
      state.project = {
        ...state.project,
        scriptMeta: {
          ...((state.project.scriptMeta as object) ?? {}),
          chat: {
            lastCharge: charge,
            turns: [
              ...priorTurns,
              { role: "user", text: String(b.message ?? ""), at: charge.at },
              { role: "assistant", text: reply, at: charge.at, billedCents: 9, revised: true },
            ],
          },
        },
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(json({
        project: state.project,
        quote: { model: charge.model, billedCents: charge.quotedCents, providerCostCents: 6, inputTokens: 500, outputTokens: 200, markup: 1.3, apiId: charge.apiId },
        billed: { model: charge.model, billedCents: charge.billedCents, providerCostCents: charge.providerCostCents, inputTokens: charge.inputTokens, outputTokens: charge.outputTokens, markup: 1.3, apiId: charge.apiId },
        charge,
        reply,
        revisedScript,
      }, 201));
    }

    const m = path.match(/^\/api\/vater\/youtube\/([^/]+)(?:\/([^/]+))?$/);
    if (m && m[1] === PROJECT_ID && !state.project) {
      return route.fulfill(json({ error: "Project not found" }, 404));
    }
    if (m && m[1] === PROJECT_ID && state.project) {
      const sub = m[2];
      if (!sub && method === "GET") return route.fulfill(json({ project: state.project }));
      if (!sub && method === "PATCH") {
        state.project = { ...state.project, ...body(), updatedAt: new Date().toISOString() } as MockProject;
        return route.fulfill(json({ project: state.project }));
      }
      if (sub === "poll") {
        // The DGX "finishes" whatever is running on the first poll.
        if (state.project.status === "scripting" && !state.holdAsync) {
          state.project = {
            ...state.project,
            status: "awaiting_script_approval",
            script: MOCK_SCRIPT,
            scriptVersions: [{ ts: new Date().toISOString(), source: "generated", script: MOCK_SCRIPT }],
            approvalExpiresAt: plus7d(),
            autopilotJobId: null,
            updatedAt: new Date().toISOString(),
          };
        } else if (state.project.status === "generating_scenes" && state.finishRender) {
          // Gated: the badge provider also kicks /poll, so without the gate the
          // render could "finish" before the test looks at step 7.
          state.project = {
            ...state.project,
            status: "ready",
            finalVideoUrl: "https://example.blob.vercel-storage.com/final.mp4",
            autopilotJobId: null,
            updatedAt: new Date().toISOString(),
          };
        }
        return route.fulfill(json({ project: state.project }));
      }
      if (sub === "approve-script" && method === "POST") {
        state.project = {
          ...state.project,
          script: String(body().script ?? state.project.script),
          status: "awaiting_engine",
          scriptApprovedAt: new Date().toISOString(),
          approvalExpiresAt: plus7d(),
          flowStep: 6,
          updatedAt: new Date().toISOString(),
        };
        return route.fulfill(json({ project: state.project }));
      }
      if (sub === "preflight") {
        return route.fulfill(
          json({
            words: MOCK_SCRIPT.split(/\s+/).length,
            estMinutes: 3,
            style: { id: MOCK_STYLE.id, name: MOCK_STYLE.name },
            voice: { name: "Mark", backend: null, source: "style" },
            character: { id: "c1", name: "Jeff", imageUrl: null, others: 0 },
            artStyle: { kind: "preset", id: "cinematic", name: "Cinematic", defaulted: false },
            soundtrack: { backgroundMusicId: null, musicVolume: null, sfxEnabled: false },
            animUntilS: null,
            blockers: [],
            warnings: [],
          }),
        );
      }
      if (sub === "cancel" && method === "POST") {
        state.cancelHits = (state.cancelHits ?? 0) + 1;
        state.project = {
          ...state.project,
          status: state.project.transcript ? "transcribed" : "failed",
          autopilotJobId: null,
          updatedAt: new Date().toISOString(),
        };
        return route.fulfill(json({ ok: true, dgx: { ok: true, wasRunning: false }, project: state.project }));
      }
      if (!sub && method === "DELETE") {
        state.deleteHits = (state.deleteHits ?? 0) + 1;
        state.project = null;
        return route.fulfill(json({ ok: true }));
      }
      if (sub === "estimate") return route.fulfill(json({ draftUsd: 1.23, fullUsd: 2.34 }));
      if (sub === "produce" && method === "POST") {
        state.project = {
          ...state.project,
          status: "generating_scenes",
          settingsJson: { engine: body().engine ?? "auto" },
          autopilotJobId: "job_render_1",
          stepDetails: { phase: "scenes", jobId: "job_render_1", logs: ["12:01:00 scenes: scene 1/8 done"] },
          updatedAt: new Date().toISOString(),
        };
        return route.fulfill(json({ project: state.project, jobId: "job_render_1" }));
      }
    }
    return route.fallback();
  });
}

test.describe("create flow (mocked API)", () => {
  let user: StudioUser | null = null;

  test.beforeAll(async ({ browser }) => {
    user = await seedAndSignIn(browser, prisma, "createflow");
  });
  test.afterAll(async () => {
    await cleanupUser(prisma, user);
    await prisma.$disconnect();
  });

  test("walks all 8 steps; Back lands on a read-only earlier step", async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    await page.context().addCookies(user!.cookies);
    const state: { project: MockProject | null } = { project: null };
    await installMockApi(page, state);

    await landOnStudio(page, "#r=create");
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("path-own-script")).toBeVisible();

    // 1 → 2: URL in, captions read (mocked), row created.
    await page.getByTestId("path-from-video").click();
    await page.getByTestId("own-script-import-url").fill(SOURCE_URL);
    await page.getByTestId("source-continue").click();
    await expect(screen).toHaveAttribute("data-step", "2");
    const box = page.getByTestId("transcript-box");
    await expect(box).toBeVisible();
    await expect(page.getByTestId("own-script-import-note")).toContainText(/Pulled \d+ words/);
    expect(state.project?.transcript).toBe(MOCK_TRANSCRIPT);
    expect(state.project?.flowStep).toBe(2);
    await expect(page).toHaveURL(/#r=create&s=2&p=proj_flow_e2e$/);

    // Auto-scroll: the transcript box's bottom edge ends up inside the viewport.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.querySelector('[data-testid="transcript-box"]');
            if (!el) return -1;
            const r = el.getBoundingClientRect();
            return r.bottom <= window.innerHeight + 4 && r.top >= -4 ? 1 : 0;
          }),
        { timeout: 15_000 },
      )
      .toBe(1);

    // The hand-off panel.
    await expect(page.getByTestId("transcript-next")).toContainText("Your script is transcribed. How long should your personalized video be?");
    await page.getByTestId("transcript-continue").click();
    await expect(screen).toHaveAttribute("data-step", "3");
    expect(state.project?.flowStep).toBe(3);

    // 3: slider → label follows.
    const slider = page.getByTestId("target-minutes");
    await expect(slider).toBeVisible();
    await slider.focus();
    for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("target-minutes-label")).toContainText(/12 min · ~1,800 words/);
    await page.getByTestId("length-confirm").click();

    // 4: on-site writer — picker, quote, generate. Not a DGX spinner.
    await expect(screen).toHaveAttribute("data-step", "4");
    await expect(page.getByTestId("writing-step")).toBeVisible();
    await expect(page.getByTestId("script-writer")).toBeVisible();
    await expect(page.getByTestId("script-model-sonnet")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("script-quote-transcript")).toContainText(/From transcript/);
    expect(state.project?.targetDuration).toBe(12);
    expect(state.project?.flowStep).toBe(4);

    await page.getByTestId("script-model-opus").click();
    await expect(page.getByTestId("script-model-opus")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("script-generate-transcript").click();

    // Generate parks at Review with quoted vs billed on the job.
    await expect(screen).toHaveAttribute("data-step", "5", { timeout: 20_000 });
    await expect(page.getByTestId("review-step")).toBeVisible();
    await expect(page.getByTestId("script-billed")).toContainText(/estimate \$0\.12 · charged \$0\.14/);
    await expect(page.getByTestId("create-step-5")).toHaveAttribute("data-state", "needs-you");
    await expect(page).toHaveURL(/#r=create&s=5&p=proj_flow_e2e$/);
    await expect(page.getByTestId("nav-progress")).toHaveAttribute("data-badge", "1");

    // 5 → 6: Approve is free (no confirm modal), lands on the engine step.
    await expect(page.getByTestId("review-script")).toHaveValue(MOCK_SCRIPT);
    await page.getByTestId("review-approve").click();
    await expect(screen).toHaveAttribute("data-step", "6", { timeout: 20_000 });
    expect(state.project?.status).toBe("awaiting_engine");
    await expect(page.getByTestId("create-step-6")).toHaveAttribute("data-state", "needs-you");

    // 6 → 7: the ONLY money click goes through RenderConfirmModal.
    await page.getByTestId("engine-auto").click();
    await page.getByTestId("engine-produce").click();
    const confirm = page.getByTestId("render-confirm");
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(screen).toHaveAttribute("data-step", "7", { timeout: 20_000 });
    expect(state.project?.status).toBe("generating_scenes");
    await expect(page.getByTestId("producing-pulse")).toBeVisible();
    await expect(page.getByTestId("render-elapsed")).toBeVisible();
    await expect(page.getByTestId("customer-stage-rail")).toBeVisible();

    // Mocked poll → 8 (release the gate first).
    state.finishRender = true;
    await expect(screen).toHaveAttribute("data-step", "8", { timeout: 40_000 });
    await expect(page.getByTestId("done-open-library")).toHaveAttribute("href", "#r=library&p=proj_flow_e2e");
    // A fake MP4 never loads metadata, so the <video> box can stay 0px tall — assert the src instead.
    await expect(page.getByTestId("done-video")).toHaveAttribute("src", /final\.mp4$/);

    // Back: lands on an EARLIER step in read-only mode. Which one depends on
    // whether the machine-driven 7→8 hop replaced or pushed the entry (the
    // Shell replaces when the server wins), so assert the contract, not "7".
    await page.goBack();
    await expect
      .poll(async () => Number(await screen.getAttribute("data-step")), { timeout: 20_000 })
      .toBeLessThan(8);
    await expect(page.getByTestId("create-readonly-note")).toBeVisible();
    // (step-specific "done" chip only exists when Back landed on 7)

    // A hash ahead of the data clamps back to the derived step.
    await page.evaluate(() => {
      window.location.hash = "#r=create&p=proj_flow_e2e&s=3";
    });
    await expect(screen).toHaveAttribute("data-step", "3");
    await expect(page.getByTestId("length-done")).toBeVisible();
    await page.getByTestId("create-jump-current").click();
    await expect(screen).toHaveAttribute("data-step", "8");
  });

  test("own script lands on the same Writing editor; generate-from-edited is a second charge", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const state: { project: MockProject | null } = { project: null };
    await installMockApi(page, state);

    await landOnStudio(page, "#r=create");
    await page.getByTestId("path-own-script").click();
    await page.getByTestId("own-script-textarea").fill(MOCK_SCRIPT);
    await page.getByTestId("source-use-script").click();
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "4");
    expect(state.project?.script).toBe(MOCK_SCRIPT);
    expect(state.project?.flowStep).toBe(4);
    await expect(page.getByTestId("script-writer")).toBeVisible();
    await expect(page.getByTestId("writing-script")).toHaveValue(MOCK_SCRIPT);

    await page.getByTestId("writing-script").fill(`${MOCK_SCRIPT} An injected line Trey typed.`);
    await page.getByTestId("script-undo").click();
    await expect(page.getByTestId("writing-script")).toHaveValue(MOCK_SCRIPT);
    await page.getByTestId("script-redo").click();
    await expect(page.getByTestId("writing-script")).toHaveValue(/An injected line Trey typed/);

    await page.getByTestId("script-fidelity").selectOption("faithful");
    await page.getByTestId("script-model-fable").click();
    await page.getByTestId("script-generate-edited").click();
    await expect(screen).toHaveAttribute("data-step", "5", { timeout: 20_000 });
    await expect(page.getByTestId("script-billed")).toContainText(/charged \$0\.14/);
    expect(state.project?.scriptMeta && (state.project.scriptMeta as { writer?: { billedCents?: number } }).writer?.billedCents).toBe(14);
  });

  test("Review has Talk to Claude; quote before send; Apply is free undo", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const state: { project: MockProject | null } = {
      project: mockProject({
        id: PROJECT_ID,
        status: "awaiting_script_approval",
        script: MOCK_SCRIPT,
        transcript: MOCK_TRANSCRIPT,
        flowStep: 5,
        scriptVersions: [{ ts: new Date().toISOString(), source: "generated", script: MOCK_SCRIPT }],
      }),
    };
    await installMockApi(page, state);

    await landOnStudio(page, `#r=create&s=5&p=${PROJECT_ID}`);
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "5");
    await expect(page.getByTestId("talk-to-claude")).toBeVisible();
    await expect(page.getByTestId("talk-to-claude")).toContainText(/Talk is billed per send/);
    await expect(page.getByTestId("talk-quote")).toContainText(/≈ \$/);
    await expect(page.getByTestId("talk-to-claude")).not.toContainText(/\+30%/);
    await expect(page.getByTestId("talk-to-claude")).not.toContainText(/markup/i);

    await page.getByTestId("talk-message").fill("Tighten the hook.");
    await page.getByTestId("talk-send").click();
    await expect(page.getByTestId("talk-billed")).toContainText(/estimate \$0\.08 · charged \$0\.09/);
    await expect(page.getByTestId("talk-apply")).toBeVisible();
    await expect(page.getByTestId("review-script")).toHaveValue(MOCK_SCRIPT);

    await page.getByTestId("talk-apply").click();
    await expect(page.getByTestId("review-script")).toHaveValue(/sharper opening/);
    await page.getByTestId("script-undo").click();
    await expect(page.getByTestId("review-script")).toHaveValue(MOCK_SCRIPT);
  });

  test("Force Kill on a scripting row lands on empty step 1", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const state: { project: MockProject | null; holdAsync: boolean; cancelHits: number; deleteHits: number } = {
      holdAsync: true,
      cancelHits: 0,
      deleteHits: 0,
      project: mockProject({
        id: PROJECT_ID,
        status: "scripting",
        sourceTitle: "Stuck writer",
        transcript: MOCK_TRANSCRIPT,
        flowStep: 4,
        autopilotJobId: "job_stale",
        stepDetails: { phase: "scripting", jobId: "job_stale", logs: ["12:00:00 scripting: writing…"] },
      }),
    };
    await installMockApi(page, state);

    await landOnStudio(page, `#r=create&p=${PROJECT_ID}`);
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "4");
    await expect(screen).toHaveAttribute("data-kind", "async");
    await expect(page.getByTestId("writing-pulse")).toBeVisible();
    const kill = screen.getByTestId("force-kill");
    await expect(kill).toBeVisible();
    await expect(kill).toContainText("Force Kill");

    await kill.click();
    const tab = page.getByTestId("force-kill-tab");
    await expect(tab).toBeVisible();
    await expect(tab).toContainText("This will kill all current and future steps");
    await expect(tab).toContainText("You will need to regenerate from step one");

    await page.getByTestId("force-kill-confirm").click();
    await expect(screen).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("path-own-script")).toBeVisible();
    await expect(page.getByTestId("force-kill")).toHaveCount(0);
    await expect(page.getByTestId("header-force-kill")).toHaveCount(0);
    await expect(page).toHaveURL(/#r=create&s=1$/);
    expect(state.project).toBeNull();
    expect(state.cancelHits).toBe(1);
    expect(state.deleteHits).toBe(1);
  });

  test("generation header shows Force Kill when p= is set; confirm lands on empty step 1", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const state: { project: MockProject | null; holdAsync: boolean; cancelHits: number; deleteHits: number } = {
      holdAsync: true,
      cancelHits: 0,
      deleteHits: 0,
      project: mockProject({
        id: PROJECT_ID,
        status: "scripting",
        sourceTitle: "Header kill",
        transcript: MOCK_TRANSCRIPT,
        flowStep: 4,
        autopilotJobId: "job_stale",
        stepDetails: { phase: "scripting", jobId: "job_stale", logs: ["12:00:00 scripting: writing…"] },
      }),
    };
    await installMockApi(page, state);

    await landOnStudio(page, `#r=create&p=${PROJECT_ID}`);
    const headerKill = page.getByTestId("header-force-kill");
    await expect(headerKill).toBeVisible();
    await expect(headerKill.getByTestId("force-kill")).toContainText("Force Kill");

    await page.getByTestId("nav-progress").click();
    await expect(page).toHaveURL(new RegExp(`p=${PROJECT_ID}`));
    await expect(headerKill).toBeVisible();

    await page.evaluate((id) => {
      window.location.hash = `#r=library&p=${id}`;
    }, PROJECT_ID);
    await expect(page).toHaveURL(new RegExp(`r=library.*p=${PROJECT_ID}`));
    await expect(headerKill).toBeVisible();

    await page.getByTestId("nav-pricing").click();
    await expect(headerKill).toHaveCount(0);

    await page.evaluate((id) => {
      window.location.hash = `#r=create&p=${id}`;
    }, PROJECT_ID);
    await expect(headerKill).toBeVisible();
    await headerKill.getByTestId("force-kill").click();
    const tab = page.getByTestId("force-kill-tab");
    await expect(tab).toBeVisible();
    await expect(tab).toContainText("This will kill all current and future steps");
    await expect(tab).toContainText("You will need to regenerate from step one");
    await page.getByTestId("force-kill-confirm").click();

    await expect(page.getByTestId("create-screen")).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("path-own-script")).toBeVisible();
    await expect(page.getByTestId("header-force-kill")).toHaveCount(0);
    await expect(page).toHaveURL(/#r=create&s=1$/);
    expect(state.project).toBeNull();
    expect(state.cancelHits).toBe(1);
    expect(state.deleteHits).toBe(1);
  });
});
