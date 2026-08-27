/**
 * ListingLanding — public marketing page for tolley.io/realestateanimated
 * ("Listing Studio by Jelly!"), shown to signed-out visitors. Signed-in users
 * get the studio Shell (app/realestateanimated/page.tsx decides).
 *
 * SERVER component (no 'use client'): every number here is real or absent —
 *   · prices          → lib/vater/listing-pricing.ts (LISTING_SKUS / LISTING_PACKS)
 *   · credit packs    → lib/vater/credit-packs.ts
 *   · 30-day views    → `proofStats` prop (lib/vater/listing/proof-stats.ts via
 *                       page.tsx). NULL → the number is HIDDEN. Never hardcoded.
 *   · support phone   → LISTING_BRAND.support (brands.ts)
 * Colour comes from the cinema kit reading `--jb-*` (set by the RE layout).
 *
 * Copy rules (Part B): "Fair-Housing safe by default" is the hook; product
 * name never contains "Realtor"; "REALTORS®" only when referring to NAR members.
 * Big type: 17–18 px body, one idea per block, no jargon.
 */
import { LISTING_SKUS, LISTING_SKU_IDS, LISTING_PACKS, formatListingPrice } from '@/lib/vater/listing-pricing';
import { creditPackOptions } from '@/lib/vater/credit-packs';
import { STUDIO_HOME, PRODUCT_NAME } from '@/lib/vater/product';
import { LISTING_BRAND } from '../brands';
import { JELLY_TOKENS, glass } from '../tokens';
import { CinemaRoot, GlassCard, GradientText, Marquee, MicroLabel, PillButton } from '../cinema';
import { InviteRequestForm } from './InviteRequestForm';
import { ListingHeroMedia, ProofAvatar } from './ListingHeroMedia';
import './landing.css';
import './listing-landing.css';

export type ProofStats = { views30d: number; asOf: string } | null;

const t = JELLY_TOKENS.dark;
const HOME = STUDIO_HOME.realestate;
const SIGNUP = `/signup?callbackUrl=${encodeURIComponent(HOME)}`;
const SIGNIN = `/login?callbackUrl=${encodeURIComponent(HOME)}`;
const SEAT = '#invite';

const SECTION: React.CSSProperties = { paddingTop: 84, paddingBottom: 84 };
const H2: React.CSSProperties = { fontWeight: 600, fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1.08, letterSpacing: '-0.025em', margin: '0 0 14px' };
const LEAD: React.CSSProperties = { fontSize: 18, lineHeight: 1.65, color: t.textSecondary, margin: 0 };
const ACT_LABEL: React.CSSProperties = { marginBottom: 14 };

function prettyPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return e164;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString('en-US');
}

function fmtAsOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STEPS: Array<{ n: number; title: string; body: string }> = [
  { n: 1, title: 'Add one photo', body: 'A phone photo of the empty room. No people in it.' },
  { n: 2, title: 'Type the address', body: 'Your state picks the advertising rule we follow for you.' },
  { n: 3, title: 'Say the details', body: 'Beds, baths, square feet. Speak or type. We check the wording for Fair Housing as you go.' },
  { n: 4, title: 'Pick the video', body: 'A staged photo, a before→after reveal, a beauty shot.' },
  { n: 5, title: 'Pay and post', body: 'You approve the staged photo first. Then download, or copy the proof link.' },
];

