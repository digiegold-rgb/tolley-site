import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Advertising Platform | T-Agent by Tolley.io",
  description:
    "T-Agent provides AI-powered Google Ads campaign management, budget optimization, keyword analytics, and performance reporting for real estate professionals.",
  openGraph: {
    title: "Advertising Platform | T-Agent by Tolley.io",
    description:
      "AI-powered Google Ads management for real estate agents. Campaign analytics, budget optimization, keyword tracking, and automated reporting.",
    url: "https://www.tolley.io/advertising",
    type: "website",
  },
};

const API_FEATURES = [
  {
    title: "Campaign Management",
    description:
      "Create, pause, and manage Google Ads campaigns directly from the T-Agent dashboard. Toggle campaign status, adjust daily budgets, and monitor spend in real time.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    title: "Performance Analytics",
    description:
      "Track impressions, clicks, conversions, CTR, and CPC across all campaigns. Drill into daily performance trends with interactive charts and exportable reports.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    title: "Keyword Intelligence",
    description:
      "Analyze top-performing keywords with quality scores, match types, and cost-per-conversion data. Identify high-ROI opportunities and eliminate wasted spend.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    title: "Budget Optimization",
    description:
      "Set and adjust campaign budgets with real-time spend tracking. Visual budget utilization bars show exactly where your ad dollars are going each month.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Ad Copy Performance",
    description:
      "Review responsive search ad performance with headline and description breakdowns. Track which ad variations drive the highest conversion rates.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "Multi-Campaign Overview",
    description:
      "Unified dashboard aggregating spend, impressions, clicks, and conversions across all active campaigns. Compare performance at a glance with sortable metrics.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
];

const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Connect Google Ads Account",
    description: "Securely link your Google Ads account via OAuth 2.0. T-Agent uses the official Google Ads API with read and write access scoped to campaign management.",
  },
  {
    step: "2",
    title: "Monitor Campaigns",
    description: "View all your campaigns in one dashboard — search, Performance Max, display, and video. Track spend, clicks, conversions, and ROI with 7/30/90-day views.",
  },
  {
    step: "3",
    title: "Optimize Performance",
    description: "Adjust budgets, pause underperforming campaigns, and analyze keyword quality scores. Drill into daily metrics to spot trends and opportunities.",
  },
  {
    step: "4",
    title: "Report & Scale",
    description: "Export performance data, track conversion trends over time, and scale winning campaigns. AI-powered insights surface actionable recommendations.",
  },
];

