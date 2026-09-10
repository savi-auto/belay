# Belay — Stacks Endowment Q3 2026 application

Every answer below is **under 1000 characters** (portal field limit). Counts shown
as `[nnn]`. Copy the text between the rules.

- **Track:** Getting Started · **Requested:** $10,000 · **Milestones:** 20 / 30 / 50
- **Closes:** Sep 24, 2026, 5:59 AM GMT+2
- **Primary category:** DeFi · **Secondary:** DeFi - Lending

---

## 02 · Project

**Project name**

Belay

**Website or repo**

https://github.com/savi-auto/belay

**Project Description**

Belay is a cross-protocol liquidation-risk monitor for Stacks. To belay is to manage the rope so a falling climber is caught. Not a bailout, not a dashboard — you still take the position, you just aren't liquidated without warning.

Working today, unfunded: a risk engine reading live mainnet positions from Granite (both markets) and Zest V2, pricing collateral via the oracle feed each protocol's own registry declares, deriving LTV, liquidation price, and remaining price buffer.

Validated across 151 addresses: 62 economically meaningful positions holding $10.7M collateral against $2.95M debt. Ten sit within 25% of liquidation; one is already past it.

Proof that cross-protocol is the product, not a feature: wallet SP33HRNWBTQK9G… reads safe on Granite at a 51% buffer while sitting 6.8% from liquidation on Zest, across $170,429 of collateral.

The grant funds alerting, full sBTC coverage, and launch. The engine exists; this is productization, not research.

---

## 03 · Audience and ecosystem fit

**Primary audience**

Bitcoin holders borrowing against sBTC on Stacks who have no consolidated view of their liquidation risk.

A borrower on both Granite and Zest must open two apps and reconcile two different risk conventions by hand — Granite states a 65% liquidation LTV, Zest publishes basis-point bands and a health factor. Nothing warns them before liquidation, and nothing tells them that one comfortable position does not offset one dangerous one.

That gap is measurable, not theoretical. Scanning 151 borrower addresses found ten positions within 25% of liquidation holding $1,000,474 of collateral, three inside a 10% buffer, and one already liquidatable. The clearest case holds $170,429 and reads safe on one protocol while 6.8% from liquidation on the other.

These are people with real money at risk who currently cannot see it in one place.

**Audience segmentation**

- **Individual sBTC borrowers** on Granite and Zest — the direct users. Verified on mainnet: 62 meaningful positions (42 Zest, 20 Granite), ten within 25% of liquidation.
- **Treasuries and larger holders** running six-figure collateralised positions. One scanned position held $285,757 of collateral with only a 16% buffer.
- **Lending protocols themselves.** Liquidations cost borrowers money and cost protocols reputation and bad debt. Earlier warning means fewer forced closures.
- **Existing Stacks grantees** whose users hold these positions — BitYield and SatoshiYield route users into yield, PaySats borrows USDCx against sBTC. Belay is the risk-side complement to products that already move capital in.
- **Agents and automation** managing Bitcoin collateral, which need a machine-readable risk read before acting.

**Why Stacks?**

The collateral is sBTC, so the risk being measured is Bitcoin risk. This product only makes sense where Bitcoin itself is the collateral asset.

It is also Stacks-specific at the mechanism level. Pyth here is pull-based: prices are pushed on-chain via signed VAA messages, and stored prices are only as fresh as the last protocol transaction. When this engine was built, the last on-chain BTC push was 20 days old and STX was 24 days old at under half its live price. Zest's registry declares a 120-second max-staleness, so it refuses to value collateral from stale data and returns zero USD to read-only callers. Liquidators push a fresh VAA inside the liquidating transaction.

A correct Stacks risk tool must therefore price positions itself, off a live feed, using the feed identifier each protocol declares. That design follows from how oracles work here — it is not portable from elsewhere.

**Maintenance plan**

I maintain it. The code is deliberately small — seven modules, ~710 lines including tests — with protocol adapters isolated behind one shared interface, so a contract change touches one file rather than the risk engine.

Risk parameters (liquidation LTV, decimals, LTV bands) are read from each protocol's own state contract rather than hardcoded, so a governance change to a risk band is picked up automatically instead of silently making every number wrong.

Issues are handled in public on GitHub. The repo is MIT-licensed, so the protocol adapters stay usable by the ecosystem regardless of what happens to the hosted product.

Operating cost is near zero: Hiro made production API access free with no monthly caps from 30 October 2026, so this needs no paid plan and no self-hosted node.

**Ecosystem fit**

