#!/usr/bin/env python3
"""
build_command_centre.py — Generate src/data/command_centre.json.

The Command Centre is the consumption surface (one of the two top-level tiles). It is
NOT a generic dashboard builder: it is a projection of the **CFO Mission-Capability
Taxonomy**, which is the routing table for the whole surface.

    8  L1 objectives      (A–H)
    21 L2 sub-objectives
    60 missions           (M1–M60)   — the atomic units of accountability
    77 capabilities       (CAP-1..77) — the reusable widgets that power missions
    11 personas                        — each owns a set of missions

Two derivations do all the work:

  cadence → tab   Daily/Weekly → pulse · Fortnightly/Monthly → intelligence
                  Ad hoc → scenarios · Quarterly/Annual → trajectory
                  A persona with no missions at a cadence simply has no such tab.

  capability → cross-reference   usedByMissions / usedByPersonas are computed, never
                  authored, so the Customize overlay can say "also used by Treasury, FP&A".

Everything below is authored once (missions, their capabilities) and every other field —
tabs, mission counts, headlines, cross-references, widget data — is generated from it.

  python scripts/build_command_centre.py
"""
import os, json, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data", "command_centre.json")
PATTERNS = os.path.join(ROOT, "src", "data", "patterns.json")

# The Builder's five theme slugs are aliases of the canonical A–H theme ids. Both tiles
# speak the same vocabulary; this is the dictionary between them.
THEME_ALIASES = {
    "working-capital": "C",
    "revenue-leakage": "A",
    "close-acceleration": "G",
    "controls-integrity": "H",
    "cash-visibility": "C",
}

# Capabilities that measure the same thing as a Builder compound KPI. Drives the
# "View in Command Centre →" / "View in Builder →" round trip.
SOURCE_KPI = {
    "CAP-35": "cashConversionCycle", "CAP-33": "cashConversionCycle",
    "CAP-37": "cashConversionCycle", "CAP-32": "forecastAccuracy",
    "CAP-18": "forecastAccuracy", "CAP-31": "cashConversionCycle",
    "CAP-57": "effectiveTaxRate", "CAP-66": "closeCycleDays",
    "CAP-71": "controlHealthScore", "CAP-4": "revenueLeakageRate",
    "CAP-3": "revenueLeakageRate",
}

CADENCE_TO_TAB = {
    "Daily": "pulse", "Weekly": "pulse",
    "Fortnightly": "intelligence", "Monthly": "intelligence",
    "Ad hoc": "scenarios",
    "Quarterly": "trajectory", "Annual": "trajectory",
}
CADENCE_ORDER = ["Daily", "Weekly", "Fortnightly", "Monthly", "Ad hoc", "Quarterly", "Annual"]
TABS = [
    {"id": "pulse", "label": "Pulse", "cadences": "Daily + Weekly",
     "blurb": "The operational heartbeat — what needs attention right now."},
    {"id": "intelligence", "label": "Intelligence", "cadences": "Fortnightly + Monthly",
     "blurb": "The analytical layer — what is developing, and why."},
    {"id": "scenarios", "label": "Scenarios", "cadences": "Ad hoc",
     "blurb": "What-if modelling and event-driven analysis — what could happen."},
    {"id": "trajectory", "label": "Trajectory", "cadences": "Quarterly + Annual",
     "blurb": "The strategic arc — targets vs actuals, and where this is heading."},
]

# ---------------------------------------------------------------------------
# L1 THEMES (A–H) → L2 OBJECTIVES (A.1…) → missions
# Same vocabulary as the Transformation Builder: "Theme" is L1, "Objective" is L2.
# ---------------------------------------------------------------------------
THEMES = {
    "A": {"name": "Total shareholder return", "objectives": {
        "A.1": {"name": "Net Revenue Growth", "missions": ["M1", "M2", "M3", "M4"]},
        "A.2": {"name": "Net Margin Growth", "missions": ["M5", "M6", "M7", "M8"]},
        "A.3": {"name": "Performance Commitments & Predictability", "missions": ["M9", "M10", "M11"]}}},
    "B": {"name": "Return on invested capital", "objectives": {
        "B.1": {"name": "Capital Deployment & Returns", "missions": ["M12", "M15", "M16", "M17"]},
        "B.2": {"name": "Asset Productivity", "missions": ["M13", "M14"]}}},
    "C": {"name": "Free cash flow", "objectives": {
        "C.1": {"name": "Working Capital", "missions": ["M18", "M19", "M20"]},
        "C.2": {"name": "Cash Generation & Conversion", "missions": ["M21", "M22", "M23"]}}},
    "D": {"name": "Cost of capital", "objectives": {
        "D.1": {"name": "Capital Structure & Funding", "missions": ["M24", "M25", "M26"]},
        "D.2": {"name": "Liquidity & Cash Management", "missions": ["M27", "M28", "M29"]},
        "D.3": {"name": "Market Risk", "missions": ["M30", "M31"]}}},
    "E": {"name": "Shareholder value & capital returns", "objectives": {
        "E.1": {"name": "Equity Story & Valuation", "missions": ["M32", "M33"]},
        "E.2": {"name": "Capital Returns", "missions": ["M34", "M35"]}}},
    "F": {"name": "Tax management", "objectives": {
        "F.1": {"name": "Effective Tax Rate", "missions": ["M36", "M37", "M38"]},
        "F.2": {"name": "Tax Compliance & Controversy", "missions": ["M39", "M40", "M41"]}}},
    "G": {"name": "Finance function excellence", "objectives": {
        "G.1": {"name": "Transactional Excellence", "missions": ["M42", "M43", "M44"]},
        "G.2": {"name": "Business Partnering Cost", "missions": ["M45", "M46", "M47", "M48", "M49", "M50"]},
        "G.3": {"name": "Reporting & Statutory", "missions": ["M51"]},
        "G.4": {"name": "People & Platform", "missions": ["M58", "M59"]}}},
    "H": {"name": "Risk & compliance management", "objectives": {
        "H.1": {"name": "Controls & Compliance", "missions": ["M52", "M53", "M54", "M55"]},
        "H.2": {"name": "Enterprise Risk", "missions": ["M56", "M57"]},
        "H.3": {"name": "Pension & Post-Employment", "missions": ["M60"]}}},
}

