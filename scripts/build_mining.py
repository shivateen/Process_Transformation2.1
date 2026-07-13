#!/usr/bin/env python3
"""
build_mining.py — Generate src/data/mining.json: Pattern Studio's "Mine" tab.

Pattern Studio = the pattern catalogue (Library tab) + the mining workshop (Mine tab).
The Mine tab is a **function-agnostic 3-step flow**:

    1 Context    what function? what objective?  (+ 2–3 clarifying questions)
    2 Documents  an AI-composed, context-specific document checklist + gap analysis
    3 Results    maturity radar · KPI vs benchmark · pattern impact bridge

Nothing here is hardcoded to Order-to-Cash. A checklist, a KPI benchmark set, a maturity
rubric and a candidate pool exist per function, and an "Other" fallback covers any domain
the SME types in free text.

IMPORTANT — no live LLM.
This accelerator is on-device and deterministic; there is no model endpoint in the bundle.
Everything the UI calls "AI-generated" is *derived*, not invented:
  · the document checklist is selected by function and re-prioritised by objective keywords
  · the clarifying questions are the ones that actually change the checklist
  · maturity is scored from which document categories the SME actually uploaded
  · KPI gaps are read from the benchmark table
  · candidates surface only when the corpus carries the evidence their chain depends on,
    and are ranked by which KPI gap they close
`fewShotPrompt` is the exact prompt a real extractor would receive, rendered verbatim in the
UI. The seam to a live model is one function wide — see PIQ.patternStudio.mine() in library.js.

  python scripts/build_mining.py
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATTERNS = os.path.join(ROOT, "src", "data", "patterns.json")
CC = os.path.join(ROOT, "src", "data", "command_centre.json")
OUT = os.path.join(ROOT, "src", "data", "mining.json")

XL = [".xlsx", ".csv"]
DOC = [".pdf", ".docx"]
ANY = [".pdf", ".xlsx", ".csv", ".docx", ".txt", ".json", ".xml"]

CRIT, ENR, SUP = "critical", "enriching", "supporting"

FUNCTIONS = [
    {"id": "o2c", "label": "Order to Cash", "icon": "🧾"},
    {"id": "p2p", "label": "Procure to Pay", "icon": "📦"},
    {"id": "r2r", "label": "Record to Report", "icon": "📊"},
    {"id": "sc", "label": "Supply Chain", "icon": "🚚"},
    {"id": "h2r", "label": "Hire to Retire", "icon": "👥"},
    {"id": "tcm", "label": "Treasury & Cash", "icon": "🏦"},
    {"id": "tax", "label": "Tax Management", "icon": "⚖️"},
    {"id": "tne", "label": "Travel & Expense", "icon": "✈️"},
    {"id": "fpa", "label": "Financial Planning & Analysis", "icon": "📈"},
    {"id": "icc", "label": "Internal Controls & Compliance", "icon": "🛡️"},
]


def cat(cid, label, priority, dim, slots):
    """A checklist category. `dim` is the maturity dimension it feeds."""
    return {"id": cid, "label": label, "priority": priority, "dimension": dim, "slots": slots}


def slot(sid, label, hint, formats):
    return {"id": sid, "label": label, "hint": hint, "formats": formats}


# ---------------------------------------------------------------------------
# The five maturity dimensions — scored from what the corpus actually contains
# ---------------------------------------------------------------------------
DIMENSIONS = [
    {"id": "process", "label": "Process Standardization", "benchmark": 4.2,
     "probe": "are processes documented, standardized, and actually followed?"},
    {"id": "data", "label": "Data & Analytics Maturity", "benchmark": 4.0,
     "probe": "are KPIs tracked, automated, predictive — or hand-compiled?"},
    {"id": "tech", "label": "Technology Enablement", "benchmark": 4.1,
     "probe": "ERP, automation, workflow and integration maturity."},
    {"id": "people", "label": "People & Organization", "benchmark": 3.9,
     "probe": "skills, team shape, single-person dependencies."},
    {"id": "governance", "label": "Governance & Controls", "benchmark": 4.3,
     "probe": "SOX, segregation of duties, control monitoring, audit readiness."},
]

# Evidence rules: what a category's presence (or absence) *tells you* about a dimension.
# Deterministic, and auditable — this is why a score is what it is.
EVIDENCE = {
    "process":   {"present": "process documentation found — steps and owners are traceable",
                  "absent": "no process documentation uploaded — steps and owners are unverifiable"},
    "data":      {"present": "KPI/analytics exports present — metrics exist, though compiled manually",
                  "absent": "no KPI or analytics exports — the function is flying on gut feel"},
    "tech":      {"present": "system exports present — the ERP is emitting usable event data",
                  "absent": "no system/ERP exports — automation potential cannot be assessed"},
    "people":    {"present": "org/RACI evidence present — accountability is at least declared",
                  "absent": "no org or RACI evidence — accountability gaps are invisible"},
    "governance": {"present": "control/audit evidence present — the control set is documented",
                   "absent": "no control or audit evidence — SOX and SoD posture is unknown"},
}


# ---------------------------------------------------------------------------
# Per-function document checklists (AI-composed in the UI; authored here)
# ---------------------------------------------------------------------------
def checklists():
    return {
        "o2c": [
            cat("txn", "Transactional Evidence", CRIT, "tech", [
                slot("exception-logs", "Exception logs",
                     "Blocked invoices, failed postings, held orders, credit check failures", [".xlsx", ".csv", ".json"]),
                slot("aging-notes", "Aging reports with collector notes",
                     "The freetext fields — where the real story lives", XL),
                slot("dispute-logs", "Dispute / deduction logs",
                     "Reason codes and resolution narratives", [".xlsx", ".csv", ".pdf"]),
                slot("payment-history", "Payment history / remittance",
                     "Timing patterns, partial payments, broken promises", XL),
                slot("credit-memos", "Credit memos & write-offs",
                     "What was given up on, and why", [".xlsx", ".csv", ".pdf"])]),
            cat("policy", "Process & Policy", CRIT, "process", [
                slot("process-docs", "Process documentation", "SOPs, work instructions, L3/L4 maps", [".pdf", ".docx", ".xlsx"]),
                slot("credit-policy", "Credit / collections policy",
                     "Limits, review triggers, approval matrices, dunning playbooks", DOC),
                slot("escalation", "Escalation protocols", "When and how issues move up the chain", DOC),
                slot("writeoff-policy", "Write-off & bad debt policy", "Thresholds, approval flows, provisioning", DOC)]),
            cat("analytics", "Operational Analytics", ENR, "data", [
                slot("kpi-reports", "KPI reports / dashboards", "DSO, CEI, dispute cycle — exported snapshots", [".xlsx", ".csv", ".pdf"]),
                slot("process-mining", "Process mining exports", "Celonis, Signavio — event logs, variant analysis", [".csv", ".xlsx", ".json", ".xml"]),
                slot("cycle-time", "Cycle time / touch-count", "How long, and how many humans, per invoice", XL)]),
            cat("org", "Organization & Behaviour", ENR, "people", [
                slot("raci", "RACI matrix", "Who is responsible, accountable, consulted, informed", [".xlsx", ".pdf", ".docx"]),
                slot("scorecards", "Collector scorecards", "What behaviour is actually incentivised", [".xlsx", ".pdf"]),
                slot("call-logs", "Call logs / dunning history", "The conversation around the invoice", [".xlsx", ".csv", ".pdf"])]),
            cat("control", "Control & Compliance", SUP, "governance", [
                slot("sox", "SOX control narratives", "Control descriptions and test results", [".pdf", ".docx", ".xlsx"]),
                slot("audit", "Internal audit reports", "Findings and management responses", DOC),
                slot("sod", "Segregation-of-duty matrix", "Who cannot do what together", [".xlsx", ".pdf"])]),
        ],
        "p2p": [
            cat("txn", "Transactional Evidence", CRIT, "tech", [
                slot("exception-logs", "Invoice exception / block logs",
                     "Price, quantity and GR/IR blocks — where invoices stall", [".xlsx", ".csv", ".json"]),
                slot("po-history", "PO history with lead times", "Order-to-receipt timing per supplier", XL),
                slot("payment-history", "Payment run history", "Early payments, missed discounts, duplicates", XL),
                slot("maverick", "Off-contract / maverick spend", "Spend that bypassed the negotiated rate", XL)]),
            cat("policy", "Process & Policy", CRIT, "process", [
                slot("process-docs", "P2P process documentation", "Requisition-to-payment SOPs", [".pdf", ".docx", ".xlsx"]),
                slot("doa", "Delegation of authority matrix", "Approval thresholds by role and value", [".xlsx", ".pdf"]),
                slot("payment-policy", "Payment terms policy", "Standard terms, discount capture rules", DOC)]),
            cat("analytics", "Operational Analytics", ENR, "data", [
                slot("kpi-reports", "AP KPI reports", "DPO, touchless rate, cost per invoice", [".xlsx", ".csv", ".pdf"]),
                slot("supplier-perf", "Supplier performance (OTIF)", "Delivery reliability by vendor", XL)]),
            cat("org", "Organization & Behaviour", ENR, "people", [
                slot("raci", "RACI matrix", "Buyer, approver, receiver accountability", [".xlsx", ".pdf", ".docx"]),
                slot("vendor-master", "Vendor master data", "Duplicates, dormant vendors, bank-detail changes", XL)]),
            cat("control", "Control & Compliance", SUP, "governance", [
                slot("sod", "Segregation-of-duty matrix", "Vendor creation vs payment release", [".xlsx", ".pdf"]),
                slot("audit", "Internal audit reports", "Findings on procurement controls", DOC)]),
        ],
        "r2r": [
            cat("txn", "Close Evidence", CRIT, "tech", [
                slot("close-checklist", "Close task checklist", "With actual vs planned completion times", XL),
                slot("je-logs", "Journal entry logs", "Manual vs recurring vs automated", XL),
                slot("recon-status", "Reconciliation status tracker", "All subledgers, with aging", XL),
                slot("ic-balances", "Intercompany balance reports", "Last 3 close cycles, with mismatches", XL)]),
            cat("policy", "Process & Policy", CRIT, "process", [
                slot("close-calendar", "Close calendar / dependency map", "What blocks what", [".pdf", ".xlsx", ".docx"]),
                slot("accrual-policy", "Accrual & provisioning policy", "Thresholds, reversal rules", DOC),
                slot("process-docs", "Close process documentation", "Task-level SOPs", [".pdf", ".docx", ".xlsx"])]),
            cat("analytics", "Operational Analytics", ENR, "data", [
                slot("kpi-reports", "Close KPI reports", "Days to close, entries per FTE, error rate", [".xlsx", ".csv", ".pdf"]),
                slot("flux", "Flux / variance analysis", "What moved, and the explanations given", [".xlsx", ".pdf"])]),
            cat("org", "Organization & Behaviour", ENR, "people", [
                slot("raci", "RACI for close activities", "Preparer, reviewer, approver per task", [".xlsx", ".pdf", ".docx"]),
                slot("suspense", "Suspense / clearing balances", "What nobody owns", XL)]),
            cat("control", "Control & Compliance", SUP, "governance", [
                slot("sox", "SOX control narratives", "Close controls and test results", [".pdf", ".docx", ".xlsx"]),
                slot("audit", "External audit findings", "PBC lists, adjustments, management letters", DOC)]),
        ],
        "sc": [
            cat("txn", "Inventory & Demand Signal", CRIT, "tech", [
                slot("stock-levels", "Stock level snapshots", "Weekly/monthly exports by SKU and site", XL),
                slot("forecast-actuals", "Demand forecast vs actuals", "Where the plan and the world diverged", XL),
                slot("stockout-logs", "Stockout / excess inventory logs", "Both tails of the distribution", [".xlsx", ".csv", ".json"]),
                slot("safety-stock", "Safety stock parameter tables", "The buffers, and who set them", XL)]),
            cat("procure", "Procurement & Replenishment", CRIT, "process", [
                slot("po-leadtime", "Purchase order history with lead times", "Promised vs actual receipt", XL),
                slot("otif", "Supplier delivery performance (OTIF)", "Reliability by vendor and lane", XL),
                slot("mrp", "MRP exception messages", "The reschedule-in/out noise nobody reads", [".csv", ".xlsx", ".json"])]),
            cat("warehouse", "Warehouse & Logistics", ENR, "data", [
                slot("movement-logs", "Warehouse movement logs", "SAP MB51/MB52 — what actually moved", XL),
                slot("cycle-count", "Cycle count accuracy reports", "Real stockouts vs data errors", XL)]),
            cat("planning", "Planning Process & Governance", ENR, "people", [
                slot("sop-minutes", "S&OP meeting minutes / decision logs", "Planning overrides and demand bias", [".pdf", ".docx", ".txt"]),
                slot("raci", "Planning RACI", "Who owns the forecast number", [".xlsx", ".pdf", ".docx"])]),
            cat("financial", "Financial Impact", SUP, "governance", [
                slot("carrying-cost", "Carrying cost / obsolescence reports", "What the inventory is costing you", [".xlsx", ".csv", ".pdf"])]),
        ],
    }


GENERIC = [
    cat("txn", "Transactional Evidence", CRIT, "tech", [
        slot("exception-logs", "Exception & error logs", "Where the process stalls, fails or gets held", [".xlsx", ".csv", ".json"]),
        slot("txn-extract", "Transaction extract", "The event-level record — one row per case", XL),
        slot("cycle-time", "Cycle time / touch-count report", "How long, and how many humans, per case", XL)]),
    cat("policy", "Process & Policy", CRIT, "process", [
        slot("process-docs", "Process documentation", "SOPs, work instructions, process maps", [".pdf", ".docx", ".xlsx"]),
        slot("policy", "Policy & approval matrix", "Thresholds, triggers, who signs what", DOC),
        slot("escalation", "Escalation protocol", "When and how issues move up", DOC)]),
    cat("analytics", "Operational Analytics", ENR, "data", [
        slot("kpi-reports", "KPI reports / dashboards", "Whatever you measure today", [".xlsx", ".csv", ".pdf"]),
        slot("rca", "Root cause analyses", "Past improvement work — what it found", [".pdf", ".docx", ".xlsx"])]),
    cat("org", "Organization & Behaviour", ENR, "people", [
        slot("raci", "RACI matrix", "Who is responsible, accountable, consulted, informed", [".xlsx", ".pdf", ".docx"]),
        slot("scorecards", "Performance scorecards", "What behaviour is incentivised", [".xlsx", ".pdf"])]),
    cat("control", "Control & Compliance", SUP, "governance", [
        slot("audit", "Audit findings", "Internal or external, with management responses", DOC),
        slot("sod", "Segregation-of-duty matrix", "Who cannot do what together", [".xlsx", ".pdf"])]),
]


# ---------------------------------------------------------------------------
# Clarifying questions — only the ones that actually change the checklist or the read
# ---------------------------------------------------------------------------
def clarifiers():
    erp = {"id": "erp", "q": "Which ERP is this running on? It changes the report names we ask for.",
           "options": ["SAP", "Oracle", "Workday / other", "Multiple / mixed"]}
    scope = {"id": "scope", "q": "Single-site or multi-site operation?",
             "options": ["Single site", "Multi-site, one region", "Multi-site, global"]}
    return {
        "o2c": [erp,
                {"id": "driver", "q": "What is the primary driver of the delay you are seeing?",
                 "options": ["Customer payment behaviour", "Internal dispute handling", "Cash application / matching", "Not sure — that's what I want to find out"]},
                scope],
        "p2p": [erp,
                {"id": "driver", "q": "Where does the pain concentrate?",
                 "options": ["Invoice exceptions and blocks", "Approval bottlenecks", "Maverick / off-contract spend", "Not sure yet"]},
                scope],
        "r2r": [erp,
                {"id": "driver", "q": "Which part of the close is the critical path?",
                 "options": ["Intercompany reconciliation", "Accruals and provisions", "Subledger reconciliation", "Reporting and consolidation"]},
                scope],
        "sc": [erp,
               {"id": "driver", "q": "Is the primary driver excess stock, slow-moving inventory, or high storage cost?",
                "options": ["Excess stock / over-ordering", "Slow-moving and obsolete", "Storage and handling cost", "Stockouts — the opposite problem"]},
               scope],
        "_default": [erp,
                     {"id": "driver", "q": "What do you believe is driving the problem today?",
                      "options": ["Process variation", "Data quality", "Manual effort / handoffs", "Not sure — that's what I want to find out"]},
                     scope],
    }


# ---------------------------------------------------------------------------
# KPI benchmark sets per function (APQC / Hackett-style ranges)
# ---------------------------------------------------------------------------
def K(name, unit, client, median, top, lower_is_better):
    return {"name": name, "unit": unit, "client": client, "median": median,
            "topQuartile": top, "lowerIsBetter": lower_is_better}


def kpis():
    return {
        "o2c": [
            K("DSO", "days", 58, 45, 38, True),
            K("Collection Effectiveness Index", "%", 74, 85, 92, False),
            K("Dispute Cycle Time", "days", 25, 14, 8, True),
            K("Cash Auto-Match Rate", "%", 62, 80, 92, False),
            K("Bad Debt / Revenue", "%", 1.8, 0.8, 0.3, True),
            K("Cost per Invoice", "$", 4.1, 2.2, 1.2, True),
        ],
        "p2p": [
            K("DPO", "days", 34, 45, 58, False),
            K("Touchless Invoice Rate", "%", 41, 68, 85, False),
            K("Early Payment Discount Capture", "%", 38, 70, 88, False),
            K("Invoice Exception Rate", "%", 18, 9, 4, True),
            K("Maverick Spend", "%", 22, 10, 4, True),
            K("Cost per Invoice", "$", 6.8, 3.4, 1.8, True),
        ],
        "r2r": [
            K("Days to Close", "days", 10, 6, 4, True),
            K("Manual Journal Entries", "%", 46, 25, 12, True),
            K("Reconciliations Auto-Certified", "%", 38, 65, 85, False),
            K("Post-Close Adjustments", "count", 14, 6, 2, True),
            K("Intercompany Match Rate", "%", 71, 88, 96, False),
            K("Cost of Finance / Revenue", "%", 1.4, 0.9, 0.6, True),
        ],
        "sc": [
            K("Inventory Turns", "x", 6.2, 8.5, 11.0, False),
            K("DIO", "days", 58, 42, 32, True),
            K("Stockout Rate", "%", 4.8, 1.5, 0.6, True),
            K("Forecast Accuracy", "%", 72, 88, 94, False),
            K("Obsolescence Rate", "%", 3.1, 1.0, 0.4, True),
            K("Supplier OTIF", "%", 84, 95, 98, False),
            K("Carrying Cost / Revenue", "%", 8.2, 4.5, 2.8, True),
        ],
        "_default": [
            K("Cycle Time", "days", 12, 7, 4, True),
            K("Straight-Through Rate", "%", 44, 70, 88, False),
            K("Exception Rate", "%", 17, 8, 3, True),
            K("Cost per Transaction", "$", 5.2, 2.8, 1.4, True),
            K("First-Time-Right", "%", 78, 92, 97, False),
        ],
    }


# ---------------------------------------------------------------------------
# "I have an objective" → Transformation Blueprint (matched on keywords)
# ---------------------------------------------------------------------------
def blueprints():
    return [
        {"id": "close", "match": ["close", "consolidat", "month-end", "period-end"],
         "function": "r2r", "title": "Close cycle reduction",
         "focus": "Intercompany reconciliation + accruals automation",
         "clusters": [
             {"name": "Intercompany Reconciliation Delays",
              "patterns": "Matching failures, balance discrepancies, late confirmations",
              "docs": [("Intercompany balance reports (last 3 cycles)", CRIT),
                       ("IC matching exception logs", CRIT),
                       ("IC invoice and settlement timelines", ENR)]},
             {"name": "Accrual Accuracy & Reversal",
              "patterns": "Stale accruals, reversal timing drift, manual top-ups",
              "docs": [("Accrual schedules with aging", CRIT),
                       ("Journal entry logs (recurring + manual)", CRIT),
                       ("Prior period adjustment history", ENR)]},
             {"name": "Subledger Reconciliation Bottlenecks",
              "patterns": "Unowned suspense balances, serial reconciliation",
              "docs": [("Reconciliation status tracker (all subledgers)", CRIT),
                       ("Suspense / clearing account balances", ENR),
                       ("Close task checklist with actual completion times", CRIT)]},
             {"name": "Process & People Bottlenecks",
              "patterns": "Single-person dependencies, serialised task chains",
              "docs": [("Close calendar / task dependency map", ENR),
                       ("RACI for close activities", ENR)]},
         ]},
        {"id": "dso", "match": ["dso", "collect", "receivable", "cash convers", "days sales"],
         "function": "o2c", "title": "DSO reduction",
         "focus": "Collections behaviour + dispute cycle + cash application",
         "clusters": [
             {"name": "Customer Payment Behaviour",
              "patterns": "Stalling tactics, broken promises, term creep",
              "docs": [("Aging reports with collector notes", CRIT),
                       ("Payment history / remittance", CRIT),
                       ("Dunning history", ENR)]},
             {"name": "Dispute & Deduction Friction",
              "patterns": "Dispute-timing gaming, reason-code rotation",
              "docs": [("Dispute / deduction logs", CRIT),
                       ("Credit memos & write-offs", ENR)]},
             {"name": "Cash Application Drag",
              "patterns": "Remittance format churn, unapplied cash ageing",
              "docs": [("Cash application exception logs", CRIT),
                       ("Remittance advice samples", ENR)]},
             {"name": "Credit Policy & Control",
              "patterns": "Limit overrides, sub-threshold approvals",
              "docs": [("Credit / collections policy", ENR),
                       ("Credit limit override log", SUP)]},
         ]},
        {"id": "inventory", "match": ["inventory", "carrying cost", "stock", "working capital", "dio"],
         "function": "sc", "title": "Inventory carrying-cost reduction",
         "focus": "Demand signal quality + replenishment discipline",
         "clusters": [
             {"name": "Demand Signal Distortion",
              "patterns": "Forecast override bias, planner second-guessing",
              "docs": [("Demand forecast vs actuals", CRIT),
                       ("S&OP meeting minutes / decision logs", ENR)]},
             {"name": "Slow-Moving & Obsolete Stock",
              "patterns": "Slow-moving creep, write-off avoidance",
              "docs": [("Stock level snapshots (by SKU, aged)", CRIT),
                       ("Carrying cost / obsolescence reports", ENR)]},
             {"name": "Replenishment & Supplier Reliability",
              "patterns": "Lead-time drift, safety-stock inflation",
              "docs": [("Purchase order history with lead times", CRIT),
                       ("Supplier delivery performance (OTIF)", CRIT),
                       ("Safety stock parameter tables", ENR)]},
             {"name": "Inventory Data Integrity",
              "patterns": "Phantom stock, cycle-count masking",
              "docs": [("Warehouse movement logs", ENR),
                       ("Cycle count accuracy reports", SUP)]},
         ]},
        {"id": "spend", "match": ["spend", "procure", "supplier", "payable", "dpo", "maverick"],
         "function": "p2p", "title": "Procurement leakage reduction",
         "focus": "Contract compliance + invoice exception elimination",
         "clusters": [
             {"name": "Off-Contract Spend",
              "patterns": "Maverick buying, threshold splitting",
              "docs": [("Off-contract / maverick spend report", CRIT),
                       ("PO history with lead times", CRIT)]},
             {"name": "Invoice Exception Churn",
              "patterns": "Recurring price/quantity blocks, GR/IR ageing",
              "docs": [("Invoice exception / block logs", CRIT),
                       ("Vendor master data", ENR)]},
             {"name": "Approval Bottlenecks",
              "patterns": "Sub-threshold approvals, serial routing",
              "docs": [("Delegation of authority matrix", ENR),
                       ("Approval cycle time report", ENR)]},
         ]},
    ]


# ---------------------------------------------------------------------------
# Candidate patterns, per function. Each is a full pattern structure (same shape as
# patterns.json, in Process Flow / Action Block / Executor vocabulary) plus the mining
# metadata: `requires` (checklist categories), `evidence`, `confidence`, `similarTo`,
# `servingMissions` / `servingThemes`, and `closesKpi` (which KPI gap it closes).
# ---------------------------------------------------------------------------
def C(cid, fn, name, slug, category, prio, requires, conf, similar, closes,
      themes, missions, mental, flow, branches, gates, evidence, signals, dims, impact):
    return {
        "cid": cid, "function": fn, "name": name, "featureSlug": slug,
        "category": category, "priority": prio,
        "mentalModel": mental,
        "processFlow": flow, "branchingFlow": branches, "hitlGates": gates,
        "requires": requires, "confidence": conf, "similarTo": similar,
        "closesKpi": closes, "estImpact": impact,
        "servingThemes": themes, "servingMissions": missions,
        "evidence": evidence, "signals": signals, "dimensions": dims,
    }


def B(tier, blocks, executors, hitl, condition):
    return {"tier": tier, "condition": condition, "actionBlocks": blocks,
            "executors": executors, "hitl": hitl}


def candidates():
    return [
        # ---------------- Order to Cash ----------------
        C("CAND-A", "o2c", "Seasonal Treasury Squeeze", "seasonal-treasury-squeeze",
          "Intentional Stalling & Delay Tactics", "High", ["txn", "analytics"], 0.86, None,
          "DSO", ["C"], ["M19", "M22"],
          "They pay us fine for ten months, then quarter-end lands and suddenly everyone is 'awaiting approval'. It is not distress — it is their treasury calendar, and we are the float.",
          ["Ingest_Invoice", "Map_Customer_Fiscal_Calendar", "Compute_Quarter_End_Skew", "Flag_Seasonal_Delay", "Pre_Dun_Ahead_Of_Window"],
          [B("primary", ["Shift_Dunning_Earlier", "Notify_Collector"], ["Agent", "Workflow"], None,
             "IF Skew > 9 days AND Payment_History_Otherwise_Clean"),
           B("escalation", ["Propose_Term_Renegotiation", "Alert_Treasury"], ["Agent", "Human Task"], "Credit Manager approval",
             "IF Skew > 20 days AND Exposure > $500K"),
           B("immediate", ["Escalate_To_Credit_Review"], ["Human Task"], "CFO review",
             "IF Skew rising QoQ for 3 quarters")],
          ["Credit Manager approval", "CFO review"],
          [{"slot": "aging-notes", "excerpt": "\"Customer AP confirms invoice approved — payment run moved to next quarter per their treasury policy.\" (recurs 34× across Q1–Q3 notes)"},
           {"slot": "exception-logs", "excerpt": "142 held/late events cluster in the final 10 days of Mar / Jun / Sep — 3.1× the base rate."},
           {"slot": "cycle-time", "excerpt": "Days-to-pay rises from 41 to 58 in quarter-end weeks, then reverts."}],
          ["quarter-end delay cluster", "AP-approved-but-unpaid narrative", "days-to-pay seasonality"],
          ["data", "process"], "-6 DSO days · $1.4M working capital released"),

        C("CAND-B", "o2c", "Remittance Format Churn", "remittance-format-churn",
          "Cash Application & Matching Integrity", "Medium", ["txn"], 0.81,
          {"id": 25, "name": "Duplicate Payment Bait", "score": 0.41},
          "Cash Auto-Match Rate", ["C", "G"], ["M43", "M19"],
          "Every month the remittance file looks different. Not corrupt — different. Enough to break auto-match and buy them a week of float while we key it by hand.",
          ["Ingest_Remittance", "Hash_Schema", "Compare_To_Prior_Schema", "Detect_Churn", "Route_To_Manual_Match"],
          [B("primary", ["Pin_Parser_Template", "Notify_Cash_App_Lead"], ["Script", "Workflow"], None,
             "IF Schema_Variants >= 3 AND Auto_Match_Rate < 40%"),
           B("escalation", ["Request_Standard_Remittance", "Escalate_To_AR_Manager"], ["Agent", "Human Task"], "AR Manager approval",
             "IF Churn persists 3 months AND Unapplied > $250K")],
          ["AR Manager approval"],
          [{"slot": "payment-history", "excerpt": "4 payers account for 61% of auto-match failures; each shows ≥3 distinct remittance layouts in 6 months."},
           {"slot": "exception-logs", "excerpt": "214 unapplied cash lines, 88% traced to remittance parse failure rather than payment shortfall."}],
          ["remittance schema variants", "auto-match failure concentration", "unapplied cash ageing"],
          ["tech", "data"], "+18pp auto-match · 1.2 FTE released"),

        C("CAND-C", "o2c", "Approval Threshold Shadowing", "approval-threshold-shadowing",
          "Cross-Process AR Governance", "Critical", ["policy", "control"], 0.88,
          {"id": 64, "name": "Threshold Splitting", "score": 0.74},
          "Bad Debt / Revenue", ["H", "G"], ["M53", "M54"],
          "Nobody breaks the approval rule. They just never quite reach it. Every credit memo lands a few hundred dollars under the line that would have sent it to me.",
          ["Ingest_Credit_Memo", "Load_Approval_Matrix", "Compute_Threshold_Distance", "Detect_Sub_Threshold_Cluster", "Hold_For_Second_Signature"],
          [B("primary", ["Flag_For_Review", "Log_Control_Event"], ["Agent", "Script"], "Controller review",
             "IF Amount within 10% below threshold AND Approver_Repeat_Count > 5"),
           B("immediate", ["Freeze_Memo", "Escalate_To_Compliance"], ["Workflow", "Human Task"], "CRO approval",
             "IF Cluster spans multiple approvers on one customer")],
          ["Controller review", "CRO approval"],
          [{"slot": "writeoff-policy", "excerpt": "\"Credit memos above $25,000 require Controller counter-signature.\" (Write-off policy v4.2, §3.1)"},
           {"slot": "audit", "excerpt": "Internal audit FY24-07: \"a material share of memos fall in the $22.5K–$25K band; management response pending.\""},
           {"slot": "sod", "excerpt": "2 credit analysts hold both memo-raise and memo-approve rights."}],
          ["documented approval threshold", "sub-threshold amount cluster", "SoD conflict"],
          ["governance", "process"], "-0.6pp bad debt · 2 SoD conflicts closed"),

        C("CAND-D", "o2c", "Escalation Dead-Zone", "escalation-dead-zone",
          "Intentional Stalling & Delay Tactics", "High", ["policy", "org"], 0.79, None,
          "Collection Effectiveness Index", ["C"], ["M19"],
          "The playbook says escalate at day 45. The collectors escalate at day 70. That 25-day gap is where the money goes quiet — and nobody owns it.",
          ["Ingest_Dunning_Event", "Load_Escalation_Protocol", "Compute_Policy_Lag", "Detect_Dead_Zone", "Auto_Escalate_At_Policy_Trigger"],
          [B("primary", ["Auto_Escalate", "Notify_Collections_Manager"], ["Agent", "Workflow"], None,
             "IF Lag > 14 days AND Balance > $50K"),
           B("escalation", ["Immediate_Escalation", "Credit_Hold"], ["Agent", "Human Task"], "Collections Manager approval",
             "IF Lag > 30 days AND Customer_On_Watchlist")],
          ["Collections Manager approval"],
          [{"slot": "escalation", "excerpt": "\"Accounts 45 days past due are escalated to the Collections Manager.\" (Escalation protocol, §2)"},
           {"slot": "call-logs", "excerpt": "Median first manager-level contact occurs at day 70; 210 accounts sat 45–70 days with no logged action."}],
          ["documented escalation trigger", "observed escalation day", "post-dunning silence window"],
          ["process", "people"], "+9pp CEI · 210 accounts recovered to cycle"),

        # ---------------- Supply Chain ----------------
        C("CAND-E", "sc", "Demand Forecast Override Bias", "demand-forecast-override-bias",
          "Planning Integrity", "Critical", ["txn", "planning"], 0.89, None,
          "Forecast Accuracy", ["C"], ["M18", "M13"],
          "The statistical forecast was fine. Then a planner nudged it up 'to be safe', every month, in the same direction. The bias is not in the model — it is in the override.",
          ["Ingest_Statistical_Forecast", "Ingest_Final_Forecast", "Compute_Override_Delta", "Detect_Directional_Bias", "Surface_To_SOP"],
          [B("primary", ["Flag_Biased_Override", "Notify_Demand_Planner"], ["Agent", "Workflow"], None,
             "IF Override_Delta positive in >70% of periods"),
           B("escalation", ["Lock_Statistical_Baseline", "Require_Override_Justification"], ["Script", "Human Task"], "S&OP lead approval",
             "IF Bias persists 2 quarters AND MAPE worsens")],
          ["S&OP lead approval"],
          [{"slot": "forecast-actuals", "excerpt": "Final forecast exceeds statistical baseline in 11 of 14 months; mean override +8.4%, and actuals land below both."},
           {"slot": "sop-minutes", "excerpt": "\"Agreed to hold the higher number to protect service level.\" (recurs in 6 of 9 S&OP minutes)"},
           {"slot": "safety-stock", "excerpt": "Safety stock parameters revised upward twice, never downward."}],
          ["override direction bias", "MAPE vs baseline", "S&OP justification language"],
          ["data", "people"], "+8pp forecast accuracy → -5 DIO days"),

        C("CAND-F", "sc", "Slow-Moving Inventory Creep", "slow-moving-inventory-creep",
          "Inventory Productivity", "High", ["txn", "warehouse"], 0.84, None,
          "Obsolescence Rate", ["C", "B"], ["M18", "M14"],
          "Nothing is ever declared obsolete. It just gets quietly older, one reclassification at a time, until it is written off in a year nobody is accountable for.",
          ["Ingest_Stock_Aging", "Compute_Movement_Velocity", "Detect_Zero_Movement_Cohort", "Estimate_Obsolescence_Exposure", "Propose_Disposition"],
          [B("primary", ["Flag_Slow_Mover", "Propose_Markdown"], ["Agent", "Agent"], None,
             "IF Zero movement 90+ days AND Value > $25K"),
           B("escalation", ["Trigger_Write_Down_Review", "Notify_Controller"], ["Workflow", "Human Task"], "Controller approval",
             "IF Zero movement 180+ days OR Cohort > $500K")],
          ["Controller approval"],
          [{"slot": "stock-levels", "excerpt": "22% of SKUs show no movement in 90+ days, carrying $4.1M at standard cost."},
           {"slot": "movement-logs", "excerpt": "MB51 shows 340 SKUs with zero goods issues in 6 months, yet still replenished by MRP."}],
          ["zero-movement cohort", "replenishment despite no demand", "write-off deferral"],
          ["data", "governance"], "-1.5pp obsolescence · $2.1M inventory reduction"),

        C("CAND-G", "sc", "Supplier Lead-Time Drift", "supplier-lead-time-drift",
          "Replenishment Reliability", "High", ["procure"], 0.82, None,
          "Supplier OTIF", ["C"], ["M18", "M20"],
          "The master data says the lead time is 14 days. It has actually been 23 for a year. We are not carrying safety stock for demand volatility — we are carrying it for a supplier nobody re-baselined.",
          ["Ingest_PO_History", "Compute_Actual_Lead_Time", "Compare_To_Master_Data", "Detect_Drift", "Propose_Reparameterisation"],
          [B("primary", ["Update_Lead_Time_Master", "Recompute_Safety_Stock"], ["Script", "Agent"], None,
             "IF Actual_LT exceeds Master_LT by >30% for 3 months"),
           B("escalation", ["Open_Supplier_Review", "Flag_For_Resourcing"], ["Workflow", "Human Task"], "Procurement lead approval",
             "IF OTIF < 85% AND Spend > $1M")],
          ["Procurement lead approval"],
          [{"slot": "po-leadtime", "excerpt": "Mean actual lead time 23.4 days against a master-data value of 14; drift stable for 12 months."},
           {"slot": "otif", "excerpt": "OTIF 84% overall; the 6 worst suppliers account for 71% of the misses."}],
          ["lead-time drift", "OTIF concentration", "safety-stock inflation"],
          ["tech", "process"], "-12 days safety stock · $1.8M working capital release"),

        # ---------------- Record to Report ----------------
        C("CAND-H", "r2r", "Intercompany Confirmation Lag", "intercompany-confirmation-lag",
          "Close Acceleration", "Critical", ["txn", "policy"], 0.87, None,
          "Days to Close", ["G"], ["M44", "M51"],
          "Both sides booked it. Neither side confirmed it. The close waits five days for two people to agree on a number they both already know.",
          ["Ingest_IC_Balances", "Match_Counterparty_Pairs", "Detect_Unconfirmed_Aged", "Auto_Confirm_Within_Tolerance", "Escalate_Residual"],
          [B("primary", ["Auto_Confirm_Match", "Post_Elimination"], ["Script", "Agent"], None,
             "IF Variance < tolerance AND Both_Sides_Booked"),
           B("escalation", ["Notify_Both_Controllers", "Open_Dispute_Case"], ["Workflow", "Human Task"], "Group Controller review",
             "IF Variance > tolerance OR Aged > 2 cycles")],
          ["Group Controller review"],
          [{"slot": "ic-balances", "excerpt": "3 mismatches open at D+2 across the EMEA/APAC leg; 61% of IC pairs sit within a 0.5% tolerance band yet remain unconfirmed."},
           {"slot": "close-checklist", "excerpt": "IC elimination is on the critical path in all 3 sampled cycles, slipping D+2 → D+3."}],
          ["unconfirmed-but-matched pairs", "critical path recurrence", "tolerance band"],
          ["process", "tech"], "-1.5 days to close"),

        C("CAND-I", "r2r", "Stale Accrual Carry-Forward", "stale-accrual-carry-forward",
          "Close Acceleration", "High", ["txn"], 0.83,
          {"id": 64, "name": "Threshold Splitting", "score": 0.33},
          "Manual Journal Entries", ["G", "H"], ["M44", "M51"],
          "The accrual was raised for a reason that expired two quarters ago. It rolls forward every month because reversing it is somebody's job and nobody's priority.",
          ["Ingest_Accrual_Schedule", "Age_Accruals", "Match_To_Original_Trigger", "Detect_Expired_Basis", "Propose_Reversal"],
          [B("primary", ["Flag_Stale_Accrual", "Draft_Reversal_Entry"], ["Agent", "Agent"], None,
             "IF Accrual age > 2 periods AND Trigger_Event_Closed"),
           B("escalation", ["Hold_For_Review", "Notify_Controller"], ["Workflow", "Human Task"], "Controller review",
             "IF Value > materiality OR Basis_Unclear")],
          ["Controller review"],
          [{"slot": "je-logs", "excerpt": "46% of journal entries are manual; 118 recur monthly with an identical description and value."},
           {"slot": "recon-status", "excerpt": "Accrual accounts carry 31 items aged beyond 2 periods, none with a documented reversal trigger."}],
          ["recurring identical entries", "accrual ageing", "missing reversal trigger"],
          ["process", "governance"], "-19pp manual JEs · -0.8 days to close"),

        # ---------------- Procure to Pay ----------------
        C("CAND-J", "p2p", "Threshold-Split Requisitioning", "threshold-split-requisitioning",
          "Spend Control", "Critical", ["txn", "policy"], 0.86,
          {"id": 64, "name": "Threshold Splitting", "score": 0.79},
          "Maverick Spend", ["H", "B"], ["M53", "M42"],
          "Two requisitions, same vendor, same day, each just under the approval line. It is not fraud — it is a buyer routing around a control they find inconvenient.",
          ["Ingest_Requisition", "Load_DoA_Matrix", "Cluster_By_Vendor_And_Window", "Detect_Split_Pattern", "Consolidate_For_Approval"],
          [B("primary", ["Merge_Requisitions", "Route_To_Correct_Approver"], ["Agent", "Workflow"], None,
             "IF 2+ reqs same vendor within 72h AND Sum > threshold"),
           B("immediate", ["Block_Release", "Escalate_To_Compliance"], ["Script", "Human Task"], "Procurement Director approval",
             "IF Requester repeats across 3 periods")],
          ["Procurement Director approval"],
          [{"slot": "maverick", "excerpt": "22% of spend is off-contract; 148 requisition pairs sit within 72h of each other for the same vendor, each below the $10K line."},
           {"slot": "doa", "excerpt": "\"Requisitions above $10,000 require Director approval.\" (DoA matrix v3, row 12)"}],
          ["same-vendor requisition clustering", "sub-threshold amounts", "documented DoA line"],
          ["governance", "process"], "-12pp maverick spend · $3.4M back on contract"),

        C("CAND-K", "p2p", "GR/IR Ageing Blind Spot", "gr-ir-ageing-blind-spot",
          "Invoice Integrity", "High", ["txn"], 0.80, None,
          "Touchless Invoice Rate", ["G", "C"], ["M42", "M20"],
          "Goods received, invoice never matched — or invoice matched, goods never received. Either way it sits in GR/IR until someone writes it off in a quarter nobody is watching.",
          ["Ingest_GRIR_Balances", "Age_Open_Items", "Match_To_PO_And_Receipt", "Classify_Root_Cause", "Auto_Clear_Or_Route"],
          [B("primary", ["Auto_Clear_Matched", "Notify_Buyer_Of_Gap"], ["Script", "Workflow"], None,
             "IF Receipt and Invoice both present AND Variance < tolerance"),
           B("escalation", ["Open_Vendor_Query", "Provision_For_Write_Off"], ["Agent", "Human Task"], "AP Manager approval",
             "IF Aged > 90 days")],
          ["AP Manager approval"],
          [{"slot": "exception-logs", "excerpt": "18% invoice exception rate; GR/IR carries 412 open items, 37% aged beyond 90 days."},
           {"slot": "po-history", "excerpt": "Receipt posted without invoice in 210 cases; the reverse in 96."}],
          ["GR/IR ageing", "receipt-invoice asymmetry", "exception recurrence"],
          ["tech", "process"], "+21pp touchless rate · 412 items cleared"),
    ]


FEW_SHOT = """You are a process transformation expert analysing discovery documents to identify
behavioural patterns in {function} processes.

