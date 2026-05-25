/**
 * Behaviour tests for the shell: empty/error states, the Settings save flow,
 * settings persistence round-trip, and the browser file-list → core conversion.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { defaultSettings, migrate } from "@naplan-throughline/core";
import { renderWithApp } from "./renderWithApp";
import { HomeView } from "../views/HomeView";
import { SettingsView } from "../views/SettingsView";
import { SectionRouter } from "../views/SectionRouter";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { loadSettings, saveSettings } from "../lib/persist";
import { filesFromFileList } from "../lib/dataSource";

const emptyStore = new Map();

describe("Home empty/error states", () => {
  it("shows the import on-ramp before any data is loaded", () => {
    renderWithApp(<HomeView />, { store: emptyStore, state: { status: "empty", primaryYear: null } });
    expect(screen.getByRole("button", { name: /add folder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add files/i })).toBeInTheDocument();
  });

  it("surfaces a load error message", () => {
    renderWithApp(<HomeView />, {
      store: emptyStore,
      state: { status: "error", primaryYear: null, error: "No NAPLAN files could be loaded from that folder." },
    });
    expect(screen.getByText(/No NAPLAN files could be loaded/i)).toBeInTheDocument();
  });
});

describe("Settings save flow", () => {
  it("passes the edited school name to updateSettings (school identity is data)", () => {
    const updateSettings = vi.fn();
    renderWithApp(<SettingsView />, { store: emptyStore, view: "settings", callbacks: { updateSettings } });

    const nameInput = screen.getByLabelText(/School name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Example Secondary College" } });
    fireEvent.click(screen.getByRole("button", { name: /Save settings/i }));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]![0]).toMatchObject({ schoolName: "Example Secondary College" });
  });
});

describe("settings persistence round-trip", () => {
  it("saves and reloads settings through localStorage + migrate", () => {
    const s = { ...defaultSettings(), schoolName: "Round Trip High", schoolNumber: "4321", planLabel: "AIP" };
    saveSettings(s);
    const loaded = loadSettings();
    expect(loaded.schoolName).toBe("Round Trip High");
    expect(loaded.schoolNumber).toBe("4321");
    expect(loaded.planLabel).toBe("AIP");
    expect(loaded.schemaVersion).toBe(migrate(s).schemaVersion);
  });
});

describe("crash safety", () => {
  function Boom(): never {
    throw new Error("kaboom");
  }

  it("ErrorBoundary catches a child throw and shows a recoverable message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("SectionRouter renders nothing (not a crash) when no year is selected", () => {
    const { container } = renderWithApp(<SectionRouter />, {
      store: emptyStore,
      state: { status: "loaded", primaryYear: null, activeView: "s1" },
    });
    expect(container.textContent).toBe("");
  });
});

describe("browser file-list conversion", () => {
  it("keeps .xlsx files, drops others + lock files, and carries the relative path", async () => {
    const mk = (name: string, rel: string): File => {
      const f = new File([new Uint8Array([1, 2, 3])], name, { type: "application/octet-stream" });
      Object.defineProperty(f, "webkitRelativePath", { value: rel });
      // jsdom's File doesn't implement arrayBuffer(); polyfill for the test.
      Object.defineProperty(f, "arrayBuffer", { value: async () => new Uint8Array([1, 2, 3]).buffer });
      return f;
    };
    const list = [
      mk("Reading.xlsx", "Naplan 2026/Reading.xlsx"),
      mk("notes.txt", "Naplan 2026/notes.txt"),
      mk("~$temp.xlsx", "Naplan 2026/~$temp.xlsx"),
    ];
    const out = await filesFromFileList(list);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("Reading.xlsx");
    expect(out[0]!.relativePath).toBe("Naplan 2026/Reading.xlsx");
    expect(out[0]!.bytes).toBeInstanceOf(ArrayBuffer);
  });
});
