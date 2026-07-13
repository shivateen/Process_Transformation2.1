#!/usr/bin/env python3
"""
build_mining.py — Generate src/data/mining.json: the Pattern Studio "Mine" tab.

Pattern Studio = the old Pattern Library (catalogue) + a document-mining workshop.
This file carries the two things the Mine tab needs:

  uploadCategories : the 7-category / 26-slot accordion the SME drops documents into
  candidates       : the pool of *minable* patterns — each a full pattern structure
                     (identical shape to patterns.json) plus evidence / confidence /
                     similarTo, and a `requires` list of the document categories whose
                     presence in the corpus is what surfaces it

IMPORTANT — no live LLM.
The accelerator is on-device and deterministic (see CLAUDE.md); there is no model
endpoint here. Stage 3 of the pipeline is therefore a *deterministic* selection: a
candidate surfaces only when the corpus actually contains the document categories its
evidence chain depends on, and its confidence is scaled by how much of that evidence
landed. `fewShotPrompt` holds the exact prompt that a real extractor would be sent,
rendered verbatim in the UI ("show the prompt"), so the seam to a live model is one
function call wide — see PIQ.patternStudio.mine() in library.js.

  python scripts/build_mining.py
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATTERNS = os.path.join(ROOT, "src", "data", "patterns.json")
OUT = os.path.join(ROOT, "src", "data", "mining.json")

XL = [".xlsx", ".csv"]
DOC = [".pdf", ".docx"]


def upload_categories():
    return [
        {"id": "txn", "label": "Transactional Evidence",
         "blurb": "The richest seam — what actually happened, transaction by transaction.",
         "slots": [
             {"id": "exception-logs", "label": "Exception logs",
              "hint": "Blocked invoices, failed postings, held orders, credit check failures",
              "formats": [".xlsx", ".csv", ".json"]},
             {"id": "aging-notes", "label": "Aging reports with notes",
              "hint": "Collector freetext fields — the real story", "formats": XL},
             {"id": "dispute-logs", "label": "Dispute / deduction logs",
              "hint": "Reason codes and resolution narratives", "formats": [".xlsx", ".csv", ".pdf"]},
             {"id": "payment-history", "label": "Payment history / remittance",
              "hint": "Timing patterns, partial payments, broken promises", "formats": XL},
             {"id": "credit-memos", "label": "Credit memos & write-offs",
              "hint": "What was given up on, and why", "formats": [".xlsx", ".csv", ".pdf"]},
         ]},
        {"id": "policy", "label": "Process & Policy",
         "blurb": "What the organisation says it does.",
         "slots": [
             {"id": "process-docs", "label": "Process documentation",
              "hint": "SOPs, work instructions, L3/L4 process maps", "formats": [".pdf", ".docx", ".xlsx"]},
             {"id": "raci", "label": "RACI matrices",
              "hint": "Who's responsible, accountable, consulted, informed", "formats": [".xlsx", ".pdf", ".docx"]},
             {"id": "credit-policy", "label": "Credit / collections policy",
              "hint": "Limits, review triggers, approval matrices, dunning playbooks", "formats": DOC},
             {"id": "escalation", "label": "Escalation protocols",
              "hint": "When and how issues move up the chain", "formats": DOC},
             {"id": "writeoff-policy", "label": "Write-off & bad debt policy",
              "hint": "Thresholds, approval flows, provisioning rules", "formats": DOC},
         ]},
        {"id": "analytics", "label": "Operational Analytics",
         "blurb": "What the numbers already told you.",
         "slots": [
             {"id": "kpi-reports", "label": "KPI reports / dashboards",
              "hint": "Exported performance snapshots", "formats": [".xlsx", ".csv", ".pdf"]},
             {"id": "process-mining", "label": "Process mining exports",
              "hint": "Celonis, Signavio — event logs, variant analysis",
              "formats": [".csv", ".xlsx", ".json", ".xml"]},
             {"id": "cycle-time", "label": "Cycle time / touch-count reports",
              "hint": "How long, and how many humans, per transaction", "formats": XL},
             {"id": "rca", "label": "Root cause analysis",
              "hint": "Past improvement projects — what they found", "formats": [".pdf", ".docx", ".xlsx"]},
         ]},
        {"id": "org", "label": "Organizational & Behavioral",
         "blurb": "Who does the work, and what they're rewarded for.",
         "slots": [
             {"id": "org-chart", "label": "Org structure / hierarchy",
              "hint": "Reporting lines and team shape", "formats": [".pdf", ".xlsx", ".docx"]},
             {"id": "skills", "label": "Skills matrix / capabilities",
              "hint": "What the team can and can't do today", "formats": [".xlsx", ".pdf"]},
             {"id": "training", "label": "Training materials",
              "hint": "What staff are taught to look for", "formats": DOC},
             {"id": "scorecards", "label": "Performance scorecards",
              "hint": "What behaviours are incentivised", "formats": [".xlsx", ".pdf"]},
         ]},
        {"id": "comms", "label": "Communication Trails",
         "blurb": "The conversation around the transaction.",
         "slots": [
             {"id": "email", "label": "Email threads",
              "hint": "Collector ↔ customer correspondence", "formats": [".pdf", ".docx", ".txt"]},
             {"id": "call-logs", "label": "Call logs / notes",
              "hint": "Collection call summaries", "formats": [".xlsx", ".csv", ".docx"]},
             {"id": "dunning", "label": "Dunning history",
              "hint": "Letter templates, send dates, response rates", "formats": [".xlsx", ".csv", ".pdf"]},
         ]},
        {"id": "external", "label": "External & Contextual",
         "blurb": "The world the process operates in.",
         "slots": [
             {"id": "benchmarks", "label": "Industry benchmarks",
              "hint": "APQC, Hackett Group metrics", "formats": [".pdf", ".xlsx"]},
             {"id": "customer-master", "label": "Customer master data",
              "hint": "Segments, payment terms, risk ratings", "formats": XL},
             {"id": "contracts", "label": "Contracts & terms",
              "hint": "Payment terms, penalty clauses, SLAs", "formats": DOC},
             {"id": "bureau", "label": "Bureau / credit reports",
              "hint": "D&B, Experian on key counterparties", "formats": [".pdf", ".xlsx"]},
         ]},
        {"id": "control", "label": "Control & Compliance",
         "blurb": "What must not go wrong.",
         "slots": [
             {"id": "sox", "label": "SOX control narratives",
              "hint": "Control descriptions and test results", "formats": [".pdf", ".docx", ".xlsx"]},
             {"id": "audit", "label": "Internal audit reports",
              "hint": "Findings and management responses", "formats": DOC},
             {"id": "sod", "label": "Segregation-of-duty matrix",
              "hint": "Who can't do what together", "formats": [".xlsx", ".pdf"]},
         ]},
    ]


def C(cid, name, slug, cat, prio, requires, confidence, similar, mental, l1, l2, l3,
      sql, dag, branches, gates, evidence, signals, sources):
    """One candidate pattern — same shape as a patterns.json entry, plus mining metadata."""
    return {
        "cid": cid, "name": name, "featureSlug": slug, "category": cat, "priority": prio,
        "mentalModel": mental,
        "sources": sources,
        "layer1_logicalMapping": l1, "layer2_eventSeries": l2, "layer3_feature": l3,
        "conceptualSQL": sql,
        "originalDAG": dag, "branchingDAG": branches, "hitlGates": gates,
        # ---- mining metadata ----
        "requires": requires,          # document categories whose presence surfaces this
        "confidence": confidence,      # ceiling; scaled by how much required evidence landed
        "similarTo": similar,          # {id, name, score} or None
        "evidence": evidence,          # [{slot, excerpt}]
        "signals": signals,            # signal names this candidate is built from
    }


def candidates():
    return [
        C("CAND-A", "Seasonal Treasury Squeeze", "seasonal-treasury-squeeze",
          "Intentional Stalling & Delay Tactics", "High",
          ["txn", "analytics"], 0.86,
          None,
          "They pay us fine for ten months, then quarter-end lands and suddenly everyone is 'awaiting approval'. It is not distress — it is their treasury calendar, and we are the float.",
          "Payment delay clusters in the last 10 days of the customer's fiscal quarter, then normalises. Correlate BSID clearing dates against the customer's fiscal calendar.",
          "Invoice_Posted → Due_Date_Passed → Payment_Delayed (quarter-end window) → Payment_Received (quarter+1 week)",
          "Fiscal_Quarter_Payment_Skew",
          "SELECT kunnr, AVG(CASE WHEN quarter_end_window THEN days_late END) - AVG(CASE WHEN NOT quarter_end_window THEN days_late END) AS skew FROM ar_clearing GROUP BY kunnr HAVING skew > 9",
          ["Ingest_Invoice", "Map_Customer_Fiscal_Calendar", "Compute_Quarter_End_Skew", "Flag_Seasonal_Delay", "Pre_Dun_Ahead_Of_Window"],
          [{"condition": "IF Skew > 9 days AND Payment_History_Otherwise_Clean", "actions": ["Shift_Dunning_Earlier + Notify_Collector"], "hitl": None, "tier": "primary"},
           {"condition": "IF Skew > 20 days AND Exposure > $500K", "actions": ["Propose_Term_Renegotiation + Alert_Treasury"], "hitl": "Credit Manager approval", "tier": "escalation"},
           {"condition": "IF Skew rising QoQ for 3 quarters", "actions": ["Escalate_To_Credit_Review"], "hitl": "CFO review", "tier": "immediate"}],
          ["Credit Manager approval", "CFO review"],
          [{"slot": "aging-notes", "excerpt": "\"Customer AP confirms invoice approved — payment run moved to next quarter per their treasury policy.\" (recurs 34× across Q1–Q3 notes)"},
           {"slot": "exception-logs", "excerpt": "142 held/late events cluster in the final 10 days of Mar / Jun / Sep — 3.1× the base rate."},
           {"slot": "cycle-time", "excerpt": "Days-to-pay rises from 41 to 58 in quarter-end weeks, then reverts."}],
          ["quarter-end delay cluster", "AP-approved-but-unpaid narrative", "days-to-pay seasonality"],
          {"sap": ["BSID (ZFBDT, AUGDT)", "KNB1 (customer fiscal calendar)"],
           "oracle": ["AR_PAYMENT_SCHEDULES_ALL (DUE_DATE, ACTUAL_DATE_CLOSED)", "HZ_CUST_ACCOUNTS"]}),

        C("CAND-B", "Remittance Format Churn", "remittance-format-churn",
          "Cash Application & Matching Integrity", "Medium",
          ["txn"], 0.81,
          {"id": 25, "name": "Duplicate Payment Bait", "score": 0.41},
          "Every month the remittance file looks different. Not corrupt — different. Enough to break auto-match and buy them a week of float while we key it by hand.",
          "Remittance advice layout/field-order changes month over month for the same payer, driving auto-match failure without any change in payment volume.",
          "Payment_Received → Remittance_Parsed (fail) → Manual_Keying → Cash_Applied (T+5)",
          "Remittance_Schema_Volatility",
          "SELECT payer_id, COUNT(DISTINCT remit_schema_hash) AS schema_variants, SUM(automatch_fail) AS fails FROM cash_app_lines GROUP BY payer_id HAVING schema_variants >= 3",
          ["Ingest_Remittance", "Hash_Schema", "Compare_To_Prior_Schema", "Detect_Churn", "Route_To_Manual_Match"],
          [{"condition": "IF Schema_Variants >= 3 AND Auto_Match_Rate < 40%", "actions": ["Pin_Parser_Template + Notify_Cash_App_Lead"], "hitl": None, "tier": "primary"},
           {"condition": "IF Churn persists 3 months AND Unapplied > $250K", "actions": ["Request_Standard_Remittance + Escalate_To_AR_Manager"], "hitl": "AR Manager approval", "tier": "escalation"}],
          ["AR Manager approval"],
          [{"slot": "payment-history", "excerpt": "4 payers account for 61% of auto-match failures; each shows ≥3 distinct remittance layouts in 6 months."},
           {"slot": "exception-logs", "excerpt": "214 unapplied cash lines, 88% traced to remittance parse failure rather than payment shortfall."}],
          ["remittance schema variants", "auto-match failure concentration", "unapplied cash ageing"],
          {"sap": ["BSID / BSAD (payment lines)", "FEBEP (bank statement items)"],
           "oracle": ["AR_CASH_RECEIPTS_ALL", "AR_RECEIVABLE_APPLICATIONS_ALL"]}),

        C("CAND-C", "Approval Threshold Shadowing", "approval-threshold-shadowing",
          "Cross-Process AR Governance", "Critical",
          ["policy", "control"], 0.88,
          {"id": 64, "name": "Threshold Splitting", "score": 0.74},
          "Nobody breaks the approval rule. They just never quite reach it. Every credit memo lands a few hundred dollars under the line that would have sent it to me.",
          "Credit memo / write-off amounts cluster immediately below a documented approval threshold, indicating deliberate sizing to stay within delegated authority.",
          "Credit_Memo_Raised → Amount_Just_Below_Threshold → Auto_Approved → Posted (no second signature)",
          "Sub_Threshold_Clustering",
          "SELECT approver, COUNT(*) FROM credit_memos WHERE amount BETWEEN threshold*0.90 AND threshold*0.999 GROUP BY approver HAVING COUNT(*) > 10",
          ["Ingest_Credit_Memo", "Load_Approval_Matrix", "Compute_Threshold_Distance", "Detect_Sub_Threshold_Cluster", "Hold_For_Second_Signature"],
          [{"condition": "IF Amount within 10% below threshold AND Approver_Repeat_Count > 5", "actions": ["Flag_For_Review + Log_Control_Event"], "hitl": "Controller review", "tier": "primary"},
           {"condition": "IF Cluster spans multiple approvers on one customer", "actions": ["Freeze_Memo + Escalate_To_Compliance"], "hitl": "CRO approval", "tier": "immediate"}],
          ["Controller review", "CRO approval"],
          [{"slot": "writeoff-policy", "excerpt": "\"Credit memos above $25,000 require Controller counter-signature.\" (Write-off policy v4.2, §3.1)"},
           {"slot": "audit", "excerpt": "Internal audit FY24-07: \"a material share of memos fall in the $22.5K–$25K band; management response pending.\""},
           {"slot": "sod", "excerpt": "2 credit analysts hold both memo-raise and memo-approve rights."}],
          ["documented approval threshold", "sub-threshold amount cluster", "SoD conflict"],
          {"sap": ["BSEG (credit memo lines)", "T077D / approval matrix config"],
           "oracle": ["AR_CREDIT_MEMOS", "AP_WEB_AUTHORIZATION_RULES"]}),

        C("CAND-D", "Escalation Dead-Zone", "escalation-dead-zone",
          "Intentional Stalling & Delay Tactics", "High",
          ["policy", "comms"], 0.79,
          None,
          "The playbook says escalate at day 45. The collectors escalate at day 70. That 25-day gap is where the money goes quiet — and nobody owns it.",
          "A structural gap between the escalation protocol's documented trigger and the point at which escalation is actually observed in the communication trail.",
          "Dunning_Sent → No_Response → (policy trigger passes, no action) → Escalation_Raised (late)",
          "Policy_To_Practice_Escalation_Lag",
          "SELECT AVG(actual_escalation_day - policy_escalation_day) AS lag FROM dunning_events JOIN escalation_policy USING (segment) HAVING lag > 14",
          ["Ingest_Dunning_Event", "Load_Escalation_Protocol", "Compute_Policy_Lag", "Detect_Dead_Zone", "Auto_Escalate_At_Policy_Trigger"],
          [{"condition": "IF Lag > 14 days AND Balance > $50K", "actions": ["Auto_Escalate + Notify_Collections_Manager"], "hitl": None, "tier": "primary"},
           {"condition": "IF Lag > 30 days AND Customer_On_Watchlist", "actions": ["Immediate_Escalation + Credit_Hold"], "hitl": "Collections Manager approval", "tier": "escalation"}],
          ["Collections Manager approval"],
          [{"slot": "escalation", "excerpt": "\"Accounts 45 days past due are escalated to the Collections Manager.\" (Escalation protocol, §2)"},
           {"slot": "call-logs", "excerpt": "Median first manager-level contact occurs at day 70; 210 accounts sat 45–70 days with no logged action."},
           {"slot": "dunning", "excerpt": "Dunning letter 3 of 3 sent, then a median 24-day silence before any further activity."}],
          ["documented escalation trigger", "observed escalation day", "post-dunning silence window"],
          {"sap": ["UDM_DUNNING (dunning history)", "BSID (open items)"],
           "oracle": ["AR_DUNNING_LETTERS", "IEX_DELINQUENCIES"]}),

        C("CAND-E", "Incentive-Driven Month-End Discounting", "incentive-month-end-discounting",
          "Billing Accuracy & Revenue Integrity", "High",
          ["org", "txn"], 0.83,
          None,
          "The credit memos spike in the last three days of the month — the same three days the sales scorecard closes. That is not a coincidence, it is a comp plan.",
          "Concessions and credit memos concentrate in the final days of the incentive period, correlating with a scorecard metric rather than with any customer event.",
          "Month_End_Approaching → Concession_Granted → Revenue_Recognised → Scorecard_Met",
          "Incentive_Window_Concession_Spike",
          "SELECT DAY(posting_date) AS d, SUM(memo_amount) FROM credit_memos GROUP BY d HAVING SUM(memo_amount) > 3 * (SELECT AVG(daily_memo) FROM ...) AND d >= days_in_month - 2",
          ["Ingest_Concession", "Map_To_Incentive_Calendar", "Compute_Window_Spike", "Flag_Incentive_Correlation", "Route_For_Revenue_Review"],
          [{"condition": "IF Spike > 3× baseline in final 3 days", "actions": ["Flag_For_Revenue_Review + Notify_Controller"], "hitl": "Controller review", "tier": "primary"},
           {"condition": "IF Same rep repeats across 3 periods", "actions": ["Escalate_To_Compliance + Hold_Concessions"], "hitl": "CRO approval", "tier": "escalation"}],
          ["Controller review", "CRO approval"],
          [{"slot": "scorecards", "excerpt": "Sales scorecard closes on the final calendar day; \"net revenue booked\" carries a 40% weighting."},
           {"slot": "credit-memos", "excerpt": "38% of credit-memo value posts in the last 3 days of the month, against 10% expected."},
           {"slot": "training", "excerpt": "Rep onboarding deck: \"use goodwill credits to protect the close.\""}],
          ["incentive period boundary", "concession value spike", "rep-level repetition"],
          {"sap": ["BSEG (memo postings)", "VBRK (billing docs)"],
           "oracle": ["AR_CREDIT_MEMOS", "OKC_K_HEADERS_B"]}),

        C("CAND-F", "Contractual SLA Weaponisation", "contractual-sla-weaponisation",
          "Relationship & Contractual Abuse", "Medium",
          ["external", "comms"], 0.76,
          {"id": 20, "name": "Partial Breadcrumbing", "score": 0.38},
          "They read the contract more carefully than we did. Every late delivery, however trivial, becomes a documented SLA breach — and a licence to hold the whole invoice.",
          "Customer cites contractual SLA/penalty clauses to justify withholding, at a rate far exceeding the actual incidence of service failures.",
          "Delivery_Event → SLA_Claim_Raised → Full_Invoice_Withheld → Negotiated_Settlement",
          "SLA_Claim_To_Breach_Ratio",
          "SELECT customer_id, COUNT(sla_claims) / NULLIF(COUNT(actual_breaches), 0) AS ratio FROM disputes GROUP BY customer_id HAVING ratio > 3",
          ["Ingest_Dispute", "Load_Contract_Terms", "Verify_Actual_Breach", "Compute_Claim_Ratio", "Reject_Unsupported_Claim"],
          [{"condition": "IF Claim_Ratio > 3 AND Breach_Unverified", "actions": ["Reject_Claim + Cite_Contract_Clause"], "hitl": None, "tier": "primary"},
           {"condition": "IF Withheld > $200K AND Strategic_Account", "actions": ["Route_To_Legal + Notify_Account_Exec"], "hitl": "Legal review", "tier": "escalation"}],
          ["Legal review"],
          [{"slot": "contracts", "excerpt": "MSA §9.4: \"Customer may withhold disputed amounts pending resolution of any service level failure.\""},
           {"slot": "email", "excerpt": "17 threads cite §9.4 verbatim; only 4 correspond to a logged delivery exception."},
           {"slot": "dispute-logs", "excerpt": "SLA-coded disputes: 41 raised, 11 substantiated on investigation."}],
          ["contract clause citation", "unsubstantiated SLA claim", "withheld-amount concentration"],
          {"sap": ["UDM_DISPUTE (reason codes)", "VBAK / contract data"],
           "oracle": ["AR_DISPUTES", "OKC_K_LINES_B"]}),

        C("CAND-G", "Onboarding Data Debt", "onboarding-data-debt",
          "Credit Risk & Exposure Control", "Medium",
          ["external", "analytics"], 0.72,
          None,
          "Half our exposure sits behind customer records that were opened in a hurry and never finished. No risk rating, no terms, no bureau pull — and no limit that means anything.",
          "Customer master records created without complete credit attributes correlate with materially higher downstream delinquency.",
          "Customer_Created (incomplete) → Credit_Limit_Defaulted → Orders_Released → Delinquency",
          "Master_Data_Completeness_Risk",
          "SELECT completeness_bucket, AVG(days_late) FROM customer_master JOIN ar_aging USING (kunnr) GROUP BY completeness_bucket",
          ["Ingest_Customer_Master", "Score_Completeness", "Join_Delinquency_History", "Flag_Data_Debt", "Block_Limit_Increase"],
          [{"condition": "IF Completeness < 60% AND Exposure > $100K", "actions": ["Request_Bureau_Pull + Freeze_Limit_Increase"], "hitl": None, "tier": "primary"},
           {"condition": "IF Completeness < 40% AND Delinquent", "actions": ["Credit_Hold + Escalate_To_Credit_Manager"], "hitl": "Credit Manager approval", "tier": "escalation"}],
          ["Credit Manager approval"],
          [{"slot": "customer-master", "excerpt": "31% of active customers have no risk rating; 18% carry the system-default payment term."},
           {"slot": "kpi-reports", "excerpt": "Incomplete-record customers are 2.4× more likely to breach 60 days."},
           {"slot": "bureau", "excerpt": "No bureau file on record for 22 of the top-100 exposures."}],
          ["master-data completeness score", "default-term prevalence", "delinquency correlation"],
          {"sap": ["KNA1 / KNB1 (customer master)", "KNKK (credit master)"],
           "oracle": ["HZ_CUST_ACCOUNTS", "AR_CUSTOMER_PROFILES"]}),

        C("CAND-H", "Reopen-and-Restart Dispute Loop", "reopen-restart-dispute-loop",
          "Dispute Lifecycle Management", "High",
          ["txn", "comms"], 0.80,
          {"id": 7, "name": "Stale Promo Exploitation", "score": 0.35},
          "The dispute is closed. Then they reopen it on a new reason code, and the clock starts again from zero. Same invoice, third reason, ninety days gone.",
          "The same invoice is disputed repeatedly under successive reason codes, each reopening resetting the resolution SLA clock.",
          "Dispute_Closed → Reopened (new reason code) → SLA_Clock_Reset → Repeat",
          "Dispute_Reopen_Cascade",
          "SELECT invoice_id, COUNT(DISTINCT reason_code) AS codes, COUNT(*) AS reopens FROM disputes GROUP BY invoice_id HAVING reopens >= 3",
          ["Ingest_Dispute", "Link_To_Prior_Disputes", "Count_Reopen_Cascade", "Freeze_SLA_Clock", "Consolidate_Into_Single_Case"],
          [{"condition": "IF Reopens >= 3 on one invoice", "actions": ["Consolidate_Case + Preserve_Original_Clock"], "hitl": None, "tier": "primary"},
           {"condition": "IF Reopens >= 5 OR Age > 120 days", "actions": ["Deny_Reopen + Escalate_To_Dispute_Lead"], "hitl": "AR Manager approval", "tier": "escalation"}],
          ["AR Manager approval"],
          [{"slot": "dispute-logs", "excerpt": "61 invoices carry ≥3 dispute records, each under a different reason code; mean age 118 days."},
           {"slot": "email", "excerpt": "\"Closing this one out — customer has come back on pricing instead of delivery.\" (collector, 9 similar threads)"}],
          ["reason-code rotation", "dispute reopen count", "SLA clock reset"],
          {"sap": ["UDM_DISPUTE (CASE_GUID, REASON_CODE, STATUS)", "BSID"],
           "oracle": ["AR_DISPUTES (DISPUTE_STATUS, DISPUTE_REASON)", "AR_PAYMENT_SCHEDULES_ALL"]}),
    ]


FEW_SHOT = """You are a process transformation expert analysing discovery documents to identify
behavioural patterns in {function} processes.