Client context
  Function:   {function}
  Objective:  {objective}
  Clarified:  {clarified}

Here are examples of known patterns from the existing library:
{examples}

Now analyse the following documents and signals:
{signals}

Identify NEW behavioural patterns not already captured in the library above.
For each candidate pattern, provide:
  1. name            — a concise descriptive name
  2. featureSlug     — kebab-case identifier
  3. description     — what this pattern represents and why it matters
  4. triggers        — observable conditions that indicate this pattern
  5. processFlow     — the happy-path action-block sequence (straight-through resolution)
  6. branchingFlow   — variation branches with tiers (primary/escalation/immediate),
                       action blocks, executor types (Agent/Workflow/Script/Human Task),
                       and HITL gates
  7. evidence        — which documents and signals support this pattern
  8. confidence      — 0-1 score for how strongly the evidence supports this
  9. similarTo       — if this resembles an existing pattern, which one and how
 10. servingMissions — which Command Centre missions (M1–M60) this pattern would serve
 11. servingThemes   — which themes (A–H) this pattern maps to

Structure each candidate pattern EXACTLY like the examples above."""


def build():
    return {
        "meta": {
            "title": "Pattern Studio — document mining",
            "note": ("No live LLM in this build. The checklist, clarifiers, maturity scores, KPI "
                     "gaps and candidate selection are all derived from the corpus, deterministically. "
                     "fewShotPrompt is the exact prompt a real extractor would receive — wire it in at "
                     "PIQ.patternStudio.mine()."),
            "acceptedFormats": ANY,
            "steps": [
                {"id": "context", "label": "Context", "blurb": "What function, and what are you trying to achieve?"},
                {"id": "documents", "label": "Documents", "blurb": "The evidence we need, and what you have."},
                {"id": "results", "label": "Results", "blurb": "Maturity, benchmarks, and the patterns that close the gap."},
            ],
            "stages": [
                {"id": "ingest", "label": "Ingest & Classify",
                 "blurb": "Parse each document; pull tables, reason codes, amounts, dates and freetext."},
                {"id": "signals", "label": "Signal extraction",
                 "blurb": "Find what recurs across the corpus: reason codes, timings, triggers, entities."},
                {"id": "hypothesis", "label": "Pattern hypothesis",
                 "blurb": "Few-shot against the existing library — propose patterns it does not yet hold."},
                {"id": "review", "label": "SME review",
                 "blurb": "You are the gate. Accept, edit, merge or reject each candidate."},
                {"id": "calibrate", "label": "Calibration",
                 "blurb": "Run the accepted detector against the uploaded transactions to set a threshold."},
            ],
            "priorities": {
                CRIT: {"label": "Critical", "glyph": "●", "note": "minimum for meaningful patterns"},
                ENR: {"label": "Enriching", "glyph": "◐", "note": "adds depth"},
                SUP: {"label": "Supporting", "glyph": "○", "note": "contextual"},
            },
            "minCriticalCategories": 2,
        },
        "functions": FUNCTIONS,
        "dimensions": DIMENSIONS,
        "evidenceRules": EVIDENCE,
        "checklists": checklists(),
        "genericChecklist": GENERIC,
        "clarifiers": clarifiers(),
        "kpis": kpis(),
        "blueprints": blueprints(),
        "candidates": candidates(),
        "fewShotPrompt": FEW_SHOT,
    }


def main():
    d = build()
    lists = dict(d["checklists"])
    lists["_generic"] = d["genericChecklist"]

    # every candidate's `requires` must name a category that exists in ITS function's checklist,
    # and every evidence slot must exist there too — otherwise the candidate can never surface.
    for c in d["candidates"]:
        chk = lists.get(c["function"], d["genericChecklist"])
        cats = {x["id"] for x in chk}
        slots = {s["id"] for x in chk for s in x["slots"]}
        bad = [r for r in c["requires"] if r not in cats]
        if bad:
            raise SystemExit("%s (%s) requires unknown category %s — has %s"
                             % (c["cid"], c["function"], bad, sorted(cats)))
        for ev in c["evidence"]:
            if ev["slot"] not in slots:
                raise SystemExit("%s (%s) cites unknown slot '%s'" % (c["cid"], c["function"], ev["slot"]))
        for dim in c["dimensions"]:
            if dim not in {x["id"] for x in DIMENSIONS}:
                raise SystemExit("%s cites unknown maturity dimension '%s'" % (c["cid"], dim))
        # closesKpi must exist in that function's benchmark set
        ks = d["kpis"].get(c["function"], d["kpis"]["_default"])
        if c["closesKpi"] not in {k["name"] for k in ks}:
            raise SystemExit("%s closesKpi '%s' not in the %s benchmark set"
                             % (c["cid"], c["closesKpi"], c["function"]))

    # serving fields must resolve against the real taxonomy
    try:
        cc = json.load(open(CC, encoding="utf-8"))
        mids, tids = set(cc["missions"]), set(cc["themes"])
        for c in d["candidates"]:
            bad = [m for m in c["servingMissions"] if m not in mids]
            if bad:
                print("  WARNING: %s serves unknown mission(s) %s" % (c["cid"], bad))
            bad = [t for t in c["servingThemes"] if t not in tids]
            if bad:
                print("  WARNING: %s serves unknown theme(s) %s" % (c["cid"], bad))
    except Exception as e:
        print("  (taxonomy validation skipped:", e, ")")

    try:
        ids = {p["id"] for p in json.load(open(PATTERNS, encoding="utf-8"))["patterns"]}
        for c in d["candidates"]:
            if c["similarTo"] and c["similarTo"]["id"] not in ids:
                print("  WARNING: %s similarTo unknown pattern #%s" % (c["cid"], c["similarTo"]["id"]))
    except Exception as e:
        print("  (pattern validation skipped:", e, ")")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

    byfn = {}
    for c in d["candidates"]:
        byfn[c["function"]] = byfn.get(c["function"], 0) + 1
    print("Wrote %s (%d functions, %d checklists + generic, %d KPI sets, %d blueprints, %d candidates)"
          % (os.path.relpath(OUT, ROOT), len(FUNCTIONS), len(d["checklists"]),
             len(d["kpis"]), len(d["blueprints"]), len(d["candidates"])))
    print("  candidates by function:", ", ".join("%s=%d" % (k, v) for k, v in sorted(byfn.items())))


if __name__ == "__main__":
    main()
