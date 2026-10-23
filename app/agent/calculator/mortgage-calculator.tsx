"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { calculateMortgage, DEFAULT_MORTGAGE, LOANS, normalizeMortgage, type LoanType, type MortgageInputs } from "@/lib/mortgage-calculator";
import styles from "./mortgage-calculator.module.css";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const exactMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function Icon({ name }: { name: "home" | "sun" | "moon" | "share" | "arrow" }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "home" ? <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></> : name === "sun" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : name === "moon" ? <path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z" /> : name === "share" ? <><path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9" /></> : <path d="M5 12h14m-5-5 5 5-5 5" />}
  </svg>;
}

function NumberField({ id, label, value, onChange, min = 0, max, suffix, prefix, large = false }: {
  id: string; label: string; value: number; onChange: (n: number) => void; min?: number; max: number; suffix?: string; prefix?: string; large?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className={`${styles.field} ${large ? styles.largeField : ""}`} htmlFor={id}>
    <span>{label}</span>
    <span className={styles.inputWrap}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={draft ?? (prefix === "$" ? Number(value.toFixed(2)).toLocaleString("en-US") : String(Number(value.toFixed(2))))}
        onChange={e => {
          const next = e.target.value.replace(/[$,%\s]/g, "");
          if (!/^\d*\.?\d*$/.test(next)) return;
          setDraft(next);
          const n = Number(next);
          if (next && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          if (draft !== null && draft !== "" && draft !== ".") onChange(Math.min(max, Math.max(min, Number(draft))));
          setDraft(null);
        }} />
      {suffix && <span>{suffix}</span>}
    </span>
  </label>;
}

function Slider({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; format: (n: number) => string }) {
  return <div className={styles.sliderWrap}>
    <input id={id} aria-label={label} aria-valuetext={format(value)} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ "--fill": `${(value - min) / (max - min) * 100}%` } as CSSProperties} />
    <div className={styles.rangeEnds}><span>{format(min)}</span><span>{format(max)}</span></div>
  </div>;
}

function Row({ label, value, dot, strong = false }: { label: ReactNode; value: string; dot?: string; strong?: boolean }) {
  return <div className={`${styles.row} ${strong ? styles.strongRow : ""}`}><dt>{dot && <i style={{ background: dot }} />}{label}</dt><dd>{value}</dd></div>;
}

