// Benchmark: scan the full known Granite borrower universe and report coverage,
// risk distribution, and the aggregate exposure currently invisible to users.
import { readFileSync, writeFileSync } from "node:fs";
import { getAllPositions as getPositions } from "../src/belay.mjs";
import { getLivePrices } from "../src/prices.mjs";

const file = process.argv[2];
const users = readFileSync(file, "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);
const prices = await getLivePrices();

const rows = [];
const failures = [];
let scanned = 0;
for (const user of users) {
  try {
    for (const p of await getPositions(user)) {
      if (p.error) { failures.push({ user, error: p.error }); continue; }
      rows.push(p);
    }
  } catch (e) {
    failures.push({ user, error: e.message });
  }
  scanned++;
  if (scanned % 10 === 0) console.error(`  …${scanned}/${users.length}`);
}

const withDebt = rows.filter((r) => r.debtUsd > 0.01);
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
const bucket = (d) => (d === null ? "none" : d < 0.10 ? "<10%" : d < 0.20 ? "10-20%" : d < 0.35 ? "20-35%" : d < 0.50 ? "35-50%" : ">50%");

const dist = {};
for (const r of withDebt) dist[bucket(r.dropToLiquidation)] = (dist[bucket(r.dropToLiquidation)] ?? 0) + 1;

const report = {
  scannedAt: new Date().toISOString(),
  btcPrice: prices.bitcoin.usd,
  addressesScanned: users.length,
  positionsFound: rows.length,
  positionsWithDebt: withDebt.length,
  byProtocol: Object.fromEntries(Object.entries(withDebt.reduce((a,r)=>{a[r.protocol]=(a[r.protocol]??0)+1;return a;},{}))),
  totalCollateralUsd: sum(rows, (r) => r.collateralUsd),
  totalDebtUsd: sum(rows, (r) => r.debtUsd),
  atRiskUnder20pct: withDebt.filter((r) => r.dropToLiquidation !== null && r.dropToLiquidation < 0.20).length,
  collateralAtRiskUnder20pct: sum(withDebt.filter((r) => r.dropToLiquidation !== null && r.dropToLiquidation < 0.20), (r) => r.collateralUsd),
  distribution: dist,
  failures: failures.length,
  failureSamples: failures.slice(0, 5),
  positions: withDebt
    .sort((a, b) => (a.dropToLiquidation ?? 9) - (b.dropToLiquidation ?? 9))
    .map((r) => ({ user: r.user, protocol: r.protocol, market: r.market, collateralUsd: r.collateralUsd, debtUsd: r.debtUsd, currentLtv: r.currentLtv, dropToLiquidation: r.dropToLiquidation, liquidationPrice: r.liquidationPrice })),
};

writeFileSync(process.argv[3] ?? "benchmark.json", JSON.stringify(report, null, 2));
console.error("done");
console.log(JSON.stringify({ ...report, positions: `${report.positions.length} rows written` }, null, 2));
