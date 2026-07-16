/**
 * Smoke: grade mains, derive ratios, ability alloc, shop travel after cap.
 * Run: node scripts/smoke-gear-balance.mjs
 */

// Pure math reimplementation matching gearGenerate/gearStats
const GRADE_MAIN_MULT = { NORMAL: 1, ENHANCED: 1.3, PRECISION: 1.7, MASTER: 2.3 };
const GRADE_MAIN_BASE = { NORMAL: 3, ENHANCED: 6, PRECISION: 12, MASTER: 22 };
const MILESTONE = { 3: 1, 6: 2, 9: 4, 10: 6 };

function milestoneSum(L) {
  let s = 0;
  for (const [lv, b] of Object.entries(MILESTONE)) {
    if (L >= Number(lv)) s += b;
  }
  return s;
}

function rawMain(g, L) {
  return Math.round((2 + L + milestoneSum(L)) * GRADE_MAIN_MULT[g] + GRADE_MAIN_BASE[g]);
}

function rollMain(g, L) {
  let v = rawMain(g, 0);
  for (let lv = 1; lv <= L; lv++) v = Math.max(rawMain(g, lv), v + 1);
  return v;
}

function derive(stats) {
  return {
    travel: Math.min(1.85, 0.78 + stats.agility * 0.012),
    work: Math.min(2.0, 0.82 + stats.agility * 0.012),
    load: 700 + stats.strength * 55,
    breaker: Math.floor(stats.strength * 0.55),
    adhesion: stats.balance * 0.008,
    hillSafe: Math.min(1, 0.15 + stats.balance * 0.005),
    crit: Math.min(0.75, 0.025 + stats.technique * 0.0035),
    drain: Math.max(0.45, 1.25 - stats.endurance * 0.025),
    durMax: 35 + stats.stamina * 8,
  };
}

function recommend(level, cls) {
  const weights =
    cls === "LIGHT"
      ? { agility: 0.5, balance: 0.25, technique: 0.25 }
      : cls === "MEDIUM"
        ? { strength: 0.25, agility: 0.25, technique: 0.25, balance: 0.25 }
        : { strength: 0.4, endurance: 0.3, stamina: 0.3 };
  const keys = Object.keys(weights);
  const out = {
    strength: 0,
    agility: 0,
    stamina: 0,
    endurance: 0,
    balance: 0,
    technique: 0,
  };
  const exact = keys.map((k) => ({ key: k, exact: level * weights[k] }));
  let assigned = 0;
  for (const r of exact) {
    const f = Math.floor(r.exact);
    out[r.key] = f;
    assigned += f;
  }
  let remain = level - assigned;
  exact.sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (const r of exact) {
    if (remain <= 0) break;
    out[r.key] += 1;
    remain -= 1;
  }
  return out;
}

const chassis = { strength: 14, agility: 14, stamina: 14, endurance: 14, balance: 14, technique: 14 };

console.log("=== Main option +0 / +10 ===");
for (const g of ["NORMAL", "ENHANCED", "PRECISION", "MASTER"]) {
  console.log(g, rollMain(g, 0), rollMain(g, 10));
}
const n10 = rollMain("NORMAL", 10);
const m10 = rollMain("MASTER", 10);
console.log("Master/+10 vs Normal/+10 ratio:", (m10 / n10).toFixed(2));

console.log("\n=== Chassis only (ViO17_1) ===");
console.log(derive(chassis));

function fullSet(grade, level) {
  const main = rollMain(grade, level);
  // 6 slots each add main to different ability — approximate by adding main to all six
  return {
    strength: chassis.strength + main,
    agility: chassis.agility + main,
    stamina: chassis.stamina + main,
    endurance: chassis.endurance + main,
    balance: chassis.balance + main,
    technique: chassis.technique + main,
  };
}

console.log("\n=== Normal +10 full set (approx) ===");
const normal = derive(fullSet("NORMAL", 10));
console.log(normal);

console.log("\n=== Master +10 full set (approx) ===");
const master = derive(fullSet("MASTER", 10));
console.log(master);
console.log("travel ratio M/N:", (master.travel / normal.travel).toFixed(2));
console.log("load ratio M/N:", (master.load / normal.load).toFixed(2));
console.log("breaker ratio M/N:", (master.breaker / normal.breaker).toFixed(2));

console.log("\n=== Ability recommend Lv.25 MEDIUM ===");
const alloc = recommend(25, "MEDIUM");
console.log(alloc, "sum", Object.values(alloc).reduce((a, b) => a + b, 0));
const withAlloc = {
  strength: chassis.strength + alloc.strength,
  agility: chassis.agility + alloc.agility,
  stamina: chassis.stamina + alloc.stamina,
  endurance: chassis.endurance + alloc.endurance,
  balance: chassis.balance + alloc.balance,
  technique: chassis.technique + alloc.technique,
};
console.log("derive with alloc:", derive(withAlloc));

console.log("\n=== Reset → remaining = level ===");
const reset = recommend(0, "MEDIUM"); // empty
console.log("reset spent", Object.values(reset).reduce((a, b) => a + b, 0), "remaining", 25);

console.log("\n=== Shop travel ×1.5 after cap ===");
const capped = { ...chassis, agility: 200 }; // force travel cap
const d = derive(capped);
const shop = d.travel * 1.5;
console.log("capped travel", d.travel, "after shop", shop, "expected", 1.85 * 1.5);

console.log("\nOK");
