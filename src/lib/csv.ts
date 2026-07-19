/**
 * CSV export. Used for the operational tables a school leader hands to someone
 * else (Section 8 targeted support, Section 10 follow-up lists). Local Student
 * IDs only — never names, matching every other output in the app.
 */
import { isTauri } from "./dataSource";

type Field = string | number | null;

/** RFC 4180: quote a field if it contains a comma, quote, CR or LF; escape
 *  embedded quotes by doubling them. */
function escapeField(value: Field): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: readonly Field[][]): string {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  return lines.join("\r\n");
}

/** Save a CSV. Native save dialog in Tauri; a normal download in the browser.
 *  Returns the saved path, "downloaded", or null if the user cancelled. */
export async function saveCsv(csv: string, suggestedName: string): Promise<string | null> {
  if (!isTauri()) {
    // Excel on Windows needs a BOM to read UTF-8 accented characters correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await save({
    title: "Save table as CSV",
    defaultPath: suggestedName,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (typeof path !== "string") return null;
  await invoke("save_text_file", { path, contents: "﻿" + csv });
  return path;
}
