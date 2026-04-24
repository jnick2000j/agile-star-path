// Phase 2 — Unified AI drafting endpoint.
// Routes "field" requests to gemini-2.5-flash and "wizard" requests to gemini-2.5-pro.
// Logs every call to ai_audit_log with status = 'pending' (human approval required).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { evaluateResidency } from "../_shared/residency.ts";
import { consumeAiCredits } from "../_shared/credits.ts";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIELD_MODEL = "google/gemini-2.5-flash";
const WIZARD_MODEL = "google/gemini-2.5-pro";
const PROMPT_VERSION = "v1.0";

type FieldMode = "improve" | "shorten" | "expand" | "translate" | "formal";

interface FieldRequest {
  kind: "field";
  mode: FieldMode;
  text: string;
  context?: string;
  language?: string;
  field?: string;
  entity_type?: string;
  entity_id?: string;
}

type WizardKind =
  | "project_brief"
  | "pid"
  | "programme_mandate"
  | "benefit_profile"
  | "change_request"
  | "exception_report"
  | "risk_suggestions"
  | "issue_suggestions"
  | "user_story"
  | "status_update"
  | "vision_statement"
  | "comms_pack_draft"
  | "governance_narrative"
  | "risk_heatmap_narrative"
  | "stakeholder_map"
  | "lessons_digest"
  | "sprint_retro_summary"
  | "definition_of_ready"
  | "cm_normal_change"
  | "cm_standard_change"
  | "cm_emergency_change"
  | "cm_rollback_plan"
  | "cm_cab_pack"
  | "cm_post_implementation_review"
  | "cm_impact_assessment"
  | "hd_incident_writeup"
  | "hd_problem_record"
  | "hd_service_request"
  | "hd_kb_article"
  | "hd_major_incident_comms"
  | "hd_csat_followup"
  | "hd_sla_policy_draft"
  // Construction & Engineering wizards
  | "con_rfi"
  | "con_submittal_log"
  | "con_method_statement"
  | "con_ncr"
  | "con_toolbox_talk"
  | "con_daily_log"
  | "con_change_order"
  | "con_commissioning_pack"
  | "con_handover_register"
  | "con_subcontractor_scope"
  | "con_lookahead_plan"
  | "con_permit_to_work"
  // Professional Services & Consulting wizards
  | "ps_proposal"
  | "ps_sow"
  | "ps_msa_summary"
  | "ps_change_order"
  | "ps_engagement_kickoff"
  | "ps_status_report"
  | "ps_deliverable_acceptance"
  | "ps_qa_review"
  | "ps_resource_plan"
  | "ps_wip_writeoff_memo"
  | "ps_post_engagement_review"
  | "ps_csat_followup"
  | "ps_case_study";

interface WizardRequest {
  kind: "wizard";
  wizard: WizardKind;
  inputs: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
}

type DraftRequest = FieldRequest | WizardRequest;

const FIELD_SYSTEM_PROMPTS: Record<FieldMode, string> = {
  improve:
    "You are an editorial assistant for a programme/project management platform. Rewrite the user's text so it reads more clearly and professionally without changing the meaning. Return ONLY the rewritten text — no preamble, no quotes, no explanations.",
  shorten:
    "Compress the user's text by ~50% while keeping every key fact. Return ONLY the shorter text.",
  expand:
    "Expand the user's text with helpful context, structure, and concrete detail suitable for a PRINCE2 / MSP audience. Do not invent facts. Return ONLY the expanded text.",
  translate:
    "Translate the user's text into the target language. Preserve tone, terminology and any product names. Return ONLY the translation.",
  formal:
    "Rewrite the user's text in a formal executive tone suitable for a steering committee report. Return ONLY the rewritten text.",
};