# ---------------------------------------------------------------------------
# The 77 capabilities. Order is the CAP-n numbering. CAP-61 is deliberately the
# shared "Function cost benchmarking" that serves all six G.2 cost missions.
# ---------------------------------------------------------------------------
CAPS = [
    ("Volume and distribution tracker", "timeseries", "wide"),          # 1
    ("Channel mix analyzer", "bar", "standard"),                        # 2
    ("Price realization bridge", "waterfall", "wide"),                  # 3
    ("Gross-to-net waterfall", "waterfall", "wide"),                    # 4
    ("Trade spend ROI engine", "scorecard", "standard"),                # 5
    ("Promo effectiveness model", "bar", "standard"),                   # 6
    ("NPD launch tracker", "timeseries", "standard"),                   # 7
    ("Innovation ROI model", "scorecard", "standard"),                  # 8
    ("COGS productivity tracker", "timeseries", "standard"),            # 9
    ("Input-cost hedge coverage", "gauge", "standard"),                 # 10
    ("Cost-to-serve model", "heatmap", "wide"),                         # 11
    ("Logistics spend analyzer", "bar", "standard"),                    # 12
    ("Marketing ROI attribution", "scorecard", "standard"),             # 13
    ("SG&A budget tracker", "bar", "standard"),                         # 14
    ("Overhead productivity index", "gauge", "standard"),               # 15
    ("Strategic plan calibrator", "scorecard", "standard"),             # 16
    ("Market assumption benchmark", "table", "standard"),               # 17
    ("Forecast accuracy scoring", "gauge", "standard"),                 # 18
    ("Plan-vs-actual variance engine", "waterfall", "wide"),            # 19
    ("Finance platform and automation index", "scorecard", "standard"), # 20
    ("Capex hurdle screener", "scorecard", "standard"),                 # 21
    ("Project return tracker", "bar", "standard"),                      # 22
    ("Asset utilization monitor", "gauge", "standard"),                 # 23
    ("Output-per-dollar index", "timeseries", "standard"),              # 24
    ("Idle asset register", "table", "standard"),                       # 25
    ("Divestment pipeline", "funnel", "standard"),                      # 26
    ("Deal return model", "scorecard", "standard"),                     # 27  (shared 4x)
    ("Synergy delivery tracker", "timeseries", "wide"),                 # 28
    ("Acquired-business ROIC monitor", "gauge", "standard"),            # 29
    ("Exit value analyzer", "waterfall", "standard"),                   # 30
    ("FCF conversion model", "timeseries", "wide"),                     # 31
    ("Cash forecast engine", "timeseries", "wide"),                     # 32
    ("DIO tracker", "timeseries", "standard"),                          # 33
    ("Inventory aging heatmap", "heatmap", "wide"),                     # 34
    ("DSO tracker", "timeseries", "standard"),                          # 35
    ("Collections effectiveness index", "gauge", "standard"),           # 36
    ("DPO tracker", "timeseries", "standard"),                          # 37
    ("Supplier terms analyzer", "table", "standard"),                   # 38
    ("Trapped cash map", "heatmap", "wide"),                            # 39
    ("Cash gap closer", "funnel", "standard"),                          # 40
    ("Leverage and rating monitor", "gauge", "standard"),               # 41
    ("Debt maturity ladder", "bar", "standard"),                        # 42
    ("Funding cost curve", "timeseries", "standard"),                   # 43
    ("Equity issuance model", "scorecard", "standard"),                 # 44
    ("Liquidity stress tester", "gauge", "standard"),                   # 45
    ("Headroom monitor", "timeseries", "standard"),                     # 46
    ("Surplus cash yield tracker", "timeseries", "standard"),           # 47
    ("Counterparty risk matrix", "heatmap", "wide"),                    # 48
    ("Cash pooling optimizer", "donut", "standard"),                    # 49
    ("FX exposure monitor", "bar", "standard"),                         # 50
    ("Hedge effectiveness scorer", "gauge", "standard"),                # 51
    ("Interest-rate exposure model", "timeseries", "standard"),         # 52
    ("Peer valuation benchmark", "bar", "standard"),                    # 53
    ("Investor base analytics", "donut", "standard"),                   # 54
    ("Dividend policy tracker", "timeseries", "standard"),              # 55
    ("Buyback execution monitor", "timeseries", "standard"),            # 56
    ("Effective tax rate bridge", "waterfall", "wide"),                 # 57
    ("Tax incentive register", "table", "standard"),                    # 58
    ("Tax impact simulator", "scorecard", "standard"),                  # 59
    ("Tax provision tracker", "timeseries", "standard"),                # 60
    ("Function cost benchmarking", "bar", "standard"),                  # 61  (shared 6x)
    ("Indirect tax compliance monitor", "gauge", "standard"),           # 62
    ("Tax audit exposure tracker", "funnel", "standard"),               # 63
    ("AP / P2P service dashboard", "scorecard", "standard"),            # 64
    ("AR / O2C service dashboard", "scorecard", "standard"),            # 65
    ("RTR cycle time monitor", "timeseries", "standard"),               # 66
    ("Statutory filing calendar", "table", "standard"),                 # 67
    ("Audit readiness tracker", "gauge", "standard"),                   # 68
    ("Delivery mix optimizer", "donut", "standard"),                    # 69
    ("Regulatory horizon scanner", "table", "wide"),                    # 70
    ("Controls effectiveness monitor", "heatmap", "wide"),              # 71
    ("Fraud and DoA monitor", "funnel", "standard"),                    # 72
    ("Enterprise risk heatmap", "heatmap", "wide"),                     # 73
    ("Risk quantification model", "scorecard", "standard"),             # 74
    ("Retained risk and insurance model", "gauge", "standard"),         # 75
    ("Pension funding monitor", "timeseries", "standard"),              # 76
    ("Finance talent and skills index", "scorecard", "standard"),       # 77
]

