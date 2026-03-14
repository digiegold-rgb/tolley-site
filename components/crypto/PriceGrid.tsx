"use client";

interface Prediction {
  symbol: string;
  direction: string;
  confidence: number;
  target_price: number;
  current_price: number;
  rationale?: string;
}

interface Props {
  prices: Record<string, number>;
  predictions: Prediction[];
}

const SYMBOL_META: Record<string, { name: string; rank: number }> = {
  BTC_USDT: { name: "Bitcoin", rank: 1 },
  ETH_USDT: { name: "Ethereum", rank: 2 },
  SOL_USDT: { name: "Solana", rank: 3 },
  BNB_USDT: { name: "BNB", rank: 4 },
  XRP_USDT: { name: "XRP", rank: 5 },
  ADA_USDT: { name: "Cardano", rank: 6 },
  AVAX_USDT: { name: "Avalanche", rank: 7 },
  DOGE_USDT: { name: "Dogecoin", rank: 8 },
  DOT_USDT: { name: "Polkadot", rank: 9 },
  LINK_USDT: { name: "Chainlink", rank: 10 },
  POL_USDT: { name: "Polygon", rank: 11 },
  UNI_USDT: { name: "Uniswap", rank: 12 },
  ATOM_USDT: { name: "Cosmos", rank: 13 },
  FIL_USDT: { name: "Filecoin", rank: 14 },
  APT_USDT: { name: "Aptos", rank: 15 },
  ARB_USDT: { name: "Arbitrum", rank: 16 },
  OP_USDT: { name: "Optimism", rank: 17 },
  NEAR_USDT: { name: "NEAR", rank: 18 },
  SUI_USDT: { name: "Sui", rank: 19 },
  INJ_USDT: { name: "Injective", rank: 20 },
  // Tier 3
  SHIB_USDT: { name: "Shiba Inu", rank: 21 },
  LTC_USDT: { name: "Litecoin", rank: 22 },
  TRX_USDT: { name: "Tron", rank: 23 },
  BCH_USDT: { name: "Bitcoin Cash", rank: 24 },
  PEPE_USDT: { name: "Pepe", rank: 25 },
  AAVE_USDT: { name: "Aave", rank: 26 },
  RENDER_USDT: { name: "Render", rank: 27 },
  FET_USDT: { name: "FET", rank: 28 },
  STX_USDT: { name: "Stacks", rank: 29 },
  HBAR_USDT: { name: "Hedera", rank: 30 },
  IMX_USDT: { name: "Immutable X", rank: 31 },
  MKR_USDT: { name: "Maker", rank: 32 },
  KAS_USDT: { name: "Kaspa", rank: 33 },
  GRT_USDT: { name: "The Graph", rank: 34 },
  THETA_USDT: { name: "Theta", rank: 35 },
  RUNE_USDT: { name: "THORChain", rank: 36 },
  ALGO_USDT: { name: "Algorand", rank: 37 },
  FTM_USDT: { name: "Fantom", rank: 38 },
  SEI_USDT: { name: "Sei", rank: 39 },
  FLOW_USDT: { name: "Flow", rank: 40 },
  SAND_USDT: { name: "Sandbox", rank: 41 },
  MANA_USDT: { name: "Decentraland", rank: 42 },
  CRV_USDT: { name: "Curve", rank: 43 },
  GALA_USDT: { name: "Gala", rank: 44 },
  DYDX_USDT: { name: "dYdX", rank: 45 },
  "1INCH_USDT": { name: "1inch", rank: 46 },
  ENS_USDT: { name: "ENS", rank: 47 },
  CFX_USDT: { name: "Conflux", rank: 48 },
  WLD_USDT: { name: "Worldcoin", rank: 49 },
  PENDLE_USDT: { name: "Pendle", rank: 50 },
};

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export default function PriceGrid({ prices, predictions }: Props) {
  const predMap = new Map(predictions.map((p) => [p.symbol, p]));

  const sorted = Object.entries(prices)
    .sort(([a], [b]) => (SYMBOL_META[a]?.rank ?? 99) - (SYMBOL_META[b]?.rank ?? 99));

  if (sorted.length === 0) {
    return (
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Live Prices</h3>
        <p className="text-sm text-white/20 text-center py-6">Waiting for price data...</p>
      </div>
    );
  }

  return (
    <div className="crypto-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider">Live Prices</h3>
        <span className="text-[10px] text-white/20">{sorted.length} symbols tracked</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {sorted.map(([symbol, price]) => {
          const pred = predMap.get(symbol);
          const meta = SYMBOL_META[symbol] || { name: symbol.replace("_USDT", ""), rank: 99 };
          const ticker = symbol.replace("_USDT", "");

          const dirColor =
            pred?.direction === "UP"
              ? "text-green-400"
              : pred?.direction === "DOWN"
              ? "text-red-400"
              : "text-white/30";
          const dirArrow =
            pred?.direction === "UP" ? "\u25B2" : pred?.direction === "DOWN" ? "\u25BC" : "\u25C6";
          const targetDiff = pred ? ((pred.target_price - price) / price) * 100 : 0;

          return (
            <div
              key={symbol}
              className="bg-white/[0.02] border border-white/5 rounded-lg p-3 hover:border-amber-500/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white">{ticker}</span>
                <span className="text-[9px] text-white/20">#{meta.rank}</span>
              </div>
              <div className="text-sm font-bold text-white mb-1">{formatPrice(price)}</div>
              {pred && (
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] ${dirColor}`}>{dirArrow}</span>
                  <span className={`text-[10px] ${dirColor}`}>{pred.direction}</span>
                  <span className="text-[10px] text-white/20">
                    {pred.confidence ? `${(pred.confidence * 100).toFixed(0)}%` : ""}
                  </span>
                </div>
              )}
              {pred && targetDiff !== 0 && (
                <div className="text-[9px] text-white/20 mt-0.5">
                  Target: {formatPrice(pred.target_price)}{" "}
                  <span className={targetDiff >= 0 ? "text-green-400/50" : "text-red-400/50"}>
                    ({targetDiff >= 0 ? "+" : ""}{targetDiff.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
