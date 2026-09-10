import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, dropToLiquidation, currentLtv, liquidationPrice, DUST_USD } from "../src/risk.mjs";
import { summarise } from "../src/belay.mjs";

const GRANITE_LIQ = 0.65; // Granite's on-chain liquidation LTV

test("healthy position keeps most of its buffer", () => {
  const p = { collateralUsd: 200_000, debtUsd: 50_000, liquidationLtv: GRANITE_LIQ };
  assert.equal(currentLtv(p), 0.25);
  assert.ok(Math.abs(dropToLiquidation(p) - 0.6154) < 0.001);
  assert.equal(classify(p), "safe");
});

test("a position exactly at the threshold is liquidatable, not safe", () => {
  const p = { collateralUsd: 100_000, debtUsd: 65_000, liquidationLtv: GRANITE_LIQ };
  assert.equal(dropToLiquidation(p), 0);
  assert.equal(classify(p), "liquidatable");
});

test("underwater never reports negative buffer", () => {
  const p = { collateralUsd: 100_000, debtUsd: 80_000, liquidationLtv: GRANITE_LIQ };
  assert.equal(dropToLiquidation(p), 0);
  assert.equal(classify(p), "liquidatable");
});

// Regression: debt against unpriceable collateral drove LTV to Infinity, which
// produced a null buffer that the display layer rendered as "no debt" - showing
// a liquidatable position as safe.
test("debt with no priceable collateral is liquidatable, never 'no debt'", () => {
  const p = { collateralUsd: 0, debtUsd: 5_000, liquidationLtv: GRANITE_LIQ };
  assert.equal(currentLtv(p), Infinity);
  assert.equal(dropToLiquidation(p), 0);
  assert.equal(classify(p), "liquidatable");
  assert.notEqual(classify(p), "no-debt");
});

test("unreliable pricing reports unknown rather than a confident wrong answer", () => {
  const p = { collateralUsd: 0, debtUsd: 40_000, liquidationLtv: GRANITE_LIQ, reliable: false };
  assert.equal(classify(p), "unknown");
});

test("dust debt is not a real obligation", () => {
  const p = { collateralUsd: 0.03, debtUsd: 0.000004, liquidationLtv: GRANITE_LIQ };
  assert.equal(dropToLiquidation(p), null);
  assert.equal(classify(p), "no-debt");
  assert.equal(classify({ collateralUsd: 1, debtUsd: DUST_USD, liquidationLtv: GRANITE_LIQ }), "no-debt");
});

test("band boundaries: at-risk under 10%, watch under 25%", () => {
  const at = (ltv) => classify({ collateralUsd: 100, debtUsd: 100 * ltv, liquidationLtv: GRANITE_LIQ });
  assert.equal(at(0.60), "at-risk");  // ~7.7% buffer
  assert.equal(at(0.52), "watch");    // ~20% buffer
  assert.equal(at(0.40), "safe");     // ~38% buffer
});

test("the protocol's own liquidatable verdict overrides a comfortable-looking buffer", () => {
  const p = { collateralUsd: 100_000, debtUsd: 10_000, liquidationLtv: 0.6, protocolSaysLiquidatable: true };
  assert.ok(dropToLiquidation(p) > 0.8);
  assert.equal(classify(p), "liquidatable");
});

test("liquidation price inverts the buffer consistently", () => {
  // 2.33342 sBTC at $77,196 backing $93,428 of debt at 65% liquidation LTV.
  const collaterals = [{ amount: 2.33342, price: 77_196 }];
  const debtUsd = 93_428;
  const price = liquidationPrice({ collaterals, debtUsd, liquidationLtv: GRANITE_LIQ });
  assert.ok(Math.abs(price - 61_598) < 5, `expected ~61598, got ${price}`);
  // Falling to that price must equal the computed buffer.
  const drop = dropToLiquidation({ collateralUsd: 2.33342 * 77_196, debtUsd, liquidationLtv: GRANITE_LIQ });
  assert.ok(Math.abs(drop - (1 - price / 77_196)) < 1e-9);
});

test("liquidation price is withheld for multi-collateral positions", () => {
  const collaterals = [{ amount: 1, price: 100 }, { amount: 2, price: 50 }];
  assert.equal(liquidationPrice({ collaterals, debtUsd: 100, liquidationLtv: 0.65 }), null);
});

test("wallet risk is set by its worst position, not its average", () => {
  const positions = [
    { protocol: "Zest", collateralUsd: 5_814, debtUsd: 771, status: "safe", dropToLiquidation: 0.81 },
    { protocol: "Granite", collateralUsd: 3_578, debtUsd: 992, status: "safe", dropToLiquidation: 0.57 },
  ];
  const s = summarise(positions);
  assert.equal(s.protocols.length, 2);
  assert.equal(Math.round(s.collateralUsd), 9_392);
  assert.equal(Math.round(s.debtUsd), 1_763);
  assert.equal(s.worst.protocol, "Granite");
});

test("no-debt positions are excluded from worst-position selection", () => {
  const s = summarise([
    { protocol: "Granite", collateralUsd: 0.01, debtUsd: 0, status: "no-debt", dropToLiquidation: null },
    { protocol: "Zest", collateralUsd: 1_000, debtUsd: 100, status: "safe", dropToLiquidation: 0.7 },
  ]);
  assert.equal(s.worst.protocol, "Zest");
});