# ---------------------------------------------------------------------------
# The 60 missions: name, owning persona, cadence, capabilities, objective/L2.
# ---------------------------------------------------------------------------
def M(name, owner, cadence, caps):
    return {"name": name, "owner": owner, "cadence": cadence,
            "capabilities": ["CAP-%d" % c for c in caps]}

MISSIONS = {
    # ---- A · Total shareholder return ----
    "M1":  M("Base-business volume and distribution growth", "cc-commercial", "Daily", [1, 2]),
    "M2":  M("Net price and mix realization vs plan", "cc-commercial", "Fortnightly", [3, 4]),
    "M3":  M("Trade spend ROI and gross-to-net within plan", "cc-commercial", "Weekly", [5, 6, 4]),
    "M4":  M("NPD revenue contribution and ROI vs launch cases", "cc-commercial", "Ad hoc", [7, 8]),
    "M5":  M("COGS productivity savings and input-cost coverage", "cc-supplychain", "Monthly", [9, 10]),
    "M6":  M("Logistics and cost-to-serve within target", "cc-supplychain", "Monthly", [11, 12]),
    "M7":  M("Marketing ROI at or above threshold", "cc-fpa", "Monthly", [13, 5]),
    "M8":  M("SG&A and overheads within budget with productivity", "cc-fpa", "Monthly", [14, 15]),
    "M9":  M("Annual and strategic plan targets calibrated to market", "cc-fpa", "Annual", [16, 17]),
    "M10": M("Forecast accuracy within tolerance", "cc-fpa", "Monthly", [18, 32]),
    "M11": M("Plan-vs-actual gaps identified and closed", "cc-fpa", "Weekly", [19, 14]),
    # ---- B · Return on invested capital ----
    "M12": M("Capex directed to projects meeting return hurdles", "cc-fpa", "Quarterly", [21, 22]),
    "M13": M("Asset utilization and output per dollar at target", "cc-supplychain", "Monthly", [23, 24]),
    "M14": M("Idle and underperforming assets rationalized", "cc-supplychain", "Quarterly", [25, 26]),
    "M15": M("Acquisitions and JVs at or above return hurdles", "cc-corpdev", "Ad hoc", [27, 29]),
    "M16": M("Synergy delivery and acquired-business ROIC", "cc-corpdev", "Monthly", [28, 29]),
    "M17": M("Below-cost-of-capital businesses exited", "cc-corpdev", "Ad hoc", [30, 27, 26]),
    # ---- C · Free cash flow ----
    "M18": M("Days inventory outstanding at target", "cc-supplychain", "Weekly", [33, 34]),
    "M19": M("Days sales outstanding at target", "cc-treasury", "Daily", [35, 36]),
    "M20": M("Days payables outstanding at target", "cc-supplychain", "Monthly", [37, 38]),
    "M21": M("FCF and cash conversion targets calibrated", "cc-fpa", "Annual", [31, 18]),
    "M22": M("Cash forecast accuracy with early warning", "cc-treasury", "Weekly", [32, 18, 31]),
    "M23": M("Cash gaps identified and closed, trapped cash minimized", "cc-treasury", "Monthly", [39, 40]),
    # ---- D · Cost of capital ----
    "M24": M("Leverage and credit rating within target", "cc-treasury", "Quarterly", [41, 42]),
    "M25": M("Funding cost at or below plan", "cc-treasury", "Ad hoc", [43, 42]),
    "M26": M("Equity funding at efficient cost", "cc-treasury", "Ad hoc", [44, 53]),
    "M27": M("Liquidity headroom above policy under stress", "cc-treasury", "Monthly", [45, 46, 32]),
    "M28": M("Risk-adjusted returns on surplus cash at benchmark", "cc-treasury", "Daily", [47, 48]),
    "M29": M("Cash available where needed, pooling costs at target", "cc-treasury", "Quarterly", [49, 39]),
    "M30": M("FX impact on cash flows within risk limits", "cc-treasury", "Weekly", [50, 51]),
    "M31": M("Interest-rate exposure within policy", "cc-treasury", "Quarterly", [52, 51]),
    # ---- E · Shareholder value & capital returns ----
    "M32": M("Valuation multiple at or above peer median", "cc-ir", "Quarterly", [53, 27]),
    "M33": M("Investor base aligned to strategy", "cc-ir", "Monthly", [54, 53]),
    "M34": M("Dividend delivered per policy", "cc-treasury", "Quarterly", [55, 31]),
    "M35": M("Buybacks executed at accretive prices", "cc-treasury", "Monthly", [56, 53]),
    # ---- F · Tax management ----
    "M36": M("Group effective tax rate at or below plan", "cc-tax", "Quarterly", [57, 59]),
    "M37": M("Tax incentives secured and retained", "cc-tax", "Ad hoc", [58, 59]),
    "M38": M("Business decisions made with quantified tax impact", "cc-tax", "Ad hoc", [59, 57]),
    "M39": M("Income tax provisions and payments on time", "cc-tax", "Quarterly", [60, 67]),
    "M40": M("Indirect tax collected and remitted on time", "cc-tax", "Monthly", [62, 67]),
    "M41": M("Tax audits resolved within provisioned levels", "cc-tax", "Ad hoc", [63, 60]),
    # ---- G · Finance function excellence ----
    "M42": M("AP and P2P at target cost and service levels", "cc-finops", "Daily", [64, 37]),
    "M43": M("AR and O2C at target cost and quality", "cc-finops", "Daily", [65, 35]),
    "M44": M("RTR at target cost and cycle time", "cc-finops", "Monthly", [66, 69]),
    "M45": M("FP&A at target cost with decision-support quality", "cc-fpa", "Quarterly", [61, 69]),
    "M46": M("Corporate development finance at target cost", "cc-corpdev", "Quarterly", [61, 69]),
    "M47": M("Commercial finance partnering at target cost", "cc-commercial", "Quarterly", [61, 69]),
    "M48": M("Supply chain finance partnering at target cost", "cc-supplychain", "Quarterly", [61, 69]),
    "M49": M("Tax function at target cost with right delivery mix", "cc-tax", "Quarterly", [61, 69]),
    "M50": M("Treasury function at target cost", "cc-treasury", "Quarterly", [61, 69]),
    "M51": M("Statutory filings accurate and on time", "cc-finops", "Monthly", [67, 68]),
    "M58": M("Finance talent and skills developed", "cc-transform", "Quarterly", [77, 69]),
    "M59": M("Finance data, systems and automation platform", "cc-transform", "Monthly", [20, 66, 68]),
    # ---- H · Risk & compliance management ----
    "M52": M("New regulatory obligations identified early", "cc-risk", "Monthly", [70, 71]),
    "M53": M("Internal controls operating effectively", "cc-risk", "Quarterly", [71, 68]),
    "M54": M("Fraud prevented, DoA compliance maintained", "cc-risk", "Monthly", [72, 71]),
    "M55": M("External audits clean and on schedule", "cc-finops", "Quarterly", [68, 67]),
    "M56": M("Enterprise risks quantified and mitigated", "cc-risk", "Quarterly", [73, 74]),
    "M57": M("Retained risk within appetite at efficient cost", "cc-treasury", "Annual", [75, 74]),
    "M60": M("Pension obligations funded within policy", "cc-treasury", "Quarterly", [76, 45]),
}