export default function AdvertisingPage() {
  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {/* Nav */}
        <nav className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-white/30 hover:text-white/50 transition-colors">
              tolley.io
            </Link>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-cyan-300">Advertising Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/start"
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              All Services
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/30"
            >
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <header className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(6,182,212,0.1)),rgba(8,7,15,0.58)] p-8 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-10">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.42em] text-white/68">
            t-agent advertising
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white/95 sm:text-4xl">
            Google Ads Management for Real Estate
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 sm:text-base">
            T-Agent integrates with the <strong className="text-white/90">Google Ads API</strong> to
            give real estate professionals a unified dashboard for managing ad campaigns, tracking
            performance, optimizing budgets, and analyzing keyword data — all without leaving the
            platform.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.1em] text-white/60">
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              Google Ads API v23
            </span>
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              OAuth 2.0 Authentication
            </span>
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              Real-Time Campaign Data
            </span>
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              Budget Management
            </span>
          </div>
        </header>

        {/* Business Context */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(6,182,212,0.08)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">About T-Agent</h2>
          <p className="mt-3 text-sm leading-7 text-white/78">
            <strong className="text-white/90">T-Agent</strong> is a SaaS platform built for real
            estate agents, brokerages, and property managers. It combines lead management, market
            intelligence, content automation, and advertising tools into a single workspace.
          </p>
          <p className="mt-3 text-sm leading-7 text-white/78">
            Real estate professionals rely on Google Ads to generate buyer and seller leads. T-Agent
            eliminates the need for separate ad management tools by integrating Google Ads campaign
            management directly into the agent&apos;s existing workflow — alongside their CRM, market
            data, and content scheduling.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-cyan-300">SaaS</p>
              <p className="mt-1 text-xs text-white/50">Business Model</p>
              <p className="mt-2 text-xs leading-5 text-white/60">
                Monthly subscription plans (Basic & Premium) via Stripe billing. Agents pay for
                platform access including ad management.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-cyan-300">Real Estate</p>
              <p className="mt-1 text-xs text-white/50">Industry Focus</p>
              <p className="mt-2 text-xs leading-5 text-white/60">
                Purpose-built for real estate professionals. Ad campaigns target home buyers,
                sellers, and property investors in local markets.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-cyan-300">AI-Powered</p>
              <p className="mt-1 text-xs text-white/50">Intelligence Layer</p>
              <p className="mt-2 text-xs leading-5 text-white/60">
                AI analyzes campaign performance alongside market data to surface actionable
                insights and optimization recommendations.
              </p>
            </div>
          </div>
        </section>

        {/* Google Ads API Usage */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(6,182,212,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">
            How We Use the Google Ads API
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/78">
            T-Agent uses the Google Ads API (REST, v23) to provide authenticated users with
            campaign management capabilities within our platform. Users connect their Google Ads
            accounts via OAuth 2.0, and T-Agent accesses their data on their behalf.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {API_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                  {f.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white/90">{f.title}</h3>
                <p className="mt-2 text-xs leading-5 text-white/60">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* API Endpoints Used */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(6,182,212,0.08)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">Google Ads API Integration Details</h2>
          <p className="mt-3 text-sm leading-7 text-white/78">
            Our integration uses the following Google Ads API services to power the T-Agent advertising dashboard:
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/15">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-black/28 text-white/80">
                <tr>
                  <th className="px-4 py-3 font-semibold">API Service</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Access</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">GoogleAdsService.SearchStream</td>
                  <td className="px-4 py-3 text-xs">Query campaign metrics, keyword data, ad performance</td>
                  <td className="px-4 py-3 text-xs">Read</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">CampaignService.MutateCampaigns</td>
                  <td className="px-4 py-3 text-xs">Update campaign status (enable/pause)</td>
                  <td className="px-4 py-3 text-xs">Write</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">CampaignBudgetService.MutateBudgets</td>
                  <td className="px-4 py-3 text-xs">Adjust daily campaign budgets</td>
                  <td className="px-4 py-3 text-xs">Write</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">OAuth 2.0</td>
                  <td className="px-4 py-3 text-xs">Authenticate user Google Ads accounts securely</td>
                  <td className="px-4 py-3 text-xs">Auth</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Dashboard Mockup */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(6,182,212,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">Campaign Dashboard</h2>
          <p className="mt-2 text-sm text-white/60">
            Authenticated users see this dashboard when managing their Google Ads campaigns within T-Agent.
          </p>

          {/* Mock Dashboard */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
            {/* Mock Account Overview */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider">Account Overview</p>
                <p className="text-sm text-white/60 mt-1">Last 30 days</p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/50">7d</span>
                <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-3 py-1 text-[10px] text-cyan-300">30d</span>
                <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/50">90d</span>
              </div>
            </div>

            {/* Mock Metrics Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-[9px] uppercase text-white/30">Total Spend</p>
                <p className="mt-1 text-xl font-bold text-rose-300">$2,847</p>
                <p className="text-[10px] text-emerald-400">+12% vs prior</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-[9px] uppercase text-white/30">Impressions</p>
                <p className="mt-1 text-xl font-bold text-purple-300">184K</p>
                <p className="text-[10px] text-emerald-400">+8% vs prior</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-[9px] uppercase text-white/30">Clicks</p>
                <p className="mt-1 text-xl font-bold text-cyan-300">6,241</p>
                <p className="text-[10px] text-emerald-400">+15% vs prior</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-[9px] uppercase text-white/30">Conversions</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">142</p>
                <p className="text-[10px] text-amber-400">-3% vs prior</p>
              </div>
            </div>

            {/* Mock Campaign Cards */}
            <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Active Campaigns</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-white/80">KC Home Buyers - Search</h4>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Active</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div>
                    <p className="text-[9px] text-white/30">Spend</p>
                    <p className="text-xs font-semibold text-rose-300">$1,204</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30">Clicks</p>
                    <p className="text-xs font-semibold text-purple-300">3,102</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30">Conv.</p>
                    <p className="text-xs font-semibold text-emerald-300">89</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30">CTR</p>
                    <p className="text-xs font-semibold text-cyan-300">3.42%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-white/30">
                  <span>Budget: $50/day</span>
                  <div className="h-1 w-20 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full w-[80%] rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-white/80">Seller Leads - PMax</h4>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Active</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div>
                    <p className="text-[9px] text-white/30">Spend</p>
                    <p className="text-xs font-semibold text-rose-300">$1,643</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30">Clicks</p>
                    <p className="text-xs font-semibold text-purple-300">3,139</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30">Conv.</p>
                    <p className="text-xs font-semibold text-emerald-300">53</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30">CTR</p>
                    <p className="text-xs font-semibold text-cyan-300">2.18%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-white/30">
                  <span>Budget: $65/day</span>
                  <div className="h-1 w-20 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full w-[84%] rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(6,182,212,0.08)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">How It Works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((s) => (
              <div key={s.step} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-sm font-bold text-cyan-400">
                  {s.step}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white/90">{s.title}</h3>
                <p className="mt-2 text-xs leading-5 text-white/60">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Handling & Compliance */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(6,182,212,0.08)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">Data Handling & Compliance</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/22 p-4">
              <h3 className="text-sm font-semibold text-white/90">User Consent & Authentication</h3>
              <p className="mt-1 text-xs leading-5 text-white/60">
                Users explicitly authorize T-Agent to access their Google Ads data via OAuth 2.0.
                We request only the permissions required for campaign management. Users can revoke
                access at any time through their Google account settings.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/22 p-4">
              <h3 className="text-sm font-semibold text-white/90">Data Storage & Security</h3>
              <p className="mt-1 text-xs leading-5 text-white/60">
                Google Ads data is fetched in real time and displayed within authenticated sessions.
                We do not store raw Google Ads data beyond temporary caching for performance.
                OAuth refresh tokens are encrypted at rest. All API communication uses HTTPS/TLS.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/22 p-4">
              <h3 className="text-sm font-semibold text-white/90">No Unauthorized Data Sharing</h3>
              <p className="mt-1 text-xs leading-5 text-white/60">
                T-Agent does not share, sell, or transfer Google Ads data to third parties.
                Campaign data is only visible to the authenticated account owner within their
                T-Agent dashboard.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(6,182,212,0.12)),rgba(8,7,15,0.58)] p-8 text-center shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl">
          <h2 className="text-xl font-semibold text-white/95">
            Ready to manage your Google Ads from one dashboard?
          </h2>
          <p className="mt-3 text-sm text-white/70">
            Join T-Agent and connect your Google Ads account to get started.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/20 px-6 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              View Plans
            </Link>
            <Link
              href="/start"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white/90"
            >
              Explore All Services
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-8 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(6,182,212,0.08)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">Contact</h2>
          <p className="mt-3 text-sm leading-7 text-white/78">
            T-Agent is operated by <strong className="text-white/90">Tolley.io</strong>, based in
            Independence, Missouri. For questions about our Google Ads API integration or platform:
          </p>
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <p>
              Website:{" "}
              <Link href="https://tolley.io" className="text-cyan-300 hover:text-cyan-200">
                tolley.io
              </Link>
            </p>
            <p>
              Email:{" "}
              <a href="mailto:support@tolley.io" className="text-cyan-300 hover:text-cyan-200">
                support@tolley.io
              </a>
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-10 border-t border-white/5 pt-6 text-center">
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} Tolley.io — Independence, MO. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
