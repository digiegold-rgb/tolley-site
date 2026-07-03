"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LeadsDashboard from "@/components/leads/LeadsDashboard";
import ClientList from "@/components/clients/ClientList";
import ClientMatches from "@/components/leads/ClientMatches";

/**
 * People workspace — smart-list sidebar + body. Switches between views of the
 * existing LeadsDashboard, ClientList, and ClientMatches components.
 *
 * Smart-list sidebar is the IA escape valve: Cordless can save any filter as
 * a smart list in later phases. For now the system lists are hardcoded.
 */

export interface PeopleWorkspaceProps {
  leads: Parameters<typeof LeadsDashboard>[0]["leads"];
  clients: Parameters<typeof ClientList>[0]["clients"];
  matchClients: Parameters<typeof ClientMatches>[0]["clients"];
}

type SmartListId =
  | "all"
  | "hot"
  | "cold"
  | "buyers"
  | "sellers"
  | "clients"
  | "matches";

interface SmartList {
  id: SmartListId;
  label: string;
  count: (p: PeopleWorkspaceProps) => number;
  description?: string;
}

const SMART_LISTS: SmartList[] = [
  { id: "all", label: "All leads", count: (p) => p.leads.length },
  {
    id: "hot",
    label: "Hot (≥70)",
    count: (p) => p.leads.filter((l) => l.score >= 70).length,
  },
  {
    id: "cold",
    label: "Cold (>14d)",
    count: (p) =>
      p.leads.filter(
        (l) =>
          !l.contactedAt &&
          Date.now() - new Date(l.createdAt).getTime() > 14 * 864e5
      ).length,
  },
  {
    id: "buyers",
    label: "Buyers",
    count: (p) => p.clients.filter((c) => c.buyerSeller === "buyer").length,
  },
  {
    id: "sellers",
    label: "Sellers",
    count: (p) => p.clients.filter((c) => c.buyerSeller === "seller").length,
  },
  {
    id: "clients",
    label: "All clients",
    count: (p) => p.clients.length,
  },
  {
    id: "matches",
    label: "Client matches",
    count: (p) => p.matchClients.length,
  },
];

export default function PeopleWorkspace(props: PeopleWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullFilters, setFullFilters] = useState(false);

  const activeId = (searchParams?.get("list") as SmartListId) ?? "all";

  const setActive = (id: SmartListId) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (id === "all") params.delete("list");
    else params.set("list", id);
    router.replace(`/leads/people${params.size ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  };

  // Compute the filtered leads subset for lead-based smart lists. For client
  // lists we render different components entirely.
  const filteredLeads = useMemo(() => {
    switch (activeId) {
      case "hot":
        return props.leads.filter((l) => l.score >= 70);
      case "cold":
        return props.leads.filter(
          (l) =>
            !l.contactedAt &&
            Date.now() - new Date(l.createdAt).getTime() > 14 * 864e5
        );
      default:
        return props.leads;
    }
  }, [activeId, props.leads]);

  const filteredClients = useMemo(() => {
    switch (activeId) {
      case "buyers":
        return props.clients.filter((c) => c.buyerSeller === "buyer");
      case "sellers":
        return props.clients.filter((c) => c.buyerSeller === "seller");
      default:
        return props.clients;
    }
  }, [activeId, props.clients]);

  return (
    <div className="flex min-h-[60vh] gap-5">
      {/* Smart lists sidebar */}
      <aside className="w-56 shrink-0">
        <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-white/30">
          Smart lists
        </div>
        <nav className="space-y-0.5">
          {SMART_LISTS.map((list) => {
            const isActive = activeId === list.id;
            const count = list.count(props);
            return (
              <button
                key={list.id}
                onClick={() => setActive(list.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span className="truncate">{list.label}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive
                      ? "bg-white/20 text-white/80"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main body */}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {SMART_LISTS.find((l) => l.id === activeId)?.label ?? "People"}
            </h1>
            <p className="text-xs text-white/40">
              {isLeadBased(activeId)
                ? `${filteredLeads.length} leads`
                : activeId === "matches"
                ? `${props.matchClients.length} matches`
                : `${filteredClients.length} clients`}
            </p>
          </div>

          {isLeadBased(activeId) && (
            <button
              onClick={() => setFullFilters((f) => !f)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              {fullFilters ? "Hide" : "Show"} full filters
            </button>
          )}
        </div>

        {isLeadBased(activeId) &&
          (fullFilters ? (
            <LeadsDashboard leads={filteredLeads} />
          ) : (
            <CompactLeadTable leads={filteredLeads} />
          ))}

        {(activeId === "buyers" || activeId === "sellers" || activeId === "clients") && (
          <ClientList clients={filteredClients} />
        )}

        {activeId === "matches" && <ClientMatches clients={props.matchClients} />}
      </div>
    </div>
  );
}

function isLeadBased(id: SmartListId): boolean {
  return id === "all" || id === "hot" || id === "cold";
}

function CompactLeadTable({
  leads,
}: {
  leads: PeopleWorkspaceProps["leads"];
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/40">
        No leads in this list.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
          <tr>
            <th className="px-4 py-2 text-left">Address</th>
            <th className="px-3 py-2 text-left">City</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {leads.slice(0, 200).map((lead) => (
            <tr
              key={lead.id}
              className="cursor-pointer text-white/80 hover:bg-white/5"
              onClick={() => (window.location.href = `/leads/${lead.id}`)}
            >
              <td className="px-4 py-2 text-white/90">
                {lead.listing?.address ?? "—"}
              </td>
              <td className="px-3 py-2 text-white/50">
                {lead.listing?.city ?? "—"}
              </td>
              <td className="px-3 py-2 text-right text-white/70">
                {lead.listing?.listPrice
                  ? `$${(lead.listing.listPrice / 1000).toFixed(0)}k`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <ScoreBadge score={lead.score} />
              </td>
              <td className="px-3 py-2 text-xs capitalize text-white/50">
                {lead.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length > 200 && (
        <div className="border-t border-white/10 bg-white/[0.02] px-4 py-2 text-center text-[11px] text-white/30">
          Showing 200 of {leads.length} — use "Show full filters" to drill down.
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : score >= 40
      ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
      : "bg-white/5 text-white/40 border-white/10";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {score}
    </span>
  );
}