PERSONAS = [
    ("cc-cfo", "CFO", "top", "📊"),
    ("cc-fpa", "FP&A", "Planning & Analysis", "📈"),
    ("cc-commercial", "Commercial Finance", "Planning & Analysis", "🤝"),
    ("cc-supplychain", "Supply Chain Finance", "Planning & Analysis", "📦"),
    ("cc-corpdev", "Corporate Dev Finance", "Planning & Analysis", "🏗️"),
    ("cc-treasury", "Treasury", "Treasury & Tax", "🏦"),
    ("cc-tax", "Tax", "Treasury & Tax", "⚖️"),
    ("cc-finops", "Finance Ops & Controllership", "Operations & Controls", "🧾"),
    ("cc-risk", "Risk & Compliance", "Operations & Controls", "🛡️"),
    ("cc-ir", "Investor Relations", "Stakeholders & Strategy", "💬"),
    ("cc-transform", "Finance Leadership & Transformation", "Stakeholders & Strategy", "🚀"),
]
GROUP_ORDER = ["top", "Planning & Analysis", "Treasury & Tax",
               "Operations & Controls", "Stakeholders & Strategy"]

# status is deterministic — seeded off the mission number so it never churns
STATUS = ["on-track", "on-track", "attention", "on-track", "off-track", "on-track", "attention"]


