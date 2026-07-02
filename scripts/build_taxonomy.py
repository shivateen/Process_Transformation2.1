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

        # --- Invoice Processing library (AP Analyst) --------------------------
        # Two behavioural categories, mirroring the AR analyst: adversarial
        # integrity/fraud signals, and non-adversarial coding/routing judgment.

        # Category A · Invoice Integrity & Fraud Signals
        add(2005, "Remit-To Bank Swap", "Invoice Integrity & Fraud Signals", "Critical",
            "RemitTo_Change_Flag",
            "The bank details on this invoice don't match the vendor master. A changed remit-to is the number-one "
            "invoice-redirection fraud vector — I never pay to it until it's verified on a known-good phone number, "
            "no matter how routine the invoice looks.",
            ["Compare_RemitTo_vs_VendorMaster", "Detect_Bank_Change", "Hold_Payment", "Trigger_OutOfBand_Verification"],
            [br("IF RemitTo_Match = TRUE", ["Auto_Continue_Processing"], "primary"),
             br("ELSE IF Bank_Changed AND Callback_Verified", ["Update_Vendor_Master", "Release_Hold", "Log_Change_Audit"],
                "escalation", hitl="AP lead approves bank-detail change", esc=1),
             br("ELSE IF Bank_Changed AND Verification_Fails", ["Freeze_Vendor", "Open_Fraud_Case", "Notify_Security"],
                "escalation", hitl="Controller confirms suspected fraud", esc=2)],
            ["AP lead approves bank-detail change", "Controller confirms suspected fraud"]),
        add(2006, "Resubmission-After-Reject", "Invoice Integrity & Fraud Signals", "High",
            "Resubmit_Fingerprint",
            "This 'new' invoice number is last week's rejected invoice wearing a disguise — same vendor, PO, and amount. "
            "If the original gets corrected and this one clears too, we pay twice. I match on the economic fingerprint, "
            "not the invoice number.",
            ["Fingerprint_Invoice(vendor+PO+amount+period)", "Match_Against_Rejected_And_Open", "Link_Resubmission", "Supersede_Original"],
            [br("IF No_Prior_Match", ["Auto_Continue_Processing"], "primary"),
             br("ELSE IF Matches_Rejected_Item", ["Link_To_Original", "Carry_Forward_Approvals", "Auto_Post"], "primary"),
             br("ELSE IF Matches_Open_Unpaid", ["Block_As_Potential_Duplicate", "Route_To_AP_Review"],
                "escalation", hitl="AP analyst confirms not a duplicate", esc=1)],
            ["AP analyst confirms not a duplicate"]),
        add(2007, "Unapplied Credit Memo", "Invoice Integrity & Fraud Signals", "High",
            "Open_Credit_Balance",
            "The vendor issued a credit memo weeks ago but keeps billing the full amount, and the credit is just sitting "
            "there unapplied. Every gross invoice I clear without netting it is money we've effectively paid twice. "
            "Net it before it posts.",
            ["Scan_Open_Credit_Memos", "Match_Credit_To_Invoice(vendor)", "Net_Before_Posting", "Update_Vendor_Statement"],
            [br("IF No_Open_Credit", ["Auto_Continue_Processing"], "primary"),
             br("ELSE IF Credit_Matches_Invoice", ["Auto_Apply_Credit", "Post_Net_Amount"], "primary"),
             br("ELSE IF Credit_Aging > 60d AND Unmatched", ["Request_Refund_From_Vendor", "Escalate_AP_Lead"],
                "escalation", hitl="AP lead approves refund request", esc=1)],
            ["AP lead approves refund request"]),
        add(2008, "Round-Sum Non-PO Inflation", "Invoice Integrity & Fraud Signals", "Medium",
            "RoundSum_Anomaly",
            "A suspiciously round non-PO invoice — exactly $10,000, no line detail — from a vendor with barely any history. "
            "It's not proof of anything, but round-sum, low-history, no-backup is the classic soft-fraud signature. "
            "I want a second look before it slides into an auto-approve tier.",
            ["Assess_Invoice_Shape(round+backup+history)", "Score_Anomaly", "Attach_Vendor_History", "Route_By_Score"],
            [br("IF Anomaly_Score = low", ["Auto_Continue_Processing"], "primary"),
             br("ELSE IF Round_Sum AND Low_History", ["Request_Supporting_Backup", "Flag_For_Review"],
                "escalation", hitl="AP analyst reviews anomaly", esc=1),
             br("ELSE IF No_Backup AND Amount > threshold", ["Hold_Payment", "Escalate_Procurement"],
                "escalation", hitl="Procurement validates spend", esc=1)],
            ["AP analyst reviews anomaly", "Procurement validates spend"]),

        # Category B · Coding, Routing & Approval Judgment
        add(2009, "Threshold-Split Approval Dodge", "Coding, Routing & Approval Judgment", "High",
            "Split_Under_Threshold",
            "Three $9,900 invoices from the same vendor this week, each one just under the $10k approval gate. Individually "
            "every one is auto-approvable; together it's a $29,700 decision someone senior should actually see. I aggregate "
            "the window before I let any of them approve.",
            ["Aggregate_Vendor_Invoices(rolling_window)", "Compare_To_Approval_Tiers", "Detect_SubThreshold_Clustering", "Re_Tier_Approval"],
            [br("IF Aggregate < threshold", ["Auto_Approve_Each"], "primary"),
             br("ELSE IF Cluster_Crosses_Tier", ["Bundle_For_Higher_Approver", "Attach_Split_Evidence"],
                "escalation", hitl="Cost-centre owner approves aggregated spend", esc=1),
             br("ELSE IF Repeat_Pattern > 2 windows", ["Flag_To_Procurement", "Open_Policy_Review"], "escalation", esc=1)],
            ["Cost-centre owner approves aggregated spend"]),
        add(2010, "Approval Musical Chairs", "Coding, Routing & Approval Judgment", "Medium",
            "Approval_Bounce",
            "This invoice has bounced to a third approver in a week, each one saying 'not mine'. The delegation-of-authority "
            "is ambiguous and the invoice is aging while they pass it around. I pin the correct approver by amount and "
            "cost-centre authority and stop the merry-go-round.",
            ["Read_Approval_History", "Resolve_DoA(amount+costcentre)", "Assign_Correct_Approver", "Notify_With_Deadline"],
            [br("IF Single_Clear_Approver", ["Auto_Route_To_Approver"], "primary"),
             br("ELSE IF Bounced >= 2 AND DoA_Resolvable", ["Pin_Authoritative_Approver", "Attach_DoA_Evidence"], "primary"),
             br("ELSE IF DoA_Ambiguous AND Aging > SLA", ["Escalate_AP_Manager", "Flag_Approval_Gap"],
                "escalation", hitl="AP manager assigns approver", esc=1)],
            ["AP manager assigns approver"]),
        add(2011, "Ownerless Non-PO Invoice", "Coding, Routing & Approval Judgment", "Medium",
            "Missing_Owner",
            "A non-PO invoice arrives with no PO and no requester named on it. Left alone it ages in the unassigned queue "
            "for weeks. I infer the likely owner from GL history, the vendor, and the contract, and route it — an inferred "
            "owner who can reassign beats a silent backlog.",
            ["Extract_Invoice_Signals(vendor+GL+desc)", "Infer_Owner_From_History", "Assign_Provisional_Owner", "Route_For_Confirmation"],
            [br("IF Owner_Confidently_Inferred", ["Auto_Route_To_Owner"], "primary"),
             br("ELSE IF Multiple_Candidate_Owners", ["Route_To_Top_Candidate", "CC_Alternates"], "primary"),
             br("ELSE IF No_Signal", ["Hold_In_Triage", "Escalate_AP_Lead"],
                "escalation", hitl="AP lead assigns cost-centre owner", esc=1)],
            ["AP lead assigns cost-centre owner"]),
        add(2012, "OCR Confidence Cliff", "Coding, Routing & Approval Judgment", "Medium",
            "OCR_Confidence",
            "The capture engine is only 62% sure the invoice total is $12,400 — the tax and vendor fields are shaky too. "
            "Above the confidence bar I let it post untouched; below it, this is a keying error waiting to hit the ledger. "
            "I gate straight-through on confidence, not on hope.",
            ["Read_Capture_Confidence(perfield)", "Compare_To_Threshold", "Auto_Post_If_Clear", "Queue_LowConfidence_For_Verify"],
            [br("IF All_Fields_Above_Bar", ["Auto_Post"], "primary"),
             br("ELSE IF Key_Field_Below_Bar", ["Highlight_Suspect_Fields", "Route_To_Keying_Review"],
                "escalation", hitl="AP clerk verifies captured fields", esc=1),
             br("ELSE IF Vendor_Unrecognised", ["Hold_For_Vendor_Match", "Escalate_Master_Data"], "escalation", esc=1)],
            ["AP clerk verifies captured fields"]),
    ]
    functions.append({
        "id": "p2p", "name": "Procure-to-Pay", "short": "P2P", "icon": "🧾",
        "accent": "#7c4dff", "status": "sample",
        "tagline": "Invoice integrity, matching, and working-capital capture.",
        "valueChain": build_p2p_value_chain(),
        "processes": [{
            "id": "p2p-ap", "name": "AP Invoice Processing & Exceptions",
            "desc": "From invoice receipt to posting — duplicates, mismatches, and spend leakage.",
            "roles": [
                {"id": "p2p-ap-analyst", "name": "AP Analyst", "objectives": [
                    {"id": "p2p-o-dup", "name": "Eliminate duplicate & fraudulent payments",
                     "kpi": "Fraud & duplicate leakage $", "patternIds": [2001, 2005, 2006, 2007, 2008]},
                    {"id": "p2p-o-proc", "name": "Touchless invoice coding & approval",
                     "kpi": "Touchless processing %", "patternIds": [2009, 2010, 2011, 2012]},
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
        # Category A · Reconciliation Integrity
        add(3001, "Stuck Reconciliation Item", "Reconciliation Integrity", "High",
            "Aging_Recon_Break",
            "This GL-to-subledger break has rolled forward three closes. Is it a timing item that will clear, or a real difference someone must own? Age it and route.",
            ["Pull_Recon_Breaks", "Classify_Timing_vs_Real", "Auto_Clear_Timing", "Assign_Owner"],
            [br("IF Timing_Difference", ["Auto_Clear + Document"], "primary"),
             br("ELSE IF Aging > 2 periods", ["Assign_To_Owner", "Escalate_Controller"], "escalation",
                hitl="Controller signs off write-off", esc=1)],
            ["Controller signs off write-off"]),
        add(3004, "Bank Reconciliation Outlier", "Reconciliation Integrity", "High", "Bank_Recon_Outlier",
            "A bank line has sat unmatched for two weeks — not an in-transit item, it's stopped clearing. Either a "
            "payment failed silently or something posted twice. I chase the outlier now, before it's buried in next "
            "month's noise.",
            ["Pull_Bank_vs_Ledger", "Auto_Match_Clearing_Items", "Isolate_Unmatched_Outliers", "Investigate_And_Clear"],
            [br("IF All_Matched", ["Auto_Certify"], "primary"),
             br("ELSE IF In_Transit < grace", ["Auto_Carry_Forward"], "primary"),
             br("ELSE IF Unmatched > grace", ["Trace_Root_Cause", "Route_To_GL_Accountant"],
                "escalation", hitl="GL accountant clears bank outlier", esc=1)],
            ["GL accountant clears bank outlier"]),
        add(3005, "Suspense Account Creep", "Reconciliation Integrity", "Medium", "Suspense_Aging",
            "The suspense and clearing accounts are quietly filling up — items land there 'temporarily' and never "
            "leave. A growing suspense balance is unreconciled risk in disguise; I age it and force each item to a home.",
            ["Scan_Suspense_Clearing_Accounts", "Age_Parked_Items", "Propose_Reclass", "Drain_To_Correct_Account"],
            [br("IF Suspense_Near_Zero", ["No_Action"], "primary"),
             br("ELSE IF Item_Reclassifiable", ["Auto_Reclass + Document"], "primary"),
             br("ELSE IF Aged > 2 periods", ["Assign_Owner", "Escalate_Controller"],
                "escalation", hitl="Controller approves write-off", esc=1)],
            ["Controller approves write-off"]),
        add(3006, "Auto-Certified Reconciliation", "Reconciliation Integrity", "Medium", "RubberStamp_Recon",
            "This account was certified 'reconciled' in four seconds flat, same as every month — but the supporting "
            "balance hasn't moved and nobody attached evidence. A rubber-stamped rec isn't a control; I re-open the "
            "risky ones for a real look.",
            ["Measure_Certification_Behaviour", "Check_Evidence_Attached", "Flag_RubberStamp_Recons", "Route_High_Risk_For_Review"],
            [br("IF Evidenced_Review", ["Accept_Certification"], "primary"),
             br("ELSE IF Low_Risk_Account", ["Accept + Sample_Later"], "primary"),
             br("ELSE IF High_Risk AND No_Evidence", ["Re_Open_Reconciliation", "Notify_Controller"],
                "escalation", hitl="Controller reviews certification quality", esc=1)],
            ["Controller reviews certification quality"]),
        # Category B · Close Orchestration & Control
        add(3002, "Late / Missing Accrual", "Close Orchestration & Control", "High",
            "Accrual_Gap",
            "A recurring accrual that posted every month is missing this period. Did the activity stop, or did someone forget? Detect the gap before the books close.",
            ["Scan_Recurring_Accruals", "Detect_Missing", "Estimate_Amount", "Propose_Journal"],
            [br("IF Within_Materiality", ["Auto_Propose_Journal"], "primary"),
             br("ELSE IF Material", ["Route_To_Accountant", "Attach_Trend"], "escalation",
                hitl="Accountant approves accrual", esc=1)],
            ["Accountant approves accrual"]),
        add(3003, "Intercompany Out-of-Balance", "Close Orchestration & Control", "Critical",
            "IC_Imbalance",
            "Entity A booked the charge; Entity B never picked it up. Every day this lingers it distorts the consolidation. Match the legs and chase the missing one.",
            ["Match_IC_Legs", "Detect_Imbalance", "Identify_Missing_Leg", "Notify_Counterparty"],
            [br("IF Both_Legs_Posted", ["Auto_Eliminate"], "primary"),
             br("ELSE IF One_Leg_Missing", ["Notify_Counterparty_Entity", "Open_IC_Case"], "escalation",
                hitl="Group accountant approves true-up", esc=1)],
            ["Group accountant approves true-up"]),
        add(3007, "Close Task Critical-Path Slip", "Close Orchestration & Control", "High", "Close_CriticalPath",
            "A close task just slipped and it's on the critical path — every downstream task is now waiting on it. I "
            "don't need a status meeting; I need to know who the one bottleneck is and nudge them before the whole "
            "close moves a day right.",
            ["Track_Close_Task_Status", "Compute_Critical_Path", "Detect_Blocking_Slip", "Auto_Nudge_Bottleneck"],
            [br("IF On_Schedule", ["Auto_Confirm_Progress"], "primary"),
             br("ELSE IF Slip AND Off_Critical_Path", ["Auto_Nudge_Owner"], "primary"),
             br("ELSE IF Slip AND On_Critical_Path", ["Escalate_Controller", "Flag_Close_Delay_Risk"],
                "escalation", hitl="Controller approves close plan change", esc=1)],
            ["Controller approves close plan change"]),
        add(3008, "Period Cut-Off Error", "Close Orchestration & Control", "Medium", "CutOff_Error",
            "A big invoice for in-period services posted two days after the cut-off, into the next month. Booked in the "
            "wrong period it distorts both months' results. I catch cut-off errors at close, not when the auditor does.",
            ["Scan_Transactions_Around_CutOff", "Test_Service_vs_Posting_Date", "Detect_Wrong_Period", "Propose_Reclass_Journal"],
            [br("IF Correct_Period", ["Auto_Pass"], "primary"),
             br("ELSE IF Clear_CutOff_Error AND Immaterial", ["Auto_Reclass_Journal"], "primary"),
             br("ELSE IF Material", ["Propose_Adjusting_Entry", "Escalate_Controller"],
                "escalation", hitl="Controller approves cut-off adjustment", esc=1)],
            ["Controller approves cut-off adjustment"]),
    ]
    functions.append({
        "id": "r2r", "name": "Record-to-Report", "short": "R2R", "icon": "📒",
        "accent": "#0aa3a3", "status": "sample",
        "tagline": "A faster, cleaner close — reconciliations, accruals, intercompany.",
        "valueChain": build_r2r_value_chain(),
        "processes": [{
            "id": "r2r-close", "name": "Financial Close & Reconciliation",
            "desc": "Period-end: clear breaks, post accruals, balance intercompany.",
            "roles": [
                {"id": "r2r-gl", "name": "GL Accountant", "objectives": [
                    {"id": "r2r-o-recon", "name": "Keep reconciliations clean & current",
                     "kpi": "Aged breaks", "patternIds": [3001, 3004, 3005, 3006]},
                ]},
                {"id": "r2r-controller", "name": "Controller", "objectives": [
                    {"id": "r2r-o-close", "name": "Run a controlled, on-time close",
                     "kpi": "Close cycle days", "patternIds": [3002, 3003, 3007, 3008]},
                ]},
            ],
        }],
    })

    # ---- 4000 · Hire-to-Retire -------------------------------------------------
    h2r = [
        # Category A · Provisioning & Readiness
        add(4001, "Stalled Onboarding Provisioning", "Provisioning & Readiness", "High",
            "Provisioning_Stall",
            "Day-one is in 48 hours and laptop, accounts, and badge are still 'pending'. Which task is the bottleneck, and who do I nudge before the new hire shows up to nothing?",
            ["Track_Provisioning_Tasks", "Detect_Stall", "Identify_Bottleneck", "Auto_Nudge_Owner"],
            [br("IF All_On_Track", ["Auto_Confirm_Ready"], "primary"),
             br("ELSE IF Task_Stalled < SLA", ["Auto_Nudge_Owner"], "primary"),
             br("ELSE IF Past_SLA", ["Escalate_HRBP", "Flag_Day1_Risk"], "escalation",
                hitl="HRBP confirms day-1 readiness", esc=1)],
            ["HRBP confirms day-1 readiness"]),
        add(4003, "Manager Onboarding No-Show", "Provisioning & Readiness", "Medium", "Manager_Prep_Gap",
            "Day-one is 48 hours out and the hiring manager still hasn't done a single onboarding task — no buddy, no "
            "equipment sign-off, no first-week plan. The new hire will show up to a manager who forgot they were "
            "coming. I nudge the manager before the impression is set.",
            ["Track_Manager_Onboarding_Tasks", "Detect_Incomplete", "Auto_Nudge_Manager", "Confirm_Ready"],
            [br("IF Manager_Tasks_Complete", ["Auto_Confirm_Ready"], "primary"),
             br("ELSE IF Incomplete < SLA", ["Auto_Nudge_Manager"], "primary"),
             br("ELSE IF Past_SLA", ["Escalate_HRBP", "Flag_Day1_Risk"], "escalation",
                hitl="HRBP confirms day-1 readiness", esc=1)],
            ["HRBP confirms day-1 readiness"]),
        add(4004, "Access Not Ready Day-1", "Provisioning & Readiness", "High", "Access_Provisioning_Gap",
            "Laptop's here, but the accounts — email, VPN, the core app — still aren't provisioned and start is "
            "tomorrow. A new hire who can't log in on day one loses their first week and their first impression. "
            "I chase the access owner, not just the asset.",
            ["Track_Access_Requests", "Detect_Unprovisioned_Systems", "Auto_Expedite_With_IT", "Verify_Login_Ready"],
            [br("IF All_Access_Ready", ["Auto_Confirm_Ready"], "primary"),
             br("ELSE IF Pending < SLA", ["Auto_Expedite_IT_Ticket"], "primary"),
             br("ELSE IF Critical_System AND Past_SLA", ["Escalate_IT_Lead", "Provision_Temp_Access"],
                "escalation", hitl="IT lead approves expedited provisioning", esc=1)],
            ["IT lead approves expedited provisioning"]),
        add(4005, "Ghost-Start Risk", "Provisioning & Readiness", "Medium", "NoShow_Signal",
            "The new hire has gone quiet — didn't confirm start details, didn't open the pre-boarding portal, and it's "
            "a hot market. Ghosting after accept is real, and every provisioned laptop and licence is sunk cost if they "
            "no-show. I re-engage now and warn the manager to keep a backup warm.",
            ["Track_PreBoarding_Engagement", "Score_NoShow_Risk", "Auto_ReEngage_Candidate", "Alert_If_Elevated"],
            [br("IF Engaged", ["No_Action"], "primary"),
             br("ELSE IF Quiet < window", ["Auto_ReEngage_Candidate"], "primary"),
             br("ELSE IF High_NoShow_Risk", ["Notify_HRBP_And_Manager", "Hold_Further_Provisioning"],
                "escalation", hitl="HRBP confirms candidate still starting", esc=1)],
            ["HRBP confirms candidate still starting"]),
        # Category B · Compliance & Eligibility
        add(4002, "Missing Compliance Document", "Compliance & Eligibility", "Critical",
            "Doc_Gap",
            "Right-to-work paperwork still isn't on file and the start date is locked. Chase it now, or we have a compliance exposure on day one.",
            ["Checklist_Required_Docs", "Detect_Missing", "Auto_Request_From_Hire", "Block_If_Unresolved"],
            [br("IF Complete", ["Auto_Clear_Gate"], "primary"),
             br("ELSE IF Missing AND > 24h_to_start", ["Auto_Request_Document"], "primary"),
             br("ELSE IF Missing AND imminent", ["Escalate_Compliance", "Hold_Start"], "escalation",
                hitl="Compliance approves conditional start", esc=1)],
            ["Compliance approves conditional start"]),
        add(4006, "Background-Check Stall", "Compliance & Eligibility", "High", "BGCheck_Stall",
            "The background check has been 'in progress' for two weeks and the start date is locked. Let them start "
            "before it clears and we've got an unvetted person in a sensitive role; hold it blindly and we lose the "
            "hire. I chase the vendor and prep the conditional-start call.",
            ["Track_BGCheck_Status", "Detect_Stall", "Auto_Chase_Vendor", "Assess_Conditional_Start"],
            [br("IF Cleared", ["Auto_Clear_Gate"], "primary"),
             br("ELSE IF In_Progress < SLA", ["Auto_Chase_Vendor"], "primary"),
             br("ELSE IF Stalled AND Start_Imminent", ["Escalate_Compliance", "Propose_Conditional_Start"],
                "escalation", hitl="Compliance approves conditional start", esc=1)],
            ["Compliance approves conditional start"]),
        add(4007, "Expiring Work Authorization", "Compliance & Eligibility", "High", "WorkAuth_Expiry",
            "This hire's work permit expires four months after they start — right in the middle of probation. An "
            "expiring authorization nobody's tracking becomes an illegal-to-employ problem overnight. I flag the "
            "renewal runway now, while there's still time to act.",
            ["Read_Work_Authorization", "Compute_Expiry_Runway", "Detect_Short_Runway", "Schedule_Renewal_Track"],
            [br("IF Long_Runway", ["Log + Monitor"], "primary"),
             br("ELSE IF Runway < policy", ["Auto_Open_Renewal_Case", "Notify_Compliance"],
                "escalation", hitl="Compliance approves sponsorship/renewal", esc=1),
             br("ELSE IF Expires_During_Probation", ["Escalate_Compliance", "Flag_Employment_Risk"], "escalation", esc=1)],
            ["Compliance approves sponsorship/renewal"]),
        add(4008, "Certification / License Gap", "Compliance & Eligibility", "Medium", "License_Gap",
            "This role legally requires a professional licence, and the one on file can't be verified against the "
            "register — maybe lapsed, maybe never held. Putting an unlicensed person in a regulated seat is a fine and "
            "a headline. I verify at source before day one.",
            ["Identify_Required_Licenses", "Verify_Against_Registry", "Detect_Gap", "Request_Evidence"],
            [br("IF Verified_Valid", ["Auto_Clear_Gate"], "primary"),
             br("ELSE IF Pending_Verification", ["Auto_Request_Evidence"], "primary"),
             br("ELSE IF Unverifiable AND Regulated_Role", ["Hold_Start", "Escalate_Compliance"],
                "escalation", hitl="Compliance confirms licensing", esc=1)],
            ["Compliance confirms licensing"]),
    ]
    functions.append({
        "id": "h2r", "name": "Hire-to-Retire", "short": "HR", "icon": "👤",
        "accent": "#e0529c", "status": "sample",
        "tagline": "Onboarding that's ready on day one, compliantly.",
        "valueChain": build_h2r_value_chain(),
        "processes": [{
            "id": "h2r-onboard", "name": "Employee Onboarding",
            "desc": "From offer-accept to productive day-one — provisioning and compliance.",
            "roles": [
                {"id": "h2r-hrbp", "name": "HR Business Partner", "objectives": [
                    {"id": "h2r-o-prov", "name": "Guarantee day-one readiness",
                     "kpi": "Day-1 readiness %", "patternIds": [4001, 4003, 4004, 4005]},
                ]},
                {"id": "h2r-comp", "name": "Compliance Officer", "objectives": [
                    {"id": "h2r-o-doc", "name": "Close compliance & eligibility gaps pre-start",
                     "kpi": "Open compliance gaps", "patternIds": [4002, 4006, 4007, 4008]},
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

    # ---- 6000 · Financial Planning & Analysis (Plan-to-Perform) ---------------
    fpa = [
        # Category A · Forecast Integrity & Bias
        add(6000, "Budget Sandbagging", "Forecast Integrity & Bias", "High", "Sandbag_Signal",
            "The regional budget landed 15% below current run-rate — right after their bonus was tied to budget "
            "attainment. That's not conservatism, it's a sandbag: lowball the plan so any outcome looks like a beat.",
            ["Compare_Budget_vs_RunRate", "Score_Sandbag_Risk", "Attach_Trend_Evidence", "Flag_For_Challenge"],
            [br("IF Budget within run-rate band", ["Auto_Accept_Submission"], "primary"),
             br("ELSE IF Below_Band AND Incentive_Linked", ["Request_Justification", "Route_To_FP&A_Review"],
                "escalation", hitl="FP&A lead challenges submission", esc=1),
             br("ELSE IF Repeat_Sandbagger", ["Escalate_Finance_Director", "Propose_Stretch_Target"], "escalation", esc=1)],
            ["FP&A lead challenges submission"]),
        add(6001, "Hockey-Stick Forecast", "Forecast Integrity & Bias", "Medium", "BackLoaded_Curve",
            "Every quarter the forecast crawls flat then miraculously spikes in the final month to hit the number. "
            "The back-loaded hockey stick almost never lands — I discount the miracle month before it's baked in.",
            ["Read_Forecast_Curve", "Detect_BackLoading", "Compare_To_History", "Risk_Adjust_Outlook"],
            [br("IF Curve_Linear", ["Auto_Accept_Forecast"], "primary"),
             br("ELSE IF BackLoaded AND History_Misses", ["Apply_Haircut", "Flag_Delivery_Risk"],
                "escalation", hitl="FP&A lead approves haircut", esc=1),
             br("ELSE IF Extreme_Spike", ["Request_Weekly_Milestones", "Escalate_Business_Partner"], "escalation", esc=1)],
            ["FP&A lead approves haircut"]),
        add(6002, "Forecast Drift", "Forecast Integrity & Bias", "Medium", "Assumption_Staleness",
            "The forecast still assumes 8% growth three months after the market turned. Nobody refreshed the driver — "
            "the gap between what we're steering by and reality is widening silently.",
            ["Check_Assumption_Freshness", "Compare_Drivers_To_Actuals", "Detect_Drift", "Prompt_Refresh"],
            [br("IF Assumptions_Current", ["No_Action"], "primary"),
             br("ELSE IF Drift < tolerance", ["Auto_Nudge_Owner"], "primary"),
             br("ELSE IF Drift > tolerance", ["Recompute_Driver_Based_Forecast", "Escalate_FP&A"],
                "escalation", hitl="FP&A lead approves reforecast", esc=1)],
            ["FP&A lead approves reforecast"]),
        add(6003, "Reforecast Trigger Miss", "Forecast Integrity & Bias", "High", "Reforecast_Trigger",
            "A material event just hit — a lost contract, an FX swing — but no reforecast was triggered. The number "
            "the business is steering by is already wrong and nobody's noticed.",
            ["Monitor_Material_Events", "Assess_Forecast_Impact", "Trigger_Reforecast", "Notify_Stakeholders"],
            [br("IF No_Material_Event", ["No_Action"], "primary"),
             br("ELSE IF Impact < threshold", ["Log_Event + Watch"], "primary"),
             br("ELSE IF Impact > threshold", ["Mandate_Reforecast", "Escalate_CFO_Office"],
                "escalation", hitl="Finance director approves reforecast scope", esc=1)],
            ["Finance director approves reforecast scope"]),
        # Category B · Variance Explanation & Insight
        add(6004, "Unexplained Variance", "Variance Explanation & Insight", "High", "Variance_Unexplained",
            "A $2M unfavourable variance and the commentary just says 'timing'. Timing three months running isn't "
            "timing — it's a miss nobody wants to name. I want the real driver, not a placeholder word.",
            ["Pull_Variance_By_Driver", "Test_Commentary_Quality", "Decompose_Root_Cause", "Request_Real_Explanation"],
            [br("IF Variance < materiality", ["Auto_Accept_Commentary"], "primary"),
             br("ELSE IF Generic_Commentary", ["Reject_Commentary", "Request_Driver_Detail"],
                "escalation", hitl="Business partner provides root cause", esc=1),
             br("ELSE IF Recurring_Unexplained", ["Escalate_Controller", "Open_Deep_Dive"], "escalation", esc=1)],
            ["Business partner provides root cause"]),
        add(6005, "Offsetting Variance Masking", "Variance Explanation & Insight", "Medium", "Offsetting_Variance",
            "Net variance is near zero, so it looks clean — but it's a big favourable price hiding an equally big "
            "unfavourable volume. The net tells a comforting lie; the components tell the real story.",
            ["Decompose_Net_Variance", "Detect_Offsetting_Components", "Surface_Gross_Drivers", "Report_Components"],
            [br("IF Components_Aligned", ["Auto_Accept"], "primary"),
             br("ELSE IF Offsetting_Detected", ["Split_Report_By_Driver", "Flag_Hidden_Risk"],
                "escalation", hitl="FP&A lead reviews component story", esc=1)],
            ["FP&A lead reviews component story"]),
        add(6006, "Phasing / Timing Distortion", "Variance Explanation & Insight", "Medium", "Phasing_Artifact",
            "The whole variance is phasing — spend that shifted a month, not real overspend. Raising an alarm on a "
            "calendar artefact wastes everyone's time; I reclass it to the right period and move on.",
            ["Trace_Variance_To_Period", "Detect_Phasing", "Reclass_To_Correct_Period", "Annotate_Timing"],
            [br("IF Not_Phasing", ["Route_As_Real_Variance"], "primary"),
             br("ELSE IF Pure_Phasing", ["Auto_Reclass + Annotate"], "primary"),
             br("ELSE IF Mixed", ["Split_Phasing_vs_Real", "Route_Real_Portion"], "escalation", esc=1)],
            []),
        add(6007, "Allocation Dispute", "Variance Explanation & Insight", "Medium", "Allocation_Split",
            "The cost centre is up in arms about a variance driven entirely by a corporate allocation they don't "
            "control. Before anyone's judged on it, I separate what they own from what was pushed down to them.",
            ["Split_Controllable_vs_Allocated", "Attribute_Allocation_Source", "Restate_On_Controllable", "Notify_Both_Owners"],
            [br("IF Fully_Controllable", ["Route_To_Cost_Centre"], "primary"),
             br("ELSE IF Allocation_Driven", ["Restate_Controllable_View", "Redirect_To_Allocation_Owner"], "primary"),
             br("ELSE IF Disputed_Split", ["Escalate_FP&A_Arbitration"], "escalation", hitl="FP&A lead arbitrates allocation", esc=1)],
            ["FP&A lead arbitrates allocation"]),
    ]
    functions.append({
        "id": "fpa", "name": "Financial Planning & Analysis", "short": "FP&A", "icon": "📊",
        "accent": "#3f5efb", "status": "sample",
        "tagline": "Rolling forecast, variance insight, and decision support — the perform half of finance.",
        "valueChain": build_fpa_value_chain(),
        "processes": [{
            "id": "fpa-plan", "name": "Forecasting & Variance Management",
            "desc": "Keep the forecast honest and the variances explained — bias out, insight in.",
            "roles": [
                {"id": "fpa-analyst", "name": "FP&A Analyst", "objectives": [
                    {"id": "fpa-o-fc", "name": "Keep the rolling forecast accurate & bias-free",
                     "kpi": "Forecast accuracy %", "patternIds": [6000, 6001, 6002, 6003]},
                ]},
                {"id": "fpa-partner", "name": "Finance Business Partner", "objectives": [
                    {"id": "fpa-o-var", "name": "Deliver explained, timely variances",
                     "kpi": "Variance cycle time", "patternIds": [6004, 6005, 6006, 6007]},
                ]},
            ],
        }],
    })

    # ---- 7000 · Treasury & Cash Management ------------------------------------
    tcm = [
        # Category A · Liquidity & Cash Efficiency
        add(7000, "Idle Balance Sweep Miss", "Liquidity & Cash Efficiency", "High", "Idle_Balance",
            "€4M sat in a non-interest current account over the weekend while another entity drew on an overdraft. "
            "We paid to borrow what we already had — sweep the idle balance before it costs us on both sides.",
            ["Scan_Account_Balances", "Detect_Idle_Above_Target", "Compute_Sweep", "Execute_Cash_Sweep"],
            [br("IF Balances_At_Target", ["No_Action"], "primary"),
             br("ELSE IF Idle AND Auto_Sweep_Eligible", ["Auto_Sweep_To_Concentration"], "primary"),
             br("ELSE IF Idle AND Restricted_Account", ["Propose_Manual_Transfer", "Notify_Cash_Manager"],
                "escalation", hitl="Cash manager approves transfer", esc=1)],
            ["Cash manager approves transfer"]),
        add(7001, "Cash-Forecast Variance", "Liquidity & Cash Efficiency", "High", "CashForecast_Miss",
            "Actual cash came in €3M under the 5-day forecast — a major customer paid late and nobody flagged it. "
            "If the forecast is this wrong we could walk into a funding gap blind.",
            ["Compare_Actual_vs_Forecast_Cash", "Detect_Material_Miss", "Trace_Driver", "Update_Liquidity_View"],
            [br("IF Within_Tolerance", ["No_Action"], "primary"),
             br("ELSE IF Miss AND Timing", ["Reforecast_Short_Term", "Notify_Cash_Manager"], "primary"),
             br("ELSE IF Miss AND Funding_Risk", ["Trigger_Contingency_Funding", "Escalate_Treasurer"],
                "escalation", hitl="Treasurer approves contingency draw", esc=1)],
            ["Treasurer approves contingency draw"]),
        add(7002, "Trapped Cash", "Liquidity & Cash Efficiency", "Medium", "Trapped_Cash",
            "We keep counting the Brazil balance as available, but repatriation rules mean we can't actually move it "
            "without a haircut. Trapped cash on the dashboard is a liquidity illusion — I ring-fence it.",
            ["Classify_Cash_By_Availability", "Detect_Restrictions", "Ring_Fence_Trapped", "Restate_Available_Liquidity"],
            [br("IF Fully_Available", ["Include_In_Liquidity"], "primary"),
             br("ELSE IF Restricted", ["Exclude_From_Available", "Flag_Repatriation_Cost"], "primary"),
             br("ELSE IF Repatriation_Opportunity", ["Propose_Upstream_Plan", "Escalate_Treasury"],
                "escalation", hitl="Treasurer approves repatriation", esc=1)],
            ["Treasurer approves repatriation"]),
        add(7003, "Duplicate / Fat-Finger Payment", "Liquidity & Cash Efficiency", "Critical", "Duplicate_Wire",
            "A €500k payment matches one released two hours ago — same beneficiary, same amount. A duplicate wire is "
            "near-impossible to claw back, so I hold it and verify before it ever leaves the building.",
            ["Fingerprint_Payment(beneficiary+amount+ref)", "Match_Against_Recent_Releases", "Hold_Suspected_Duplicate", "Route_For_Verification"],
            [br("IF No_Match", ["Auto_Release_Payment"], "primary"),
             br("ELSE IF Exact_Duplicate", ["Block_Payment", "Alert_Payments_Team"],
                "escalation", hitl="Cash manager confirms not duplicate", esc=1),
             br("ELSE IF Fuzzy_Match", ["Hold_For_Review", "Attach_Candidate_Pair"], "escalation", esc=1)],
            ["Cash manager confirms not duplicate"]),
        # Category B · Financial Risk & Covenant
        add(7004, "FX Exposure Drift", "Financial Risk & Covenant", "High", "FX_Drift",
            "Net USD exposure has drifted 20% past the hedge-policy band as receivables piled up. Unhedged drift is "
            "just a P&L surprise waiting for the next rate move — bring it back inside the band.",
            ["Aggregate_Net_FX_Exposure", "Compare_To_Hedge_Policy", "Detect_Band_Breach", "Propose_Hedge"],
            [br("IF Within_Policy_Band", ["No_Action"], "primary"),
             br("ELSE IF Breach AND Standard_Instrument", ["Propose_Forward_Hedge", "Notify_Risk_Analyst"],
                "escalation", hitl="Treasury risk approves hedge", esc=1),
             br("ELSE IF Large_Breach", ["Escalate_Treasurer", "Model_Hedge_Options"], "escalation", esc=1)],
            ["Treasury risk approves hedge"]),
        add(7005, "Covenant Early-Warning", "Financial Risk & Covenant", "Critical", "Covenant_Proximity",
            "Projected leverage is creeping toward the 3.0x covenant with two months to the test date. I flag it now, "
            "while there's still room to act — discovering a breach on the test date is discovering it too late.",
            ["Project_Covenant_Ratios", "Compare_To_Thresholds", "Detect_Proximity", "Alert_With_Runway"],
            [br("IF Ample_Headroom", ["No_Action"], "primary"),
             br("ELSE IF Proximity < buffer", ["Model_Mitigations", "Notify_Treasurer"],
                "escalation", hitl="Treasurer reviews covenant plan", esc=1),
             br("ELSE IF Breach_Projected", ["Escalate_CFO", "Prepare_Waiver_Case"], "escalation", esc=2)],
            ["Treasurer reviews covenant plan"]),
        add(7006, "Counterparty Concentration", "Financial Risk & Covenant", "Medium", "Counterparty_Concentration",
            "We're holding more with a single bank than policy allows — and its rating just went on negative watch. "
            "Concentration is fine right up until the counterparty isn't, so I rebalance before the headline.",
            ["Aggregate_Exposure_By_Counterparty", "Compare_To_Limits", "Overlay_Credit_Signals", "Propose_Rebalance"],
            [br("IF Within_Limits", ["No_Action"], "primary"),
             br("ELSE IF Over_Limit", ["Propose_Diversification", "Notify_Risk_Analyst"],
                "escalation", hitl="Treasury risk approves reallocation", esc=1),
             br("ELSE IF Rating_Downgrade", ["Reduce_Exposure", "Escalate_Treasurer"], "escalation", esc=1)],
            ["Treasury risk approves reallocation"]),
        add(7007, "Interest-Rate Reset Surprise", "Financial Risk & Covenant", "Medium", "Rate_Reset",
            "A large floating-rate facility resets next week into a higher-rate environment, and the forecast still "
            "uses the old coupon. The reset will quietly blow the interest budget unless we price it in now.",
            ["Scan_Upcoming_Resets", "Reprice_At_Forward_Curve", "Compare_To_Budget", "Update_Interest_Forecast"],
            [br("IF Reset_Immaterial", ["Auto_Update_Forecast"], "primary"),
             br("ELSE IF Material_Increase", ["Flag_Budget_Impact", "Notify_Risk_Analyst"],
                "escalation", hitl="Treasury risk reviews hedge option", esc=1)],
            ["Treasury risk reviews hedge option"]),
    ]
    functions.append({
        "id": "tcm", "name": "Treasury & Cash Management", "short": "TCM", "icon": "🏦",
        "accent": "#1f9d76", "status": "sample",
        "tagline": "Cash visibility, liquidity, and FX / covenant risk — money in motion.",
        "valueChain": build_tcm_value_chain(),
        "processes": [{
            "id": "tcm-cash", "name": "Cash & Liquidity Management",
            "desc": "See the cash, sweep the idle, and catch the risk before it's a surprise.",
            "roles": [
                {"id": "tcm-manager", "name": "Cash Manager", "objectives": [
                    {"id": "tcm-o-cash", "name": "Maximise cash visibility & yield",
                     "kpi": "Idle cash $", "patternIds": [7000, 7001, 7002, 7003]},
                ]},
                {"id": "tcm-risk", "name": "Treasury Risk Analyst", "objectives": [
                    {"id": "tcm-o-risk", "name": "Contain FX & covenant risk",
                     "kpi": "Unhedged exposure $", "patternIds": [7004, 7005, 7006, 7007]},
                ]},
            ],
        }],
    })

    # ---- 8000 · Tax Management ------------------------------------------------
    tax = [
        # Category A · Compliance & Filing Integrity
        add(8000, "Filing-Deadline Slip", "Compliance & Filing Integrity", "Critical", "Filing_Deadline",
            "The VAT return is due in three days and three entities still haven't closed. A missed filing is an "
            "automatic penalty plus interest — I chase the stragglers now, not on day four when it's already a fine.",
            ["Track_Return_Calendar", "Detect_At_Risk_Filings", "Chase_Owners", "Escalate_If_Stalled"],
            [br("IF All_On_Track", ["Auto_Confirm_Ready"], "primary"),
             br("ELSE IF At_Risk < SLA", ["Auto_Remind_Owner"], "primary"),
             br("ELSE IF Past_Internal_SLA", ["Escalate_Tax_Manager", "Prepare_Extension_If_Available"],
                "escalation", hitl="Tax manager approves extension/priority", esc=1)],
            ["Tax manager approves extension/priority"]),
        add(8001, "Return-to-Ledger Mismatch", "Compliance & Filing Integrity", "High", "ReturnLedger_Delta",
            "The output tax on the draft return is €90k off the GL control account. File that and you've either "
            "overpaid or handed an auditor a thread to pull — I reconcile the delta before anything is submitted.",
            ["Compare_Return_To_GL", "Compute_Delta", "Trace_Difference", "Reconcile_Before_Filing"],
            [br("IF Delta = 0", ["Auto_Proceed_To_File"], "primary"),
             br("ELSE IF Delta_Explained", ["Document_Reconciliation", "Proceed"], "primary"),
             br("ELSE IF Delta_Unexplained", ["Hold_Filing", "Escalate_Tax_Manager"],
                "escalation", hitl="Tax manager approves adjustment", esc=1)],
            ["Tax manager approves adjustment"]),
        add(8002, "Credit-Note Timing Gap", "Compliance & Filing Integrity", "Medium", "CreditNote_Period",
            "A big credit note landed after the period cut-off but relates to in-period sales. Claim it in the wrong "
            "period and the reclaim gets denied — I place it where the underlying transaction lives.",
            ["Match_CreditNote_To_Sale", "Determine_Correct_Period", "Apply_In_Right_Return", "Document_Basis"],
            [br("IF Same_Period", ["Auto_Apply"], "primary"),
             br("ELSE IF Cross_Period_Clear", ["Assign_To_Original_Period", "Adjust_Return"], "primary"),
             br("ELSE IF Ambiguous", ["Route_To_Tax_Specialist"], "escalation", hitl="Tax specialist confirms period", esc=1)],
            ["Tax specialist confirms period"]),
        add(8003, "e-Invoicing Clearance Reject", "Compliance & Filing Integrity", "High", "Clearance_Reject",
            "The authority's real-time clearance platform bounced 40 invoices on a format rule. Until they're fixed and "
            "re-cleared, those sales can't legally ship — this is a today problem, not a month-end one.",
            ["Ingest_Clearance_Responses", "Detect_Rejections", "Diagnose_Format_Error", "Auto_Correct_And_Resubmit"],
            [br("IF Cleared", ["Release_Invoice"], "primary"),
             br("ELSE IF Known_Format_Error", ["Auto_Fix + Resubmit"], "primary"),
             br("ELSE IF Unknown_Reject", ["Hold_Shipment", "Escalate_Tax_Specialist"],
                "escalation", hitl="Tax specialist resolves clearance rule", esc=1)],
            ["Tax specialist resolves clearance rule"]),
        # Category B · Determination & Position
        add(8004, "Reverse-Charge Miscode", "Determination & Position", "High", "ReverseCharge_Flag",
            "This cross-border service should be reverse-charged but it's coded standard-rated. Wrong mechanism means "
            "a wrong return on both sides of the border — I catch it at determination, not in an audit.",
            ["Read_Transaction_Attributes", "Determine_Correct_Mechanism", "Detect_Miscode", "Correct_Tax_Treatment"],
            [br("IF Treatment_Correct", ["Auto_Continue"], "primary"),
             br("ELSE IF Clear_Miscode", ["Auto_Reclassify + Log"], "primary"),
             br("ELSE IF Complex_Cross_Border", ["Route_To_Tax_Specialist"], "escalation", hitl="Tax specialist confirms treatment", esc=1)],
            ["Tax specialist confirms treatment"]),
        add(8005, "Nexus Threshold Breach", "Determination & Position", "High", "Nexus_Threshold",
            "Sales into this state just crossed the economic-nexus threshold and we're not registered there. Every day "
            "unregistered is tax we should be collecting and will end up paying out of margin — register before it compounds.",
            ["Track_Sales_By_Jurisdiction", "Compare_To_Nexus_Thresholds", "Detect_Breach", "Initiate_Registration"],
            [br("IF Below_Threshold", ["Monitor"], "primary"),
             br("ELSE IF Breach_Recent", ["Flag_Registration_Need", "Notify_Tax_Manager"],
                "escalation", hitl="Tax manager approves registration", esc=1),
             br("ELSE IF Breach_Aged", ["Quantify_Back_Liability", "Escalate_Tax_Director"], "escalation", esc=1)],
            ["Tax manager approves registration"]),
        add(8006, "Exemption-Certificate Gap", "Determination & Position", "Medium", "Cert_Expiry",
            "We're treating this customer as exempt, but the certificate on file expired last quarter. No valid "
            "certificate means no exemption — the assessment lands on us, so I chase the cert before we invoice again.",
            ["Check_Certificate_Validity", "Detect_Expired_Or_Missing", "Request_Renewal", "Suspend_Exemption_If_Unresolved"],
            [br("IF Valid_Certificate", ["Apply_Exemption"], "primary"),
             br("ELSE IF Expired AND Grace", ["Auto_Request_Renewal"], "primary"),
             br("ELSE IF Missing AND Invoicing", ["Charge_Tax_Provisionally", "Notify_Tax_Analyst"],
                "escalation", hitl="Tax analyst confirms exemption status", esc=1)],
            ["Tax analyst confirms exemption status"]),
        add(8007, "Rate-Change Lag", "Determination & Position", "Medium", "Rate_Staleness",
            "The jurisdiction changed the rate effective the 1st and our tax engine still has the old one. Every "
            "invoice since is wrong by the delta — I refresh the rate and sweep the mispriced ones before the return is built.",
            ["Monitor_Statutory_Rate_Changes", "Compare_To_Engine_Config", "Detect_Stale_Rate", "Update_And_Restate"],
            [br("IF Rate_Current", ["No_Action"], "primary"),
             br("ELSE IF Stale AND No_Invoices_Yet", ["Auto_Update_Rate"], "primary"),
             br("ELSE IF Stale AND Invoices_Issued", ["Update_Rate", "Flag_Mispriced_For_Correction"],
                "escalation", hitl="Tax analyst approves corrections", esc=1)],
            ["Tax analyst approves corrections"]),
    ]
    functions.append({
        "id": "tax", "name": "Tax Management", "short": "TAX", "icon": "🧮",
        "accent": "#2d6cdf", "status": "sample",
        "tagline": "Determination, compliance, and provisioning — accurate, penalty-free tax.",
        "valueChain": build_tax_value_chain(),
        "processes": [{
            "id": "tax-comp", "name": "Indirect Tax Compliance & Filing",
            "desc": "File on time and right — reconcile to the ledger, determine at source, never miss a deadline.",
            "roles": [
                {"id": "tax-analyst", "name": "Tax Analyst", "objectives": [
                    {"id": "tax-o-file", "name": "File on time and accurately",
                     "kpi": "Penalty exposure $", "patternIds": [8000, 8001, 8002, 8003]},
                ]},
                {"id": "tax-specialist", "name": "Tax Specialist", "objectives": [
                    {"id": "tax-o-det", "name": "Get determination right at source",
                     "kpi": "Determination error %", "patternIds": [8004, 8005, 8006, 8007]},
                ]},
            ],
        }],
    })

    # ---- 9000 · Travel & Expense Management -----------------------------------
    tne = [
        # Category A · Expense Integrity & Fraud
        add(9000, "Duplicate Receipt Submission", "Expense Integrity & Fraud", "High", "Duplicate_Claim",
            "The same restaurant receipt shows up on two reports a month apart — once on the card feed, once as a "
            "manual claim. Pay both and we've bought that dinner twice. I fingerprint the receipt, not the report.",
            ["Fingerprint_Receipt(merchant+amount+date)", "Match_Across_Reports_And_Card", "Flag_Duplicate", "Block_Second_Claim"],
            [br("IF No_Match", ["Auto_Approve_Line"], "primary"),
             br("ELSE IF Exact_Duplicate", ["Auto_Reject_Duplicate", "Notify_Claimant"], "primary"),
             br("ELSE IF Card_vs_Manual_Overlap", ["Hold_For_Review", "Route_To_Auditor"],
                "escalation", hitl="Expense auditor confirms duplicate", esc=1)],
            ["Expense auditor confirms duplicate"]),
        add(9001, "Split-to-Dodge-Limit", "Expense Integrity & Fraud", "Medium", "Claim_Split",
            "A €300 dinner split into two €150 claims to stay under the receipt-required line. The split itself is the "
            "tell — I reassemble the pieces and apply the rule to the whole.",
            ["Aggregate_Related_Lines(merchant+day)", "Compare_To_Thresholds", "Detect_Sub_Limit_Split", "Re_Apply_Rule"],
            [br("IF No_Splitting", ["Auto_Continue"], "primary"),
             br("ELSE IF Split_Detected", ["Merge_And_Require_Receipt", "Flag_For_Review"],
                "escalation", hitl="Expense auditor reviews split", esc=1)],
            ["Expense auditor reviews split"]),
        add(9002, "Weekend / Personal Blur", "Expense Integrity & Fraud", "Medium", "Personal_Blur",
            "The hotel spans Saturday and Sunday with no meeting on the calendar. Personal days dressed up as business "
            "travel — I carve out the private portion before reimbursing it.",
            ["Cross_Ref_Dates_To_Calendar", "Detect_Non_Business_Days", "Split_Business_vs_Personal", "Reimburse_Business_Only"],
            [br("IF All_Business", ["Auto_Approve"], "primary"),
             br("ELSE IF Clear_Personal_Days", ["Auto_Deduct_Personal", "Notify_Claimant"], "primary"),
             br("ELSE IF Disputed", ["Route_To_Auditor"], "escalation", hitl="Expense auditor rules on split", esc=1)],
            ["Expense auditor rules on split"]),
        add(9003, "Mileage / Per-Diem Inflation", "Expense Integrity & Fraud", "Medium", "Mileage_Inflation",
            "Claimed mileage is 40% over the map distance for that route, and it's a recurring habit for this claimant. "
            "Inflated distance every trip is small money that adds up — I check it against the route, not the honour system.",
            ["Compute_Route_Distance", "Compare_To_Claimed", "Detect_Inflation", "Cap_At_Standard"],
            [br("IF Within_Tolerance", ["Auto_Approve"], "primary"),
             br("ELSE IF Over AND One_Off", ["Auto_Cap + Notify"], "primary"),
             br("ELSE IF Repeat_Inflator", ["Flag_Pattern", "Route_To_Auditor"],
                "escalation", hitl="Expense auditor reviews claimant pattern", esc=1)],
            ["Expense auditor reviews claimant pattern"]),
        # Category B · Policy & Flow
        add(9004, "Out-of-Policy Class/Rate", "Policy & Flow", "Medium", "Policy_Breach",
            "Business-class flight on a route policy caps at economy, no exception on file. It's not fraud — but it "
            "clears silently unless the rule actually bites. I hold it for the exception it needs.",
            ["Evaluate_Against_Policy", "Detect_Out_Of_Policy", "Check_Exception_On_File", "Route_By_Rule"],
            [br("IF In_Policy", ["Auto_Approve"], "primary"),
             br("ELSE IF Breach AND Exception_Exists", ["Auto_Approve + Log_Exception"], "primary"),
             br("ELSE IF Breach AND No_Exception", ["Hold_For_Approval", "Notify_Manager"],
                "escalation", hitl="Cost-centre manager approves exception", esc=1)],
            ["Cost-centre manager approves exception"]),
        add(9005, "Missing-Receipt Loop", "Policy & Flow", "Medium", "Missing_Receipt",
            "Third reminder and the receipt still isn't attached; the report just ages while the claimant ignores it. "
            "I auto-remind, then auto-hold — a claim can't sit in limbo forever waiting on one attachment.",
            ["Detect_Missing_Receipt", "Auto_Remind_Claimant", "Escalate_On_Timeout", "Hold_Until_Resolved"],
            [br("IF Receipt_Present", ["Auto_Continue"], "primary"),
             br("ELSE IF Missing < window", ["Auto_Remind"], "primary"),
             br("ELSE IF Missing > window", ["Hold_Reimbursement", "Notify_Manager"],
                "escalation", hitl="Manager approves receipt waiver", esc=1)],
            ["Manager approves receipt waiver"]),
        add(9006, "Late Submission Beyond Window", "Policy & Flow", "Medium", "Late_Submission",
            "This expense is four months old — past the submission window and the VAT-reclaim deadline. Late claims "
            "quietly cost us the tax recovery, so I flag the reclaim loss before it's just accepted.",
            ["Check_Expense_Date_vs_Window", "Detect_Late_Submission", "Quantify_Reclaim_Loss", "Route_By_Policy"],
            [br("IF Within_Window", ["Auto_Continue"], "primary"),
             br("ELSE IF Late AND Within_Grace", ["Approve + Flag_No_Reclaim"], "primary"),
             br("ELSE IF Beyond_Grace", ["Route_To_Manager", "Attach_Policy"],
                "escalation", hitl="Manager approves late claim", esc=1)],
            ["Manager approves late claim"]),
        add(9007, "Manager Rubber-Stamp", "Policy & Flow", "Medium", "RubberStamp_Approval",
            "This approver clears every report in under three seconds flat — flags and all. A rubber-stamp isn't a "
            "control; I re-route the flagged reports somewhere they'll actually be read.",
            ["Measure_Approval_Behaviour", "Detect_RubberStamp_Pattern", "Re_Route_Flagged_Reports", "Notify_Controls"],
            [br("IF Approver_Reviews", ["Auto_Continue"], "primary"),
             br("ELSE IF RubberStamp AND No_Flags", ["Allow + Monitor"], "primary"),
             br("ELSE IF RubberStamp AND Flagged_Items", ["Redirect_To_Independent_Review", "Escalate_Controls"],
                "escalation", hitl="Controls reviews approval quality", esc=1)],
            ["Controls reviews approval quality"]),
    ]
    functions.append({
        "id": "tne", "name": "Travel & Expense", "short": "T&E", "icon": "💳",
        "accent": "#d68910", "status": "sample",
        "tagline": "Expense capture, policy, and reimbursement — spend that behaves.",
        "valueChain": build_tne_value_chain(),
        "processes": [{
            "id": "tne-exp", "name": "Expense Audit & Compliance",
            "desc": "Catch the leakage and keep reimbursement frictionless — audit smart, pay clean.",
            "roles": [
                {"id": "tne-auditor", "name": "Expense Auditor", "objectives": [
                    {"id": "tne-o-audit", "name": "Catch out-of-policy & fraudulent spend",
                     "kpi": "Expense leakage $", "patternIds": [9000, 9001, 9002, 9003]},
                ]},
                {"id": "tne-analyst", "name": "T&E Analyst", "objectives": [
                    {"id": "tne-o-flow", "name": "Frictionless, compliant reimbursement",
                     "kpi": "Auto-approval %", "patternIds": [9004, 9005, 9006, 9007]},
                ]},
            ],
        }],
    })

    # ---- 10000 · Internal Controls & Compliance (SOX / GRC) -------------------
    icc = [
        # Category A · Control-Failure Signals
        add(10000, "Journal-Entry Anomaly", "Control-Failure Signals", "High", "JE_Anomaly",
            "A manual top-side journal, round number, posted on the last day of the quarter by someone who never posts "
            "journals. Every red flag for earnings management sitting on one line — I stop and ask before it hits the books.",
            ["Scan_Manual_Journals", "Score_Anomaly(round+timing+poster)", "Attach_Context", "Route_High_Risk"],
            [br("IF Score_Low", ["Auto_Pass"], "primary"),
             br("ELSE IF Elevated", ["Request_Support", "Notify_Controls_Analyst"],
                "escalation", hitl="Controls analyst reviews journal", esc=1),
             br("ELSE IF High_Risk", ["Hold_Posting", "Escalate_Controller"], "escalation", esc=2)],
            ["Controls analyst reviews journal"]),
        add(10001, "Control-Owner Gap", "Control-Failure Signals", "Medium", "Owner_Gap",
            "A key control's owner left three weeks ago and nobody's been reassigned. An unowned control isn't "
            "operating — it's just a paragraph in a binder. I reassign it before the next test proves it dead.",
            ["Map_Controls_To_Owners", "Detect_Vacant_Ownership", "Propose_Reassignment", "Notify_Control_Manager"],
            [br("IF Owner_Active", ["No_Action"], "primary"),
             br("ELSE IF Vacant < grace", ["Auto_Nudge_Manager"], "primary"),
             br("ELSE IF Vacant > grace", ["Flag_Control_At_Risk", "Escalate_Controls_Lead"],
                "escalation", hitl="Controls lead reassigns owner", esc=1)],
            ["Controls lead reassigns owner"]),
        add(10002, "Master-Data Change Without Approval", "Control-Failure Signals", "High", "Unapproved_Change",
            "A vendor's bank detail changed outside the approval workflow — and then a payment went to it. "
            "Change-without-approval followed by a payment is the exact shape of invoice fraud; I freeze and investigate.",
            ["Monitor_Master_Data_Changes", "Match_To_Approval_Records", "Detect_Unapproved", "Correlate_With_Payments"],
            [br("IF Change_Approved", ["Auto_Pass"], "primary"),
             br("ELSE IF Unapproved AND No_Payment", ["Flag_For_Review", "Notify_Controls"],
                "escalation", hitl="Controls analyst validates change", esc=1),
             br("ELSE IF Unapproved AND Payment_Made", ["Freeze_Vendor", "Open_Investigation", "Alert_Security"],
                "escalation", hitl="Controller confirms suspected fraud", esc=2)],
            ["Controls analyst validates change", "Controller confirms suspected fraud"]),
        add(10003, "After-Hours Privileged Access", "Control-Failure Signals", "Medium", "OffHours_Privilege",
            "A privileged admin logged into the finance system at 3am from a new location and touched payment config. "
            "Maybe it's a legitimate fix — but 'explain or freeze' is the only safe default for privilege at that hour.",
            ["Monitor_Privileged_Sessions", "Detect_Anomalous_Access(time+geo+action)", "Request_Justification", "Contain_If_Unexplained"],
            [br("IF Normal_Pattern", ["Auto_Pass"], "primary"),
             br("ELSE IF Anomalous AND Justified", ["Log + Clear"], "primary"),
             br("ELSE IF Anomalous AND Unexplained", ["Suspend_Session", "Escalate_Security"],
                "escalation", hitl="Security approves account suspension", esc=1)],
            ["Security approves account suspension"]),
        # Category B · Segregation of Duties & Access
        add(10004, "Toxic SoD Combination", "Segregation of Duties & Access", "Critical", "Toxic_SoD",
            "This user can both create a vendor and release a payment. That single combination is how invoice fraud "
            "happens — I break the conflict before it's exploited, not while writing the post-mortem.",
            ["Analyze_User_Entitlements", "Detect_Toxic_Combination", "Propose_Mitigation", "Enforce_Separation"],
            [br("IF No_Conflict", ["Auto_Pass"], "primary"),
             br("ELSE IF Conflict AND Mitigating_Control", ["Log_Mitigation + Monitor"], "primary"),
             br("ELSE IF Conflict AND Unmitigated", ["Remove_Conflicting_Access", "Notify_Access_Owner"],
                "escalation", hitl="Access owner approves entitlement change", esc=1)],
            ["Access owner approves entitlement change"]),
        add(10005, "Access-Creep After Role Change", "Segregation of Duties & Access", "High", "Access_Creep",
            "They moved from AP to Treasury six months ago but kept every AP entitlement on the way. Access nobody "
            "revoked just widens the blast radius — I strip the stale rights back to the current role.",
            ["Compare_Access_To_Current_Role", "Detect_Residual_Entitlements", "Propose_Revocation", "Recertify_With_Manager"],
            [br("IF Access_Matches_Role", ["No_Action"], "primary"),
             br("ELSE IF Residual_Low_Risk", ["Auto_Revoke + Notify"], "primary"),
             br("ELSE IF Residual_Sensitive", ["Route_To_Manager_Recert", "Flag_SoD_Risk"],
                "escalation", hitl="Manager recertifies access", esc=1)],
            ["Manager recertifies access"]),
        add(10006, "Dormant Privileged Account", "Segregation of Duties & Access", "Medium", "Dormant_Account",
            "A super-user account hasn't logged in for 90 days but is still enabled. Dormant privilege is free real "
            "estate for an attacker — I disable it now and make someone re-justify it if it's really needed.",
            ["Scan_Privileged_Accounts", "Detect_Dormancy", "Disable_Provisionally", "Notify_Owner_To_Justify"],
            [br("IF Recently_Active", ["No_Action"], "primary"),
             br("ELSE IF Dormant AND Non_Critical", ["Auto_Disable + Notify"], "primary"),
             br("ELSE IF Dormant AND Critical_System", ["Route_To_Access_Owner"],
                "escalation", hitl="Access owner confirms disable", esc=1)],
            ["Access owner confirms disable"]),
        add(10007, "Emergency-Access Never Closed", "Segregation of Duties & Access", "Medium", "Firefighter_Open",
            "Firefighter access was granted for a go-live three weeks ago and never revoked. Temporary access that "
            "outlives its reason is just a standing hole in the wall — I close it and log what it did while open.",
            ["Track_Emergency_Grants", "Detect_Expired_Window", "Review_Actions_Taken", "Revoke_Access"],
            [br("IF Within_Window", ["Monitor"], "primary"),
             br("ELSE IF Expired AND Clean_Log", ["Auto_Revoke + Archive_Log"], "primary"),
             br("ELSE IF Expired AND Suspicious_Actions", ["Revoke + Escalate_Controls"],
                "escalation", hitl="Controls reviews firefighter activity", esc=1)],
            ["Controls reviews firefighter activity"]),
    ]
    functions.append({
        "id": "icc", "name": "Internal Controls & Compliance", "short": "GRC", "icon": "🛡️",
        "accent": "#c0392b", "status": "sample",
        "tagline": "Continuous control monitoring and segregation of duties — trust, evidenced.",
        "valueChain": build_icc_value_chain(),
        "processes": [{
            "id": "icc-ccm", "name": "Continuous Control Monitoring & SoD",
            "desc": "Catch control failures and toxic access before they become losses — assurance, continuously.",
            "roles": [
                {"id": "icc-analyst", "name": "Controls Analyst", "objectives": [
                    {"id": "icc-o-detect", "name": "Detect control failures early",
                     "kpi": "Control exceptions", "patternIds": [10000, 10001, 10002, 10003]},
                ]},
                {"id": "icc-access", "name": "Access Reviewer", "objectives": [
                    {"id": "icc-o-sod", "name": "Prevent toxic access combinations",
                     "kpi": "Open SoD conflicts", "patternIds": [10004, 10005, 10006, 10007]},
                ]},
            ],
        }],
    })

    return functions, stubs


def _area(name, subs, procId=None):
    """One L3 process area with its L4 sub-processes. A procId marks it BUILT —
    navigable, resolving to that process; otherwise it is landscape context."""
    a = {"name": name, "sub": subs}
    if procId:
        a["built"] = True
        a["procId"] = procId
    return a


def build_o2c_value_chain():
    """The full Order-to-Cash process taxonomy (L1 value chain → L2 groups →
    L3 process areas → L4 sub-processes). Only the Bill-to-Cash areas are backed
    by a real pattern library today (procId → the built AR process); every other
    area is landscape context, rendered but not yet navigable.
    """
    area = _area
    return {
        "name": "Order-to-Cash Value Chain",
        "groups": [
            {"id": "md", "name": "Master Data", "tone": "md", "areas": [
                area("Master Data", [
                    "Data Prep & Request Validation", "Data collection & validation",
                    "Approval & Syndication", "Ongoing Data Maintenance"]),
            ]},
            {"id": "o2d", "name": "Order to Deliver", "tone": "o2d", "areas": [
                area("Order Mgmt", [
                    "Order Intake & validation", "Order Modification / Cancellation",
                    "Credit Check & Approval", "Outbound Delivery & fulfilment"]),
                area("Order Fulfilment", [
                    "Stock Allocation & Mgmt", "Delivery Creation",
                    "Logistics Operations", "Warehouse Mgmt & Logistics"]),
                area("Customer Billing", [
                    "Invoice Generation", "Invoice validation & dispute handling",
                    "Credit Note / Debit Note processing", "Billing adjustments"]),
            ]},
            {"id": "b2c", "name": "Bill to Cash", "note": "Collections & Cash apps",
             "tone": "b2c", "areas": [
                area("Collections Mgmt", [
                    "Collections Strategy", "Collections correspondence & escalation",
                    "Promise to pay / payment plan capture", "Provisions & writeoff"],
                    procId="o2c-ar"),
                area("Cash Application", [
                    "Payment Identification", "Payment matching & reconciliation",
                    "Deduction identification", "Cash posting & adjustment"],
                    procId="o2c-ar"),
            ]},
            {"id": "claims", "name": "Claims", "tone": "claims", "areas": [
                area("Claims Mgmt", [
                    "Claims Registration", "Claims Validation",
                    "Claims Approval", "Claims Settlement"]),
            ]},
        ],
    }


def build_p2p_value_chain():
    """Procure-to-Pay lifecycle. The AP invoice + matching areas resolve to the
    built AP process; the rest map the surrounding source-to-pay landscape."""
    area = _area
    return {
        "name": "Procure-to-Pay Value Chain",
        "groups": [
            {"id": "sup", "name": "Supplier & Master Data", "tone": "md", "areas": [
                area("Vendor Onboarding & Master Data", [
                    "Vendor Registration & Validation", "Bank Detail Verification",
                    "Compliance & Risk Screening", "Ongoing Vendor Maintenance"]),
            ]},
            {"id": "s2c", "name": "Source to Contract", "tone": "violet", "areas": [
                area("Sourcing & RFQ", [
                    "Sourcing Event Setup", "Bid Evaluation & Award",
                    "Negotiation & Savings", "Supplier Selection"]),
                area("Contract Management", [
                    "Contract Authoring", "Approval & Signature",
                    "Compliance Monitoring", "Renewal & Expiry"]),
            ]},
            {"id": "p2r", "name": "Purchase to Receipt", "tone": "o2d", "areas": [
                area("Requisition Management", [
                    "Requisition Intake", "Budget & Policy Check",
                    "Requisition Approval", "PR-to-PO Conversion"]),
                area("PO Management", [
                    "PO Creation & Dispatch", "Change / Cancellation",
                    "Order Confirmation", "Expediting & Follow-up"]),
                area("Goods & Service Receipt", [
                    "Goods Receipt Posting", "Service Entry Sheet",
                    "Quality Inspection", "Returns & Rejections"]),
            ]},
            {"id": "i2p", "name": "Invoice to Pay", "note": "AP automation",
             "tone": "b2c", "areas": [
                area("Invoice Processing", [
                    "Invoice Capture & Coding", "Duplicate Detection",
                    "Non-PO Routing", "Approval Workflow"], procId="p2p-ap"),
                area("Matching & Exceptions", [
                    "2/3-Way Matching", "Tolerance & Variance",
                    "Exception Resolution", "GR/IR Clearing"], procId="p2p-ap"),
                area("Payment Execution", [
                    "Payment Proposal", "Discount Capture",
                    "Payment Run & Remittance", "Bank Reconciliation"]),
            ]},
        ],
    }


def build_r2r_value_chain():
    """Record-to-Report lifecycle. The reconciliation + period-end close areas
    resolve to the built Financial Close process; the rest map the landscape."""
    area = _area
    return {
        "name": "Record-to-Report Value Chain",
        "groups": [
            {"id": "record", "name": "Record & Capture", "tone": "o2d", "areas": [
                area("Journal & Transaction Processing", [
                    "Journal Entry Capture", "Recurring & Accrual Journals",
                    "Cost Allocations", "Sub-ledger Postings"]),
            ]},
            {"id": "close", "name": "Reconcile & Close", "note": "The built core",
             "tone": "b2c", "areas": [
                area("Account Reconciliation", [
                    "Balance Sheet Reconciliation", "Bank Reconciliation",
                    "Break Identification & Aging", "Reconciliation Sign-off"],
                    procId="r2r-close"),
                area("Period-End Close", [
                    "Close Task Orchestration", "Accrual & Provision Review",
                    "Intercompany Balancing", "Pre-close Validation"],
                    procId="r2r-close"),
            ]},
            {"id": "consol", "name": "Consolidate & Adjust", "tone": "violet", "areas": [
                area("Consolidation", [
                    "Data Collection & Mapping", "Intercompany Elimination",
                    "Currency Translation", "Minority Interest & Equity"]),
            ]},
            {"id": "report", "name": "Report & Disclose", "tone": "slate", "areas": [
                area("Financial & Management Reporting", [
                    "Statutory Financial Statements", "Management Reporting",
                    "Regulatory & Tax Reporting", "Disclosure & Filing"]),
            ]},
        ],
    }


def build_h2r_value_chain():
    """Hire-to-Retire lifecycle. The onboarding provisioning + compliance areas
    resolve to the built Employee Onboarding process; the rest map the landscape."""
    area = _area
    return {
        "name": "Hire-to-Retire Lifecycle",
        "groups": [
            {"id": "hire", "name": "Attract & Hire", "tone": "violet", "areas": [
                area("Recruitment & Sourcing", [
                    "Job Requisition", "Sourcing & Screening",
                    "Interview Management", "Offer & Negotiation"]),
            ]},
            {"id": "onboard", "name": "Onboard", "note": "Day-1 readiness",
             "tone": "md", "areas": [
                area("Pre-boarding & Provisioning", [
                    "Offer Acceptance Handover", "IT & Asset Provisioning",
                    "Workspace & Access Setup", "Provisioning Tracking"],
                    procId="h2r-onboard"),
                area("Compliance & Day-1", [
                    "Right-to-Work Verification", "Document Collection",
                    "Background Checks", "Day-1 Readiness Gate"],
                    procId="h2r-onboard"),
            ]},
            {"id": "manage", "name": "Manage & Develop", "tone": "o2d", "areas": [
                area("Core HR & Master Data", [
                    "Employee Master Data", "Org & Position Mgmt",
                    "Time & Attendance", "Leave & Absence"]),
                area("Payroll & Benefits", [
                    "Payroll Processing", "Benefits Administration",
                    "Expense & Reimbursement", "Statutory & Tax Filing"]),
                area("Talent & Performance", [
                    "Goal & Performance Mgmt", "Learning & Development",
                    "Compensation Review", "Succession Planning"]),
            ]},
            {"id": "retire", "name": "Offboard & Retire", "tone": "slate", "areas": [
                area("Separation Management", [
                    "Resignation / Termination", "Exit Clearance & Deprovisioning",
                    "Final Settlement", "Records Retention"]),
            ]},
        ],
    }


def build_fpa_value_chain():
    """Financial Planning & Analysis — Plan-to-Perform. Forecast + variance
    areas resolve to the built process; the rest map the landscape."""
    area = _area
    return {
        "name": "Plan-to-Perform Value Chain",
        "groups": [
            {"id": "plan", "name": "Plan & Target", "tone": "violet", "areas": [
                area("Strategic Planning", [
                    "Long-Range Planning", "Target Setting",
                    "Driver & Assumption Library", "Capital Allocation"]),
                area("Annual Budgeting", [
                    "Budget Calendar & Templates", "Bottom-Up Build",
                    "Top-Down Challenge", "Budget Consolidation"]),
            ]},
            {"id": "forecast", "name": "Forecast & Variance", "note": "The built core",
             "tone": "md", "areas": [
                area("Rolling Forecast", [
                    "Forecast Refresh", "Driver-Based Projection",
                    "Bias & Sandbag Detection", "Reforecast Triggers"], procId="fpa-plan"),
                area("Variance Analysis", [
                    "Actual-vs-Plan Bridge", "Variance Commentary",
                    "Phasing & Timing Split", "Controllable vs Allocated"], procId="fpa-plan"),
            ]},
            {"id": "report", "name": "Report & Steer", "tone": "o2d", "areas": [
                area("Management Reporting", [
                    "Monthly Business Review", "Flash & Board Reporting",
                    "KPI & Scorecard", "Profitability Analysis"]),
            ]},
            {"id": "decide", "name": "Decision Support", "tone": "slate", "areas": [
                area("Scenario & Investment", [
                    "Scenario Modeling", "Sensitivity Analysis",
                    "Business Case & ROI", "What-If Simulation"]),
            ]},
        ],
    }


def build_tcm_value_chain():
    """Treasury & Cash Management. Cash positioning + bank sweeps resolve to the
    built process; the rest map the landscape."""
    area = _area
    return {
        "name": "Treasury & Cash Value Chain",
        "groups": [
            {"id": "position", "name": "Plan & Position", "tone": "violet", "areas": [
                area("Cash Forecasting & Liquidity", [
                    "Short-Term Cash Forecast", "Liquidity Planning",
                    "Working-Capital Levers", "Funding Strategy"]),
            ]},
            {"id": "cash", "name": "Cash & Liquidity", "note": "The built core",
             "tone": "md", "areas": [
                area("Cash Positioning", [
                    "Daily Cash Position", "Idle-Balance Sweep",
                    "Forecast-vs-Actual Cash", "Trapped-Cash Watch"], procId="tcm-cash"),
                area("Bank Recon & Payments", [
                    "Bank Reconciliation", "Payment Release Controls",
                    "Duplicate-Payment Guard", "Bank-Fee Analysis"], procId="tcm-cash"),
            ]},
            {"id": "bank", "name": "Bank & Accounts", "tone": "o2d", "areas": [
                area("Payment Factory", [
                    "Payment Orchestration", "In-House Bank",
                    "Bank Account Mgmt", "Signatory & Mandate Control"]),
            ]},
            {"id": "risk", "name": "Debt, Investment & FX", "tone": "slate", "areas": [
                area("Financial Risk", [
                    "FX Exposure & Hedging", "Interest-Rate Risk",
                    "Covenant Monitoring", "Counterparty Risk"]),
            ]},
        ],
    }


def build_tax_value_chain():
    """Tax Management. Compliance & filing + reconciliation resolve to the built
    process; the rest map the landscape."""
    area = _area
    return {
        "name": "Tax Management Value Chain",
        "groups": [
            {"id": "determine", "name": "Determine", "tone": "violet", "areas": [
                area("Tax Determination", [
                    "Rate & Rule Engine", "Reverse-Charge Logic",
                    "Exemption & Certificates", "Master Data & Nexus"]),
            ]},
            {"id": "comply", "name": "Comply & File", "note": "The built core",
             "tone": "md", "areas": [
                area("Compliance & Filing", [
                    "Return Preparation", "Deadline Management",
                    "e-Invoicing & Clearance", "Filing & Submission"], procId="tax-comp"),
                area("Reconciliation & Payment", [
                    "Return-to-Ledger Recon", "Credit-Note Timing",
                    "Tax Payment", "Refund & Reclaim"], procId="tax-comp"),
            ]},
            {"id": "provision", "name": "Provision & Report", "tone": "o2d", "areas": [
                area("Provision & Reporting", [
                    "Current-Tax Provision", "Deferred Tax",
                    "Effective-Rate Analysis", "Statutory Disclosure"]),
            ]},
            {"id": "audit", "name": "Audit & Controversy", "tone": "slate", "areas": [
                area("Audit Management", [
                    "Audit Response", "Assessment Tracking",
                    "Rulings & Positions", "Dispute Resolution"]),
            ]},
        ],
    }


def build_tne_value_chain():
    """Travel & Expense. Expense audit + policy resolve to the built process;
    the rest map the landscape."""
    area = _area
    return {
        "name": "Travel & Expense Value Chain",
        "groups": [
            {"id": "book", "name": "Request & Book", "tone": "violet", "areas": [
                area("Travel Request & Booking", [
                    "Trip Request & Approval", "Online Booking Tool",
                    "Cash Advances", "Pre-Trip Policy Check"]),
            ]},
            {"id": "capture", "name": "Capture & Audit", "note": "The built core",
             "tone": "md", "areas": [
                area("Expense Capture & Audit", [
                    "Receipt Capture & OCR", "Duplicate-Claim Detection",
                    "Fraud & Anomaly Scoring", "Mileage & Per-Diem Check"], procId="tne-exp"),
                area("Policy & Compliance", [
                    "Policy Rule Engine", "Out-of-Policy Flagging",
                    "Missing-Receipt Chase", "Submission-Window Control"], procId="tne-exp"),
            ]},
            {"id": "reimburse", "name": "Approve & Reimburse", "tone": "o2d", "areas": [
                area("Approval & Reimbursement", [
                    "Approval Workflow", "Reimbursement Run",
                    "Payroll / AP Posting", "VAT Reclaim"]),
            ]},
            {"id": "control", "name": "Analyze & Control", "tone": "slate", "areas": [
                area("Spend Analytics", [
                    "Category Spend Analysis", "Card Program Mgmt",
                    "Vendor & Rate Leakage", "Compliance Dashboards"]),
            ]},
        ],
    }


def build_icc_value_chain():
    """Internal Controls & Compliance (SOX/GRC). Continuous monitoring + SoD
    resolve to the built process; the rest map the landscape."""
    area = _area
    return {
        "name": "Internal Controls & Compliance Value Chain",
        "groups": [
            {"id": "design", "name": "Design & Scope", "tone": "violet", "areas": [
                area("Risk & Control Design", [
                    "Risk Assessment", "Control Framework",
                    "Scoping & Materiality", "Control Documentation"]),
            ]},
            {"id": "operate", "name": "Operate & Monitor", "note": "The built core",
             "tone": "md", "areas": [
                area("Continuous Control Monitoring", [
                    "Journal-Entry Testing", "Master-Data Change Watch",
                    "Config & Threshold Monitors", "Privileged-Access Alerts"], procId="icc-ccm"),
                area("Segregation of Duties", [
                    "Toxic-Combination Detection", "Access-Creep Review",
                    "Dormant-Account Sweep", "Emergency-Access Control"], procId="icc-ccm"),
            ]},
            {"id": "certify", "name": "Test & Certify", "tone": "o2d", "areas": [
                area("Testing & Certification", [
                    "Control Testing", "Evidence Collection",
                    "Sub-Certification", "Management Sign-off"]),
            ]},
            {"id": "remediate", "name": "Remediate & Report", "tone": "slate", "areas": [
                area("Issue & Assurance", [
                    "Deficiency Logging", "Remediation Tracking",
                    "Internal Audit Liaison", "Regulatory Reporting"]),
            ]},
        ],
    }


def build_ar_function(patterns):
    """Order-to-Cash, fully populated against the real 31-pattern library."""
    cat = lambda c: ids_for_category(patterns, c)
    return {
        "id": "o2c", "name": "Order-to-Cash", "short": "O2C", "icon": "💵",
        "accent": "#e67e22", "status": "live",
        "tagline": "AR collections, disputes, credit risk — the fully-built core.",
        "valueChain": build_o2c_value_chain(),
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
