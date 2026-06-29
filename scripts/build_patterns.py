#!/usr/bin/env python3
"""
build_patterns.py — Parse AR_Pattern_Library_v2_Complete.xlsx into src/data/patterns.json

The xlsx is the master pattern library: 31 behavioural patterns across 5 categories,
each with the analyst mental model, SAP + Oracle (Fusion/EBS) source tables, the
three-layer brain mapping (logical -> event-series -> AI feature), conceptual SQL,
the original flat Action DAG, and the enriched conditional Branching DAG (with HITL gates).

We parse it into a structured JSON the ProcessIQ cognitive engine renders off.
Re-run after any edit to the xlsx:  python scripts/build_patterns.py

Stdlib only — no openpyxl dependency (parses the OOXML directly).
"""
import zipfile, re, json, os
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "AR_Pattern_Library_v2_Complete.xlsx")
OUT  = os.path.join(ROOT, "src", "data", "patterns.json")
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Risk/priority colour mapping mirrors the deck legend.
PRIORITY_RANK = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}

# A compact slug for each AI feature so the engine can key off it.
def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.strip().lower()).strip("-")


def col_idx(ref):
    m = re.match(r"([A-Z]+)", ref)
    n = 0
    for c in m.group(1):
        n = n * 26 + (ord(c) - 64)
    return n - 1


def read_sheet(z, fn):
    root = ET.fromstring(z.read(fn))
    rows = []
    for row in root.iter(M + "row"):
        cells = {}
        maxc = 0
        for c in row.findall(M + "c"):
            ci = col_idx(c.get("r"))
            maxc = max(maxc, ci)
            if c.get("t") == "inlineStr":
                val = "".join(t.text or "" for t in c.iter(M + "t"))
            else:
                v = c.find(M + "v")
                val = v.text if v is not None else ""
            cells[ci] = val or ""
        rows.append([cells.get(i, "") for i in range(maxc + 1)])
    return rows


def split_tables(cell):
    """Source-table cells pack several 'TABLE (FIELDS) [SYSTEM]' lines separated by newlines."""
    out = []
    for line in re.split(r"\n+", cell.strip()):
        line = line.strip()
        if line:
            out.append(line)
    return out


def parse_branching_dag(text):
    """
    Turn the amber 'Branching DAG Logic' free-text into structured branches.
    Each branch = { condition, actions[], hitl } parsed from IF / ELSE IF / Default blocks
    and the bullet '->' action lines beneath them.
    """
    text = text.replace("→", "->").replace("≥", ">=").replace("≤", "<=")
    branches = []
    cur = None
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        cond_m = re.match(r"^(IF|ELSE IF|IMMEDIATE ACTION|Default)\b(.*)", line, re.I)
        hitl_m = re.search(r"\[HITL[:\s]?(.*?)\]", line, re.I)
        if cond_m:
            if cur:
                branches.append(cur)
            kw = cond_m.group(1)
            cur = {"condition": line.rstrip(), "actions": [], "hitl": None,
                   "tier": {"IF": "primary", "ELSE IF": "escalation",
                            "Default": "default"}.get(kw.upper().replace("ELSE IF", "ELSE IF"), "primary")}
            # tier heuristic: first IF = primary, subsequent ELSE IF escalate
            if kw.upper().startswith("ELSE"):
                cur["tier"] = "escalation"
            elif kw.upper().startswith("IMMEDIATE"):
                cur["tier"] = "immediate"
            elif kw.upper().startswith("DEFAULT"):
                cur["tier"] = "default"
            else:
                cur["tier"] = "primary"
        elif hitl_m and cur is not None:
            cur["hitl"] = hitl_m.group(1).strip()
        elif line.startswith("->") and cur is not None:
            cur["actions"].append(line.lstrip("-> ").strip())
        elif cur is not None:
            # continuation of previous action or condition
            if cur["actions"]:
                cur["actions"][-1] += " " + line
            else:
                cur["condition"] += " " + line
    if cur:
        branches.append(cur)

    # "IMMEDIATE ACTION ..." is a header, not an executable branch: the real
    # branches follow it (parsed as 'primary' IFs). Detect that mode, retag the
    # following branches as immediate, and drop any actionless header branch.
    immediate_mode = any(b["tier"] == "immediate" and not b["actions"] for b in branches)
    branches = [b for b in branches if b["actions"]]  # drop headers/labels
    if immediate_mode:
        for b in branches:
            b["tier"] = "immediate"

    # mark escalation order
    esc = 0
    for b in branches:
        if b["tier"] == "escalation":
            esc += 1
            b["escLevel"] = esc
    return branches


