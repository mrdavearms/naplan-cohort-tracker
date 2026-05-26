/**
 * PDF report tests. The Plotly chart→PNG step needs a real browser, so it's
 * mocked with a generated 1×1 PNG; this verifies the two report builders
 * assemble a valid pdfmake document from real (synthetic) store data AND that
 * pdfmake renders it to actual PDF bytes. Covers the path that can't be
 * exercised in a headless GUI.
 */
import { deflateSync } from "node:zlib";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Shared mutable holder so the hoisted vi.mock factory and the test body agree.
const chart = vi.hoisted(() => ({ png: "" }));
vi.mock("../pdf/chartImage", () => ({ figureToPng: async () => chart.png }));

import type { Store } from "@naplan-cohort-tracker/core";
import { defaultSettings } from "@naplan-cohort-tracker/core";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { buildSyntheticStore } from "./fixtures";
import { buildOverviewDoc } from "../pdf/overviewReport";
import { buildCohortDoc } from "../pdf/cohortReport";
import { createPdf } from "../pdf/pdfmake";

// Build a valid 8-bit RGBA 1×1 PNG (pdfmake's decoder is strict about format).
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function png1x1(): string {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.from([0x00, 0xff, 0x00, 0x00, 0xff]); // filter byte + 1 RGBA pixel
  const png = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + png.toString("base64");
}

let store: Store;
beforeAll(async () => {
  chart.png = png1x1();
  store = await buildSyntheticStore();
});

function toPdfBytes(doc: TDocumentDefinitions): Promise<Uint8Array> {
  return new Promise((resolve) => createPdf(doc).getBuffer((b: Uint8Array) => resolve(b)));
}

function assertValidDoc(doc: TDocumentDefinitions) {
  expect(Array.isArray(doc.content)).toBe(true);
  expect((doc.content as unknown[]).length).toBeGreaterThan(3);
  expect(doc.footer).toBeTypeOf("function");
  expect(doc.styles).toBeTruthy();
}

describe("overview PDF (Sections 1–9)", () => {
  it("builds a valid document and renders to PDF bytes", async () => {
    const doc = await buildOverviewDoc(store, 2026, defaultSettings());
    assertValidDoc(doc);
    const bytes = await toPdfBytes(doc);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});

describe("cohort PDF (Section 10)", () => {
  it("builds a valid document and renders to PDF bytes", async () => {
    const doc = await buildCohortDoc(store, 2026, defaultSettings());
    assertValidDoc(doc);
    const bytes = await toPdfBytes(doc);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
