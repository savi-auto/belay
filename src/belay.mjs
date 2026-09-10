// Belay aggregator
// -----------------------------------------------------------------------------
// One wallet, every Bitcoin-collateralised position, one risk view. Each
// protocol adapter returns the same shape, so adding a venue never changes the
// consumer.
// -----------------------------------------------------------------------------
import * as granite from "./granite.mjs";
import * as zest from "./zest.mjs";

export const ADAPTERS = [granite, zest];

const RANK = { liquidatable: 0, "at-risk": 1, watch: 2, unknown: 3, safe: 4, "no-debt": 5 };

/** Every position a wallet holds across supported protocols, riskiest first. */
export async function getAllPositions(user) {
  const results = [];
  for (const adapter of ADAPTERS) {
    results.push(...(await adapter.getPositions(user)));
  }
  return results.sort(
    (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) ||
              (a.dropToLiquidation ?? 9) - (b.dropToLiquidation ?? 9)
  );
}

/** Wallet-level totals across protocols. */
export function summarise(positions) {
  const live = positions.filter((p) => !p.error);
  const collateralUsd = live.reduce((a, p) => a + (p.collateralUsd ?? 0), 0);
  const debtUsd = live.reduce((a, p) => a + (p.debtUsd ?? 0), 0);
  const withDebt = live.filter((p) => p.status !== "no-debt");
  return {
    protocols: [...new Set(live.map((p) => p.protocol))],
    positions: live.length,
    collateralUsd,
    debtUsd,
    netUsd: collateralUsd - debtUsd,
    // The wallet's true exposure is set by its WORST position: one liquidation
    // does not care that another position is comfortable.
    worst: withDebt.length
      ? withDebt.reduce((w, p) =>
          (p.dropToLiquidation ?? 9) < (w.dropToLiquidation ?? 9) ? p : w)
      : null,
    errors: positions.filter((p) => p.error),
  };
}
