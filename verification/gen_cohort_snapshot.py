"""Generate the cohort oracle snapshot for the TS port to match.

Reads the committed cross-year fixtures, runs them through the LEGACY
cohort/loader modules (the oracle), and writes
`core/tests/fixtures/cohort_snapshot.json`. The Vitest cohort-parity test
parses the same fixtures and asserts buildPairedCohort / mcnemarPaired /
transitionMatrix / wilsonCi reproduce these numbers.

Reads the legacy repo (read-only) + local fixtures; writes only into this repo.

    NAPLAN_DATA_SOURCE=local:/tmp/nt_empty \
      /Users/davidarmstrong/Antigravity/naplan_analysis_app/.venv/bin/python \
      verification/gen_cohort_snapshot.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

LEGACY = "/Users/davidarmstrong/Antigravity/naplan_analysis_app"
sys.path.insert(0, LEGACY)

import pandas as pd  # noqa: E402
from naplan.cohort import (  # noqa: E402
    NAS,
    build_paired_cohort,
    mcnemar_paired,
    transition_matrix,
    wilson_ci,
)
from naplan.loader import _clean_student_reports  # noqa: E402

FIXTURES = Path(__file__).resolve().parent.parent / "core" / "tests" / "fixtures"
OUT = FIXTURES / "cohort_snapshot.json"


def main() -> None:
    y7 = _clean_student_reports(
        pd.read_excel(FIXTURES / "synthetic_y7_2024_reading.xlsx", sheet_name="Student Reports")
    )
    y9 = _clean_student_reports(
        pd.read_excel(FIXTURES / "synthetic_y9_2026_reading.xlsx", sheet_name="Student Reports")
    )

    pc = build_paired_cohort(y7, y9, "Reading")
    n = len(pc.paired)
    y7_nas = int((pc.paired["Proficiency Y7"] == NAS).sum())
    y9_nas = int((pc.paired["Proficiency Y9"] == NAS).sum())
    mc = mcnemar_paired(pc.paired)
    tm = transition_matrix(pc.paired)
    y7_lo, y7_hi = wilson_ci(y7_nas, n)
    y9_lo, y9_hi = wilson_ci(y9_nas, n)

    snapshot = {
        "_comment": "Oracle snapshot from legacy naplan.cohort. Regenerate via verification/gen_cohort_snapshot.py.",
        "domain": "Reading",
        "paired": n,
        "leavers": len(pc.leavers),
        "joiners": len(pc.joiners),
        "pairedFilteredCount": pc.paired_filtered_count,
        "y7NasCount": y7_nas,
        "y9NasCount": y9_nas,
        "y7NasPct": y7_nas / n * 100,
        "y9NasPct": y9_nas / n * 100,
        "mcnemar": {
            "stayersNas": mc.stayers_nas,
            "stayersNotNas": mc.stayers_not_nas,
            "movedOutOfNas": mc.moved_out_of_nas,
            "movedIntoNas": mc.moved_into_nas,
            "pValue": mc.p_value,
        },
        "transitionMatrix": tm.values.tolist(),
        "wilsonY7Nas": [float(y7_lo), float(y7_hi)],
        "wilsonY9Nas": [float(y9_lo), float(y9_hi)],
    }
    OUT.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(f"wrote {OUT}")
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