# ---------------------------------------------------------------------------
# Synthetic KPI data per capability, shaped by widgetType
# ---------------------------------------------------------------------------
def ramp(n, lo, hi, seed, wob=0.06):
    return [round((lo + (hi - lo) * (i / (n - 1))) * (1 + wob * math.sin(i * 1.7 + seed)), 2)
            for i in range(n)]


MONTHS = ["M4", "M5", "M6", "M7", "M8", "M9"]
QTRS = ["Q1", "Q2", "Q3", "Q4"]
TONES = ["act", "brand2", "high", "crit", "muted"]


def cap_data(i, label, wtype):
    """Deterministic synthetic data for CAP-i, in the shape its widget kind expects."""
    s = i * 0.7
    good = (i % 3) != 1
    if wtype == "timeseries":
        base = 30 + (i % 7) * 9
        return {"kind": "series", "unit": "index", "labels": MONTHS,
                "target": round(base * 1.18, 1),
                "series": [{"name": label.split(" ")[0], "values": ramp(6, base, base * (1.22 if good else 0.9), s), "color": "brand2"},
                           {"name": "Forecast", "values": [None, None, None, None] + ramp(2, base * 1.1, base * 1.25, s), "color": "act", "dash": True}],
                "note": None}
    if wtype == "gauge":
        cur = 0.52 + ((i * 13) % 41) / 100.0
        return {"kind": "gauge", "value": round(cur, 2), "target": round(min(0.97, cur + 0.12), 2),
                "label": label, "trend": ramp(6, max(0.2, cur - 0.2), cur, s, 0.03)}
    if wtype == "bar":
        return {"kind": "bars", "items": [
            {"label": n, "value": str(v) + "%", "pct": v, "tone": TONES[j % 3]}
            for j, (n, v) in enumerate([("Segment A", 88 - i % 20), ("Segment B", 72 - i % 15),
                                        ("Segment C", 61 - i % 12), ("Segment D", 44 - i % 9)])]}
    if wtype == "donut":
        a = 40 + (i % 25)
        b = int((100 - a) * 0.6)
        return {"kind": "donut", "centre": str(a) + "%", "centreSub": "primary",
                "segments": [{"label": "Optimised", "value": a, "color": "act"},
                             {"label": "Partial", "value": b, "color": "high"},
                             {"label": "Unmanaged", "value": 100 - a - b, "color": "crit"}]}
    if wtype == "heatmap":
        return {"kind": "heat", "unit": "index",
                "rows": ["EMEA", "NAM", "APAC", "LATAM"], "cols": QTRS,
                "cells": [[round(1 + ((i + r * 3 + c) % 9) * 0.6, 1) for c in range(4)] for r in range(4)]}
    if wtype == "funnel":
        top = 900 + (i % 11) * 60
        return {"kind": "funnel", "steps": [
            {"label": "Identified", "value": top},
            {"label": "Assessed", "value": int(top * 0.52)},
            {"label": "Actioned", "value": int(top * 0.24)},
            {"label": "Closed", "value": int(top * 0.09)}]}
    if wtype == "waterfall":
        return {"kind": "waterfall", "unit": "$M", "buckets": [
            {"label": "Plan", "value": round(8 + i % 5, 1), "tone": "muted"},
            {"label": "Volume", "value": round(2.4 + (i % 4) * 0.4, 1), "tone": "act"},
            {"label": "Price", "value": round(1.8 + (i % 3) * 0.5, 1), "tone": "act"},
            {"label": "Cost", "value": round(1.2 + (i % 5) * 0.3, 1), "tone": "crit"},
            {"label": "Actual", "value": round(9 + i % 6, 1), "tone": "brand2"}]}
    if wtype == "scorecard":
        return {"kind": "list", "items": [
            {"primary": "Target", "secondary": "committed for the year", "badge": str(70 + i % 25) + "%", "tone": "muted"},
            {"primary": "Actual", "secondary": "year to date", "badge": str(62 + i % 30) + "%", "tone": "act" if good else "crit"},
            {"primary": "Variance", "secondary": "vs plan", "badge": ("+" if good else "-") + str(2 + i % 7) + " pts",
             "tone": "act" if good else "crit"},
            {"primary": "Confidence", "secondary": "model-scored", "badge": str(74 + i % 20) + "%", "tone": "brand2"}]}
    # table
    return {"kind": "table",
            "cols": ["Item", "Owner", "Status"],
            "rows": [["Line " + str(k + 1), ["FP&A", "Treasury", "Tax", "Controllership"][(i + k) % 4],
                      ["on-track", "attention", "off-track"][(i + k) % 3]] for k in range(4)]}