const FH_POINTS: Array<{ title: string; body: string }> = [
  { title: 'Equal Housing Opportunity on every export', body: 'The slogan and logo are on the end card and in the caption. Every time. Not a setting.' },
  { title: '“Virtually staged” label on the frame', body: 'Burned into the picture, readable at thumbnail size — the NAR “true picture” rule, done for you.' },
  { title: 'Your broker line, per your state', body: 'Missouri, Kansas and Pennsylvania each word it differently. We size and place the broker name and phone the way your state requires.' },
  { title: 'MLS-safe export', body: 'A bare staged photo with no name, logo or label, plus the “Virtually staged” line for the photo-description field. Unlocks when your license is verified.' },
  { title: 'Wording check before you spend', body: 'Type “great for families” or “safe neighborhood” and we flag it and suggest safer words — before anything is rendered.' },
  { title: 'A proof page for every video', body: 'A public link that shows your original photo next to the generated one. Paste it anywhere a disclosure is asked for.' },
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: 'Do I need to know anything about AI?', a: 'No. Upload a photo, tap a few buttons, pay. If you get stuck, call or text and Jared answers himself.' },
  { q: 'Is this allowed on the MLS?', a: 'Virtual staging of furniture is allowed on most boards (Heartland MLS included) when it is labeled — we label it and give you an MLS-safe copy. Videos that change the home itself (a before→after reveal that swaps the floors) are for your socials and marketing, not the MLS photo slots. We say so on the button.' },
  { q: 'What does it cost?', a: `A staged photo is ${formatListingPrice(LISTING_SKUS.virtual_staging.priceCents)}. A before→after video is ${formatListingPrice(LISTING_SKUS.before_after.economyPriceCents ?? LISTING_SKUS.before_after.priceCents)}–${formatListingPrice(LISTING_SKUS.before_after.priceCents)}. You buy credit in small packs and only spend it when you press Pay. No subscription. A failed render is never charged.` },
  { q: 'How long does it take?', a: `A staged photo comes back in about a minute for your approval. A video is usually ready ${LISTING_SKUS.before_after.etaLabel} after you approve the photo.` },
  { q: 'What if I don’t like the staged photo?', a: 'Tap “Try again” for 99¢ and we roll a fresh version. Nothing is filmed until you approve one.' },
  { q: 'Who is behind this?', a: 'Jared Tolley — a licensed Missouri Salesperson (Your KC Homes team · United Real Estate Kansas City) who uses this on his own listings. Support is his phone number, not a ticket queue.' },
];

