/**
 * Generate synthetic Year 3 / Year 5 SSSR fixtures by cloning the validated
 * Year 7 / Year 9 fixtures and changing only the "Year level" cells (7→3, 9→5).
 * This guarantees the primary fixtures have the exact same SSSR structure and
 * column names as the secondary ones, so loader tests exercise the real parse
 * path for primary data. Local Student IDs are preserved, so the Year 3 → 5
 * cohort pairs the same way the Year 7 → 9 one does.
 *
 * Run: node scripts/make-primary-fixtures.mjs
 */
import ExcelJS from "exceljs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../core/tests/fixtures");

async function clone(src, dst, fromLevel, toLevel) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(FIX, src));
  const ws = wb.getWorksheet("Student Reports");
  const header = ws.getRow(1).values; // 1-based; [empty, "Student ID", ...]
  const col = header.indexOf("Year level");
  if (col < 1) throw new Error(`No "Year level" column in ${src}`);
  let changed = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const cell = ws.getRow(r).getCell(col);
    if (Number(cell.value) === fromLevel) {
      cell.value = toLevel;
      changed++;
    }
  }
  await wb.xlsx.writeFile(join(FIX, dst));
  console.log(`wrote ${dst}: ${changed} rows Year ${fromLevel} → ${toLevel}`);
}

await clone("synthetic_y7_2024_reading.xlsx", "synthetic_y3_2024_reading.xlsx", 7, 3);
await clone("synthetic_y9_2026_reading.xlsx", "synthetic_y5_2026_reading.xlsx", 9, 5);