const WIZARD_SYSTEM_PROMPTS: Record<WizardKind, string> = {
  project_brief:
    "You are a PRINCE2-trained project consultant. Draft a Project Brief covering: Background, Project Definition (objectives, scope, deliverables, exclusions, constraints, assumptions), Outline Business Case, Project Approach, and Project Management Team Structure. Use clear headings.",
  pid: "You are a PRINCE2 PID author. Produce a complete Project Initiation Document with sections: Project Definition, Business Case, Organisation Structure, Quality Management Approach, Configuration Management Approach, Risk Management Approach, Communication Management Approach, Project Plan, Project Controls, Tailoring.",
  programme_mandate:
    "You are an MSP-trained programme manager. Draft a Programme Mandate with: Strategic Objectives, Vision Statement (one paragraph), Drivers for Change, Expected Benefits, Outline Scope, Constraints, Assumptions, Initial Risks.",
  benefit_profile:
    "You are an MSP benefits manager. Draft a Benefit Profile with: Description, Category (cashable / non-cashable), Owner, Measurement Method, Baseline, Target, Realisation Timeline (with milestones), Dependencies, Dis-benefits.",
  change_request:
    "You are a PRINCE2 change authority. Draft a Change Request covering: Summary, Reason for Change, Description of Change, Impact Analysis (cost, time, quality, scope, benefits, risk), Options Considered, Recommendation.",
  exception_report:
    "You are a PRINCE2 project manager raising an Exception Report. Sections: Exception Title, Cause, Consequences, Options (with pros/cons), Recommendation, Lessons.",
  risk_suggestions:
    "Based on the entity provided, suggest 3-5 likely risks. For each: title, description (1-2 sentences), category, probability (low/medium/high), impact (low/medium/high), suggested mitigation.",
  issue_suggestions:
    "Based on the entity provided, suggest 3-5 likely issues that could surface. For each: title, description, type (problem/concern/question), priority, suggested action.",
  user_story:
    "Convert the user's one-liner into a complete user story with: Title, As a / I want / So that, Acceptance Criteria (3-6 bullets, Given/When/Then format), MoSCoW classification with one-line rationale, and a RICE estimate (reach 1-10, impact 1-10, confidence 0-100%, effort in story points).",
  status_update:
    "Synthesise a concise status update from the supplied recent activity. Structure: Headline (one sentence), Progress (3-5 bullets), Risks & Issues (highlight new/elevated), Next Week.",
  vision_statement:
    "You are a strategy coach. Produce a one-paragraph vision statement (~60 words), then a 5-point 'why this matters' list, then 3 candidate north-star metrics. Tone: ambitious but credible.",
  comms_pack_draft:
    "You are a communications lead. Produce three coordinated outputs from the inputs: (1) Executive email (subject + 120-word body), (2) Slack/Teams post (3-5 short bullets, emoji ok), (3) Stakeholder PDF summary (markdown, headings: Highlights / Risks / Asks / Next Steps).",
  governance_narrative:
    "You are a programme assurance lead. Turn the supplied governance metrics into a board-ready narrative: Headline RAG, Cadence commentary, Hygiene commentary, Controls commentary, Recommended actions (max 3).",
  risk_heatmap_narrative:
    "You are a risk manager. Given the risk distribution across probability×impact, write: (1) Heat-map summary (which quadrants are loaded, trend), (2) Top 3 risks of concern with rationale, (3) Mitigation suggestions per risk (avoid/reduce/transfer/accept).",
  stakeholder_map:
    "You are a stakeholder engagement specialist. From the supplied stakeholder list/notes, produce: (1) Influence×Interest grid placement for each, (2) Engagement strategy per quadrant (Manage closely / Keep satisfied / Keep informed / Monitor), (3) Recommended cadence and channel per stakeholder.",
  lessons_digest:
    "You are a PMO lead. Synthesise the supplied lessons-learned entries into a digest: Themes (3-5), Quick wins to apply now, Systemic changes to recommend, Open questions for the steering committee.",
  sprint_retro_summary:
    "You are an agile coach. Given the retro inputs (went well / didn't / ideas / actions), produce a polished retro summary: Highlights, Pain points (with likely root cause), Experiments to try next sprint, Owned action items with suggested owners.",
  definition_of_ready:
    "You are a scrum master. Draft a Definition of Ready checklist for the team's user stories: User value clear, Acceptance criteria written, Dependencies identified, Estimable, Sized to fit a sprint, Test approach agreed, Designs/assets available where relevant. Tailor wording to the inputs.",
  // ─── Change Management (ITIL 4 Change Enablement) ───────────────────────
  cm_normal_change:
    "You are an ITIL 4 Change Manager drafting a NORMAL change record for CAB review. Sections (use clear headings): Title & Reference, Change Type (Normal), Requested by / Owner / Implementer, Business Justification, Scope & Affected Services/CIs, Risk Assessment (likelihood × impact, score 1-25), Implementation Plan (numbered steps with timing), Test Plan (pre-prod & post-deploy verification), Rollback Plan (with trigger criteria & RTO), Communication Plan (who, when, channel), Downtime Window (planned start/end & duration), Approvals required (Technical, Business, Security if applicable). Be specific and reviewable.",
  cm_standard_change:
    "You are an ITIL 4 Change Manager defining a STANDARD (pre-authorised) change template. Sections: Title, Trigger, Pre-conditions, Step-by-step procedure (idempotent & repeatable), Validation steps, Rollback procedure, Risk classification (must be Low), Frequency expected, Owner, Recommended catalog category. Make it copy-paste runnable for level-1/level-2 staff.",
  cm_emergency_change:
    "You are an ITIL 4 Change Manager raising an EMERGENCY (E-CAB) change to restore service or prevent imminent harm. Sections: Title & Reference, Trigger Incident (link if any), Justification for bypassing normal CAB, Risk Acceptance Statement, Minimal Implementation Plan, Rollback Plan, Required E-CAB approvers, Post-Implementation Review commitment (within 48h), Communication. Tone: urgent, factual, no fluff.",
  cm_rollback_plan:
    "You are an SRE / Release Manager. Draft a tested ROLLBACK PLAN for the supplied change. Sections: Pre-deploy snapshot/backup steps, Detection criteria that should trigger rollback (specific metrics & thresholds), Rollback steps (numbered, idempotent), Verification after rollback, Estimated Recovery Time Objective (RTO), Data-loss / replay considerations, Communication on rollback, Post-rollback follow-ups.",
  cm_cab_pack:
    "You are the Change Manager preparing a CAB MEETING PACK. Produce: Forward Schedule of Change summary table (date, change ref, type, owner, risk), per-change one-page brief (Purpose, Risk score, Downtime, Rollback summary, Open questions), Conflicts/Collisions analysis, Recommended decision per change (Approve / Defer / Reject with rationale), Standing items (carry-overs, post-implementation reviews due, emergency changes since last CAB).",
  cm_post_implementation_review:
    "You are conducting a POST-IMPLEMENTATION REVIEW (PIR) for a change. Sections: Change reference & summary, Outcome (Successful / Successful-with-issues / Failed / Backed-out), Objectives met (yes/no with evidence), Variance vs plan (time, downtime, scope), Incidents caused (link refs), Root cause if any, Lessons learned (what to keep, what to change), CMDB updates required, Recommended follow-up actions with owners.",
  cm_impact_assessment:
    "You are a Change Analyst producing an IMPACT ASSESSMENT for a proposed change. Score and explain: Affected services & CIs, User population affected, Business processes impacted, Downtime exposure (planned & worst-case), Security & compliance impact, Data integrity considerations, Dependency / collision risk with other in-flight changes, Financial impact, Recommended classification (Standard / Normal / Major / Emergency), Recommended approvers.",
  // ─── Helpdesk / Service Management (ITIL 4 + KCS) ───────────────────────
  hd_incident_writeup:
    "You are a senior service-desk analyst writing a high-quality INCIDENT TICKET from raw user input. Produce: Title (concise, symptom-led), Affected service / CI, Reported by, Impact (Low/Med/High/Critical), Urgency, Calculated Priority (P1-P4), Symptoms (numbered), Steps to reproduce, Expected vs actual behaviour, Workaround if known, Initial diagnosis hypothesis, Suggested category & subcategory, Suggested assignee group. Use neutral, factual tone.",
  hd_problem_record:
    "You are a Problem Manager opening a PROBLEM RECORD from a cluster of related incidents. Sections: Title, Linked incident references, Frequency & trend, Affected services, Business impact summary, Known error description, Hypothesised root cause(s), Investigation plan (5 Whys / Ishikawa / log analysis), Workaround for service desk (immediate), Permanent fix candidate (likely Change Request), Owner & target review date.",
  hd_service_request:
    "You are a service-desk analyst capturing a SERVICE REQUEST against the catalog. Sections: Request title, Catalog item (suggest if missing), Requester & beneficiary, Business justification, Required by date, Pre-approvals needed (line manager, security, finance), Fulfilment steps (numbered), Verification with requester, Closure criteria. Keep it standardised so it can become a catalog template.",
  hd_kb_article:
    "You are a KCS-trained service-desk analyst writing a KNOWLEDGE-BASE ARTICLE from a resolved ticket. Use the KCS structure: Title (problem-as-user-types-it), Environment / Applies to, Symptoms, Cause, Resolution (numbered steps), Verification, Related articles, Internal vs Customer-facing flag, Author confidence (draft / validated). Plain language, no jargon, screenshots referenced where helpful.",
  hd_major_incident_comms:
    "You are an Incident Commander drafting MAJOR INCIDENT COMMUNICATIONS. Produce three coordinated artefacts: (1) Initial customer status-page post (≤80 words, facts only, no speculation), (2) Internal Slack/Teams update for stakeholders (impact, what we know, what we're doing, next update time), (3) Executive briefing (impact in business terms, current ETA to mitigate, decisions needed). Calm, factual, time-stamped tone.",
  hd_csat_followup:
    "You are a service-desk supervisor following up on a LOW CSAT score. Draft: (1) Empathetic email to the customer acknowledging the experience, summarising the ticket, asking for specific feedback, and offering a call, (2) Internal coaching note for the agent (what went well, what to improve, suggested KB to study), (3) Process improvement candidate if a systemic issue is suspected.",
  hd_sla_policy_draft:
    "You are an ITSM consultant drafting an SLA POLICY for a service desk. For each ticket type (Incident, Service Request, Question, Problem) and each priority (P1-P4), recommend: Response target, Resolution target, Business hours vs 24×7, Pause-clock conditions (pending customer, vendor, scheduled), Escalation thresholds (50%, 75%, 100%), Breach handling, Reporting cadence. Output as a clear policy document with a summary matrix table.",
  // ─── Construction & Engineering ─────────────────────────────────────────
  con_rfi:
    "You are a Senior Project Engineer drafting a Request for Information (RFI) on a construction project. Produce a clean, contractually defensible RFI with: RFI Number placeholder, Project, Subject, Discipline, Spec Section reference, Drawing reference(s), Date Raised, Response Required By (state working days), Cost & Schedule impact (None / TBC / Yes – with rationale), Background & Context (factual, no blame), Specific Question(s) (numbered, single-issue per question), Proposed Solution / Contractor's Suggestion (if any), Attachments list. Tone: factual, professional, NEC4/JCT/AIA-aware.",
  con_submittal_log:
    "You are a Document Controller. From the inputs, draft a Submittal Register entry and a covering transmittal: Submittal No., Spec Section, Submittal Type (product data / shop drawing / sample / mock-up / calculation / cert), Description, Submitted By, Reviewer (Ball-in-Court), Required-On-Site date back-calculated from lead time, Review SLA (working days), Review Codes legend (A – Approved, B – Approved as Noted, C – Revise & Resubmit, D – Rejected), Notes for the reviewer. End with a one-paragraph transmittal cover note.",
  con_method_statement:
    "You are an SHEQ Manager writing a combined Risk Assessment & Method Statement (RAMS) compliant with CDM 2015 / ISO 45001. Structure: 1) Activity & Location, 2) Sequence of works (numbered, plain-English steps), 3) Plant & equipment, 4) Materials & substances (note COSHH / SDS), 5) PPE required, 6) Permits required (hot work / confined space / WAH / excavation / electrical isolation / lifting), 7) Hazard Identification table (Hazard | Who can be harmed | Initial risk LxC | Controls | Residual risk LxC), 8) Emergency arrangements, 9) Competency & training requirements, 10) Briefing & sign-off. Be specific to the activity supplied.",
  con_ncr:
    "You are a QA/QC Engineer raising a Non-Conformance Report (NCR) under an ISO 9001 quality system. Sections: NCR No., Project, Date raised, Raised by, Trade/Party responsible, Specification / Standard reference, Location, Severity (Minor/Major/Critical) with rationale, Description of non-conformance (factual, photographic refs), Immediate containment action, Root cause analysis (5 Whys – walk through it), Proposed disposition (Rework / Repair / Use-As-Is / Reject & Replace / Concession – with justification), Corrective & preventive action (CAPA) with owner & due date, Verification plan, Required approvals. Neutral, evidence-based tone.",
  con_toolbox_talk:
    "You are a Site Safety Officer delivering a Toolbox Talk. Produce a 10-minute talk script: Topic, Why it matters (recent industry stats or incident — generic if none supplied), Key hazards (3-5 bullets), Site-specific controls, Safe work practices (do's and don'ts), What to do if it goes wrong, 3 quick check questions for attendees, Sign-off prompt. Plain trade language, no jargon.",
  con_daily_log:
    "You are a Site Superintendent writing the Daily Site Log narrative from raw notes. Produce: Date, Weather AM/PM with temperature, Total manpower (broken down by trade/subcontractor), Plant & equipment on site, Deliveries received, Visitors, Inspections held, Permits issued, Works completed today (by area/grid), Works planned tomorrow, Delays / disruptions with cause & impact, Safety observations, Quality issues, Notable events. Factual third-person tone suitable for the project record.",
  con_change_order:
    "You are a Quantity Surveyor / Commercial Manager drafting a Change Order / Variation under NEC4 (Compensation Event), JCT (Variation Instruction) or AIA G701. Sections: CO/CE/VO No., Contract reference, Originator (Client / Designer / Contractor / Site condition), Description of change, Reason & justification, Contractual mechanism cited, Cost impact (broken down: labour, plant, materials, sub-contract, prelims, OH&P, contingency) – show calculation, Time impact (programme analysis: critical path, float consumed, EOT requested in days), Supporting evidence list, Recommendation. Professional, contractually precise.",
  con_commissioning_pack:
    "You are a Commissioning Manager building a Commissioning Test Pack for a building services system. Sections: System description & boundaries, Reference drawings & specifications, Pre-commissioning checks (installation, cleanliness, energisation prerequisites), Static tests (with acceptance criteria), Dynamic / functional tests (numbered procedures with expected vs actual columns), Performance / integrated systems test, Witnessing requirements (Contractor / Consultant / Client), Test instruments required (with calibration), Sign-off sheet, Defects list template. Output as a structured test pack outline.",
  con_handover_register:
    "You are a Project Manager preparing the Handover / O&M deliverables register for Practical Completion. List the categories required: O&M Manuals (per system), As-Built Drawings (per discipline), Test & Commissioning Certificates, Statutory Certificates (electrical, gas, fire, lifts, pressure systems), Manufacturer warranties & DLP letters, Asset data spreadsheet for CAFM upload, Spare parts list & delivery, Training records (operator & end-user), Keys & access register, Health & Safety File (CDM 2015 Reg 12.5), Building Manual (Soft Landings / BSRIA BG 6). For each: responsible party, due date, status placeholder. Output as a structured table-style register.",
  con_subcontractor_scope:
    "You are a Procurement / Contracts Manager drafting a Subcontractor Scope of Works for a tender package. Sections: Package title & ref, Contract form (NEC4 sub / JCT sub / DOM/A / bespoke), Inclusions (detailed, by drawing/spec ref), Exclusions (explicit), Interfaces with other trades, Programme constraints & key milestones, Quality requirements (ITPs, hold/witness points), HSE requirements (CDM duties, RAMS, permits), Commercial requirements (insurance, retention %, payment terms, valuation cycle), Information required at tender, Information returnable post-award. Be specific and unambiguous.",
  con_lookahead_plan:
    "You are a Site Planner producing a 3-week Look-Ahead schedule. From the inputs, output: Week-by-week activities by area / work face, Predecessors & constraints (information, materials, permits, inspections), Resources required (crew sizes by trade, key plant), Risks & mitigations, Coordination items needing client/consultant input, Milestones in window, Recovery actions if behind. Format as a structured weekly breakdown ready for the weekly subcontractor coordination meeting.",
  con_permit_to_work:
    "You are an Authorised Person issuing a Permit to Work. Draft a complete permit for the supplied activity covering: Permit type (Hot Work / Confined Space / Working at Height / Excavation / Electrical Isolation / Lifting Operation / Live Traffic), Permit No., Location with grid ref, Description of work, Validity (from / to), Issued to (with competency check), Issued by, Specific hazards, Required controls & isolations, PPE & equipment, Standby person / rescue plan if applicable, Atmospheric / environmental tests required, Adjacent permits / interactions, Suspension conditions, Closure & handback procedure, Signatures required. Compliant with HSG250 / OSHA 1910 principles.",
};

