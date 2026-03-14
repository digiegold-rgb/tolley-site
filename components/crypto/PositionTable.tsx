"use client";

interface Position {
  symbol: string;
  side: string;
  entry_price: number;
  current_price: number;
  size: number;
  pnl: number;
  pnl_pct: number;
  strategy: string;
  stop_loss: number;
  take_profit: number;
  entered_at: string | null;
}

interface Props {
  positions: Position[];
}

export default function PositionTable({ positions }: Props) {
  if (!positions || positions.length === 0) {
    return (
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Open Positions</h3>
        <p className="text-sm text-white/20 text-center py-6">No open positions</p>
      </div>
    );
  }

  return (
    <div className="crypto-card overflow-x-auto">
      <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Open Positions</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/30 text-xs uppercase">
            <th className="text-left py-2">Symbol</th>
            <th className="text-left py-2">Side</th>
            <th className="text-right py-2">Entry</th>
            <th className="text-right py-2">Current</th>
            <th className="text-right py-2">Size</th>
            <th className="text-right py-2">P&L</th>
            <th className="text-left py-2">Strategy</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="py-2 text-white font-medium">{p.symbol.replace("_USDT", "")}</td>
              <td className={`py-2 ${p.side === "long" ? "text-green-400" : "text-red-400"}`}>
                {p.side.toUpperCase()}
              </td>
              <td className="py-2 text-right text-white/60">${p.entry_price.toLocaleString()}</td>
              <td className="py-2 text-right text-white/80">${p.current_price.toLocaleString()}</td>
              <td className="py-2 text-right text-white/60">{p.size.toFixed(6)}</td>
              <td className={`py-2 text-right font-medium ${p.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                <span className="text-[10px] ml-1 opacity-60">
                  ({(p.pnl_pct * 100).toFixed(2)}%)
                </span>
              </td>
              <td className="py-2 text-white/40 text-xs">{p.strategy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
