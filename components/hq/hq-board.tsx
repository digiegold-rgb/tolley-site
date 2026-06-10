"use client";

import { HQ_BOARD_STAGES } from "@/lib/hq";
import { STAGE_LABEL, type HqLead } from "./types";

interface Props {
  leads: HqLead[];
  onSelect: (lead: HqLead) => void;
}

export function HqBoard({ leads, onSelect }: Props) {
  return (
    <div className="board">
      {HQ_BOARD_STAGES.map((stage) => {
        const column = leads.filter((l) => l.stage === stage);
        return (
          <div key={stage} className="board-col">
            <div className="board-col-head">
              <span>{STAGE_LABEL[stage] || stage}</span>
              <span className="board-col-count">{column.length}</span>
            </div>
            <div className="board-cards">
              {column.length === 0 && (
                <div style={{ fontSize: 11, color: "#9ca3af", padding: "6px 4px" }}>—</div>
              )}
              {column.map((lead) => (
                <button key={lead.id} className="lead-card" onClick={() => onSelect(lead)}>
                  <div className="lead-name">{lead.name}</div>
                  <div className="lead-meta">
                    <span className={`pill pill-offer-${lead.offer}`}>{lead.offer}</span>
                    {lead.score !== null && (
                      <span className="pill pill-score">{lead.score}</span>
                    )}
                    {lead.city && <span className="pill pill-city">{lead.city}</span>}
                  </div>
                  {lead.websiteNotes && (
                    <div className="lead-note">{lead.websiteNotes}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
