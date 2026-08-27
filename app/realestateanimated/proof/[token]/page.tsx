/**
 * /realestateanimated/proof/[token] — public "proof page".
 *
 * The CA AB 723 / WI Act 69 pattern, shipped ahead of the mandate: the
 * original unaltered photo next to the AI-generated output, the on-frame
 * label text, a plain "virtually staged / AI-generated" disclosure and the
 * agent + broker line. Agents paste this link into captions and MLS remarks.
 *
 * Server component, no session. 404 on an unknown token or a job with
 * nothing to show. Nothing here reveals the license number or any URL the
 * agent did not already publish.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { hasVaterListingJobTable } from "@/lib/vater/schema-probe";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { readAgentProfile } from "@/lib/vater/listing/agent-profile";
import { frameLabelSpec, type ComplianceSku } from "@/lib/vater/listing/compliance";
import { isListingSku, LISTING_SKUS } from "@/lib/vater/listing-pricing";
import { PRODUCT_NAME } from "@/lib/vater/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

async function loadJob(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  if (!(await hasVaterListingJobTable())) return null;
  try {
    return await prisma.vaterListingJob.findUnique({ where: { proofToken: token } });
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const job = await loadJob(token);
  const title = job ? `AI disclosure — ${job.address ?? "listing photo"} · ${PRODUCT_NAME.realestate}` : "Not found";
  return { title, robots: { index: false, follow: false } };
}

export default async function ProofPage({ params }: Props) {
  const { token } = await params;
  const job = await loadJob(token);
  if (!job) notFound();
  const original = job.sourceImageUrls[0] ?? null;
  const generated = job.stagedStillLabeledUrl ?? job.stagedStillUrl ?? null;
  if (!original || !generated) notFound();

  const sku = isListingSku(job.sku) ? job.sku : "virtual_staging";
  const label = frameLabelSpec(sku as ComplianceSku, "social", job.sourceKind === "streetview" ? "streetview" : "upload");
  const profile = await readAgentProfile(job.userId);
  const agentLine = [profile.agentDisplayName, profile.brokerName, profile.brokerPhone].filter(Boolean).join(" · ");
  const video = job.finalUrl && job.finalUrl !== job.stagedStillLabeledUrl && /\.mp4(\?|$)/i.test(job.finalUrl) ? job.finalUrl : null;
  const when = (job.completedAt ?? job.updatedAt).toISOString().slice(0, 10);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--jb-body, #0B1F3A)",
        color: "var(--jb-text, #F7F4EC)",
        fontFamily: "var(--font-jelly-display, ui-sans-serif, system-ui, sans-serif)",
        padding: "32px 16px 64px",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>
          {PRODUCT_NAME.realestate} · AI disclosure
        </p>
        <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: "8px 0 4px" }}>
          {job.address ? [job.address, job.city, job.state].filter(Boolean).join(", ") : "Listing photo"}
        </h1>
        <p style={{ margin: "0 0 24px", opacity: 0.8 }}>
          {LISTING_SKUS[sku].label} · {when}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <figure style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={original} alt="Original, unaltered listing photo" style={{ width: "100%", height: "auto", borderRadius: 12, display: "block" }} />
            <figcaption style={{ marginTop: 8, fontSize: 14 }}>
              <strong>Original photo</strong> — as taken, unaltered
            </figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={generated} alt="AI-generated version" style={{ width: "100%", height: "auto", borderRadius: 12, display: "block" }} />
            <figcaption style={{ marginTop: 8, fontSize: 14 }}>
              <strong>AI-generated</strong> — {label.captionLine}
            </figcaption>
          </figure>
        </div>

        {video ? (
          <div style={{ marginTop: 24 }}>
            <video src={video} controls playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />
          </div>
        ) : null}

        <section
          style={{
            marginTop: 28,
            padding: "18px 20px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            fontSize: 15,
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Disclosure.</strong> The right-hand image{video ? " and the video" : ""} were generated with AI from the original photo on the left.
            {label.materialChange
              ? " They depict changes to walls, floors or finishes that are NOT as listed — see the original for the property as it is."
              : " Furniture and décor shown are virtual staging (personal property) and are not included with the property."}{" "}
            The on-frame label reads: <em>&ldquo;{label.text}&rdquo;</em>.
          </p>
          {agentLine ? (
            <p style={{ margin: "12px 0 0" }}>
              Listed by {agentLine}. Equal Housing Opportunity.
            </p>
          ) : (
            <p style={{ margin: "12px 0 0" }}>Equal Housing Opportunity.</p>
          )}
        </section>

        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>
          Proof page reference {token}. Generated by {PRODUCT_NAME.realestate} — tolley.io/realestateanimated.
        </p>
      </div>
    </main>
  );
}
