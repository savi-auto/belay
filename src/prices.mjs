// Live price provider
// -----------------------------------------------------------------------------
// Liquidations on Stacks are executed by liquidators who push a FRESH Pyth VAA
// in the same transaction. So the price that decides whether a position is
// liquidatable is the live market price - not whatever happens to be sitting in
// on-chain storage, which is only as fresh as the last protocol transaction.
//
// Belay therefore prices risk off a live feed, and separately reports the
// on-chain price and its age so the user can see the gap.
// -----------------------------------------------------------------------------
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";

// Collateral contract -> (coingecko id, display symbol)
export const ASSETS = {
  "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token": { id: "bitcoin", symbol: "sBTC" },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stbtc-token": { id: "bitcoin", symbol: "stBTC" },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token": { id: "blockstack", symbol: "stSTX" },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2": { id: "blockstack", symbol: "stSTXbtc" },
  "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.wstx": { id: "blockstack", symbol: "wSTX" },
  STX: { id: "blockstack", symbol: "STX" },
};

// Pyth/DIA feed identifier -> pricing. Protocols carry the feed id per asset in
// their own registries, so pricing by feed keeps us aligned with the protocol's
// own view of what an asset is.
//
// Stablecoins are pinned at $1 and flagged: a depeg would bias any position
// valued this way, and that is worth stating rather than hiding.
export const FEED_PRICING = {
  e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43: { id: "bitcoin", symbol: "BTC" },
  ec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17: { id: "blockstack", symbol: "STX" },
  eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a: { pegged: 1, symbol: "USDC" },
  "0d00000008555344682f555344": { pegged: 1, symbol: "USDh" },
};

/** Price an asset by the oracle feed id its protocol registry declares. */
export async function priceByFeed(feedHex) {
  const key = String(feedHex ?? "").replace(/^0x/, "");
  const meta = FEED_PRICING[key];
  if (!meta) return { price: null, symbol: null, pegged: false };
  if (meta.pegged !== undefined) return { price: meta.pegged, symbol: meta.symbol, pegged: true };
  const prices = await getLivePrices();
  return { price: prices[meta.id]?.usd ?? null, symbol: meta.symbol, pegged: false };
}

let cache = { at: 0, data: null };

/** Live USD prices keyed by coingecko id. Cached for 60s. */
export async function getLivePrices({ ttlMs = 60_000 } = {}) {
  if (cache.data && Date.now() - cache.at < ttlMs) return cache.data;
  const ids = [...new Set(Object.values(ASSETS).map((a) => a.id))].join(",");
  const res = await fetch(`${COINGECKO}?ids=${ids}&vs_currencies=usd`);
  if (!res.ok) throw new Error(`price feed ${res.status}`);
  const json = await res.json();
  cache = { at: Date.now(), data: json };
  return json;
}

/** USD price for a collateral contract principal (or "STX"). */
export async function priceOf(assetKey) {
  const meta = ASSETS[assetKey];
  if (!meta) return null;
  const prices = await getLivePrices();
  return prices[meta.id]?.usd ?? null;
}

export const symbolOf = (assetKey) => ASSETS[assetKey]?.symbol ?? assetKey;
