// Chain read layer
// -----------------------------------------------------------------------------
// Thin wrapper over read-only contract calls with three things the naive path
// lacks and that cost real debugging time to discover:
//
//   1. Response checking. A Clarity (err uint) decodes to a perfectly ordinary
//      uint. Reading it as a value silently turns error code u80002 into the
//      number 80002 - which, taken as a price, is a plausible-looking $0.0008.
//      Every call here fails loudly instead.
//   2. Backoff. The public Hiro node rate-limits per minute; a naive scan trips
//      429 within a dozen calls.
//   3. Caching. Market-level parameters (decimals, LTV bands) are identical for
//      every user, so they are fetched once.
// -----------------------------------------------------------------------------
import { fetchCallReadOnlyFunction, cvToJSON } from "@stacks/transactions";

const API = "https://api.hiro.so";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map();

// Hiro made production API access free from 30 Oct 2026; an API key is optional
// but grants higher, more predictable rate limits. The key header changed to
// `x-api-key` (the legacy `x-hiro-api-key` / `x-partner` headers are retired).
// Set HIRO_API_KEY to use authenticated limits; without it we fall back to the
// anonymous tier and lean on the backoff below.
const apiKey = process.env.HIRO_API_KEY ?? null;

const keyedFetch = (input, init = {}) =>
  fetch(input, apiKey ? { ...init, headers: { ...init.headers, "x-api-key": apiKey } } : init);

export const client = { baseUrl: API, fetch: keyedFetch };
export const hasApiKey = () => Boolean(apiKey);

/** Unwrap cvToJSON's nested {type,value} into plain JS data. */
export const plain = (node) => {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return node.map(plain);
  if (typeof node !== "object") return node;
  if (!("type" in node)) return node;
  const v = node.value;
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(plain);
  if ("type" in v && "value" in v) return plain(v);
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, plain(val)]));
};

export class ContractError extends Error {
  constructor(fn, code) {
    super(`${fn} returned (err ${code})`);
    this.name = "ContractError";
    this.code = code;
  }
}

/**
 * Call a read-only function and return decoded plain data.
 * Throws ContractError when the contract returns an (err ...) response.
 */
export async function readOnly(
  { address, contract, fn, args = [], sender = address },
  { retries = 5, cacheKey = null } = {}
) {
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const json = cvToJSON(
        await fetchCallReadOnlyFunction({
          contractAddress: address,
          contractName: contract,
          functionName: fn,
          functionArgs: args,
          senderAddress: sender,
          client,
        })
      );
      // A response type carries an explicit success flag; honour it.
      if (json.success === false) throw new ContractError(fn, plain(json));
      const data = plain(json);
      if (cacheKey) cache.set(cacheKey, data);
      return data;
    } catch (e) {
      if (e instanceof ContractError) throw e;
      lastErr = e;
      // 429 is rate limiting; 502/503/504 are transient node errors seen under
      // sustained scans. Both deserve a retry - a full crawl surfaced six 503s
      // that were otherwise reported as position failures.
      if (!/\b(429|502|503|504)\b/.test(String(e.message))) throw e;
      await wait(Math.min(2000 * 2 ** attempt, 20_000));
    }
  }
  throw lastErr;
}

export const throttle = (ms = 350) => wait(ms);