export default function ListingLanding({ proofStats }: { proofStats: ProofStats }): React.ReactElement {
  const support = LISTING_BRAND.support;
  const p0 = LISTING_SKU_IDS.filter((id) => LISTING_SKUS[id].phase === 'p0');
  const later = LISTING_SKU_IDS.filter((id) => LISTING_SKUS[id].phase !== 'p0');
  const packs = creditPackOptions();

  return (
    <CinemaRoot className="jsl" beam density="full" data-testid="listing-landing">
      {/* ══ nav ══ */}
      <nav className="jsl-band" style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 22, paddingBottom: 22 }}>
        <a href={HOME} data-slot="sidebar-lockup" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: t.text }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LISTING_BRAND.logoSrc} alt="" width={36} height={36} style={{ width: 36, height: 36, filter: `drop-shadow(0 0 14px ${JELLY_TOKENS.brandGlow.includes('rgba') ? 'rgba(201,162,74,0.5)' : JELLY_TOKENS.brand})` }} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.12em', fontSize: 15, whiteSpace: 'nowrap' }}>{LISTING_BRAND.wordmark}</span>
            <span style={{ fontSize: 12, color: t.textFaint, letterSpacing: '0.04em' }}>{LISTING_BRAND.eyebrow}</span>
          </span>
        </a>
        <div style={{ flex: 1 }} />
        <div className="jsl-navlinks">
          <a className="jc-nav-link jsl-navlink" href="#steps">How it works</a>
          <a className="jc-nav-link jsl-navlink" href="#pricing">Prices</a>
          <a className="jc-nav-link jsl-navlink" href="#fair-housing">Fair Housing</a>
          <PillButton variant="ghost" size="md" href={SIGNIN} data-testid="nav-sign-in">Sign in</PillButton>
          <PillButton variant="gradient" size="md" href={SEAT}>Get an invite</PillButton>
        </div>
      </nav>

      {/* ══ hero ══ */}
      <header id="hero" className="jsl-band jrl-hero">
        <div>
          <div className="jc-fadein jsl-eyebrow-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: JELLY_TOKENS.brandLight, border: `1px solid ${JELLY_TOKENS.brandOutline}`, background: JELLY_TOKENS.brandGhost, padding: '8px 18px', borderRadius: JELLY_TOKENS.radius.pill, marginBottom: 24, fontSize: 14, letterSpacing: '0.08em' }}>
            ✦ FOR REAL ESTATE AGENTS · FAIR-HOUSING SAFE BY DEFAULT ✦
          </div>
          <h1 className="jc-rise-load jc-d1" style={{ fontWeight: 600, fontSize: 'clamp(40px, 5.2vw, 70px)', lineHeight: 1.04, letterSpacing: '-0.03em', margin: '0 0 20px' }}>
            One photo of an empty room. <GradientText serif>One listing video.</GradientText>
            <br />
            Pay when you click.
          </h1>
          <p className="jc-rise-load jc-d2" style={{ ...LEAD, maxWidth: 520, margin: '0 0 28px' }}>
            Upload a phone photo, type the address, pick a video, pay. Listing Studio stages the room, films the reveal, adds your broker line and the Equal Housing logo, and hands you a file ready to post.{' '}
            <strong style={{ color: t.text }}>From {formatListingPrice(LISTING_SKUS.virtual_staging.priceCents)} a photo. No subscription.</strong>
          </p>
          <div className="jc-rise-load jc-d3" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <PillButton variant="gradient" size="lg" href={SEAT} data-testid="hero-cta">Get an invite</PillButton>
            <PillButton variant="ghost" size="lg" href="#steps">See the 5 steps ↓</PillButton>
          </div>
          <div className="jc-rise-load jc-d4" style={{ fontSize: 15, color: t.textFaint, marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>$10 starter credit on signup</span>
            <span>·</span>
            <span>Failed renders never charged</span>
            {support.phone && (
              <>
                <span>·</span>
                <a href={`tel:${support.phone}`} style={{ color: t.textSecondary, textDecoration: 'none' }}>Questions? Call {prettyPhone(support.phone)}</a>
              </>
            )}
          </div>
        </div>
        <ListingHeroMedia />
      </header>

      <Marquee items={['ONE PHOTO IN', 'VIDEO OUT', 'EQUAL HOUSING ON EVERY EXPORT', 'BROKER LINE PER YOUR STATE', 'MLS-SAFE COPY', 'NO SUBSCRIPTION', 'FAILED RENDERS $0.00']} />

      {/* ══ proof ══ */}
      <section id="proof" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>LIVING PROOF</MicroLabel>
          <h2 style={H2}>
            “I’m not selling something <GradientText serif>I don’t use.</GradientText>”
          </h2>
          <div className="jrl-proof" style={{ marginTop: 24 }}>
            <div data-slot="living-proof" style={{ display: 'contents' }}><GlassCard radius={JELLY_TOKENS.radius.xxl} padding="26px 26px" halo>
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <ProofAvatar src="/realestateanimated/brand/jared.jpg" name="Jared Tolley" size={88} />
                <div style={{ flex: '1 1 260px', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Jared Tolley</div>
                  <div style={{ fontSize: 16, color: t.textSecondary }}>Jared Tolley · Your KC Homes team · United Real Estate Kansas City · <a href="tel:+18166294494" style={{ color: 'inherit' }}>(816) 629-4494</a></div>
                  <div style={{ fontSize: 14, color: t.textFaint }}>Licensed Missouri Salesperson, Lic #2024002937 · Independence, MO</div>
                  <p style={{ ...LEAD, fontSize: 17 }}>
                    I built this for my own listings first. Every video on my real-estate socials for the last year came out of this same pipeline — the staging, the reveal, the broker line, the Equal Housing logo. When something breaks, it breaks on my listings before it breaks on yours.
                  </p>
                </div>
              </div>
            </GlassCard></div>
            {proofStats ? (
              <GlassCard variant="ticket" radius={JELLY_TOKENS.radius.xxl} padding="26px 26px" data-testid="proof-views">
                <MicroLabel tone="violet" size={11} tracking="0.24em">REAL NUMBERS — NOT A PROJECTION</MicroLabel>
                <div className="jc-tabular" style={{ fontSize: 'clamp(48px, 6vw, 72px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 10 }}>{fmtViews(proofStats.views30d)}</div>
                <div style={{ fontSize: 17, color: t.textSecondary, marginTop: 6, lineHeight: 1.5 }}>views across my real-estate socials in the last 30 days</div>
                <div style={{ borderTop: `1px dashed ${t.borderStrong}`, margin: '16px 0 10px' }} />
                <div style={{ fontSize: 14, color: t.textFaint }}>Counted from YouTube, Facebook, Pinterest and X · as of {fmtAsOf(proofStats.asOf)}</div>
              </GlassCard>
            ) : (
              <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="26px 26px" data-testid="proof-views-hidden">
                <MicroLabel tone="violet" size={11} tracking="0.24em">WHAT YOU GET</MicroLabel>
                <ul style={{ margin: '12px 0 0', paddingLeft: 20, display: 'grid', gap: 8, fontSize: 17, lineHeight: 1.5, color: t.textSecondary }}>
                  <li>A staged photo you approve before anything is filmed</li>
                  <li>A finished video with your broker line and the Equal Housing logo</li>
                  <li>An MLS-safe copy and a public proof page</li>
                  <li>A phone number that a licensed agent answers</li>
                </ul>
              </GlassCard>
            )}
          </div>
        </div>
      </section>

      {/* ══ steps ══ */}
      <section id="steps" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>FIVE STEPS — ABOUT TWO MINUTES</MicroLabel>
          <h2 style={H2}>
            Upload. Type. Tap. <GradientText serif>Pay. Post.</GradientText>
          </h2>
          <p style={{ ...LEAD, maxWidth: 620, marginBottom: 28 }}>One thing per screen. Big buttons. Nothing to learn. If a step ever feels confusing, that is our bug — call and we fix it.</p>
          <div className="jrl-steps" data-slot="five-steps">
            {STEPS.map((s) => (
              <GlassCard key={s.n} radius={JELLY_TOKENS.radius.xl} padding="20px 18px" hover style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <div className="jc-tabular" style={{ width: 44, height: 44, borderRadius: 999, background: JELLY_TOKENS.gradPrimary, color: JELLY_TOKENS.onGradient, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{s.title}</div>
                <div style={{ fontSize: 16, lineHeight: 1.5, color: t.textSecondary }}>{s.body}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ══ pricing ══ */}
      <section id="pricing" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>THE PRICE LIST — WHOLE DOLLARS, NO SEASON PASS</MicroLabel>
          <h2 style={H2}>
            You only pay <GradientText serif>when you click Pay.</GradientText>
          </h2>
          <p style={{ ...LEAD, maxWidth: 640, marginBottom: 28 }}>Buy a small credit pack, spend it one listing at a time. The price on the button is the whole price. A render that fails is never charged.</p>
          <div className="jrl-skus">
            {p0.map((id) => {
              const s = LISTING_SKUS[id];
              return (
                <div key={id} data-slot="sku-card" style={{ display: 'contents' }}><GlassCard data-testid={`landing-sku-${id}`} radius={JELLY_TOKENS.radius.xl} padding="22px 20px" hover style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>{s.label}</div>
                    <div className="jc-tabular" style={{ fontSize: 24, fontWeight: 700, color: JELLY_TOKENS.cyan, whiteSpace: 'nowrap' }}>
                      {s.economyPriceCents ? `${formatListingPrice(s.economyPriceCents)}–${formatListingPrice(s.priceCents)}` : formatListingPrice(s.priceCents)}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.5, color: t.textSecondary }}>{s.blurb}</div>
                  <div style={{ fontSize: 14.5, color: t.textFaint }}>
                    {s.kind === 'still' ? 'Photo' : `${s.durationS}-second video`} · ready in {s.etaLabel}
                    {s.economyPriceCents ? ' · Economy or Photoreal engine' : ''}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    {s.materialChange ? (
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: JELLY_TOKENS.warning, border: `1px solid ${JELLY_TOKENS.warning}`, borderRadius: 999, padding: '4px 10px', display: 'inline-block' }}>For social & marketing — not for MLS photo slots</span>
                    ) : (
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: JELLY_TOKENS.success, border: `1px solid ${JELLY_TOKENS.success}`, borderRadius: 999, padding: '4px 10px', display: 'inline-block' }}>MLS-safe copy included</span>
                    )}
                  </div>
                </GlassCard></div>
              );
            })}
            {LISTING_PACKS.map((p) => (
              <div key={p.id} data-slot="pricing-ticket" style={{ display: 'contents' }}><GlassCard variant="ticket" data-testid={`landing-pack-${p.id}`} radius={JELLY_TOKENS.radius.xl} padding="22px 20px" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <MicroLabel tone="violet" size={11} tracking="0.24em">BUNDLE — {p.label.toUpperCase()}</MicroLabel>
                <div className="jc-tabular" style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatListingPrice(p.priceCents)}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, lineHeight: 1.55, color: t.textSecondary }}>
                  {p.includes.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <div style={{ fontSize: 14, color: t.textFaint }}>One new listing, fully covered.</div>
              </GlassCard></div>
            ))}
          </div>

          {later.length > 0 && (
            <div style={{ marginTop: 18, fontSize: 15, color: t.textFaint }}>
              Coming next: {later.map((id) => LISTING_SKUS[id].label).join(' · ')}.
            </div>
          )}

          <div style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, padding: '18px 20px', marginTop: 26, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Credit packs</div>
            {packs.map((pk) => (
              <div key={pk.pack} className="jc-tabular" style={{ fontSize: 16, color: t.textSecondary }}>
                <strong style={{ color: t.text }}>${pk.pack}</strong> → ${(pk.creditsCents / 100).toFixed(2)} credit
              </div>
            ))}
            <div style={{ fontSize: 14, color: t.textFaint, flexBasis: '100%' }}>The difference is the card-processing fee, passed through at cost. Credit never expires.</div>
          </div>
        </div>
      </section>

      {/* ══ fair housing ══ */}
      <section id="fair-housing" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>THE PART THAT KEEPS YOUR LICENSE SAFE</MicroLabel>
          <h2 style={H2}>
            Fair-Housing safe <GradientText serif>by default.</GradientText>
          </h2>
          <p style={{ ...LEAD, maxWidth: 660, marginBottom: 28 }}>
            You don’t decide these. We do, every time — because one pulled listing and a board fine costs more than a year of videos.
          </p>
          <div className="jrl-fh">
            {FH_POINTS.map((f) => (
              <div key={f.title} data-slot="fair-housing-badge" style={{ display: 'contents' }}><GlassCard radius={JELLY_TOKENS.radius.xl} padding="20px 18px" style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, display: 'flex', gap: 8 }}>
                  <span aria-hidden style={{ color: JELLY_TOKENS.success }}>✓</span>
                  <span>{f.title}</span>
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.5, color: t.textSecondary }}>{f.body}</div>
              </GlassCard></div>
            ))}
          </div>
          <div style={{ fontSize: 14, color: t.textFaint, marginTop: 18, lineHeight: 1.5 }}>
            Built for real estate agents and, for NAR members, REALTORS®. {PRODUCT_NAME.realestate} is not affiliated with the National Association of REALTORS® or any MLS. Rules cited: Fair Housing Act / HUD 24 CFR 109 · NAR Code of Ethics Art. 12 · Heartland MLS §11.2 · MO 20 CSR 2250-8.070 · KS K.A.R. 86-3-7 · PA 49 Pa. Code §35.305.
          </div>
        </div>
      </section>

      {/* ══ invite ══ */}
      <section className="jsl-band" style={{ maxWidth: 820, paddingTop: 20, paddingBottom: 60 }}>
        <div data-slot="invite-form" style={{ display: 'contents' }}><GlassCard id="invite" className="jc-rise" radius={JELLY_TOKENS.radius.xxl} padding="30px 28px" halo>
          <MicroLabel tone="cyan" style={ACT_LABEL}>PRIVATE BETA — LIMITED SEATS</MicroLabel>
          <h2 style={{ ...H2, fontSize: 'clamp(28px, 3.4vw, 40px)' }}>
            Get an invite. <GradientText serif>We’ll walk you through the first one.</GradientText>
          </h2>
          <p style={{ ...LEAD, marginBottom: 20 }}>Leave your email and we send a signup link. Tell us your brokerage and state so the end card is right on your very first video.</p>
          <InviteRequestForm
            subsite="realestate"
            copy={{
              aboutPlaceholder: 'Your brokerage, your state, and how many listings a month',
              submit: 'Send me an invite',
              doneTitle: 'You’re on the list — check your email.',
              doneBody: 'Your signup link is on its way. Check spam if it isn’t there in a minute — or just call the number below.',
              fallbackEmail: support.email,
            }}
          />
        </GlassCard></div>
      </section>

      {/* ══ faq ══ */}
      <section id="faq" className="jsl-band" style={{ ...SECTION, paddingTop: 40 }}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>PLAIN ANSWERS</MicroLabel>
          <h2 style={{ ...H2, marginBottom: 24 }}>
            Questions agents <GradientText serif>actually ask.</GradientText>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map((f) => (
              <details key={f.q} className="jc-details jrl-faq" style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.lg, padding: '16px 20px' }}>
                <summary style={{ fontSize: 18, fontWeight: 600, color: t.text }}>{f.q}</summary>
                <div style={{ marginTop: 12, fontSize: 17, lineHeight: 1.65, color: t.textSecondary }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ footer ══ */}
      <footer className="jsl-band" style={{ paddingTop: 30, paddingBottom: 60, borderTop: `1px solid ${t.border}`, display: 'grid', gap: 18 }}>
        <div data-slot="support-strip" style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.xl, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Talk to a person</div>
            <div style={{ fontSize: 15, color: t.textSecondary }}>{support.who}{support.hours ? ` · ${support.hours}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {support.phone && <PillButton variant="outline" size="lg" href={`tel:${support.phone}`} data-testid="footer-call">📞 Call {prettyPhone(support.phone)}</PillButton>}
            {support.sms && <PillButton variant="outline" size="lg" href={`sms:${support.sms}?&body=${encodeURIComponent('Listing Studio question')}`} data-testid="footer-text">💬 Text us</PillButton>}
            <PillButton variant="ghost" size="lg" href={`mailto:${support.email}`}>Email</PillButton>
          </div>
        </div>
        <div className="jrl-footer-links" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', color: t.textFaint, fontSize: 15 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.12em', color: t.textSecondary }}>{LISTING_BRAND.wordmark}</span>
          <span>{LISTING_BRAND.eyebrow}</span>
          <span>· Independence, MO</span>
          <a href={LISTING_BRAND.legal.terms}>Terms</a>
          <a href={LISTING_BRAND.legal.privacy}>Privacy</a>
          <a href={LISTING_BRAND.legal.beta}>Beta</a>
          <a href={SIGNIN}>Sign in</a>
          <a href={SIGNUP}>Sign up</a>
          <span style={{ marginLeft: 'auto' }}>Equal Housing Opportunity</span>
        </div>
      </footer>
    </CinemaRoot>
  );
}
