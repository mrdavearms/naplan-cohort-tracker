/**
 * Save a generated PDF. In the Tauri shell: native save dialog + a Rust command
 * that writes the bytes. In the browser (dev): a normal download. Either way the
 * PDF is assembled in JS (pdfmake) from oracle-validated core data.
 */
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { createPdf } from "./pdfmake";
import { isTauri } from "../lib/dataSource";

/** pdfmake's getBuffer is callback-only with no error channel: if it fails or
 *  stalls the callback simply never fires, which would leave the export button
 *  disabled on "Generating…" forever with no way out but restarting the app.
 *  The watchdog converts that silent hang into a message the user can act on. */
const PDF_TIMEOUT_MS = 30_000;

function getBuffer(doc: TDocumentDefinitions): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          "The report timed out while being generated. This can happen with very large datasets — " +
            "try exporting again, and if it keeps happening please report it.",
        ),
      );
    }, PDF_TIMEOUT_MS);

    try {
      createPdf(doc).getBuffer((buffer: Uint8Array) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(buffer);
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
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
