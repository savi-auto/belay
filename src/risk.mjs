// Risk classification
// -----------------------------------------------------------------------------
// Pure functions, shared by every protocol adapter. Kept in one place because a
// risk product must not let two venues disagree about what "at risk" means -
// and because the classification bug worth guarding against (an underwater
// position reading as "no debt") is exactly the kind that hides in duplicated
// display logic.
// -----------------------------------------------------------------------------

/** Debt below this is rounding dust, not a real obligation. */
export const DUST_USD = 0.01;

/** Thresholds on remaining price buffer before liquidation. */
export const BANDS = { atRisk: 0.10, watch: 0.25 };

/**
 * Proportional fall in collateral price that reaches the liquidation threshold.
 * Null ONLY when there is no debt; an already-underwater position is 0.
 *
 * Assumes collateral prices move together, which holds for the single-asset
 * markets live today but would need per-asset shocks for mixed collateral.
 */
export function dropToLiquidation({ collateralUsd, debtUsd, liquidationLtv }) {
  if (debtUsd <= DUST_USD) return null;
  const ltv = collateralUsd > 0 ? debtUsd / collateralUsd : Infinity;
  if (!Number.isFinite(ltv) || liquidationLtv <= 0) return 0;
  return Math.max(0, 1 - ltv / liquidationLtv);
}

/** Current loan-to-value; Infinity when debt is held against no priceable collateral. */
export const currentLtv = ({ collateralUsd, debtUsd }) =>
  collateralUsd > 0 ? debtUsd / collateralUsd : Infinity;

/**
 * Single classification for a position. Computed once, here, so no display
 * layer can reinvent it and get "liquidatable" wrong.
 */
export function classify({ collateralUsd, debtUsd, liquidationLtv, reliable = true, protocolSaysLiquidatable = false }) {
  if (debtUsd <= DUST_USD) return "no-debt";
  if (!reliable) return "unknown";
  const drop = dropToLiquidation({ collateralUsd, debtUsd, liquidationLtv });
  if (protocolSaysLiquidatable || drop === 0) return "liquidatable";
  if (drop < BANDS.atRisk) return "at-risk";
  if (drop < BANDS.watch) return "watch";
  return "safe";
}

/** Absolute collateral price at which a single-collateral position liquidates. */
export function liquidationPrice({ collaterals, debtUsd, liquidationLtv }) {
  if (collaterals.length !== 1 || debtUsd <= DUST_USD || liquidationLtv <= 0) return null;
  const [c] = collaterals;
  return c.amount > 0 ? debtUsd / (c.amount * liquidationLtv) : null;
}
