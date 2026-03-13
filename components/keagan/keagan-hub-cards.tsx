"use client";

import Link from "next/link";
import { CATEGORY_COLORS } from "@/lib/keagan";

interface CardData {
  title: string;
  href: string;
  color: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
  stat3Label: string;
  stat3Value: string;
}

interface Props {
  wdClients: number;
  wdEarned: number;
  trailerClients: number;
  trailerEarned: number;
  totalPaid: number;
  totalPending: number;
}

export function KeeganHubCards({ wdClients, wdEarned, trailerClients, trailerEarned, totalPaid, totalPending }: Props) {
  const cards: CardData[] = [
    {
      title: "W&D Rental",
      href: "/keagan/wd",
      color: CATEGORY_COLORS.wd,
      stat1Label: "Clients",
      stat1Value: String(wdClients),
      stat2Label: "Your Split",
      stat2Value: `$${wdEarned.toLocaleString()}`,
      stat3Label: "Status",
      stat3Value: wdClients > 0 ? "Active" : "None",
    },
    {
      title: "Trailer Rental",
      href: "/keagan/trailer",
      color: CATEGORY_COLORS.trailer,
      stat1Label: "Clients",
      stat1Value: String(trailerClients),
      stat2Label: "Your Split",
      stat2Value: `$${trailerEarned.toLocaleString()}`,
      stat3Label: "Status",
      stat3Value: trailerClients > 0 ? "Active" : "Ready",
    },
    {
      title: "All Payments",
      href: "/keagan/payments",
      color: CATEGORY_COLORS.labor,
      stat1Label: "Total Paid",
      stat1Value: `$${totalPaid.toLocaleString()}`,
      stat2Label: "Pending",
      stat2Value: `$${totalPending.toLocaleString()}`,
      stat3Label: "Categories",
      stat3Value: "WD, Trailer, Labor",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(card => (
        <Link
          key={card.href}
          href={card.href}
          className="block bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl" style={{ background: card.color }} />
          <div className="flex items-center gap-2.5 mb-4 pl-2">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: card.color }} />
            <h3 className="text-base font-bold text-gray-900">{card.title}</h3>
          </div>
          <div className="space-y-2.5 text-sm pl-2">
            <div className="flex justify-between">
              <span className="text-gray-500">{card.stat1Label}</span>
              <span className="font-semibold text-gray-900">{card.stat1Value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{card.stat2Label}</span>
              <span className="font-semibold text-gray-900">{card.stat2Value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{card.stat3Label}</span>
              <span className="font-semibold text-gray-900">{card.stat3Value}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