def main():
    z = zipfile.ZipFile(XLSX)
    rows = read_sheet(z, "xl/worksheets/sheet1.xml")

    patterns = []
    current_category = None
    for r in rows:
        if not r:
            continue
        c0 = (r[0] or "").strip()
        # category separator rows, e.g. "  Dispute & Deduction Manipulation  (9 patterns)"
        if not c0.isdigit():
            mcat = re.match(r"^\s*(.+?)\s*\((\d+)\s+patterns?\)", r[0] or "")
            if mcat:
                current_category = mcat.group(1).strip()
            continue

        def g(i):
            return r[i].strip() if i < len(r) else ""

        pid = int(c0)
        name = g(2)
        priority = g(3) or "Medium"
        feature = g(9)
        branching = parse_branching_dag(g(12))
        # collect HITL gates surfaced by this pattern
        hitl_gates = sorted({b["hitl"] for b in branching if b.get("hitl")})

        patterns.append({
            "id": pid,
            "name": name,
            "category": g(1) or current_category,
            "priority": priority,
            "priorityRank": PRIORITY_RANK.get(priority, 2),
            "mentalModel": g(4),
            "sources": {
                "sap": split_tables(g(5)),
                "oracle": split_tables(g(6)),  # Fusion / EBS combined column
            },
            "layer1_logicalMapping": g(7),
            "layer2_eventSeries": g(8),
            "layer3_feature": feature,
            "featureSlug": slug(feature),
            "conceptualSQL": g(10).replace("→", "->"),
            "originalDAG": [s.strip() for s in re.split(r"→|->", g(11)) if s.strip()],
            "branchingDAG": branching,
            "hitlGates": hitl_gates,
        })

    patterns.sort(key=lambda p: p["id"])

    # category roll-up for the library view / priority matrix (deck slide 6 & 11)
    cats = {}
    for p in patterns:
        c = cats.setdefault(p["category"], {"category": p["category"], "count": 0,
                                            "Critical": 0, "High": 0, "Medium": 0, "Low": 0})
        c["count"] += 1
        c[p["priority"]] = c.get(p["priority"], 0) + 1

    out = {
        "meta": {
            "title": "ProcessIQ — AR Collections Pattern Library",
            "source": "AR_Pattern_Library_v2_Complete.xlsx",
            "patternCount": len(patterns),
            "categories": list(cats.values()),
            "priorityLegend": {"Critical": "#c0392b", "High": "#e67e22",
                               "Medium": "#27ae60", "Low": "#2980b9"},
            "erp": {"primary": "SAP", "toggle": ["SAP", "Oracle Fusion / EBS"]},
        },
        "patterns": patterns,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(patterns)} patterns -> {os.path.relpath(OUT, ROOT)}")
    print("Categories:")
    for c in cats.values():
        print(f"  {c['count']:>2}  {c['category']}  "
              f"(C{c['Critical']} H{c['High']} M{c['Medium']} L{c['Low']})")
    # sanity: how many have structured branching DAGs + HITL gates
    with_dag = sum(1 for p in patterns if p["branchingDAG"])
    with_hitl = sum(1 for p in patterns if p["hitlGates"])
    print(f"Branching DAGs parsed: {with_dag}/{len(patterns)} | with HITL gates: {with_hitl}")


if __name__ == "__main__":
    main()
