/**
 * Store selectors — pure navigation over the keyed `Map<string, LoadedFile>`
 * produced by the loader. Ported from the legacy `naplan/loader.py` helpers
 * (`year_domain_keys`, `available_years`, `get_primary_year_entries`,
 * `get_prior_year_entries`). No filesystem, no UI.
 */
import { VALID_DOMAINS } from "./constants";
import type { LoadedFile } from "./types";

export type Store = Map<string, LoadedFile>;

/** All loaded entries as an array (insertion order of the store). */
export function storeEntries(store: Store): LoadedFile[] {
  return [...store.values()];
}

/** The single entry for (yearOfTest, yearLevel, domain), or undefined. */
export function getEntry(
  store: Store,
  yearOfTest: number,
  yearLevel: number,
  domain: string,
): LoadedFile | undefined {
  for (const e of store.values()) {
    if (e.yearOfTest === yearOfTest && e.yearLevel === yearLevel && e.domain === domain) {
      return e;
    }
  }
  return undefined;
}

/** Distinct years of test present in the store, most recent first. */
export function availableYears(store: Store): number[] {
  return [...new Set(storeEntries(store).map((e) => e.yearOfTest))].sort((a, b) => b - a);
}

/** Entries for the selected primary year. */
export function getPrimaryYearEntries(store: Store, primaryYear: number): LoadedFile[] {
  return storeEntries(store).filter((e) => e.yearOfTest === primaryYear);
}

/** Entries NOT in the primary year (multi-year context, e.g. year-on-year). */
export function getPriorYearEntries(store: Store, primaryYear: number): LoadedFile[] {
  return storeEntries(store).filter((e) => e.yearOfTest !== primaryYear);
}

/** Year levels present for a given test year, ascending (e.g. [7, 9]). */
export function yearLevelsFor(store: Store, yearOfTest: number): number[] {
  return [
    ...new Set(
      storeEntries(store)
        .filter((e) => e.yearOfTest === yearOfTest)
        .map((e) => e.yearLevel),
    ),
  ].sort((a, b) => a - b);
}

/** Domains present for a (yearOfTest, yearLevel), in canonical VALID_DOMAINS order. */
export function domainsFor(store: Store, yearOfTest: number, yearLevel: number): string[] {
  const present = new Set(
    storeEntries(store)
      .filter((e) => e.yearOfTest === yearOfTest && e.yearLevel === yearLevel)
      .map((e) => e.domain),
  );
  return (VALID_DOMAINS as readonly string[]).filter((d) => present.has(d));
}
