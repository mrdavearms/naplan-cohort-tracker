/**
 * Save a generated PDF. In the Tauri shell: native save dialog + a Rust command
 * that writes the bytes. In the browser (dev): a normal download. Either way the
 * PDF is assembled in JS (pdfmake) from oracle-validated core data.
 */
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { createPdf } from "./pdfmake";
import { isTauri } from "../lib/dataSource";

function getBuffer(doc: TDocumentDefinitions): Promise<Uint8Array> {
  return new Promise((resolve) => {
    createPdf(doc).getBuffer((buffer: Uint8Array) => resolve(buffer));
  });
}

/** Returns the saved path (Tauri), "downloaded" (browser), or null if cancelled. */
export async function savePdf(doc: TDocumentDefinitions, filename: string): Promise<string | null> {
  if (!isTauri()) {
    createPdf(doc).download(filename);
    return "downloaded";
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await save({
    title: "Save report",
    defaultPath: filename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (typeof path !== "string") return null;
  const bytes = await getBuffer(doc);
  await invoke("save_binary_file", { path, bytes: Array.from(bytes) });
  return path;
}
