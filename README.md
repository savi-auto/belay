# Belay

Cross-protocol position and liquidation-risk monitor for Stacks.

Connect a wallet and immediately see every Bitcoin-collateralised position you
hold — across **Granite and Zest** — with the number no Stacks interface
currently shows: **how far the price can fall before you are liquidated.**

*To belay is to manage the rope so a falling climber is caught. The belayer
watches constantly and arrests the fall. You still climb; you just don't hit the
ground.*

## Status

Working cross-protocol risk engine, validated against real mainnet positions,
with 12 passing tests (`npm test`).

A wallet holding positions in both protocols, aggregated — the worst position
sets the wallet's true risk, because one liquidation does not care that another
position is comfortable:

```
borrower        protocol     collateral         debt     LTV       liq@    drop  status
SP2JFW1CBXJD3P… Granite          $3,576         $992   27.7%    $32,938   57.3%  safe
SP2JFW1CBXJD3P… Zest             $5,812         $771   13.3%    $14,622   81.1%  safe
                ACROSS           $9,388       $1,763                      57.3%  Granite + Zest
```

Full cross-protocol crawl: 151 addresses, 121 positions, 62 economically
meaningful (42 Zest, 20 Granite), **$10.7M collateral against $2.95M debt**. Ten
positions sit within 25% of liquidation holding $1,000,474 of collateral, three
within 10%, and one is already past its threshold.

The case that makes cross-protocol the product rather than a feature — safe on
one protocol, nearly liquidated on the other:

```
SP33HRNWBTQK9G… Zest            $44,040      $34,894   79.2%      $0.24    6.8%  AT RISK
SP33HRNWBTQK9G… Granite        $126,389      $40,295   31.9%    $37,813   51.0%  safe
                ACROSS         $170,429      $75,189                       6.8%  worst: Zest
```

```
live BTC $77,195   STX $0.261847
on-chain Pyth BTC $78,473.8 — last pushed 19.9d ago  (STALE: protocols push a fresh VAA at liquidation time)

borrower           collateral         debt     LTV       liq@    drop  status
--------------------------------------------------------------------------------
SP33HRNWBTQK9G…      $126,556      $40,295   31.8%    $37,813   51.0%  safe
SP3ND3H6QF7RW2…      $483,291      $85,910   17.8%    $21,111   72.7%  safe
SP3QXCV3CDV124…      $180,129      $93,428   51.9%    $61,598   20.2%  watch
SPWEA3BQ1KRXGD…      $206,396     $107,554   52.1%    $61,888   19.8%  watch
SP21GTVTEEDQBB…       $33,273       $6,178   18.6%    $22,052   71.4%  safe
```

Run it yourself: `npm install && node scripts/scan.mjs [address ...]`

## How the risk number is derived

All risk parameters are read from the protocol's own state contract, never
hardcoded, so a governance change to a risk band is picked up automatically
instead of silently making every number wrong.

1. `get-user-position(user)` → collateral list and debt **shares**
2. `convert-to-assets(shares)` → debt including accrued interest
3. `get-user-collateral(user, asset)` → collateral amount
4. `get-collateral(asset)` → `liquidation-ltv`, `max-ltv`, `decimals`
5. Live collateral price
6. `drop_to_liquidation = 1 − (current_LTV / liquidation_LTV)`

For a single-collateral position the absolute liquidation price is
`debt / (collateral_amount × liquidation_LTV)`.

## Three things verified on-chain, not assumed

**Pyth on Stacks is pull-based, and stored prices go stale.** The last on-chain
BTC push was ~20 days old; STX was ~24 days old and less than half the live
price. Protocols push a fresh VAA inside the liquidating transaction, so risk
must be priced off a live feed — while the gap between live and stored price is
itself worth showing.

**A Clarity `(err uint)` decodes to an ordinary uint.** Granite's
`pyth-adapter-v1.read-price` returns `(err u80002)` when called read-only.
Unwrapped naively, error code `80002` becomes a plausible-looking price of
$0.0008. Every call in `src/chain.mjs` checks the response flag and throws.

**The public Hiro node rate-limits per minute.** A naive scan trips 429 within
about a dozen calls, so reads carry exponential backoff, and market-level
parameters (decimals, LTV bands) are cached once rather than per user. Hiro is
making production API access free from 30 October 2026 with no monthly caps, so
this needs no paid plan — an optional API key buys higher, more predictable
limits. Set `HIRO_API_KEY` to use the authenticated tier; the client sends it as
`x-api-key` (the legacy `x-hiro-api-key` / `x-partner` headers are retired).

## Verified contracts

| Purpose | Principal |
| --- | --- |
| Granite market (main) | `SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.state-v1` |
| Granite market (alt) | `SP35E2BBMDT2Y1HB0NTK139YBGYV3PAPK3WA8BRNA.state-v1` |
| Zest V2 aggregation | `SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-5-data` |
| Pyth storage (read-only prices) | `SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y.pyth-storage-v4` |
| sBTC | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` |

Granite risk bands as configured on-chain today: liquidation LTV 65%, max LTV
50%, liquidation premium 10%.

## Zest, and why its USD figures are computed here

Zest V2's `get-user-position` takes an *optional* Pyth VAA payload. Called
read-only with `none` it returns real amounts and real LTV bands but
`total-collateral-usd = 0` — its registry declares `max-staleness` of 120
seconds per asset, so it will not value collateral off a stale price. Belay
values collateral itself, using the feed id Zest's own registry declares, so the
two never disagree about what an asset is.

Zest collateral is also held as **vault shares** (`v0-vault-sbtc` and friends),
not the underlying token, so share→asset ratios are applied before pricing.
Skipping that step understates every collateral figure.

Where Zest publishes its own `is-liquidatable` verdict, Belay keeps it alongside
its own classification as a cross-check, and defers to the protocol.

## Layout

- `src/chain.mjs` — read-only calls with response checking, backoff, caching
- `src/risk.mjs` — pure risk classification, shared by every adapter
- `src/prices.mjs` — live prices, by asset and by oracle feed id
- `src/pyth.mjs` — on-chain Pyth reads with explicit staleness
- `src/granite.mjs` / `src/zest.mjs` — protocol adapters, one shape
- `src/belay.mjs` — cross-protocol aggregation
- `scripts/scan.mjs` — live risk table
- `scripts/benchmark.mjs` — full borrower-universe scan
- `tests/` — risk math and classification (`npm test`)

## Next

StackingDAO and Bitflow LP positions, alerting before liquidation, and an
agent-readable risk endpoint.

Alerting is event-driven rather than polled: Chainhooks is the supported path
for watching borrow, repay, and collateral events, and it remains fully
supported through its API (only the Platform UI is retired, with Hiro's own
Contract Monitoring being folded into it).

## License

MIT
