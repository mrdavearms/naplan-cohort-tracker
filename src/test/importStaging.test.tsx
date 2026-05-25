/**
 * Import-staging UI tests: recognised/rejected rows, year-gated Load button,
 * the Year 7 → Year 9 readiness warning, and per-file removal. State is
 * fabricated directly (metadata only) — no pickers / inspection are mocked.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithApp } from "./renderWithApp";
import { ImportStaging } from "../components/ImportStaging";
import type { StagedFile, StagedSource } from "../state/AppState";

const emptyStore = new Map();

function okFile(
  id: string,
  name: string,
  detectedYear: number | null,
  yearLevel: 7 | 9,
  domain = "Reading",
): StagedFile {
  return {
    id,
    name,
    relativePath: `folder/${name}`,
    detectedYear,
    assignedYear: null,
    inspection: { status: "ok", yearLevel, domain, sheets: "full" },
  };
}

function source(id: string, files: StagedFile[], kind: "folder" | "files" = "folder"): StagedSource {
  return { id, kind, label: id, files };
}

function renderStaged(staged: StagedSource[], callbacks = {}) {
  return renderWithApp(<ImportStaging />, {
    store: emptyStore,
    state: { status: "empty", primaryYear: null, activeView: "import", staged },
    callbacks,
  });
}

describe("ImportStaging", () => {
  it("shows a recognised file's year/level/domain and a rejection reason", () => {
    renderStaged([
      source("Naplan 2026", [
        okFile("f1", "Reading Y9.xlsx", 2026, 9),
        {
          id: "f2",
          name: "junk.xlsx",
          relativePath: "folder/junk.xlsx",
          detectedYear: 2026,
          assignedYear: null,
          inspection: { status: "rejected", reason: "Not a NAPLAN SSSR file." },
        },
      ]),
    ]);
    expect(screen.getByText(/2026 · Year 9 · Reading/)).toBeInTheDocument();
    expect(screen.getByText(/Not a NAPLAN SSSR file\./)).toBeInTheDocument();
  });

  it("disables Load and prompts for a year when a recognised file has none", () => {
    renderStaged([source("loose", [okFile("f1", "Reading.xlsx", null, 9)], "files")]);
    const btn = screen.getByRole("button", { name: /confirm the year/i });
    expect(btn).toBeDisabled();
    // a year dropdown is offered for the batch
    expect(screen.getByText(/year sat/i)).toBeInTheDocument();
  });

  it("enables Load and calls loadStaged when every file has a year", () => {
    const loadStaged = vi.fn();
    renderStaged([source("Naplan 2026", [okFile("f1", "Reading Y9.xlsx", 2026, 9)])], { loadStaged });
    const btn = screen.getByRole("button", { name: /load 1 spreadsheet/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(loadStaged).toHaveBeenCalledTimes(1);
  });

  it("warns when the staged set can't track a Year 7 → Year 9 cohort", () => {
    renderStaged([source("Naplan 2026", [okFile("f1", "Reading Y9.xlsx", 2026, 9)])]);
    expect(screen.getByText(/track the same cohort/i)).toBeInTheDocument();
  });

  it("clears the readiness warning when a Y7→Y9 pair is present", () => {
    renderStaged([
      source("Naplan 2024", [okFile("a", "Y7.xlsx", 2024, 7)]),
      source("Naplan 2026", [okFile("b", "Y9.xlsx", 2026, 9)]),
    ]);
    expect(screen.queryByText(/track the same cohort/i)).toBeNull();
    expect(screen.getByRole("button", { name: /load 2 spreadsheets/i })).not.toBeDisabled();
  });

  it("removes a single file via its × button", () => {
    const stageRemoveFile = vi.fn();
    renderStaged([source("Naplan 2026", [okFile("f1", "Reading Y9.xlsx", 2026, 9)])], {
      stageRemoveFile,
    });
    fireEvent.click(screen.getByRole("button", { name: /remove Reading Y9\.xlsx/i }));
    expect(stageRemoveFile).toHaveBeenCalledWith("Naplan 2026", "f1");
  });
});
