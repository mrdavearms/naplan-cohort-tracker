"""Generate the loader oracle snapshot for the TypeScript port to match.

Reads the committed synthetic (fake-data) fixture, runs it through the LEGACY
Python loader (the oracle), and writes canonical JSON to
`core/tests/fixtures/loader_snapshot.json`. The Vitest loader test parses the
same fixture via exceljs, runs the TS loader, and asserts equality.

This script READS the legacy repo (read-only) and the local fixture; it only
WRITES into this repo. Run with the legacy venv:

    NAPLAN_DATA_SOURCE=local:/tmp/nt_empty \
      /path/to/naplan_analysis_app/.venv/bin/python \
      verification/gen_loader_snapshot.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

LEGACY = "/path/to/naplan_analysis_app"
sys.path.insert(0, LEGACY)

import pandas as pd  # noqa: E402
from naplan.loader import (  # noqa: E402
    _clean_student_reports,
    _clean_student_results,
    _detect_domain_and_year,
)

REPO = Path(__file__).resolve().parent.parent
FIXTURE = REPO / "core" / "tests" / "fixtures" / "synthetic_raw_2026.xlsx"
OUT = REPO / "core" / "tests" / "fixtures" / "loader_snapshot.json"


def scalar(v):
    """pandas/NaN/None -> JSON-safe scalar (NaN/None -> null)."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def num(v):
    s = scalar(v)
    return None if s is None else float(s)


def reports_json(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "studentId": scalar(r["Student ID"]),
            "localStudentId": scalar(r["Local student ID"]),
            "localStudentIdDisplay": scalar(r["Local student ID display"]),
            "yearLevel": None if scalar(r["Year level"]) is None else int(r["Year level"]),
            "classGroups": scalar(r["Class groups"]),
            "domain": scalar(r["Domain"]),
            "proficiencyLevel": scalar(r["Proficiency level"]),
            "participationCode": scalar(r["Participation code"]),
            "indigenousStatus": scalar(r["Indigenous Status"]),
            "lboteStatus": scalar(r["LBOTE Status"]),
            "atsiGroup": scalar(r["ATSI group"]),
        }
        for _, r in df.iterrows()
    ]


def results_json(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "studentPsi": scalar(r["Student PSI"]),
            "yearLevel": None if scalar(r["Year Level"]) is None else int(r["Year Level"]),
            "classGroups": scalar(r["Class Groups"]),
            "itemId": scalar(r["Item ID"]),
            "itemDifficulty": num(r["Item difficulty"]),
            "domain": scalar(r["Domain"]),
            "subdomain": scalar(r["Subdomain"]),
            "descriptor": scalar(r["Descriptor"]),
            "studentMarkedResponse": scalar(r["Student marked response"]),
            "difficultyBand": scalar(r["Difficulty band"]),
        }
        for _, r in df.iterrows()
    ]


def main() -> None:
    sr = _clean_student_reports(pd.read_excel(FIXTURE, sheet_name="Student Reports"))
    srt = _clean_student_results(pd.read_excel(FIXTURE, sheet_name="Student Results Table"))
    domain, year_level = _detect_domain_and_year(sr)

    snapshot = {
        "_comment": "Oracle snapshot from legacy naplan.loader. Regenerate via verification/gen_loader_snapshot.py.",
        "domain": domain,
        "yearLevel": year_level,
        "participants": int((sr["Participation code"] == "Participated").sum()),
        "totalStudents": int(len(sr)),
        "studentReports": reports_json(sr),
        "studentResults": results_json(srt),
    }
    OUT.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(f"wrote {OUT}")
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
