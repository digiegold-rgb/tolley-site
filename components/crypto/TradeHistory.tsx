"use client";

interface TradeInfo {
  id: string;
  symbol: string;
  side: string;
  strategy: string;
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  pnl: number | null;
  pnlPct: number | null;
  fees: number;
  status: string;
  exitReason: string | null;
  regime: string | null;
  enteredAt: string;
  exitedAt: string | null;
}

interface Props {
  trades: TradeInfo[];
}

export default function TradeHistory({ trades }: Props) {
  const closedTrades = trades.filter((t) => t.status === "closed");
  const openTrades = trades.filter((t) => t.status === "open");

  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = closedTrades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? wins / closedTrades.length : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Total P&L</div>
          <div className={`text-xl font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Win Rate</div>
          <div className="text-xl font-bold text-amber-400">{(winRate * 100).toFixed(0)}%</div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Total Trades</div>
          <div className="text-xl font-bold text-white">{closedTrades.length}</div>
        </div>
      </div>

      <div className="crypto-card overflow-x-auto">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Trade History</h3>
        {closedTrades.length === 0 ? (
          <p className="text-sm text-white/20 text-center py-6">No completed trades yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase">
                <th className="text-left py-2">Symbol</th>
                <th className="text-left py-2">Side</th>
                <th className="text-right py-2">Entry</th>
                <th className="text-right py-2">Exit</th>
                <th className="text-right py-2">P&L</th>
                <th className="text-left py-2">Strategy</th>
                <th className="text-left py-2">Reason</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-2 text-white font-medium">{t.symbol.replace("_USDT", "")}</td>
                  <td className={`py-2 ${t.side === "long" ? "text-green-400" : "text-red-400"}`}>
                    {t.side.toUpperCase()}
                  </td>
                  <td className="py-2 text-right text-white/60">${t.entryPrice.toLocaleString()}</td>
                  <td className="py-2 text-right text-white/60">
                    ${t.exitPrice?.toLocaleString() ?? "—"}
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${
                      (t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(t.pnl || 0) >= 0 ? "+" : ""}${(t.pnl || 0).toFixed(2)}
                  </td>
                  <td className="py-2 text-white/40 text-xs">{t.strategy}</td>
                  <td className="py-2 text-white/30 text-xs">{t.exitReason || "—"}</td>
                  <td className="py-2 text-white/30 text-xs">
                    {t.exitedAt
                      ? new Date(t.exitedAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