export default function MortgageCalculator() {
  const [input, setInput] = useState<MortgageInputs>(DEFAULT_MORTGAGE);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [ready, setReady] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [fallbackLink, setFallbackLink] = useState("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tolley-calculator-theme");
      if (stored === "dark" || stored === "light") setTheme(stored);
    } catch { /* Private browsing can block storage. */ }
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("scenario");
      if (raw && raw.length < 3000) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) setInput(normalizeMortgage(parsed));
      }
    } catch { /* Invalid shared links fall back to the example. */ }
    setReady(true);
  }, []);
  const result = calculateMortgage(input);
  const loan = LOANS[input.loan];
  const miLabel = input.loan === "fha" ? "FHA mortgage insurance" : input.loan === "usda" ? "USDA annual fee" : "Mortgage insurance (PMI)";
  const upfrontLabel = input.loan === "fha" ? "FHA upfront MIP" : input.loan === "va" ? "VA funding fee" : "USDA guarantee fee";
  function update<K extends keyof MortgageInputs>(key: K, value: MortgageInputs[K]) {
    setInput(current => normalizeMortgage({ ...current, [key]: value }));
    setShareMessage(""); setFallbackLink("");
  }
  function changeLoan(next: LoanType) {
    setInput(current => normalizeMortgage({ ...current, loan: next, down: Math.max(current.down, LOANS[next].minimum) }));
    setShareMessage(""); setFallbackLink("");
  }
  function toggleTheme() {
    const isDark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("tolley-calculator-theme", next); } catch { /* Theme still works without storage. */ }
  }
  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("scenario", JSON.stringify(input));
    const data = { title: "My home payment estimate · T-Agent", text: `${money(input.price)} home · ${loan.name} · ${input.down}% down · estimated ${money(result.monthly)}/month`, url: url.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url.href); setShareMessage("Estimate link copied."); }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFallbackLink(url.href); setShareMessage("Copy this link to share your estimate.");
    }
  }
  const colors = ["#11a896", "#7197e5", "#b396df", "#e5b66b", "#92a6aa"];
  const parts = [result.pi, result.taxes, result.insurance, result.mi, input.hoa];
  const presets = [...new Set([loan.minimum, 5, 10, 20])];
  return <div className={styles.calculator} data-theme={theme} data-mortgage-calculator data-ready={ready}>
    <a className={styles.skip} href="#calculator-inputs">Skip to calculator</a>
    <header className={styles.header}>
      <Link href="/agent" className={styles.brand}><span className={styles.brandMark}><Icon name="home" /></span><span>T-AGENT<span className={styles.brandSub}>HOME FINANCING, SIMPLIFIED</span></span></Link>
      <div className={styles.headerActions}><Link href="/agent" className={styles.backLink}>Back to Agent <span aria-hidden="true">↗</span></Link><button type="button" className={styles.themeButton} onClick={toggleTheme} aria-label="Switch light or dark appearance"><span className={styles.sun}><Icon name="sun" /></span><span className={styles.moon}><Icon name="moon" /></span></button></div>
    </header>
    <main className={styles.main}>
      <div className={styles.intro}><span className={styles.eyebrow}><span /> A LITTLE CLARITY FOR YOUR NEXT CHAPTER</span><h1>What could your<br className={styles.mobileBreak} /> payment be?</h1><p>A home you love. A payment you understand.<br className={styles.mobileBreak} /> Let’s find your comfortable.</p><span className={styles.freeBadge}>Free to use <span>·</span> No sign-in needed</span></div>
      <div className={styles.workspace}>
        <section id="calculator-inputs" className={styles.controls} aria-label="Mortgage calculator inputs">
          <div className={styles.card}>
            <div className={styles.sectionHeading}><span className={styles.step}>01</span><h2>Choose your loan</h2><span className={styles.tiny}>FIXED RATE</span></div>
            <div className={styles.loanGrid} role="group" aria-label="Loan type">
              {(Object.keys(LOANS) as LoanType[]).map(type => <button type="button" key={type} aria-pressed={input.loan === type} className={styles.loanButton} onClick={() => changeLoan(type)}><span>{LOANS[type].name}<span className={styles.radio} /></span><small>{LOANS[type].hint}</small></button>)}
            </div>
            <p className={styles.loanDescription}>{loan.description}</p>
          </div>
          <div className={styles.card}>
            <div className={styles.sectionHeading}><span className={styles.step}>02</span><h2>Make it your home</h2></div>
            <NumberField id="home-price" label="Home price" prefix="$" value={input.price} min={10000} max={5000000} large onChange={value => update("price", value)} />
            <Slider id="home-price-slider" label="Home price slider" min={10000} max={Math.max(1500000, input.price)} step={1000} value={input.price} onChange={value => update("price", value)} format={money} />
            <div className={styles.divider} />
            <div className={styles.downHeading}><h3>Down payment</h3><span>{money(result.downPayment)} upfront</span></div>
            <div className={styles.presets} role="group" aria-label="Down payment presets">{presets.map(pct => <button key={pct} type="button" aria-pressed={input.down === pct} onClick={() => update("down", pct)}>{pct}%<small>{money(input.price * pct / 100)}</small></button>)}</div>
            <div className={styles.downCustom}><Slider id="down-slider" label="Down payment slider" value={input.down} min={loan.minimum} max={100} step={0.5} onChange={value => update("down", value)} format={n => `${n}%`} /><NumberField id="down-percent" label="Custom down" value={input.down} min={loan.minimum} max={100} suffix="%" onChange={value => update("down", value)} /></div>
            <div className={styles.divider} />
            <div className={styles.twoFields}><NumberField id="interest-rate" label="Interest rate" value={input.rate} max={20} suffix="%" onChange={value => update("rate", value)} /><label className={styles.field} htmlFor="loan-term"><span>Loan term</span><select id="loan-term" value={input.years} disabled={input.loan === "usda"} onChange={e => update("years", Number(e.target.value))}>{[10, 15, 20, 25, 30].map(years => <option key={years} value={years}>{years} years</option>)}</select></label></div>
            <p className={styles.helper}>The rate is an example, not a live quote. Enter your lender’s rate.{input.loan === "usda" && " USDA Guaranteed loans use a 30-year term."}</p>
          </div>
          <div className={styles.card}>
            <div className={styles.sectionHeading}><span className={styles.step}>03</span><h2>The other monthly costs</h2></div>
            <p className={styles.helper}>These are included in your total. Adjust them for the property.</p>
            <div className={styles.costFields}><NumberField id="property-tax" label="Property tax · yearly" value={input.taxRate} max={10} suffix="%" onChange={value => update("taxRate", value)} /><NumberField id="home-insurance" label="Home insurance · yearly" value={input.insurance} max={100000} prefix="$" onChange={value => update("insurance", value)} /><NumberField id="hoa" label="HOA dues · monthly" value={input.hoa} max={10000} prefix="$" onChange={value => update("hoa", value)} />{input.loan === "conventional" && <NumberField id="pmi-rate" label="PMI rate · yearly" value={input.pmiRate} max={5} suffix="%" onChange={value => update("pmiRate", value)} />}</div>
            <div className={styles.insuranceNote}><span aria-hidden="true">ⓘ</span><p>{input.loan === "conventional" ? input.down >= 20 ? "With 20% or more down, this estimate has no PMI." : `PMI uses your ${input.pmiRate}% annual estimate. Ask your lender for a personalized premium.` : input.loan === "fha" ? `FHA annual MIP: ${Number(result.annualMiRate.toFixed(2))}%. ${input.down >= 10 ? "Estimated for 11 years." : "Applies for the loan term."}` : input.loan === "va" ? "VA loans have no monthly mortgage insurance." : "Includes a 0.35% annual guarantee fee, estimated on the scheduled balance."}</p></div>
            {input.loan === "va" && <label className={styles.field} htmlFor="va-use"><span>VA funding fee status</span><select id="va-use" value={input.vaUse} onChange={e => update("vaUse", e.target.value as MortgageInputs["vaUse"])}><option value="first">First use</option><option value="subsequent">Subsequent use</option><option value="exempt">Exempt from funding fee</option></select></label>}
            {input.loan !== "conventional" && <label className={styles.check}><input type="checkbox" checked={input.financeFee} onChange={e => update("financeFee", e.target.checked)} /><span>Include the {upfrontLabel.toLowerCase()} in my loan<small>{money(result.upfrontFee)} · {result.upfrontRate}% of the base loan</small></span></label>}
          </div>
        </section>
        <aside className={styles.results} aria-label="Your payment estimate">
          <section className={`${styles.card} ${styles.paymentCard}`} id="payment-breakdown">
            <div className={styles.resultEyebrow}><span className={styles.liveDot} /> YOUR ESTIMATED PAYMENT<span className={styles.pill}>{loan.name}</span></div>
            <div className={styles.payment}><span data-testid="monthly-payment">{money(result.monthly)}</span><span>/ month</span></div>
            <p className={styles.paymentCaption}>The whole monthly picture, in one number.</p>
            <div className={styles.paymentBar} aria-hidden="true">{parts.map((part, i) => part > 0 && <span key={i} style={{ background: colors[i], flexGrow: part }} />)}</div>
            <dl className={styles.breakdown}><Row label="Principal & interest" value={exactMoney(result.pi)} dot={colors[0]} /><Row label="Property taxes" value={exactMoney(result.taxes)} dot={colors[1]} /><Row label="Home insurance" value={exactMoney(result.insurance)} dot={colors[2]} /><Row label={miLabel} value={exactMoney(result.mi)} dot={colors[3]} /><Row label="HOA dues" value={exactMoney(input.hoa)} dot={colors[4]} /><Row label="Total monthly payment" value={exactMoney(result.monthly)} strong /></dl>
            <div className={styles.paymentFootnote}>{input.years}-year fixed · {input.rate}% interest · {input.down}% down</div>
            <button type="button" className={styles.shareButton} onClick={share}><Icon name="share" /> Share this estimate</button>
            <p className={styles.shareStatus} role="status">{shareMessage}</p>{fallbackLink && <input className={styles.fallback} aria-label="Shareable estimate link" readOnly value={fallbackLink} onFocus={e => e.target.select()} />}
          </section>
          <section className={`${styles.card} ${styles.purchaseCard}`}>
            <div className={styles.sectionHeading}><span className={styles.miniHome}><Icon name="home" /></span><h2>Your purchase, at a glance</h2></div>
            <dl><Row label="Home price" value={money(input.price)} /><Row label={`Down payment (${input.down}%)`} value={money(result.downPayment)} /><Row label="Base loan amount" value={money(result.base)} />{result.upfrontFee > 0 && <Row label={<>{upfrontLabel}<small>{input.financeFee ? "Added to your loan" : "Paid at closing"}</small></>} value={money(result.upfrontFee)} />}<Row label="Total loan amount" value={money(result.principal)} strong /></dl>
            <details className={styles.details}><summary>Cash needed at closing<span aria-hidden="true">+</span></summary><div className={styles.detailBody}><NumberField id="closing-cost" label="Other closing costs · estimate" value={input.closingRate} max={10} suffix="%" onChange={value => update("closingRate", value)} /><dl><Row label="Down payment" value={money(result.downPayment)} /><Row label="Other closing costs" value={money(result.closingCosts)} />{!input.financeFee && result.upfrontFee > 0 && <Row label={upfrontLabel} value={money(result.upfrontFee)} />}<Row label="Estimated cash to close" value={money(result.cashToClose)} strong /></dl><p className={styles.helper}>Planning estimate for down payment and lender/title charges. Prepaid taxes, insurance, escrow reserves, earnest money and credits are not included. Use your Loan Estimate for actual cash to close.</p></div></details>
            <details className={styles.details}><summary>The full cost over {input.years} years<span aria-hidden="true">+</span></summary><div className={styles.detailBody}><dl><Row label="Loan principal" value={money(result.principal)} /><Row label="Total interest" value={money(result.totalInterest)} /><Row label="Total principal & interest" value={money(result.loanPayments)} strong /><Row label="Mortgage insurance / fees over time" value={money(result.totalMi)} /><Row label="Taxes, home insurance & HOA" value={money((result.taxes + result.insurance + input.hoa) * input.years * 12)} /><Row label="Cash to close" value={money(result.cashToClose)} /><Row label="Estimated total housing outlay" value={money(result.lifetimeHousing)} strong /></dl><p className={styles.helper}>Assumes the same rate, taxes, home insurance and HOA for the full term, with no early payoff. Government annual fees are approximate and decline with scheduled balances. PMI assumes on-time payments and automatic termination at 78% scheduled loan-to-value or the midpoint; earlier cancellation may be available. Utilities, repairs, future increases and closing-cost adjustments are excluded.</p></div></details>
          </section>
        </aside>
      </div>
      <section className={styles.bottomNote}><div><span className={styles.eyebrow}>YOUR NEXT MOVE</span><h2>Less guessing. More house hunting.</h2><p>Change one thing at a time to see what makes a comfortable payment for you.</p></div><Link href="/homes">Explore Your KC Homes <Icon name="arrow" /></Link></section>
      <details className={styles.assumptions}><summary>About these estimates & loan guidelines</summary><p>This is a planning tool for fixed-rate home purchases, not a loan offer, APR disclosure, approval or eligibility check. Rates and costs are examples. County loan limits, credit, occupancy, income and property requirements still apply. A lender’s Loan Estimate is the source for your actual terms. Mortgage insurance and government annual fees are estimates; lender rounding and fee calculations may differ.</p><p>Fee assumptions reviewed October 23, 2026: <a href="https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf" target="_blank" rel="noreferrer">HUD FHA MIP schedule</a>, <a href="https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/" target="_blank" rel="noreferrer">VA funding fees</a>, <a href="https://content.govdelivery.com/accounts/USDARD/bulletins/42b1054" target="_blank" rel="noreferrer">USDA FY2027 fees</a>, and <a href="https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/" target="_blank" rel="noreferrer">CFPB PMI cancellation</a>. This calculator models USDA Guaranteed loans, not USDA Direct loans. FHA MIP uses the published $726,200 premium tier threshold; that is not a county loan limit.</p></details>
      <footer className={styles.footer}><span>T-AGENT <span>·</span> A little more confidence, from Tolley.</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><button type="button" onClick={() => { setInput(DEFAULT_MORTGAGE); setShareMessage(""); setFallbackLink(""); window.history.replaceState(null, "", window.location.pathname); }}>Reset calculator</button></div></footer>
    </main>
    <div className={styles.mobileTotal}><div><span>Estimated monthly total</span><strong>{money(result.monthly)}<small>/mo</small></strong></div><a href="#payment-breakdown">Breakdown <Icon name="arrow" /></a></div>
    <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">Estimated monthly payment {money(result.monthly)} with a {loan.name} loan.</div>
  </div>;
}
