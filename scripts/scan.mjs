// Live risk scan: reads real Granite borrowers off mainnet and prints the view
// Belay exists to provide. Usage: node scripts/scan.mjs [address ...]
import { getAllPositions, summarise } from "../src/belay.mjs";
import { getLivePrices } from "../src/prices.mjs";
import { readPrice, FEEDS } from "../src/pyth.mjs";

const USERS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "SP33HRNWBTQK9GEPQN7G4SD9D7RCNGAQZDM53EHX4",
  "SP3ND3H6QF7RW2H3TM4MA316Y1J158SFWS6YDD83Z",
  "SP3QXCV3CDV124V6XXJN1HXY3KXCSG30P9XFT3ZSK",
  "SPWEA3BQ1KRXGDGGTN5W8TDKHGZWGMAWTNN4QNWT",
  "SP21GTVTEEDQBBQSK6FPEG4G4XGQRJGJDQV41CAD",
  "SP2VWSP59FEVDXXYGGWYG90M3N67ZST2AGQK6Q5RY",
];

const usd = (n) =>
  n === null ? "—" : "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const pct = (n) => (n === null ? "—" : (n * 100).toFixed(1) + "%");
// Status is classified in the risk engine, never re-derived here.
const LABEL = {
  "no-debt": "no debt",
  unknown: "UNPRICED",
  liquidatable: "LIQUIDATABLE",
  "at-risk": "AT RISK",
  watch: "watch",
  safe: "safe",
};

const live = await getLivePrices();
const onchain = await readPrice(FEEDS.BTC);
console.log(`live BTC $${live.bitcoin.usd.toLocaleString()}   STX $${live.blockstack.usd}`);
if (onchain) {
  const days = (onchain.ageSeconds / 86400).toFixed(1);
  console.log(
    `on-chain Pyth BTC $${onchain.price.toLocaleString()} — last pushed ${days}d ago` +
    `${onchain.stale ? "  (STALE: protocols push a fresh VAA at liquidation time)" : ""}`
  );
}
console.log("");
console.log(
  "borrower".padEnd(16) + "protocol".padEnd(10) + "collateral".padStart(13) +
  "debt".padStart(13) + "LTV".padStart(8) + "liq@".padStart(11) + "drop".padStart(8) + "  status"
);
console.log("-".repeat(90));

for (const user of USERS) {
  const positions = await getAllPositions(user);
  for (const p of positions) {
    if (p.error) { console.log(`${user.slice(0, 14)}… ERROR ${p.error}`); continue; }
    const dust = p.status === "no-debt";
    console.log(
      (user.slice(0, 14) + "…").padEnd(16) +
      p.protocol.padEnd(10) +
      usd(p.collateralUsd).padStart(13) +
      (dust ? "dust" : usd(p.debtUsd)).padStart(13) +
      pct(p.currentLtv).padStart(8) +
      (dust ? "—" : usd(p.liquidationPrice)).padStart(11) +
      (dust ? "—" : pct(p.dropToLiquidation)).padStart(8) +
      "  " + (LABEL[p.status] ?? p.status) +
      (p.reliable === false ? ` (unpriced: ${p.unpricedAssets.join(", ")})` : "")
    );
  }
  const s = summarise(positions);
  if (s.protocols.length > 1) {
    console.log(
      "".padEnd(16) + "ACROSS".padEnd(10) + usd(s.collateralUsd).padStart(13) +
      usd(s.debtUsd).padStart(13) + "".padStart(8) + "".padStart(11) +
      pct(s.worst?.dropToLiquidation ?? null).padStart(8) +
      `  ${s.protocols.join(" + ")} — worst: ${s.worst?.protocol ?? "—"}`
    );
  }
}
