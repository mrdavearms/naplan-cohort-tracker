"""Generate the cohort oracle snapshot for the TS port to match.

Reads the committed cross-year fixtures, runs them through the LEGACY
cohort/loader modules (the oracle), and writes
`core/tests/fixtures/cohort_snapshot.json`. The Vitest cohort-parity test
parses the same fixtures and asserts buildPairedCohort / mcnemarPaired /
transitionMatrix / wilsonCi reproduce these numbers.

Reads the legacy repo (read-only) + local fixtures; writes only into this repo.

    NAPLAN_DATA_SOURCE=local:/tmp/nt_empty \
      /path/to/naplan_analysis_app/.venv/bin/python \
      verification/gen_cohort_snapshot.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

LEGACY = "/path/to/naplan_analysis_app"
sys.path.insert(0, LEGACY)

import pandas as pd  # noqa: E402
from naplan.cohort import (  # noqa: E402
    NAS,
    PROFICIENCY_LEVELS,
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

    # ── Section 10 drill-downs (mirror the legacy s10 render inline math) ──
    def dist(frame, col, denom):
        return {lvl: float((frame[col] == lvl).sum() / max(denom, 1) * 100) for lvl in PROFICIENCY_LEVELS}

    p7 = dist(pc.paired, "Proficiency Y7", n)
    p9 = dist(pc.paired, "Proficiency Y9", n)
    headline = {
        "pairedN": n,
        "y7NasPct": p7[NAS],
        "y9NasPct": p9[NAS],
        "deltaNasPp": p9[NAS] - p7[NAS],
        "y7MeetingPct": p7["Strong"] + p7["Exceeding"],
        "y9MeetingPct": p9["Strong"] + p9["Exceeding"],
        "deltaMeetingPp": (p9["Strong"] + p9["Exceeding"]) - (p7["Strong"] + p7["Exceeding"]),
    }

    sN, lN = len(pc.paired), len(pc.leavers)
    attrition = {
        "stayersN": sN,
        "leaversN": lN,
        "stayersY7Distribution": dist(pc.paired, "Proficiency Y7", sN),
        "leaversY7Distribution": dist(pc.leavers, "Proficiency Y7", lN),
        "stayersNasCount": int((pc.paired["Proficiency Y7"] == NAS).sum()),
        "leaversNasCount": int((pc.leavers["Proficiency Y7"] == NAS).sum()),
        "stayersNasPct": float((pc.paired["Proficiency Y7"] == NAS).sum() / max(sN, 1) * 100),
        "leaversNasPct": float((pc.leavers["Proficiency Y7"] == NAS).sum() / max(lN, 1) * 100),
    }

    def sub(label, group):
        gn = len(group)
        if gn < 5:
            return {"subgroup": label, "n": gn, "suppressed": True, "caveat": False,
                    "y7NasPct": None, "y9NasPct": None}
        return {"subgroup": label, "n": gn, "suppressed": False, "caveat": gn <= 9,
                "y7NasPct": float((group["Proficiency Y7"] == NAS).sum() / gn * 100),
                "y9NasPct": float((group["Proficiency Y9"] == NAS).sum() / gn * 100)}

    paired = pc.paired
    equity = [
        sub("LBOTE Yes (Y7)", paired[paired["LBOTE Status"] == "Yes"]),
        sub("LBOTE No (Y7)", paired[paired["LBOTE Status"] == "No"]),
        sub("Aboriginal and/or TSI (Y7)", paired[paired["ATSI group"] == "ATSI"]),
        sub("Non-Indigenous (Y7)", paired[paired["ATSI group"] == "Non-ATSI"]),
    ]

    paired_view = pc.paired[["Class group Y7", "Class group Y9", "Proficiency Y7", "Proficiency Y9"]].copy()
    leavers_view = pc.leavers[["Class group Y7", "Proficiency Y7"]].copy()
    leavers_view["Class group Y9"] = "left WHS"
    leavers_view["Proficiency Y9"] = None
    combined = pd.concat([paired_view, leavers_view], ignore_index=True)
    classes = []
    for y7c, grp in combined.groupby("Class group Y7"):
        total = len(grp)
        stayers = grp[grp["Class group Y9"] != "left WHS"]
        stayed, left = len(stayers), total - len(stayers)
        y7nas = int((grp["Proficiency Y7"] == NAS).sum())
        y9nas = int((stayers["Proficiency Y9"] == NAS).sum())
        dests = [{"y9Class": str(c), "n": int(cnt)}
                 for c, cnt in sorted(stayers["Class group Y9"].value_counts().items())]
        if left > 0:
            dests.append({"y9Class": "left WHS", "n": int(left)})
        classes.append({
            "y7Class": str(y7c), "total": total, "stayed": stayed, "left": int(left),
            "y7NasCount": y7nas, "y7NasPct": float(y7nas / total * 100) if total else 0.0,
            "pairedSubsetN": stayed, "y9NasCount": y9nas,
            "y9NasPct": float(y9nas / stayed * 100) if stayed else 0.0,
            "destinations": dests,
        })

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
        "drilldowns": {
            "headline": headline,
            "attrition": attrition,
            "equitySubCohorts": equity,
            "classGroups": classes,
        },
    }
    OUT.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(f"wrote {OUT}")
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