ACTIONS_LAST = [
    "refreshed {n}h ago by the agent", "reconciled {n}h ago", "agent posted {n} updates today",
    "reviewed {n}d ago by the owner", "auto-validated {n}h ago", "escalated {n}d ago",
]
ACTIONS_NEXT = [
    "weekly lock-in due Thursday", "month-end close, D+3", "board pack due in {n} days",
    "quarterly review in {n} weeks", "policy re-test due {n}d", "hedge roll in {n} days",
    "audit walkthrough in {n} days",
]


def benchmark(i, wtype):
    """Industry benchmark band for a capability's KPI (APQC/Hackett-style ranges).
    Pattern Studio's KPI panel overwrites these with the client's real benchmark set."""
    if wtype == "gauge":
        cur = 52 + (i * 13) % 41
        return {"median": float(min(90, cur + 6)), "topQuartile": float(min(97, cur + 16)), "unit": "%"}
    if wtype == "timeseries":
        base = 30 + (i % 7) * 9
        return {"median": round(base * 1.12, 1), "topQuartile": round(base * 1.30, 1), "unit": "index"}
    if wtype in ("bar", "donut", "scorecard"):
        v = 62 + i % 30
        return {"median": float(min(92, v + 5)), "topQuartile": float(min(98, v + 14)), "unit": "%"}
    return {"median": None, "topQuartile": None, "unit": None}


def metric(i, wtype, good):
    """The single headline number a capability contributes to a KPI stat tile."""
    up = "better" if good else "worse"
    if wtype == "gauge":
        cur = 52 + (i * 13) % 41
        return {"value": "%.1f%%" % (cur + 0.3), "sub": "target %d%%" % min(97, cur + 12),
                "delta": ("+" if good else "-") + "%.1fpp" % (0.4 + (i % 5) * 0.3), "direction": up}
    if wtype == "timeseries":
        base = 30 + (i % 7) * 9
        return {"value": "%.1f" % (base * 1.14), "sub": "target %.0f" % (base * 1.18),
                "delta": ("+" if good else "-") + "%.1f%%" % (1.2 + (i % 6) * 0.7), "direction": up}
    if wtype == "bar":
        return {"value": "%d%%" % (88 - i % 20), "sub": "top segment",
                "delta": ("+" if good else "-") + "%d pts" % (1 + i % 5), "direction": up}
    if wtype == "donut":
        a = 40 + (i % 25)
        return {"value": "%d%%" % a, "sub": "optimised",
                "delta": ("+" if good else "-") + "%d pts" % (2 + i % 4), "direction": up}
    if wtype == "funnel":
        return {"value": str(900 + (i % 11) * 60), "sub": "in pipeline",
                "delta": ("+" if good else "-") + "%d" % (12 + i % 30), "direction": up}
    if wtype == "waterfall":
        return {"value": "$%.1fM" % (9 + i % 6), "sub": "vs $%.1fM plan" % (8 + i % 5),
                "delta": ("+" if good else "-") + "$%.1fM" % (0.4 + (i % 5) * 0.3), "direction": up}
    if wtype == "heatmap":
        return {"value": str(2 + i % 6) + ".1", "sub": "risk index",
                "delta": ("+" if good else "-") + "%.1f" % (0.2 + (i % 4) * 0.2), "direction": up}
    if wtype == "table":
        return {"value": str(4 + i % 9), "sub": "open items",
                "delta": ("+" if good else "-") + str(1 + i % 3), "direction": up}
    return {"value": "%d%%" % (62 + i % 30), "sub": "vs %d%% target" % (70 + i % 25),
            "delta": ("+" if good else "-") + "%d pts" % (2 + i % 7), "direction": up}


