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

/** Base64-encode bytes in chunks (avoids a call-stack overflow on large PDFs).
 *  Sent to the Rust command as a compact string rather than a JSON number array. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
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
  await invoke("save_binary_file", { path, b64: bytesToBase64(bytes) });
  return path;
}