This cycle's Market Efficiency & Risk theme names "liquidation and position-monitoring systems", "market, liquidity, and risk analytics", and "collateral-management infrastructure". Belay is the first, built on the third. Theme 1 separately names "collateral and risk-management tools".

The cycle asks applicants to know what exists and be specific about the gap. I checked. Staxiq shows balances and USD values but no health factors or liquidation distance. zest-auto-repay is Zest-only and acts rather than showing cross-protocol risk. Granite and Zest each show your position inside their own app; nothing aggregates them. Signal21 is ecosystem-level analytics, not per-wallet risk.

On other chains this category is established — Aave alerts, Otomato. It has no Stacks equivalent. Belay composes rather than competes: it references both protocols and reduces forced liquidations for each.

---

## 04 · Risk and prior history

**Referral source**

*(Fill in honestly — how you actually heard about this cycle. Write "None" if there was no referral.)*

**Risk disclosure**

- **Single price source.** Live prices come from one public feed with no fallback. If unavailable, positions show as UNPRICED rather than being silently valued at zero. A second source lands in M1.
- **Protocol contract changes.** A redeploy or V3 breaks an adapter until updated. Mitigated by reading parameters from on-chain state and isolating each protocol in one file.
- **Stablecoin peg.** Debt on both protocols is a stablecoin valued 1:1; a depeg would bias debt figures.
- **Correlated collateral.** The buffer figure assumes collateral prices move together — true for the single-asset markets live today. It is withheld rather than guessed where it does not apply.
- **Partial coverage.** StackingDAO and Bitflow LP exposure land in M2.
- **Adoption.** This is read-only; people must choose to use it. M2 alerting converts it from a page you visit into something that reaches you.

**Prior grants**

None.

**Prior Stacks work**

I build Clarity protocols. Three complete, tested codebases on Stacks, none grant-funded:

- **Weir** — constant-product AMM for sBTC against a SIP-010 token with a built-in cumulative-price TWAP oracle. Three Clarity 4 contracts, 17-case test suite covering swaps, liquidity, and oracle accounting.
- **Yieldsmith** — yield tokenization splitting a yield-bearing sBTC position into Principal and Yield tokens. Five Clarity 4 contracts, 12 tests proving principal and yield reconcile to the exact vault balance.
- **Writ** — physically-settled, fully-collateralised sBTC options. One Clarity 4 contract, 26 tests covering full call and put lifecycles and collateral conservation under rounding.

Weir and Yieldsmith were submitted in Q2 2026 and not selected. I disclose that deliberately: I ship working tested Clarity, and for Q3 I chose the problem by verifying what the ecosystem actually lacks rather than proposing another primitive.

---

## 06 · Track-specific context (Getting Started · 12 questions)

**What are you proposing to explore or build?**

A cross-protocol liquidation-risk monitor for Stacks. One view of every Bitcoin-collateralised position a wallet holds, showing the remaining price buffer before liquidation, plus alerts that arrive before that buffer runs out rather than after.

Today a borrower using both Granite and Zest must open two apps and reconcile two different risk conventions by hand, and nothing warns them in advance. Belay reads both protocols' state, prices collateral using the oracle feed each protocol's own registry declares, and reports a single number: how far the price can fall before liquidation.

The engine already works against mainnet. The grant adds alerting, extends coverage to the remaining venues where sBTC carries risk, and launches it publicly.

**What user or ecosystem problem motivates the project?**

A borrower on Stacks cannot answer "how far can Bitcoin fall before I lose my collateral?" without opening each protocol separately, and nothing warns them in advance.

This is measured, not assumed. Scanning 151 borrower addresses found ten positions within 25% of liquidation holding $1,000,474 of collateral against $557,456 of debt — three inside a 10% buffer, one already past its liquidation threshold. One wallet holds $285,757 with a 16% buffer.

The cross-protocol case is sharper. Wallet SP33HRNWBTQK9G… is safe on Granite at a 51% buffer and simultaneously 6.8% from liquidation on Zest, across $170,429. A borrower checking one protocol sees safety that does not exist.

The exposure grows as sBTC lending grows — Zest alone holds $75.9M TVL.

**Why is Stacks the right environment for this work?**

The collateral is Bitcoin, so the risk measured is Bitcoin risk. This only makes sense where Bitcoin itself is the collateral.

The mechanics are Stacks-specific too. Pyth here is pull-based: on-chain prices are only as fresh as the last protocol transaction, and when this was built the stored BTC price was 20 days old. Zest declares a 120-second max-staleness and returns zero USD to read-only callers rather than value collateral from stale data. Liquidators push a fresh price inside the liquidating transaction.