Here are examples of known patterns from the existing library:
{examples}

Now analyse the following documents and signals:
{signals}

Identify NEW behavioural patterns not already captured in the library above.
For each candidate pattern, provide:
 1. name          — a concise descriptive name
 2. featureSlug   — kebab-case identifier
 3. description   — what this pattern represents and why it matters
 4. triggers      — observable conditions that indicate this pattern
 5. originalDAG   — the happy-path action sequence (straight-through resolution)
 6. branchingDAG  — variation branches with tiers (primary/escalation/immediate),
                    actions, and HITL gates
 7. evidence      — which documents and signals support this pattern
 8. confidence    — 0-1 score for how strongly the evidence supports this
 9. similarTo     — if this resembles an existing pattern, which one and how

Structure each candidate pattern EXACTLY like the examples above."""


def build():
    cands = candidates()
    return {
        "meta": {
            "title": "Pattern Studio — document mining",
            "note": ("No live LLM in this build: candidate selection is deterministic and "
                     "evidence-gated. fewShotPrompt is the exact prompt a real extractor "
                     "would receive — wire it in at PIQ.patternStudio.mine()."),
            "acceptedFormats": [".pdf", ".xlsx", ".csv", ".docx", ".txt", ".json", ".xml"],
            "quickStart": ["txn", "policy"],
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
        },
        "uploadCategories": upload_categories(),
        "candidates": cands,
        "fewShotPrompt": FEW_SHOT,
    }


def main():
    data = build()
    # every candidate's `requires` must name a real category; similarTo must name a real pattern
    cats = {c["id"] for c in data["uploadCategories"]}
    slots = {s["id"] for c in data["uploadCategories"] for s in c["slots"]}
    ids = set()
    try:
        ids = {p["id"] for p in json.load(open(PATTERNS, encoding="utf-8"))["patterns"]}
    except Exception as e:
        print("  (pattern validation skipped:", e, ")")

    for c in data["candidates"]:
        bad = [r for r in c["requires"] if r not in cats]
        if bad:
            raise SystemExit("%s requires unknown category %s" % (c["cid"], bad))
        for ev in c["evidence"]:
            if ev["slot"] not in slots:
                raise SystemExit("%s evidence cites unknown slot '%s'" % (c["cid"], ev["slot"]))
        if c["similarTo"] and ids and c["similarTo"]["id"] not in ids:
            print("  WARNING: %s similarTo unknown pattern #%s" % (c["cid"], c["similarTo"]["id"]))

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    nslots = sum(len(c["slots"]) for c in data["uploadCategories"])
    print("Wrote %s (%d categories / %d slots, %d minable candidates)" % (
        os.path.relpath(OUT, ROOT), len(data["uploadCategories"]), nslots, len(data["candidates"])))


if __name__ == "__main__":
    main()
