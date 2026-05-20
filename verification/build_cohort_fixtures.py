"""Build synthetic cross-year cohort fixtures (Y7 2024 + Y9 2026, Reading).

Writes two single-sheet ("Student Reports") workbooks into
`core/tests/fixtures/`. Designed to exercise build_paired_cohort end-to-end:
paired students with NAS transitions in both directions, a paired student with
null Y9 proficiency (filtered), leavers, joiners, a withdrawn student, and a
null-Local-ID student (both excluded from pairing).

Fake data only. Run with the legacy venv (has pandas + openpyxl):

    /Users/davidarmstrong/Antigravity/naplan_analysis_app/.venv/bin/python \
      verification/build_cohort_fixtures.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

FIXTURES = Path(__file__).resolve().parent.parent / "core" / "tests" / "fixtures"

NEITHER = "Neither Aboriginal nor Torres Strait Islander origin"
ABORIGINAL = "Aboriginal but not Torres Strait Islander origin"


def _reports(rows: list[dict], year_level: int) -> pd.DataFrame:
    base = []
    for r in rows:
        base.append({
            "Student ID": r["psi"],
            "Local student ID": r["lsid"],
            "Student name": r["psi"],  # placeholder; dropped downstream
            "Year level": year_level,
            "Class groups": r.get("class", "Class A"),
            "Domain": "Reading",
            "Proficiency level": r["prof"],
            "Participation code": r.get("part", "Participated"),
            "Indigenous Status": r.get("atsi", NEITHER),
            "LBOTE Status": r.get("lbote", "N"),
        })
    return pd.DataFrame(base)


def build() -> None:
    # Y7 2024 — the entry cohort.
    y7 = _reports([
        {"psi": "T2024001", "lsid": "L001", "prof": "Needs additional support", "atsi": ABORIGINAL, "lbote": "Y"},  # paired: NAS->Strong
        {"psi": "T2024002", "lsid": "L002", "prof": "Needs additional support"},  # paired: NAS->NAS
        {"psi": "T2024003", "lsid": "L003", "prof": "Strong"},                    # paired: Strong->NAS
        {"psi": "T2024004", "lsid": "L004", "prof": "Strong"},                    # paired: Strong->Exceeding
        {"psi": "T2024005", "lsid": "L005", "prof": "Developing"},               # paired: Developing->Strong
        {"psi": "T2024006", "lsid": "L006", "prof": "Strong"},                    # paired but Y9 prof null -> filtered
        {"psi": "T2024007", "lsid": "L007", "prof": "Developing"},               # leaver
        {"psi": "T2024008", "lsid": "L008", "prof": "Needs additional support"},  # leaver
        {"psi": "T2024009", "lsid": "L009", "prof": "Strong", "part": "Withdrawn"},  # excluded (not participated)
        {"psi": "T2024099", "lsid": None, "prof": "Strong"},                      # excluded (null Local ID)
    ], year_level=7)

    # Y9 2026 — same students two years on, plus joiners.
    y9 = _reports([
        {"psi": "T2026001", "lsid": "L001", "prof": "Strong", "atsi": ABORIGINAL, "lbote": "Y"},
        {"psi": "T2026002", "lsid": "L002", "prof": "Needs additional support"},
        {"psi": "T2026003", "lsid": "L003", "prof": "Needs additional support"},
        {"psi": "T2026004", "lsid": "L004", "prof": "Exceeding"},
        {"psi": "T2026005", "lsid": "L005", "prof": "Strong"},
        {"psi": "T2026006", "lsid": "L006", "prof": None},  # participated but no proficiency -> filtered
        {"psi": "T2026010", "lsid": "L010", "prof": "Strong"},                    # joiner
        {"psi": "T2026011", "lsid": "L011", "prof": "Needs additional support"},  # joiner
    ], year_level=9)

    for df, name in ((y7, "synthetic_y7_2024_reading.xlsx"), (y9, "synthetic_y9_2026_reading.xlsx")):
        out = FIXTURES / name
        with pd.ExcelWriter(out, engine="openpyxl") as w:
            df.to_excel(w, sheet_name="Student Reports", index=False)
        print(f"wrote {out}")


if __name__ == "__main__":
    build()
