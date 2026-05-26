"""Generate the sections oracle snapshot (Sections 1, 2, 7) for the TS port.

Calls the legacy section helpers headless over the committed synthetic fixture
and writes `core/tests/fixtures/sections_snapshot.json`. Reads the legacy repo
(read-only) + local fixture; writes only into this repo.

    NAPLAN_DATA_SOURCE=local:/tmp/nt_empty \
      /path/to/naplan_analysis_app/.venv/bin/python \
      verification/gen_sections_snapshot.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

LEGACY = "/path/to/naplan_analysis_app"
sys.path.insert(0, LEGACY)

import pandas as pd  # noqa: E402
from naplan.loader import (  # noqa: E402
    LoadedFile,
    _clean_student_reports,
    _clean_student_results,
    _detect_domain_and_year,
)
from naplan.sections.s1_participation import _participation_breakdown  # noqa: E402
from naplan.sections.s2_proficiency import (  # noqa: E402
    proficiency_counts,
    proficiency_percentages,
)
from naplan.sections.s5_skill_gap import (  # noqa: E402
    _accuracy_by_subdomain_and_band,
    _bottom_descriptors,
)
from naplan.sections.s7_class_groups import _class_distribution  # noqa: E402

FIXTURES = Path(__file__).resolve().parent.parent / "core" / "tests" / "fixtures"
FIXTURE = FIXTURES / "synthetic_raw_2026.xlsx"
OUT = FIXTURES / "sections_snapshot.json"


def main() -> None:
    sr = _clean_student_reports(pd.read_excel(FIXTURE, sheet_name="Student Reports"))
    srt = _clean_student_results(pd.read_excel(FIXTURE, sheet_name="Student Results Table"))
    domain, year_level = _detect_domain_and_year(sr)
    entry = LoadedFile(
        2026, year_level, domain, sr, srt, "synthetic", datetime.now(),
        int((sr["Participation code"] == "Participated").sum()), len(sr),
    )

    # Section 1
    breakdown_df = _participation_breakdown(sr)
    breakdown = {row["Status"]: int(row["Students"]) for _, row in breakdown_df.iterrows()}
    total = len(sr)
    participated = breakdown["Participated"]

    # Section 7 — per class group
    cd = _class_distribution(sr)
    parts = sr[sr["Participation code"] == "Participated"].copy()
    parts["Class groups"] = parts["Class groups"].fillna("(unassigned)")
    class_n = parts.groupby("Class groups").size().to_dict()
    classes: dict[str, dict] = {}
    for _, row in cd.iterrows():
        raw = str(row["Class raw"])
        classes.setdefault(raw, {"classGroup": raw, "n": int(class_n.get(raw, 0)), "percentages": {}})
        classes[raw]["percentages"][row["Level"]] = float(row["Percentage"])

    # Section 5 — item-level
    acc = _accuracy_by_subdomain_and_band(srt)
    acc_list = [
        {
            "subdomain": row["Subdomain"],
            "band": row["Difficulty band"],
            "accuracyPct": float(row["Accuracy %"]),
            "nResponses": int(row["n_responses"]),
        }
        for _, row in acc.iterrows()
    ]
    bottom = _bottom_descriptors(srt, n=10)
    bottom_list = [
        {
            "itemId": row["Item ID"],
            "descriptor": row["Descriptor"],
            "subdomain": row["Subdomain"],
            "itemDifficulty": None if pd.isna(row["Item difficulty"]) else int(row["Item difficulty"]),
            "accuracyPct": float(row["Accuracy %"]),
            "studentsAttempted": int(row["Students attempted"]),
        }
        for _, row in bottom.iterrows()
    ]

    snapshot = {
        "_comment": "Oracle snapshot from legacy section helpers. Regenerate via verification/gen_sections_snapshot.py.",
        "participation": {
            "breakdown": breakdown,
            "total": total,
            "participated": participated,
            "rate": participated / total * 100 if total else 0.0,
        },
        "proficiency": {
            "counts": proficiency_counts(entry),
            "percentages": proficiency_percentages(entry),
        },
        "classDistribution": sorted(classes.values(), key=lambda c: c["classGroup"]),
        "skillGap": {
            "accuracyBySubdomainBand": acc_list,
            "bottomDescriptors": bottom_list,
        },
    }
    OUT.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(f"wrote {OUT}")
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