So a correct Stacks risk tool must price positions itself against the feed each protocol declares. Everything needed is exposed as Clarity read-only state, which makes the product fully non-custodial and permissionless — it needs approval from nobody.

**What have you already validated, prototyped, or learned?**

The engine runs against mainnet today. Validated: real positions from Granite (both markets) and Zest V2, with risk parameters read from each protocol's own state contract; 151 addresses scanned, 62 economically meaningful positions, $10.7M collateral against $2.95M debt; cross-protocol aggregation proven on a wallet safe on one protocol and 6.8% from liquidation on the other; 12 passing tests.

Three things learned only by going to chain, each of which changed the design:

1. A Clarity `(err uint)` decodes to an ordinary uint. Granite's Pyth adapter returns `(err u80002)` read-only; unwrapped naively that becomes a plausible price of $0.0008. Every call now checks the response flag. This is the bug class that drained Velar.
2. Zest collateral is vault shares, not the underlying — pricing shares as sBTC understates every figure.
3. Unpriceable collateral must never count as zero; that makes positions look safer than they are.

**Who will do the work and what experience do they bring?**

Saviour Sunday, sole developer, Nigeria.

Three complete Clarity protocols built and tested on Stacks: Weir (AMM with TWAP oracle, 17 tests), Yieldsmith (yield tokenization, 12 tests), Writ (physically-settled sBTC options, 26 tests). Plus this engine, already validated against live mainnet positions with 12 passing tests.

The work here is Clarity contract reading, risk math, and a small web surface — the work I already do. The hardest part, which is reading two protocols' state correctly and pricing collateral the way each protocol itself would, is done and demonstrable on any address in one command.

**What is the smallest useful outcome this grant should produce?**

A borrower on Granite or Zest opens one page, connects a wallet, and sees in a single screen how far Bitcoin can fall before they are liquidated — then sets an alert that reaches them before it happens.

That alone is useful on day one and does not exist on Stacks today. Everything beyond it — more venues, an agent-readable endpoint, protocol integrations — is additive.

**What evidence will show the concept is worth continuing?**

Non-team wallets using it, and alerts firing before real liquidations rather than after.

Concretely: unique non-team wallets connected, positions under monitoring, collateral value under monitoring, alerts delivered, and at least one protocol team or existing grantee confirming they would point users at it. The strongest single signal is a documented case of a user acting on an alert — adding collateral or repaying — before liquidation, evidenced on-chain.

All of these are countable, reproducible from public data, and reported publicly at each milestone.

**What dependencies or risks could affect delivery?**

Hiro API access — rate limits are handled with exponential backoff and caching, and a full crawl surfaced transient 503s that are now retried too. Hiro's free production access from 30 October 2026 removes the cost risk.

A single live price source until a fallback lands in M1.

Protocol contract redeploys breaking an adapter, mitigated by reading parameters from on-chain state and isolating each protocol in one file.

Adoption is the honest risk: this is read-only, so people must choose to use it. M2 alerting addresses it directly, and I have a developer community I can bring to it.

**What support from the Stacks ecosystem would help?**

An introduction to the Granite and Zest teams, so each protocol's risk conventions are represented the way they intend and the integrations are reviewed by the people who built them.

Beyond that, visibility wherever borrowers already are — protocol docs, ecosystem channels — since this is only useful to people who already hold a position. A mention from an existing grantee whose users borrow against sBTC would be worth more than broad promotion.

**How will you share progress or learnings publicly?**

Public MIT repo from day one, with the scanner runnable against any address in a single command, so every published figure is reproducible.

The three chain-level findings are written up in the repo already and will be published as short posts: the error-code-as-price failure and the pull-oracle staleness behaviour are traps any Stacks team reading protocol state can hit, and the Velar exploit shows what they cost.

Milestone updates in public with reproducible numbers, including the ones that disappoint.

**What happens after the grant if the work succeeds?**

Coverage extends to every venue where sBTC carries risk, and the risk read becomes a service other products consume rather than only a page people visit — an agent-readable, x402-payable endpoint, following the pattern Vibewatch established for a public index.

Protocols are the natural counterparty: fewer forced liquidations is worth money to a lending market, which makes protocol-sponsored coverage credible.

I would rather be straight than overclaim. At grant stage Belay is a free public good with no revenue, and the grant is what gets it to where those paths can be tested with real usage behind them. Operating cost is near zero, so it does not need revenue to keep running.