# ---------------------------------------------------------------------------
def build():
    caps = {}
    for n, (label, wtype, size) in enumerate(CAPS, start=1):
        cid = "CAP-%d" % n
        caps[cid] = {"id": cid, "label": label, "widgetType": wtype, "defaultSize": size,
                     "usedByMissions": [], "usedByPersonas": [],
                     "theme": None, "data": cap_data(n, label, wtype),
                     "metric": metric(n, wtype, (n % 3) != 1),
                     "benchmarkTargets": benchmark(n, wtype),
                     "sourceCompoundKPI": SOURCE_KPI.get(cid)}

    # mission → objective / l2 / tab, and the capability cross-references
    m2obj = {}
    for tid, t in THEMES.items():
        for oid, o in t["objectives"].items():
            for mid in o["missions"]:
                m2obj[mid] = (tid, oid)

    missions = {}
    for mid, m in MISSIONS.items():
        tid, oid = m2obj[mid]
        num = int(mid[1:])
        missions[mid] = {
            "id": mid, "name": m["name"], "owner": m["owner"], "cadence": m["cadence"],
            "tab": CADENCE_TO_TAB[m["cadence"]], "capabilities": m["capabilities"],
            "theme": tid, "objective": oid, "status": STATUS[num % len(STATUS)],
            "poweredByPatterns": [],   # inverted from patterns.json below
            "agentCoverage": (num * 7) % 10 >= 4,
            "lastAction": ACTIONS_LAST[num % len(ACTIONS_LAST)].format(n=1 + num % 6),
            "nextAction": ACTIONS_NEXT[num % len(ACTIONS_NEXT)].format(n=2 + num % 9),
        }
        for cid in m["capabilities"]:
            caps[cid]["usedByMissions"].append(mid)
            if m["owner"] not in caps[cid]["usedByPersonas"]:
                caps[cid]["usedByPersonas"].append(m["owner"])
            if caps[cid]["theme"] is None:
                caps[cid]["theme"] = tid

    # ---- invert the patterns' servingMissions into each mission's poweredByPatterns ----
    # The pattern declares what it serves; the mission never has to know about patterns.
    try:
        lib = json.load(open(PATTERNS, encoding="utf-8"))["patterns"]
        for pat in lib:
            for mid in pat.get("servingMissions", []):
                if mid in missions and pat["id"] not in missions[mid]["poweredByPatterns"]:
                    missions[mid]["poweredByPatterns"].append(pat["id"])
        for m in missions.values():
            m["poweredByPatterns"].sort()
    except Exception as e:
        print("  (poweredByPatterns inversion skipped:", e, ")")

    # personas: tabs derived from mission cadence, headline generated
    personas = []
    for pid, label, group, icon in PERSONAS:
        own = [mid for mid in sorted(missions, key=lambda x: int(x[1:]))
               if missions[mid]["owner"] == pid]
        tabs = {}
        for t in TABS:
            ms = [mid for mid in own if missions[mid]["tab"] == t["id"]]
            tabs[t["id"]] = {"missions": ms}
        capset = []
        for mid in own:
            for cid in missions[mid]["capabilities"]:
                if cid not in capset:
                    capset.append(cid)

        if pid == "cc-cfo":
            headline = ("Eight objectives, sixty missions — the strategic scorecard across the "
                        "entire finance function")
        else:
            cads = sorted({missions[m]["cadence"] for m in own}, key=CADENCE_ORDER.index)
            lo, hi = cads[0].lower(), cads[-1].lower()
            headline = "%s missions, from %s to %s" % (len(own), lo, hi)

        # ---- above-the-fold derivations ----
        on = [m for m in own if missions[m]["status"] == "on-track"]
        att = [m for m in own if missions[m]["status"] == "attention"]
        off = [m for m in own if missions[m]["status"] == "off-track"]
        auto = [m for m in own if missions[m]["agentCoverage"]]

        # 12-week "% missions on track" trend, converging on today's actual
        n_own = len(own) or 1
        today = round(len(on) / n_own * 100)
        trend = [max(20, min(100, round(today - 14 + k * (14 / 11.0) +
                 6 * math.sin(k * 1.3 + len(own))))) for k in range(12)]
        trend[-1] = today

        # headline KPIs: walk the persona's own missions Pulse-first and take the first
        # 2–4 distinct capabilities. Auto-derived — never hardcoded per persona.
        head_caps = []
        for t in TABS:
            for mid in tabs[t["id"]]["missions"]:
                for cid in missions[mid]["capabilities"]:
                    if cid not in head_caps:
                        head_caps.append(cid)
        head_caps = head_caps[:4]

        if pid == "cc-cfo":
            all_m = list(missions)
            on = [m for m in all_m if missions[m]["status"] == "on-track"]
            att = [m for m in all_m if missions[m]["status"] == "attention"]
            off = [m for m in all_m if missions[m]["status"] == "off-track"]
            auto = [m for m in all_m if missions[m]["agentCoverage"]]
            n_own = len(all_m)
            today = round(len(on) / n_own * 100)
            trend = [max(20, min(100, round(today - 12 + k * (12 / 11.0) + 5 * math.sin(k * 1.1))))
                     for k in range(12)]
            trend[-1] = today
            head_caps = []   # the CFO uses the enterprise tiles below instead

        personas.append({
            "id": pid, "label": label, "group": group, "icon": icon,
            "headline": headline,
            "health": {"onTrack": len(on), "attention": len(att), "offTrack": len(off),
                       "total": n_own, "pct": today},
            "automation": {"covered": len(auto), "total": n_own},
            "trend12": trend,
            "headlineCaps": head_caps,
            "flagged": sorted(off + att, key=lambda m: (missions[m]["status"] != "off-track", int(m[1:]))),
            "isOverview": pid == "cc-cfo",
            "overviewThemes": list(THEMES) if pid == "cc-cfo" else [],
            "missions": own,
            "missionCount": len(own),
            "capabilityCount": len(capset),
            "defaultWidgets": capset,
            "tabs": tabs,
            # the CFO owns no mission — the roll-up spans all four lenses regardless
            "activeTabs": ([t["id"] for t in TABS] if pid == "cc-cfo"
                           else [t["id"] for t in TABS if tabs[t["id"]]["missions"]]),
        })

    return {
        "meta": {"title": "Command Centre — CFO Mission-Capability Taxonomy",
                 "asOfDate": "2025-06-27",
                 # the CFO's middle stat tiles are enterprise-level, not capability-derived
                 "enterpriseKPIs": [
                     {"value": "112", "label": "TSR index", "sub": "vs peer median 100",
                      "delta": "+7.2%", "direction": "better"},
                     {"value": "94.1%", "label": "FCF conversion", "sub": "target 95%",
                      "delta": "-0.9pp", "direction": "worse"},
                     {"value": "7.4%", "label": "Cost of capital", "sub": "WACC, target 7.0%",
                      "delta": "+0.3pp", "direction": "worse"},
                     {"value": "$4.2B", "label": "Working capital", "sub": "released YTD",
                      "delta": "+$180M", "direction": "better"},
                 ],
                 "counts": {"themes": len(THEMES),
                            "objectives": sum(len(t["objectives"]) for t in THEMES.values()),
                            "missions": len(missions), "capabilities": len(caps),
                            "personas": len(personas)},
                 "tabs": TABS, "groupOrder": GROUP_ORDER},
        "themes": THEMES,
        "missions": missions,
        "capabilities": caps,
        "personas": personas,
        "cadenceToTab": CADENCE_TO_TAB,
        "themeAliases": THEME_ALIASES,
    }


