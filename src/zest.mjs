// Zest adapter
// -----------------------------------------------------------------------------
// Zest V2 exposes a rich aggregation contract (`v0-5-data`) that already knows a
// user's LTV bands and liquidation state. Two things it will NOT give a
// read-only caller:
//
//   * USD valuation. `get-user-position` takes an optional Pyth VAA payload;
//     passing `none` returns real amounts and real LTV bands but
//     total-collateral-usd = 0. Zest's own registry declares max-staleness of
//     120s per asset, so it will not value collateral off a stale price - it
//     expects a fresh VAA pushed in the same transaction. Belay therefore
//     values collateral itself, using the feed id Zest's registry declares.
//
//   * Underlying amounts. Collateral is held as VAULT SHARES (v0-vault-sbtc and
//     friends), not the underlying token, so share->asset ratios must be applied
//     before pricing or every collateral figure is understated.
// -----------------------------------------------------------------------------
import { principalCV, noneCV } from "@stacks/transactions";
import { readOnly, throttle, ContractError } from "./chain.mjs";
import { priceByFeed } from "./prices.mjs";
import { classify, currentLtv as calcLtv, dropToLiquidation, liquidationPrice as calcLiqPrice } from "./risk.mjs";

const ZEST = { address: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7", data: "v0-5-data" };

// Zest expresses LTV bands in basis points (u7000 == 70%).
const BPS = 10_000;

const data = (fn, args = [], cacheKey) =>
  readOnly({ address: ZEST.address, contract: ZEST.data, fn, args }, { cacheKey });

/** Asset registry: id -> { addr, decimals, feed, collateral, debt }. */
export async function getAssets() {
  const res = await data("get-all-assets", [], "zest:assets");
  const out = new Map();
  for (const a of res?.assets ?? []) {
    out.set(Number(a.id), {
      id: Number(a.id),
      addr: a.addr,
      decimals: Number(a.decimals),
      feed: a["oracle-ident"],
      maxStaleness: Number(a["max-staleness"]),
      isCollateral: a.collateral === true,
      isDebt: a.debt === true,
    });
  }
  return out;
}

/** Vault share->asset ratios, keyed by the vault's short name (sbtc, ststx, …). */
export async function getVaultRatios() {
  const res = await data("get-all-vault-ratios", [], "zest:ratios");
  const out = new Map();
  for (const [name, v] of Object.entries(res ?? {})) {
    out.set(name, { sharesToAssets: Number(v["shares-to-assets"]), underlying: v.underlying });
  }
  return out;
}

// `v0-vault-sbtc` -> `sbtc`, so a vault asset can be matched to its ratio.
const vaultNameOf = (addr) => {
  const name = String(addr).split(".")[1] ?? "";
  return name.startsWith("v0-vault-") ? name.slice("v0-vault-".length) : null;
};

/** Risk view for one Zest borrower, or null when they hold no position. */
export async function getPosition(user) {
  const [assets, ratios] = [await getAssets(), await getVaultRatios()];
  await throttle();
  const pos = await data("get-user-position", [principalCV(user), noneCV()]);
  if (!pos) return null;

  // --- debt ---------------------------------------------------------------
  let debtUsd = 0;
  let debtPriced = true;
  for (const d of pos.debt ?? []) {
    const asset = assets.get(Number(d["asset-id"]));
    if (!asset) { debtPriced = false; continue; }
    const { price } = await priceByFeed(asset.feed);
    if (price === null) { debtPriced = false; continue; }
    debtUsd += (Number(d["actual-debt"]) / 10 ** asset.decimals) * price;
  }

  // --- collateral (vault shares -> underlying -> USD) ----------------------
  let collateralUsd = 0;
  const collaterals = [];
  const unpriced = [];
  for (const c of pos.collateral ?? []) {
    const asset = assets.get(Number(c.aid));
    if (!asset) { unpriced.push(`aid:${c.aid}`); continue; }

    // Vault collateral is denominated in shares; convert to the underlying.
    const vaultName = vaultNameOf(asset.addr);
    const ratio = vaultName ? ratios.get(vaultName) : null;
    const shareScale = ratio ? ratio.sharesToAssets / 10 ** asset.decimals : 1;
    const amount = (Number(c.amount) / 10 ** asset.decimals) * shareScale;

    const { price, symbol, pegged } = await priceByFeed(asset.feed);
    if (price === null) { unpriced.push(asset.addr); continue; }
    const usd = amount * price;
    collateralUsd += usd;
    collaterals.push({ asset: asset.addr, symbol: symbol ?? vaultName ?? asset.addr, amount, price, usd, pegged });
  }

  const reliable = unpriced.length === 0 && debtPriced;
  if (collateralUsd === 0 && debtUsd === 0) return null;

  // Zest publishes the bands directly; trust the protocol over any local guess.
  const liquidationLtv = Number(pos["ltv-liq-partial"] ?? 0) / BPS;
  const borrowLtv = Number(pos["ltv-borrow"] ?? 0) / BPS;
  const currentLtv = calcLtv({ collateralUsd, debtUsd });
  const protocolSaysLiquidatable = pos["is-liquidatable"] === true;
  const dropToLiq = dropToLiquidation({ collateralUsd, debtUsd, liquidationLtv });
  const status = classify({ collateralUsd, debtUsd, liquidationLtv, reliable, protocolSaysLiquidatable });
  const liquidationPrice = calcLiqPrice({ collaterals, debtUsd, liquidationLtv });

  return {
    protocol: "Zest",
    market: "zest-v2",
    user,
    collateralUsd,
    debtUsd,
    currentLtv,
    liquidationLtv,
    borrowLtv,
    dropToLiquidation: dropToLiq,
    liquidationPrice,
    status,
    reliable,
    unpricedAssets: unpriced,
    // Zest's own verdict, kept alongside ours as a cross-check.
    protocolSaysLiquidatable,
    collaterals,
  };
}

/** Uniform entry point matching the Granite adapter. */
export async function getPositions(user) {
  try {
    const p = await getPosition(user);
    return p ? [p] : [];
  } catch (e) {
    if (e instanceof ContractError) return [];
    return [{ protocol: "Zest", market: "zest-v2", user, error: e.message }];
  }
}
