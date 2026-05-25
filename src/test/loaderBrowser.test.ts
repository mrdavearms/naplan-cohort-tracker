/**
 * Browser-side parse smoke test. The core loader tests run in the `node`
 * environment (vitest project "core"), which loads exceljs's *node* build. This
 * test lives under `src/` so it runs in the `ui` (jsdom) project, where Vite
 * resolves exceljs's `browser` field — the same build shipped into the Tauri
 * WebView. exceljs's browser build (its bundled JSZip) is fussier about input
 * types than the node build, so this guards the real WebView parse path that the
 * node-only tests can't reach. It feeds both production input shapes through the
 * host→core boundary: a Uint8Array (the Tauri folder reader) and an ArrayBuffer
 * (the browser directory <input>).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadStoreFromFiles, type RawWorkbookFile } from "@naplan-throughline/core";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "../../core/tests/fixtures/synthetic_raw_2026.xlsx");

/** Tauri shell hands core a Uint8Array (Uint8Array.from over the Rust bytes). */
function tauriBytes(): Uint8Array {
  return new Uint8Array(readFileSync(fixturePath));
}

/** Browser dir-input hands core an ArrayBuffer (File.arrayBuffer()). */
function browserBytes(): ArrayBuffer {
  const buf = readFileSync(fixturePath);
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

function file(bytes: ArrayBuffer | Uint8Array): RawWorkbookFile {
  return { name: "synthetic_raw_2026.xlsx", relativePath: "Naplan 2026/synthetic_raw_2026.xlsx", bytes };
}

describe("xlsx parsing under jsdom (browser-side exceljs build)", () => {
  it.each([
    ["Tauri Uint8Array", tauriBytes],
    ["browser ArrayBuffer", browserBytes],
  ])("parses a 2026 SSSR workbook into the keyed store (%s)", async (_label, makeBytes) => {
    const { store, skipped, unresolved } = await loadStoreFromFiles([file(makeBytes())]);

    expect(skipped).toEqual([]);
    expect(unresolved).toEqual([]);
    expect(store.size).toBe(1);

    const entry = store.get("2026|7|Reading");
    expect(entry).toBeDefined();
    expect(entry!.domain).toBe("Reading");
    expect(entry!.yearLevel).toBe(7);
    expect(entry!.participants).toBe(5);
    expect(entry!.totalStudents).toBe(6);
  });
});