def main():
    d = build()

    # ---- the taxonomy must be airtight, or the whole surface routes wrong ----
    all_m = set(d["missions"])
    expect = {"M%d" % i for i in range(1, 61)}
    if all_m != expect:
        raise SystemExit("missions must be exactly M1–M60; missing=%s extra=%s"
                         % (sorted(expect - all_m), sorted(all_m - expect)))

    # every mission belongs to exactly one L2
    seen = {}
    for tid, t in THEMES.items():
        for oid, o in t["objectives"].items():
            for mid in o["missions"]:
                if mid in seen:
                    raise SystemExit("%s appears in both %s and %s" % (mid, seen[mid], oid))
                seen[mid] = oid
    if set(seen) != expect:
        raise SystemExit("theme tree does not cover every mission: missing=%s"
                         % sorted(expect - set(seen)))

    if len(d["capabilities"]) != 77:
        raise SystemExit("expected 77 capabilities, got %d" % len(d["capabilities"]))
    orphan = [c for c, v in d["capabilities"].items() if not v["usedByMissions"]]
    if orphan:
        raise SystemExit("capabilities used by no mission: %s" % orphan)

    # every persona owns >=1 mission and lands on a real tab
    for p in d["personas"]:
        if p["id"] == "cc-cfo":
            continue
        if not p["missions"]:
            raise SystemExit("%s owns no missions" % p["id"])

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

    c = d["meta"]["counts"]
    print("Wrote %s (%d themes / %d objectives / %d missions / %d capabilities / %d personas)"
          % (os.path.relpath(OUT, ROOT), c["themes"], c["objectives"], c["missions"],
             c["capabilities"], c["personas"]))
    shared = sorted(d["capabilities"].values(), key=lambda x: -len(x["usedByMissions"]))[:3]
    for s in shared:
        print("  most-shared: %-8s %-34s %d missions, %d personas"
              % (s["id"], s["label"], len(s["usedByMissions"]), len(s["usedByPersonas"])))
    for p in d["personas"]:
        print("  %-16s %-36s %2d missions  tabs: %s"
              % (p["id"], p["headline"][:36], p["missionCount"], ",".join(p["activeTabs"])))


if __name__ == "__main__":
    main()
