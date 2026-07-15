import { previewMainAtLevel } from "../src/games/yanmar/gearGenerate";
import type { ItemGrade } from "../src/games/yanmar/gearCatalog";

const grades: ItemGrade[] = ["NORMAL", "ENHANCED", "PRECISION", "MASTER"];
let ok = true;

for (const grade of grades) {
  const row: number[] = [];
  for (let lv = 0; lv <= 10; lv += 1) {
    row.push(previewMainAtLevel("BUCKET", grade, lv));
  }
  console.log(grade, row.join(","));
  for (let i = 1; i < row.length; i += 1) {
    const d = row[i]! - row[i - 1]!;
    if (d < 1 || !Number.isInteger(row[i]!) || !Number.isInteger(row[i - 1]!)) {
      console.error(`FAIL ${grade} +${i - 1}->+${i} delta=${d} values=${row[i - 1]},${row[i]}`);
      ok = false;
    }
  }
}

if (!ok) process.exit(1);
console.log("ALL_OK");