async function callGateway(
  supabase: ReturnType<typeof createClient>,
  organizationId: string | null,
  model: string,
  system: string,
  user: string,
) {
  const result = await callAI({
    supabase,
    organizationId,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  if (!result.ok) {
    return { error: "gateway_error", status: result.errorResponse.status, response: result.errorResponse } as const;
  }
  const content: string = result.data?.choices?.[0]?.message?.content ?? "";
  return { content } as const;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as DraftRequest & { organization_id?: string; output_language?: string };
    const orgId = body.organization_id ?? null;

    // Residency policy check (org-level, hybrid: warn or block).
    const residency = await evaluateResidency({
      supabase,
      organizationId: orgId,
      userId: userData.user.id,
      operation: `ai-draft:${body.kind}`,
      resourceType: body.entity_type,
      resourceId: body.entity_id,
    });
    if (!residency.ok) {
      return new Response(
        JSON.stringify({ error: residency.message, code: "residency_blocked", org_region: residency.org_region }),
        { status: residency.status ?? 451, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AI credits guard — atomically check + reserve one credit before calling the model.
    const credits = await consumeAiCredits({
      supabase,
      organizationId: orgId,
      userId: userData.user.id,
      actionType: `ai-draft:${body.kind}`,
      model: body.kind === "wizard" ? WIZARD_MODEL : FIELD_MODEL,
      metadata: { entity_type: body.entity_type ?? null, entity_id: body.entity_id ?? null },
    });
    if (!credits.ok) {
      return new Response(
        JSON.stringify({
          error: credits.message,
          code: "credits_exhausted",
          credits: { quota: credits.quota, used: credits.used, remaining: credits.remaining },
        }),
        { status: credits.status ?? 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Phase 5 — Look up the user's preferred language so AI output matches their UI language,
    // unless the request explicitly overrides it (e.g. translate field assist).
    let outputLanguage: string | null = body.output_language ?? null;
    if (!outputLanguage) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      outputLanguage = (profile?.preferred_language as string | undefined) ?? null;
    }
    const langDirective =
      outputLanguage && outputLanguage !== "en"
        ? `\n\nIMPORTANT: Respond in ${outputLanguage}. Preserve any product names, code, and terminology in their original form.`
        : "";

    let model = FIELD_MODEL;
    let system = "";
    let userPrompt = "";
    let actionType = "";
    let targetField: string | null = null;

    if (body.kind === "field") {
      model = FIELD_MODEL;
      // For an explicit "translate" mode, the body.language wins over the user's preference.
      system =
        FIELD_SYSTEM_PROMPTS[body.mode] + (body.mode === "translate" ? "" : langDirective);
      const lang = body.language ? `Target language: ${body.language}.\n\n` : "";
      const ctx = body.context ? `Context: ${body.context}\n\n` : "";
      userPrompt = `${lang}${ctx}Text:\n${body.text}`;
      actionType = `field_assist:${body.mode}`;
      targetField = body.field ?? null;
    } else if (body.kind === "wizard") {
      model = WIZARD_MODEL;
      system = WIZARD_SYSTEM_PROMPTS[body.wizard] + langDirective;
      userPrompt = `Inputs:\n${JSON.stringify(body.inputs, null, 2)}\n\nProduce the document in clean Markdown.`;
      actionType = `wizard:${body.wizard}`;
      targetField = body.wizard;
    } else {
      return new Response(JSON.stringify({ error: "invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callGateway(supabase, orgId, model, system, userPrompt);
    if ("error" in result) {
      if ("response" in result && result.response) return result.response;
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log entry — pending approval.
    const { data: audit, error: auditErr } = await supabase
      .from("ai_audit_log")
      .insert({
        organization_id: orgId,
        user_id: userData.user.id,
        action_type: actionType,
        entity_type: body.entity_type ?? null,
        entity_id: body.entity_id ?? null,
        model,
        prompt_version: PROMPT_VERSION,
        prompt_summary: userPrompt.slice(0, 500),
        output_summary: result.content.slice(0, 500),
        target_field: targetField,
        target_language:
          body.kind === "field" && body.mode === "translate" ? body.language ?? null : outputLanguage,
        draft_payload: { content: result.content, inputs: body.kind === "wizard" ? body.inputs : undefined },
        status: "pending",
      })
      .select()
      .single();

    if (auditErr) console.error("Audit insert failed", auditErr);

    return new Response(
      JSON.stringify({ content: result.content, audit_id: audit?.id ?? null, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-draft error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
