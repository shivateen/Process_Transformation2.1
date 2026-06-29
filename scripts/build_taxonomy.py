#!/usr/bin/env python3
"""
build_taxonomy.py — Generates src/data/taxonomy.json: the generic, function-agnostic
navigation spine for the Process Transformation Accelerator.

The accelerator is agnostic to function/process. A business SME drives:

    Function -> Process -> Role -> Objective -> Patterns (+ DAGs) -> Action Blocks

This generator builds that tree. AR Collections (Order-to-Cash) is fully populated
against the real 31-pattern library (patterns.json); four other functions ship as
"sample" entries with self-contained stub patterns so the framework is provably
agnostic and demoable end-to-end.

Pattern resolution at runtime: each objective carries patternIds. The Studio resolves
an id against the real library (window.PIQ.patterns) first, then falls back to
taxonomy.stubPatterns. Stub patterns share the exact shape of real ones so every
downstream stage (fitment, runtime) renders them identically.
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")


def load_ar_patterns():
    with open(os.path.join(DATA, "patterns.json"), encoding="utf-8") as f:
        return json.load(f)


def ids_for_category(patterns, category):
    return [p["id"] for p in patterns if p["category"] == category]


def stub(pid, name, category, priority, feature, mental, happy, branches, gates):
    """Build a stub pattern with the same shape as a real library pattern."""
    return {
        "id": pid,
        "name": name,
        "category": category,
        "priority": priority,
        "priorityRank": {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}[priority],
        "mentalModel": mental,
        "sample": True,
        "sources": {
            "sap": ["(sample mapping — connect your system of record)"],
            "oracle": ["(sample mapping — connect your system of record)"],
        },
        "layer1_logicalMapping": "Sample logical mapping for the " + name + " pattern.",
        "layer2_eventSeries": "Sample event series derived from the source timeline.",
        "layer3_feature": feature,
        "featureSlug": feature.lower().replace("_", "-"),
        "conceptualSQL": "-- sample trigger for " + feature + "\nSELECT * FROM source WHERE signal = '" + feature + "'",
        "originalDAG": happy,
        "branchingDAG": branches,
        "hitlGates": gates,
    }


def br(condition, actions, tier, hitl=None, esc=None):
    b = {"condition": condition, "actions": actions, "hitl": hitl, "tier": tier}
    if esc is not None:
        b["escLevel"] = esc
    return b


def build_stub_functions():
    """Four sample functions, each with a self-contained library of stub patterns."""
    stubs = {}        # id -> stub pattern
    functions = []

    def add(pid, *args):
        stubs[str(pid)] = stub(pid, *args)
        return pid

    # ---- 2000 · Procure-to-Pay -------------------------------------------------
    p2p = [
        add(2001, "Duplicate Invoice Slip", "Invoice Integrity & Duplication", "Critical",
            "Duplicate_Fingerprint",
            "Same vendor, same amount, near-identical date — is this a re-bill or a genuine duplicate? Fingerprint it before it clears.",
            ["Fingerprint_Invoice", "Match_Against_History", "Auto_Block_If_Match", "Notify_AP"],
            [br("IF Fingerprint_Match = exact", ["Auto_Hold + Flag_Duplicate"], "primary"),
             br("ELSE IF Fingerprint_Match = fuzzy", ["Route_To_AP_Review", "Attach_Candidate_Pair"], "escalation",
                hitl="AP analyst confirms duplicate", esc=1)],
            ["AP analyst confirms duplicate"]),
        add(2002, "PO–Invoice 3-Way Mismatch", "Match & Exception Handling", "High",
            "ThreeWay_Variance",
            "Invoice says 1,000 units, GR says 980. Is this within tolerance, a short-ship, or a price creep? Decide the variance, don't bounce it to a human by default.",
            ["Pull_PO_GR_Invoice", "Compute_Variance", "Apply_Tolerance", "Post_If_Within"],
            [br("IF Variance <= tolerance", ["Auto_Post + Clear_Block"], "primary"),
             br("ELSE IF Price_Variance > 2%", ["Route_To_Buyer", "Request_Price_Confirmation"], "escalation",
                hitl="Buyer confirms price change", esc=1),
             br("ELSE IF Qty_Variance", ["Open_GR_Discrepancy", "Notify_Receiving"], "escalation", esc=1)],
            ["Buyer confirms price change"]),
        add(2003, "Maverick / Off-Contract Spend", "Spend Compliance", "Medium",
            "Off_Contract_Flag",
            "This buy bypassed the preferred-supplier contract. Was it an emergency, or leakage? Surface it before payment, attribute the savings lost.",
            ["Match_To_Contract", "Detect_Off_Contract", "Quantify_Leakage", "Log_For_Sourcing"],
            [br("IF On_Contract", ["Auto_Approve"], "primary"),
             br("ELSE IF Off_Contract AND Amount < threshold", ["Flag_For_Review", "Notify_Category_Manager"], "escalation",
                hitl="Category manager reviews leakage", esc=1)],
            ["Category manager reviews leakage"]),
        add(2004, "Early-Payment Discount Capture", "Working Capital", "Medium",
            "Discount_Window",
            "There's a 2/10 net-30 discount on the table and the clock is ticking. Is the discount worth more than the cash held? Capture it automatically when it is.",
            ["Read_Payment_Terms", "Compute_Discount_Value", "Compare_Cost_Of_Cash", "Schedule_Early_Pay"],
            [br("IF Discount_Value > Cost_Of_Cash", ["Auto_Schedule_Early_Payment"], "primary"),
             br("ELSE IF Marginal", ["Route_To_Treasury"], "escalation", hitl="Treasury approves early pay", esc=1)],
            ["Treasury approves early pay"]),
    ]
    functions.append({
        "id": "p2p", "name": "Procure-to-Pay", "short": "P2P", "icon": "🧾",
        "accent": "#7c4dff", "status": "sample",
        "tagline": "Invoice integrity, matching, and working-capital capture.",
        "processes": [{
            "id": "p2p-ap", "name": "AP Invoice Processing & Exceptions",
            "desc": "From invoice receipt to posting — duplicates, mismatches, and spend leakage.",
            "roles": [
                {"id": "p2p-ap-analyst", "name": "AP Analyst", "objectives": [
                    {"id": "p2p-o-dup", "name": "Eliminate duplicate & fraudulent payments",
                     "kpi": "Duplicate leakage $", "patternIds": [2001]},
                    {"id": "p2p-o-match", "name": "Touchless invoice matching",
                     "kpi": "Touchless %", "patternIds": [2002]},
                ]},
                {"id": "p2p-buyer", "name": "Category / Procurement Manager", "objectives": [
                    {"id": "p2p-o-mav", "name": "Curb off-contract (maverick) spend",
                     "kpi": "Contract compliance %", "patternIds": [2003]},
                ]},
                {"id": "p2p-treasury", "name": "Treasury Analyst", "objectives": [
                    {"id": "p2p-o-disc", "name": "Maximize early-payment discount capture",
                     "kpi": "Discounts captured $", "patternIds": [2004]},
                ]},
            ],
        }],
    })

    # ---- 3000 · Record-to-Report ----------------------------------------------
    r2r = [
        add(3001, "Stuck Reconciliation Item", "Close & Reconciliation", "High",
            "Aging_Recon_Break",
            "This GL-to-subledger break has rolled forward three closes. Is it a timing item that will clear, or a real difference someone must own? Age it and route.",
            ["Pull_Recon_Breaks", "Classify_Timing_vs_Real", "Auto_Clear_Timing", "Assign_Owner"],
            [br("IF Timing_Difference", ["Auto_Clear + Document"], "primary"),
             br("ELSE IF Aging > 2 periods", ["Assign_To_Owner", "Escalate_Controller"], "escalation",
                hitl="Controller signs off write-off", esc=1)],
            ["Controller signs off write-off"]),
        add(3002, "Late / Missing Accrual", "Period-End Accruals", "High",
            "Accrual_Gap",
            "A recurring accrual that posted every month is missing this period. Did the activity stop, or did someone forget? Detect the gap before the books close.",
            ["Scan_Recurring_Accruals", "Detect_Missing", "Estimate_Amount", "Propose_Journal"],
            [br("IF Within_Materiality", ["Auto_Propose_Journal"], "primary"),
             br("ELSE IF Material", ["Route_To_Accountant", "Attach_Trend"], "escalation",
                hitl="Accountant approves accrual", esc=1)],
            ["Accountant approves accrual"]),
        add(3003, "Intercompany Out-of-Balance", "Intercompany", "Critical",
            "IC_Imbalance",
            "Entity A booked the charge; Entity B never picked it up. Every day this lingers it distorts the consolidation. Match the legs and chase the missing one.",
            ["Match_IC_Legs", "Detect_Imbalance", "Identify_Missing_Leg", "Notify_Counterparty"],
            [br("IF Both_Legs_Posted", ["Auto_Eliminate"], "primary"),
             br("ELSE IF One_Leg_Missing", ["Notify_Counterparty_Entity", "Open_IC_Case"], "escalation",
                hitl="Group accountant approves true-up", esc=1)],
            ["Group accountant approves true-up"]),
    ]
    functions.append({
        "id": "r2r", "name": "Record-to-Report", "short": "R2R", "icon": "📒",
        "accent": "#0aa3a3", "status": "sample",
        "tagline": "A faster, cleaner close — reconciliations, accruals, intercompany.",
        "processes": [{
            "id": "r2r-close", "name": "Financial Close & Reconciliation",
            "desc": "Period-end: clear breaks, post accruals, balance intercompany.",
            "roles": [
                {"id": "r2r-gl", "name": "GL Accountant", "objectives": [
                    {"id": "r2r-o-recon", "name": "Clear reconciliation breaks faster",
                     "kpi": "Aged breaks", "patternIds": [3001]},
                    {"id": "r2r-o-accrual", "name": "Close the accrual gap",
                     "kpi": "Missed accruals", "patternIds": [3002]},
                ]},
                {"id": "r2r-controller", "name": "Controller", "objectives": [
                    {"id": "r2r-o-ic", "name": "Balance intercompany before consolidation",
                     "kpi": "IC imbalance $", "patternIds": [3003]},
                ]},
            ],
        }],
    })

    # ---- 4000 · Hire-to-Retire -------------------------------------------------
    h2r = [
        add(4001, "Stalled Onboarding Provisioning", "Onboarding Throughput", "High",
            "Provisioning_Stall",
            "Day-one is in 48 hours and laptop, accounts, and badge are still 'pending'. Which task is the bottleneck, and who do I nudge before the new hire shows up to nothing?",
            ["Track_Provisioning_Tasks", "Detect_Stall", "Identify_Bottleneck", "Auto_Nudge_Owner"],
            [br("IF All_On_Track", ["Auto_Confirm_Ready"], "primary"),
             br("ELSE IF Task_Stalled < SLA", ["Auto_Nudge_Owner"], "primary"),
             br("ELSE IF Past_SLA", ["Escalate_HRBP", "Flag_Day1_Risk"], "escalation",
                hitl="HRBP confirms day-1 readiness", esc=1)],
            ["HRBP confirms day-1 readiness"]),
        add(4002, "Missing Compliance Document", "Compliance & Eligibility", "Critical",
            "Doc_Gap",
            "Right-to-work paperwork still isn't on file and the start date is locked. Chase it now, or we have a compliance exposure on day one.",
            ["Checklist_Required_Docs", "Detect_Missing", "Auto_Request_From_Hire", "Block_If_Unresolved"],
            [br("IF Complete", ["Auto_Clear_Gate"], "primary"),
             br("ELSE IF Missing AND > 24h_to_start", ["Auto_Request_Document"], "primary"),
             br("ELSE IF Missing AND imminent", ["Escalate_Compliance", "Hold_Start"], "escalation",
                hitl="Compliance approves conditional start", esc=1)],
            ["Compliance approves conditional start"]),
    ]
    functions.append({
        "id": "h2r", "name": "Hire-to-Retire", "short": "HR", "icon": "👤",
        "accent": "#e0529c", "status": "sample",
        "tagline": "Onboarding that's ready on day one, compliantly.",
        "processes": [{
            "id": "h2r-onboard", "name": "Employee Onboarding",
            "desc": "From offer-accept to productive day-one — provisioning and compliance.",
            "roles": [
                {"id": "h2r-hrbp", "name": "HR Business Partner", "objectives": [
                    {"id": "h2r-o-prov", "name": "Guarantee day-one readiness",
                     "kpi": "Day-1 readiness %", "patternIds": [4001]},
                ]},
                {"id": "h2r-comp", "name": "Compliance Officer", "objectives": [
                    {"id": "h2r-o-doc", "name": "Close compliance-document gaps pre-start",
                     "kpi": "Open doc gaps", "patternIds": [4002]},
                ]},
            ],
        }],
    })

    # ---- 5000 · Supply Chain ---------------------------------------------------
    sc = [
        add(5001, "Stockout Risk Signal", "Inventory & Availability", "High",
            "Stockout_Lead",
            "Demand is trending up and on-hand cover just dropped below lead time. Do I expedite, substitute, or ride it out? Decide before the shelf goes empty.",
            ["Read_Demand_Signal", "Compute_Cover_vs_LeadTime", "Detect_Risk", "Propose_Replenishment"],
            [br("IF Cover >= LeadTime", ["No_Action"], "primary"),
             br("ELSE IF Risk AND Auto_Replen_Eligible", ["Auto_Raise_Replenishment_PO"], "primary"),
             br("ELSE IF Critical_SKU", ["Propose_Expedite", "Notify_Planner"], "escalation",
                hitl="Planner approves expedite cost", esc=1)],
            ["Planner approves expedite cost"]),
        add(5002, "Delivery Slippage", "Order Fulfillment Exceptions", "Medium",
            "ETA_Slip",
            "The carrier's ETA just slipped past the customer's promised date. Do I re-route, split the shipment, or proactively tell the customer? Don't let them find out first.",
            ["Track_Shipment_ETA", "Detect_Slip", "Assess_Impact", "Trigger_Customer_Comms"],
            [br("IF On_Time", ["No_Action"], "primary"),
             br("ELSE IF Slip < grace", ["Auto_Notify_Customer"], "primary"),
             br("ELSE IF Slip > grace", ["Propose_Reroute", "Escalate_Logistics"], "escalation",
                hitl="Logistics lead approves reroute", esc=1)],
            ["Logistics lead approves reroute"]),
    ]
    functions.append({
        "id": "sc", "name": "Supply Chain", "short": "SC", "icon": "📦",
        "accent": "#f08a24", "status": "sample",
        "tagline": "Availability and on-time delivery, exception-first.",
        "processes": [{
            "id": "sc-fulfill", "name": "Order Fulfillment & Replenishment",
            "desc": "Keep shelves stocked and promises kept — stockouts and slippage.",
            "roles": [
                {"id": "sc-planner", "name": "Supply Planner", "objectives": [
                    {"id": "sc-o-stock", "name": "Prevent stockouts on critical SKUs",
                     "kpi": "Stockout incidents", "patternIds": [5001]},
                ]},
                {"id": "sc-logistics", "name": "Logistics Coordinator", "objectives": [
                    {"id": "sc-o-eta", "name": "Protect on-time-in-full delivery",
                     "kpi": "OTIF %", "patternIds": [5002]},
                ]},
            ],
        }],
    })

    return functions, stubs


def build_ar_function(patterns):
    """Order-to-Cash, fully populated against the real 31-pattern library."""
    cat = lambda c: ids_for_category(patterns, c)
    return {
        "id": "o2c", "name": "Order-to-Cash", "short": "O2C", "icon": "💵",
        "accent": "#e67e22", "status": "live",
        "tagline": "AR collections, disputes, credit risk — the fully-built core.",
        "processes": [{
            "id": "o2c-ar", "name": "AR Collections & Dispute Management",
            "desc": "Behavioural collections: read intent, sequence the right action, escalate only when warranted.",
            "roles": [
                {"id": "o2c-analyst", "name": "Collections Analyst", "objectives": [
                    {"id": "o2c-o-dso", "name": "Accelerate collections / cut DSO",
                     "kpi": "DSO (days)",
                     "patternIds": cat("Intentional Stalling & Delay Tactics")},
                    {"id": "o2c-o-dispute", "name": "Resolve disputes & deductions faster",
                     "kpi": "Dispute cycle time",
                     "patternIds": cat("Dispute & Deduction Manipulation")},
                ]},
                {"id": "o2c-credit", "name": "Credit & Risk Manager", "objectives": [
                    {"id": "o2c-o-risk", "name": "Detect insolvency & credit risk early",
                     "kpi": "Bad-debt write-off $",
                     "patternIds": cat("Credit Risk & Insolvency Indicators")},
                ]},
                {"id": "o2c-cashapp", "name": "Cash Application Specialist", "objectives": [
                    {"id": "o2c-o-match", "name": "Lift auto-match / cash-application rate",
                     "kpi": "Auto-match %",
                     "patternIds": cat("Cash Application & Remittance Friction")},
                ]},
                {"id": "o2c-kam", "name": "Strategic Account Manager", "objectives": [
                    {"id": "o2c-o-rel", "name": "Curb contractual & relationship abuse",
                     "kpi": "Margin leakage $",
                     "patternIds": cat("Relationship & Contractual Abuse")},
                ]},
            ],
        }],
    }


def main():
    data = load_ar_patterns()
    patterns = data["patterns"]

    ar = build_ar_function(patterns)
    stub_funcs, stub_patterns = build_stub_functions()
    functions = [ar] + stub_funcs

    # roll up counts for the picker chrome
    for f in functions:
        n = 0
        for p in f["processes"]:
            for r in p["roles"]:
                for o in r["objectives"]:
                    o["patternCount"] = len(o["patternIds"])
                    n += len(o["patternIds"])
        f["patternCount"] = n

    out = {
        "meta": {
            "title": "Process Transformation Accelerator — Navigation Spine",
            "tagline": "From client mission to running agent — one continuous pipeline.",
            "note": "Function-agnostic. Order-to-Cash is fully built; other functions are samples that prove the framework generalises.",
            "stages": [
                {"id": "design", "n": 1, "name": "Design",
                 "sub": "Missions → Actions",
                 "blurb": "Pick the mission, choose the patterns, configure the action blocks."},
                {"id": "fit", "n": 2, "name": "Discover & Fit",
                 "sub": "Process discovery & agent fitment",
                 "blurb": "Assess every action block for agent fit; record and agentivise the happy path."},
                {"id": "run", "n": 3, "name": "Run & Govern",
                 "sub": "Process flow → Agentic workflow",
                 "blurb": "Straight-through on the happy path; variations matched to patterns and routed for approval."},
            ],
            "functionCount": len(functions),
        },
        "functions": functions,
        "stubPatterns": stub_patterns,
    }

    path = os.path.join(DATA, "taxonomy.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("Built", os.path.relpath(path, ROOT),
          "(%d functions, %d sample patterns)" % (len(functions), len(stub_patterns)))


if __name__ == "__main__":
    main()
