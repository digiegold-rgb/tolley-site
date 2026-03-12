"use client";

interface TickerData {
  price: number;
  change: number;
  changePercent: number;
}

interface Props {
  tickers: Record<string, TickerData> | null;
}

export default function StockTicker({ tickers }: Props) {
  if (!tickers || Object.keys(tickers).length === 0) {
    return (
      <div className="text-center py-4 text-white/30 text-xs">
        No stock data yet
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(tickers).map(([symbol, data]) => {
        const isUp = data.changePercent >= 0;
        return (
          <div
            key={symbol}
            className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/5 px-3 py-2"
          >
            <span className="text-xs font-bold text-white">{symbol}</span>
            <span className="text-sm text-white/80">${data.price.toFixed(2)}</span>
            <span className={`text-xs font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
              {isUp ? "+" : ""}{data.changePercent.toFixed(2)}%
              <svg className="inline-block w-3 h-3 ml-0.5" viewBox="0 0 12 12" fill="none">
                <path
                  d={isUp ? "M6 2L10 8H2L6 2Z" : "M6 10L2 4H10L6 10Z"}
                  fill="currentColor"
                />
              </svg>
            </span>
          </div>
        );
      })}
    </div>
  );
}
