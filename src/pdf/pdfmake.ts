/**
 * pdfmake configuration. We use pdfmake's built-in Roboto (embedded TrueType) so
 * generated PDFs render identically across the WebView2 (Windows) and WebKit
 * (macOS) engines — the cross-engine-consistency goal from PLAN.md early-
 * foundations #5. (@fontsource ships only woff/woff2, which pdfmake can't embed,
 * and the app makes no network calls to fetch TTFs — see DECISIONS.md.) Charts
 * are embedded as fixed-size PNGs for the same reason.
 */
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFontsModule from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// vfs export shape differs across pdfmake versions; cover them all.
const mod = pdfFontsModule as unknown as Record<string, unknown>;
const vfs =
  (mod["vfs"] as Record<string, string> | undefined) ??
  ((mod["default"] as { vfs?: Record<string, string> } | undefined)?.vfs) ??
  ((mod["pdfMake"] as { vfs?: Record<string, string> } | undefined)?.vfs) ??
  (mod as unknown as Record<string, string>);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfMake as any).vfs = vfs;

export function createPdf(doc: TDocumentDefinitions) {
  return pdfMake.createPdf(doc);
}