**Any other context reviewers should consider?**

Zest, Granite, Bitflow and Covault all depend on price feeds. The Velar exploit on Stacks came from contracts reading Pyth without timestamp checks. Belay sits deliberately on the other side of that line: it holds no funds, takes no custody, has no oracle dependency it can be exploited through, and its worst failure mode is saying "unpriced" instead of a number.

I also chose this problem by elimination, which is worth stating. I checked options, liquidation bots, a Clarity component library, and contract upgradeability against the grants tracker and the live ecosystem, and found each already served — by Covault, by zest-auto-repay and Granite's native partial liquidation, by an in-flight community SIP effort, and by ExecutorDAO. Cross-protocol risk visibility was the one that survived checking.

---

## 08 · Milestones

Target dates assume decisions in early October 2026.

### M1 — Public launch: Granite and Zest risk, live · 20% · $2,000 · Nov 14, 2026

**Description**

Ship the risk engine as a public, wallet-connected web app covering Granite (both markets) and Zest V2.

A borrower connects a wallet and sees every position, its current LTV against the protocol's own liquidation threshold, the absolute liquidation price, and the remaining price buffer — with the worst position setting the wallet's headline risk.

Adds a second independent price source with failover, so a feed outage degrades to an explicit UNPRICED state rather than a wrong number. Publishes the MIT repo with the scanner runnable against any address in one command, and a written walkthrough that reproduces every published figure.

**Success criteria**

Endowment can verify: the app is live at a public URL and returns correct positions for any supplied Granite or Zest address; the repo is public with tests passing; risk parameters are demonstrably read from protocol state rather than hardcoded; price-source failover degrades to UNPRICED rather than a wrong number; and a published walkthrough reproduces the reported figures independently.

**Adoption metric**

≥ 50 unique wallets scanned, of which ≥ 20 are non-team.

### M2 — Alerting and full sBTC coverage · 30% · $3,000 · Dec 12, 2026

**Description**

Turn the snapshot into something that reaches people before liquidation. Users set a buffer threshold and receive an alert when a position crosses it, driven by on-chain events via Chainhooks rather than polling.

Extends coverage to the remaining places sBTC carries risk — StackingDAO positions and Bitflow LP exposure — so a wallet's Bitcoin risk view is complete rather than partial.

Publishes the write-ups of the pull-oracle staleness behaviour and the error-code-as-price failure, both of which are traps for any team reading Stacks protocol state.

**Success criteria**

Endowment can verify: alerts are configurable per position and delivered on a real threshold crossing, with delivery evidence; StackingDAO and Bitflow positions appear in the unified view; repo and docs updated; and at least one alert delivered to a non-team wallet ahead of a genuine risk increase.

**Adoption metric**

≥ 150 unique non-team wallets; ≥ 25 alerts configured; ≥ 1 alert delivered on a real threshold crossing.

### M3 — Real usage and ecosystem integration · 50% · $5,000 · Jan 30, 2027 · FINAL

**Description**

Drive genuine adoption and prove the risk read is useful to more than one audience.

Ships a public, agent-readable risk endpoint so other products and agents can query a wallet's liquidation buffer, and secures confirmation from protocol teams or existing grantees that they would point users at it.

Publishes a final report with reproducible numbers, known limitations, and the follow-on plan — including what did not work.

**Success criteria**

Endowment can verify every item in the final adoption metric from public evidence, plus: the agent-readable endpoint is live and documented; the final report is published with figures reproducible from the public repo; and known limitations and next steps are stated plainly.

**Final adoption metric**

Measured from application logs and on-chain data, published in the final report:

- ≥ 400 unique non-team wallets have viewed their risk position
- ≥ 100 positions under active monitoring
- ≥ $4,000,000 of collateral under monitoring, summed across monitored positions at report time (the pool already measured across Granite and Zest is $10.7M)
- ≥ 100 alerts delivered to non-team users
- ≥ 2 protocols or existing grantees confirming in writing that they would reference or integrate Belay
- ≥ 1 documented case of a user acting on an alert — adding collateral or repaying — before liquidation, evidenced on-chain

---

## Pre-submission checklist

- [ ] Primary category **DeFi**, secondary **DeFi - Lending**
- [ ] Create public repo `savi-auto/belay` and paste the URL
- [ ] Fill **Referral source** honestly
- [ ] Confirm milestone dates against the announced decision date
- [ ] Re-run `npm test` and the live scan; refresh any figure that has moved
- [ ] Confirm no other cohort applicant is submitting a risk/monitoring product
