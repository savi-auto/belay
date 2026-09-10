// Granite adapter
// -----------------------------------------------------------------------------
// Derives, from a borrower's real on-chain position, the number no Stacks
// interface currently shows: how far the collateral price can fall before the
// position is liquidated.
//
// Risk parameters (liquidation LTV, max LTV, decimals) are read from the
// protocol's own state contract rather than hardcoded, so a governance change
// to a risk band is picked up automatically instead of silently making every
// number wrong.
// -----------------------------------------------------------------------------
import { principalCV, uintCV } from "@stacks/transactions";
import { readOnly, throttle, ContractError } from "./chain.mjs";
import { priceOf, symbolOf } from "./prices.mjs";
import { classify, currentLtv as calcLtv, dropToLiquidation, liquidationPrice as calcLiqPrice } from "./risk.mjs";

// Granite runs more than one market; each has its own state contract,
// collateral set and debt asset.
export const GRANITE_MARKETS = [
  { id: "granite-main", address: "SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE" },
  { id: "granite-alt", address: "SP35E2BBMDT2Y1HB0NTK139YBGYV3PAPK3WA8BRNA" },
];

// Contract fixed-point scale for LTV figures: u65000000 == 65%.
const LTV_SCALE = 1e8;

const state = (market, fn, args, cacheKey) =>
  readOnly({ address: market.address, contract: "state-v1", fn, args }, { cacheKey });

/** Risk bands for one collateral asset, as configured on-chain. */
export async function getCollateralParams(market, collateral) {
  const res = await state(
    market, "get-collateral", [principalCV(collateral)], `${market.id}:coll:${collateral}`
  );
  if (!res) return null;
  return {
    decimals: Number(res.decimals),
    liquidationLtv: Number(res["liquidation-ltv"]) / LTV_SCALE,
    maxLtv: Number(res["max-ltv"]) / LTV_SCALE,
    liquidationPremium: Number(res["liquidation-premium"]) / LTV_SCALE,
  };
}

/** Debt-asset decimals for the market (cached; identical for all users). */
const getDebtDecimals = (market) =>
  state(market, "get-decimals", [], `${market.id}:decimals`).then(Number);

/**
 * Risk view for one borrower in one market, or null when they hold no position.
 */
export async function getPosition(market, user) {
  const position = await state(market, "get-user-position", [principalCV(user)]);
  if (!position) return null;

  const shares = Number(position["debt-shares"] ?? 0);
  const collateralList = position.collaterals ?? [];
  if (shares === 0 && collateralList.length === 0) return null;

  // Debt is stored as shares; convert so accrued interest is included.
  await throttle();
  const debtDecimals = await getDebtDecimals(market);
  let debtAssets = 0;
  if (shares > 0) {
    await throttle();
    debtAssets = Number(await state(market, "convert-to-assets", [uintCV(shares)]));
  }
  // Granite markets are isolated with a single borrowable STABLECOIN (USDCx /
  // aeUSDC), so debt is valued 1:1 in USD. A depeg would bias this figure.
  const debtUsd = debtAssets / 10 ** debtDecimals;

  const collaterals = [];
  let collateralUsd = 0;
  for (const asset of collateralList) {
    await throttle();
    const params = await getCollateralParams(market, asset);
    if (!params) continue;
    await throttle();
    const held = await state(market, "get-user-collateral", [principalCV(user), principalCV(asset)]);
    const amount = Number(held?.amount ?? 0) / 10 ** params.decimals;
    const price = await priceOf(asset);
    const usd = price === null ? 0 : amount * price;
    collateralUsd += usd;
    collaterals.push({
      asset, symbol: symbolOf(asset), amount, price, usd, priced: price !== null, ...params,
    });
  }

  if (collateralUsd === 0 && debtUsd === 0) return null;

  // A collateral asset we cannot price would otherwise count as $0, silently
  // understating collateral and making the position look SAFER than it is.
  // Never quietly absorb that: mark the whole reading unreliable.
  const unpriced = collaterals.filter((c) => !c.priced && c.amount > 0);
  const reliable = unpriced.length === 0;

  // Liquidation threshold is the collateral-weighted liquidation LTV.
  const liquidationLtv = collateralUsd > 0
    ? collaterals.reduce((a, c) => a + c.liquidationLtv * c.usd, 0) / collateralUsd
    : 0;
  const currentLtv = calcLtv({ collateralUsd, debtUsd });
  const dropToLiq = dropToLiquidation({ collateralUsd, debtUsd, liquidationLtv });
  const status = classify({ collateralUsd, debtUsd, liquidationLtv, reliable });
  const liquidationPrice = calcLiqPrice({ collaterals, debtUsd, liquidationLtv });

  return {
    protocol: "Granite",
    market: market.id,
    user,
    collateralUsd,
    debtUsd,
    currentLtv,
    liquidationLtv,
    dropToLiquidation: dropToLiq,
    liquidationPrice,
    status,
    reliable,
    unpricedAssets: unpriced.map((c) => c.asset),
    collaterals,
  };
}

/** Every Granite position held by a user, across markets. */
export async function getPositions(user) {
  const out = [];
  for (const market of GRANITE_MARKETS) {
    try {
      await throttle();
      const p = await getPosition(market, user);
      if (p) out.push(p);
    } catch (e) {
      if (e instanceof ContractError) continue; // no position / unsupported asset
      out.push({ protocol: "Granite", market: market.id, user, error: e.message });
    }
  }
  return out;
}
