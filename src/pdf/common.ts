/**
 * Shared pdfmake building blocks: brand colours, styles, the footer
 * (Generated-on + Page N of M), cover page and table helpers. Australian
 * English throughout. No student names ever appear in a generated PDF.
 */
import type { Content, ContentTable, TDocumentDefinitions } from "pdfmake/interfaces";

// Design palette (DESIGN.md), as hex for print.
export const INK = "#333533";
export const INK_SOFT = "#6b6d6a";
export const CORAL = "#c4502b"; // coral-text — darker coral reads well on white
export const SAGE = "#4f6b46";
export const RULE = "#cfdbd5";

export const PDF_STYLES: TDocumentDefinitions["styles"] = {
  h1: { fontSize: 20, bold: true, color: INK, margin: [0, 0, 0, 4] },
  h2: { fontSize: 14, bold: true, color: INK, margin: [0, 14, 0, 6] },
  h3: { fontSize: 11, bold: true, color: CORAL, margin: [0, 8, 0, 4] },
  lead: { fontSize: 10, color: INK_SOFT, margin: [0, 0, 0, 8] },
  body: { fontSize: 10, color: INK, margin: [0, 0, 0, 4] },
  small: { fontSize: 8, color: INK_SOFT },
  th: { fontSize: 8, bold: true, color: INK_SOFT, fillColor: "#f3f5ee" },
  td: { fontSize: 9, color: INK },
  caption: { fontSize: 8, color: INK_SOFT, italics: true, margin: [0, 2, 0, 8] },
};

/** Footer: generated-on (left) + Page N of M (right). */
export function footer(generatedAt: Date) {
  const stamp = generatedAt.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (currentPage: number, pageCount: number): Content => ({
    margin: [40, 8, 40, 0],
    columns: [
      { text: `Generated ${stamp}`, style: "small" },
      { text: `Page ${currentPage} of ${pageCount}`, style: "small", alignment: "right" },
    ],
  });
}

export function coverPage(opts: {
  title: string;
  subtitle: string;
  schoolName: string;
  schoolNumber?: string;
  generatedAt: Date;
}): Content[] {
  const who = opts.schoolName || "(school not set)";
  const num = opts.schoolNumber ? ` (${opts.schoolNumber})` : "";
  return [
    { text: " ", margin: [0, 120, 0, 0] },
    { text: opts.title, fontSize: 28, bold: true, color: INK, alignment: "center" },
    { text: opts.subtitle, fontSize: 14, color: CORAL, alignment: "center", margin: [0, 6, 0, 0] },
    { text: `${who}${num}`, fontSize: 13, color: INK, alignment: "center", margin: [0, 40, 0, 0] },
    {
      text: "On-device NAPLAN analysis · no student names in this report",
      style: "small",
      alignment: "center",
      margin: [0, 8, 0, 0],
    },
    { text: "", pageBreak: "after" },
  ];
}

/** A simple table: header row (string[]) + body rows. Widths default to even. */
export function table(headers: string[], rows: (string | number)[][], widths?: (string | number)[]): ContentTable {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => "*"),
      body: [
        headers.map((h) => ({ text: h, style: "th" })),
        ...rows.map((r) => r.map((c) => ({ text: String(c), style: "td" }))),
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 || i === 1 ? 0.8 : 0.4),
      vLineWidth: () => 0,
      hLineColor: () => RULE,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 2, 0, 8],
  };
}

export function bulletList(items: string[]): Content {
  if (items.length === 0) return { text: "" };
  return { ul: items.map((t) => ({ text: t, style: "body" })), margin: [0, 0, 0, 8] };
}

/** 1-decimal percentage. */
export const pct1 = (x: number): string => `${x.toFixed(1)}%`;
