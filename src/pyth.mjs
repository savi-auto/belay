// Pyth price source
// -----------------------------------------------------------------------------
// Pyth on Stacks is PULL-based: prices are pushed on-chain via signed VAA
// messages, and the storage contract holds the most recent one. A read-only
// consumer therefore reads a price that is as fresh as the last push - which
// means price AGE is itself a risk signal, not an implementation detail.
//
// This matters concretely: the Velar exploit on Stacks turned on contracts
// reading Pyth without timestamp freshness checks. Belay surfaces the age of
// every price it uses rather than hiding it.
// -----------------------------------------------------------------------------
import { fetchCallReadOnlyFunction, cvToJSON, bufferCV } from "@stacks/transactions";
import { client } from "./chain.mjs";

const API = "https://api.hiro.so";
const PYTH = { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", storage: "pyth-storage-v4" };

// Official Pyth price-feed identifiers.
export const FEEDS = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  STX: "ec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17",
};

const hexToBytes = (hex) =>
  Uint8Array.from(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

const plain = (n) => {
  if (n === null || n === undefined) return null;
  if (typeof n !== "object") return n;
  if (!("type" in n)) return n;
  const v = n.value;
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return v;
  if ("type" in v && "value" in v) return plain(v);
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, plain(val)]));
};

/**
 * Latest on-chain price for a feed.
 * Returns { price, expo, publishTime, ageSeconds, stale } or null if unavailable.
 * `price` is already scaled by `expo` (Pyth exponents are negative).
 */
export async function readPrice(feedId, { maxAgeSeconds = 120 } = {}) {
  const cv = await fetchCallReadOnlyFunction({
    contractAddress: PYTH.address,
    contractName: PYTH.storage,
    functionName: "get-price",
    functionArgs: [bufferCV(hexToBytes(feedId))],
    senderAddress: PYTH.address,
    client,
  });
  const json = cvToJSON(cv);
  if (json.success === false) return null;
  const d = plain(json);
  if (!d) return null;

  const raw = Number(d.price);
  const expo = Number(d.expo ?? d.exponent ?? 0);
  // Clarity has no signed ints here; large expo values encode negatives.
  const exponent = expo > 1e9 ? expo - 4294967296 : expo;
  const publishTime = Number(d["publish-time"] ?? d.publishTime ?? 0);
  const ageSeconds = publishTime ? Math.floor(Date.now() / 1000) - publishTime : null;

  return {
    price: raw * 10 ** exponent,
    expo: exponent,
    publishTime,
    ageSeconds,
    stale: ageSeconds !== null && ageSeconds > maxAgeSeconds,
    raw: d,
  };
}
