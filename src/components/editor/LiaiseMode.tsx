import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Handshake, Plus, Copy, Trash2, ChevronDown, ChevronRight, CheckCircle2, Phone, Home, Mail, Monitor, Info, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* =========================================================================
 * LIAISE V2 — CANONICAL DOMAIN TEMPLATES
 * =========================================================================
 *
 * V2 templates align Liaise questions to the functional capacity domains used
 * in Section 12/13 of the v5.1 FCA template. Each template only includes
 * domains that informant can reasonably speak to, with phrasing tailored for
 * their perspective.
 *
 * Key differences from V1:
 *   • Canonical domain IDs (mobility_transfers, personal_adls, etc.) shared
 *     across all templates so the AI can triangulate — "support worker AND
 *     parent both reported X for showering".
 *   • Mixed question types: open-ended narrative PLUS structured checklists
 *     (single-select and multi-select) for fast functional snapshots.
 *   • Per-template dynamic Role placeholder (e.g. allied_health prompts the
 *     clinician to capture discipline + tenure).
 *   • Primary (★) contribution domains auto-expand in the UI so the
 *     clinician sees the most important sections first.
 *   • Template IDs suffixed with `_v2` so V1 interviews continue to render
 *     via the legacy TEMPLATES constant without any schema migration.
 *
 * The `participant_self` template is intentionally omitted — self-report is
 * not used in practice for this workflow. The `employer` template is also
 * omitted — not contacted in practice.
 * ========================================================================= */

export type LiaiseQuestionV2 =
  | { type: "open"; text: string }
  | { type: "checklist_single"; text: string; options: string[]; allowOther?: boolean }
  | { type: "checklist_multi"; text: string; options: string[]; allowOther?: boolean };

/**
 * Canonical evidence tags. Each Liaise V2 domain is tagged with one or more
 * of these so the report-generation pipeline can withdraw the right
 * evidence when generating each section. Treat Liaise as a "bank" of
 * observations that any downstream section can query — same observation
 * (e.g. "support worker reports hoist transfers") legitimately funds the
 * Mobility narrative, the Risk profile, AND the recommendation
 * justification, with attribution each time.
 *
 * Stable string-literal type so the AI prompt and the report renderer can
 * agree on tag values without import gymnastics.
 */
export type LiaiseEvidenceTag =
  | "background"           // disability profile, history, developmental
  | "cognition"             // executive function, memory, learning
  | "communication"         // expressive / receptive / AAC
  | "mobility"              // gait, transfers, falls, aids
  | "personal_adls"         // showering, dressing, toileting, eating
  | "domestic_iadls"        // meal prep, cleaning, laundry, shopping
  | "executive_iadls"       // money, medication, transport, scheduling
  | "behaviour"             // BoCs, dysregulation, triggers
  | "mental_health"         // mood, anxiety, sleep, MH symptoms
  | "risk"                  // safety, falls, harm to self / others, supervision
  | "social"                // peers, community, isolation, relationships
  | "carer_sustainability"  // informal-support burden, respite, family load
  | "supports_gaps"         // current paid supports, what's missing, breakdown patterns
  | "recommendations"       // direct input to recommendation justifications
  | "strengths";            // capabilities, interests, when at their best

export interface LiaiseDomainV2 {
  id: string;
  name: string;
  /** When true, the domain auto-expands in the UI and is marked as the informant's primary contribution area. */
  primary?: boolean;
  /**
   * Evidence tags this domain's responses contribute to. Used by
   * `gatherCollateralEvidence()` to package the bank for the
   * report-generation pipeline. A domain can have multiple tags — e.g.
   * the support worker's mobility_transfers domain feeds both the
   * Mobility narrative AND the Risk profile because falls evidence
   * belongs in both.
   */
  tags?: LiaiseEvidenceTag[];
  questions: LiaiseQuestionV2[];
}

export interface LiaiseTemplateV2 {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  /** Placeholder shown in the Role / Relationship field for this template. */
  rolePlaceholder: string;
  domains: LiaiseDomainV2[];
  version: 2;
}

/* Shared checklist option sets reused across templates to keep wording consistent. */
const SUPPORT_LEVEL_OPTIONS = [
  "Independent",
  "Prompting only",
  "Supervision",
  "Hands-on assistance",
  "Fully dependent",
] as const;

const CONTINENCE_OPTIONS = [
  "Continent",
  "Occasional accidents",
  "Regular accidents",
  "Incontinent — managed with aids",
] as const;

const FREQUENCY_OPTIONS = [
  "Never",
  "Rarely",
  "Weekly",
  "Several times per week",
  "Daily",
  "Multiple times daily",
] as const;

const MOBILITY_AIDS_OPTIONS = [
  "None",
  "Walking stick / single-point cane",
  "Quad stick",
  "Walker / wheelie frame",
  "Manual wheelchair",
  "Powered wheelchair",
  "Mobility scooter",
] as const;

const COMMS_METHOD_OPTIONS = [
  "Verbal speech",
  "Gesture / pointing",
  "AAC device / communication app",
  "PECS / picture exchange",
  "Key word sign",
  "Behaviour as communication",
] as const;

/* ─── V2 Templates — full question bank ──────────────────────────────── */
/* ─── V2 Templates — high-signal question bank ──────────────────────────
 *
 * Each template asks each informant ONLY what they're uniquely placed to
 * answer well. Total questions per template are deliberately tight (8-16)
 * so a phone interview can finish in 10-15 minutes without exhausting the
 * informant. The principle is "ask the support worker about ADLs, ask the
 * parent about sustainability, ask allied health about clinical change" —
 * triangulation across informants on the canonical V2 domain ids does the
 * cross-checking.
 *
 * Structure per template:
 *   • 4-7 domains (down from 8-15 in the previous bank)
 *   • 2-4 questions per domain (down from 3-8)
 *   • One narrative anchor per domain max — checklists for everything else
 *   • 2-3 primary domains marked, auto-expanded so the clinician sees the
 *     highest-yield areas first.
 * ────────────────────────────────────────────────────────────────────── */
export const LIAISE_TEMPLATES_V2: Record<string, LiaiseTemplateV2> = {
  support_worker_v2: {
    id: "support_worker_v2",
    name: "Support Worker",
    icon: "SW",
    color: "#2563eb",
    description: "Hands-on shift observation — ADLs, behaviour, mobility, and what the participant does during supported time",
    rolePlaceholder: "e.g. Daily support worker — 2 years",
    version: 2,
    domains: [
      {
        id: "personal_adls",
        name: "Personal ADLs",
        primary: true,
        tags: ["personal_adls"],
        questions: [
          { type: "checklist_single", text: "Showering / bathing", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Dressing", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Toileting & continence", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Eating / mealtime", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "open", text: "Walk me through a typical morning during your shifts — where do you step in?" },
        ],
      },
      {
        id: "mobility_transfers",
        name: "Mobility & Transfers",
        tags: ["mobility", "risk"],
        questions: [
          { type: "checklist_multi", text: "Mobility aids used during your shifts", options: [...MOBILITY_AIDS_OPTIONS], allowOther: true },
          { type: "checklist_single", text: "Transfers (bed / chair / toilet / car)", options: ["Independent", "Set-up / verbal prompt only", "Minimal hands-on (steadying)", "Moderate assist (one person)", "Full assist (two people or hoist)"] },
          { type: "open", text: "Any falls, near-falls, or fatigue you've witnessed?" },
        ],
      },
      {
        id: "behaviour_emotional",
        name: "Behaviour & Triggers",
        primary: true,
        tags: ["behaviour", "risk", "mental_health"],
        questions: [
          { type: "checklist_multi", text: "Behaviours of concern observed during your shifts", options: ["None", "Self-injury", "Physical aggression", "Verbal aggression", "Property damage", "Absconding", "Refusing supports", "Shutdown / withdrawal"], allowOther: true },
          { type: "checklist_single", text: "Frequency", options: [...FREQUENCY_OPTIONS] },
          { type: "open", text: "What tends to trigger dysregulation, and what genuinely helps them regulate?" },
        ],
      },
      {
        id: "communication",
        name: "Communication",
        tags: ["communication"],
        questions: [
          { type: "checklist_multi", text: "Primary communication methods", options: [...COMMS_METHOD_OPTIONS], allowOther: true },
          { type: "open", text: "How does [name] tell you what they need, and where does communication break down?" },
        ],
      },
      {
        id: "risk_safety",
        name: "Risk & Safety",
        tags: ["risk"],
        questions: [
          { type: "checklist_single", text: "Can [name] be safely left alone?", options: ["Yes, any duration", "Yes, short periods (<1 hr)", "Yes, with check-ins", "No — requires continuous supervision"] },
          { type: "open", text: "Describe the most significant safety incident you've witnessed or responded to." },
        ],
      },
      {
        id: "current_supports_gaps",
        name: "Current Supports & Unmet Needs",
        primary: true,
        tags: ["supports_gaps", "recommendations"],
        questions: [
          { type: "checklist_single", text: "Hours per week you currently work with [name]", options: ["<5", "5-10", "11-20", "21-40", "40+"] },
          { type: "checklist_single", text: "How adequate are current supports during your shifts?", options: ["Adequate", "Stretched but manageable", "Insufficient — unmet needs", "Inadequate — safety concerns when support ends"] },
          { type: "open", text: "What's working well, what's missing, and what happens when supports are reduced or cancelled?" },
        ],
      },
      {
        id: "strengths",
        name: "Strengths",
        tags: ["strengths"],
        questions: [
          { type: "open", text: "When is [name] at their best, and what do people often underestimate about them?" },
        ],
      },
    ],
  },

  parent_carer_v2: {
    id: "parent_carer_v2",
    name: "Parent / Carer",
    icon: "PC",
    color: "#7c3aed",
    description: "Long-term home observation, developmental history, and the 24/7 picture — primary source for carer sustainability",
    rolePlaceholder: "e.g. Mother — primary carer since birth",
    version: 2,
    domains: [
      {
        id: "daily_routine_adls",
        name: "Daily Routine & ADLs",
        primary: true,
        tags: ["personal_adls", "carer_sustainability"],
        questions: [
          { type: "checklist_single", text: "Showering / bathing at home", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Toileting & continence at home", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Eating / mealtime at home", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Time per day you spend on personal-care support", options: ["<30 min", "30-60 min", "1-2 hrs", "2-4 hrs", "4+ hrs"] },
          { type: "open", text: "Walk me through a typical morning and evening at home — where do you step in?" },
        ],
      },
      {
        id: "behaviour_mood",
        name: "Behaviour & Mood at Home",
        tags: ["behaviour", "mental_health", "risk"],
        questions: [
          { type: "checklist_multi", text: "Behaviours of concern at home", options: ["None", "Self-injury", "Physical aggression", "Verbal aggression", "Property damage", "Absconding", "Refusing supports", "Shutdown / withdrawal"], allowOther: true },
          { type: "open", text: "What tends to trigger meltdowns at home, and what helps?" },
        ],
      },
      {
        id: "health_sleep",
        name: "Health & Sleep",
        tags: ["mental_health", "background"],
        questions: [
          { type: "checklist_single", text: "Sleep pattern", options: ["Settled and consistent", "Occasional disruption", "Frequent night waking", "Severely disrupted — major daytime impact"] },
          { type: "open", text: "Any health concerns, hospitalisations, or medication issues you're managing?" },
        ],
      },
      {
        id: "carer_capacity",
        name: "Carer Capacity & Sustainability",
        primary: true,
        tags: ["carer_sustainability", "supports_gaps", "recommendations"],
        questions: [
          { type: "checklist_single", text: "How are you managing with the current level of care?", options: ["Coping well", "Stretched but managing", "Burnt out — barely coping", "Unsustainable — need urgent change"] },
          { type: "checklist_multi", text: "Other responsibilities competing for your time", options: ["Paid work", "Other children / dependents", "Own health issues", "Elderly parents", "Single-parent household"], allowOther: true },
          { type: "open", text: "What would happen if you became unable to provide care for a week?" },
        ],
      },
      {
        id: "social_community",
        name: "Social & Community",
        tags: ["social"],
        questions: [
          { type: "open", text: "How does [name] do in the community — outings, friendships, isolation?" },
        ],
      },
      {
        id: "history_concerns_goals",
        name: "History, Concerns & Goals",
        primary: true,
        tags: ["background", "recommendations"],
        questions: [
          { type: "open", text: "When did concerns first emerge for [name], and what's the diagnosis history?" },
          { type: "open", text: "What worries you most about [name] right now, and what would make the biggest difference for your family?" },
        ],
      },
    ],
  },

  teacher_educator_v2: {
    id: "teacher_educator_v2",
    name: "Teacher / Educator",
    icon: "TE",
    color: "#059669",
    description: "Structured educational environment, peer observation, and academic focus",
    rolePlaceholder: "e.g. Year 5 classroom teacher — current year",
    version: 2,
    domains: [
      {
        id: "academic_learning",
        name: "Academic & Learning",
        primary: true,
        tags: ["cognition", "background"],
        questions: [
          { type: "checklist_single", text: "Academic level relative to peers", options: ["At grade level", "Slightly behind", "Significantly behind", "Working on individual learning plan", "Cannot meaningfully engage with curriculum"] },
          { type: "open", text: "What learning supports or modifications are currently in place, and what are their strengths as a learner?" },
        ],
      },
      {
        id: "classroom_behaviour",
        name: "Classroom Behaviour",
        tags: ["behaviour", "cognition"],
        questions: [
          { type: "open", text: "How do they manage in class — focus, transitions, regulation?" },
          { type: "open", text: "What triggers dysregulation at school, and what strategies work?" },
        ],
      },
      {
        id: "social_peers",
        name: "Social & Peer Interaction",
        tags: ["social"],
        questions: [
          { type: "open", text: "How do they go with peers — friendships, isolation, conflict, unstructured times?" },
        ],
      },
      {
        id: "communication_school",
        name: "Communication at School",
        tags: ["communication"],
        questions: [
          { type: "checklist_multi", text: "Communication methods at school", options: [...COMMS_METHOD_OPTIONS], allowOther: true },
          { type: "open", text: "Can they express needs to staff, follow group instructions, or do they need individual prompting?" },
        ],
      },
      {
        id: "self_care_school",
        name: "Self-Care at School",
        tags: ["personal_adls"],
        questions: [
          { type: "open", text: "How do they manage toileting, eating, and transitions during the school day?" },
        ],
      },
      {
        id: "school_supports",
        name: "Current School Supports",
        primary: true,
        tags: ["supports_gaps", "recommendations"],
        questions: [
          { type: "checklist_single", text: "Aide / individual support hours per week", options: ["None", "<5", "5-10", "11-20", "Full-time 1:1"] },
          { type: "checklist_single", text: "Is the current support level sufficient?", options: ["Yes — meets needs", "Mostly — some unmet needs", "No — significant gaps", "No — safety / participation at risk"] },
          { type: "open", text: "What additional school support would make the biggest difference?" },
        ],
      },
    ],
  },

  allied_health_v2: {
    id: "allied_health_v2",
    name: "Allied Health Professional",
    icon: "AH",
    color: "#ea580c",
    description: "Clinical observations, treatment progress, and interdisciplinary perspective",
    rolePlaceholder: "e.g. Speech Pathologist — fortnightly for 18 months",
    version: 2,
    domains: [
      {
        id: "role_involvement",
        name: "Role & Involvement",
        tags: ["background"],
        questions: [
          { type: "open", text: "What is your discipline, how long have you worked with [name], and how often do you see them?" },
          { type: "open", text: "What has been the focus of your intervention?" },
        ],
      },
      {
        id: "clinical_observations",
        name: "Clinical Observations",
        primary: true,
        // Broad tag set — allied health observations are discipline-specific
        // (a speech path's notes belong in communication; a physio's belong
        // in mobility). The AI in the report-generation prompt is told to
        // route these by content rather than by tag alone.
        tags: ["background", "cognition", "communication", "behaviour", "mobility", "risk"],
        questions: [
          { type: "open", text: "From your discipline's perspective, what are the main areas of difficulty?" },
          { type: "open", text: "How does their presentation compare to when you started — progress, plateau, deterioration?" },
          { type: "open", text: "Any clinical concerns, safety risks, or critical incidents you're monitoring?" },
        ],
      },
      {
        id: "progress_outcomes",
        name: "Progress & Barriers",
        tags: ["recommendations"],
        questions: [
          { type: "open", text: "What's working well and what isn't — including any barriers to progress?" },
        ],
      },
      {
        id: "recommendations",
        name: "Recommendations",
        primary: true,
        tags: ["recommendations", "supports_gaps"],
        questions: [
          { type: "checklist_single", text: "Are the current funded hours for your service sufficient?", options: ["Yes — adequate", "Mostly — could use more", "No — significantly under-funded", "No — service at risk of ending"] },
          { type: "open", text: "What do they need more or less of, and what would happen if your service was reduced or discontinued?" },
        ],
      },
    ],
  },

  support_coordinator_v2: {
    id: "support_coordinator_v2",
    name: "Support Coordinator",
    icon: "SC",
    color: "#0891b2",
    description: "Service gaps, plan utilisation, and system-level barriers — the multi-provider view",
    rolePlaceholder: "e.g. Level 2 Support Coordinator — 14 months",
    version: 2,
    domains: [
      {
        id: "current_supports",
        name: "Current Supports",
        primary: true,
        tags: ["supports_gaps", "recommendations"],
        questions: [
          { type: "checklist_multi", text: "Services currently in place", options: ["Support workers", "OT", "Physio", "Speech", "Psychology", "Behaviour Support", "Specialist nursing", "SIL / SDA", "Plan management"], allowOther: true },
          { type: "open", text: "Which services have been hard to engage or maintain, and how well are funded supports actually being used?" },
        ],
      },
      {
        id: "service_gaps",
        name: "Service Gaps",
        tags: ["supports_gaps", "recommendations"],
        questions: [
          { type: "open", text: "Where are the biggest gaps in the current plan, and what tends to break down first when things go badly?" },
        ],
      },
      {
        id: "risk_sustainability",
        name: "Risk & Sustainability",
        primary: true,
        tags: ["risk", "carer_sustainability", "recommendations"],
        questions: [
          { type: "checklist_single", text: "How sustainable is the current arrangement?", options: ["Stable", "Stretched but manageable", "Fragile — at risk of breakdown", "Already breaking down"] },
          { type: "checklist_multi", text: "Risks you're most concerned about", options: ["Carer burnout", "Hospitalisation", "Crisis / mental health relapse", "Placement breakdown", "Disengagement from services", "Financial / housing instability"], allowOther: true },
          { type: "open", text: "What tends to happen when supports are reduced or inconsistent?" },
        ],
      },
      {
        id: "plan_engagement",
        name: "Plan Engagement & Funding",
        tags: ["recommendations", "supports_gaps"],
        questions: [
          { type: "open", text: "How engaged is [name] with their plan — do they understand it, prioritise their goals, follow through on services?" },
          { type: "open", text: "Where is the current funding insufficient, and what recommendations would make the biggest difference?" },
        ],
      },
    ],
  },
};

/* ─── V1/V2 interop helpers ──────────────────────────────────────────── */

/**
 * Look up a template by id, returning the V2 template if one exists, falling
 * back to the V1 set so legacy interviews continue to render. Returns null
 * if no template matches (e.g. legacy `employer` / `participant_self`
 * interviews whose templates were removed in the Apr 2026 cleanup).
 *
 * Consumers should use this helper rather than probing the two registries
 * directly so the V1/V2 fallback policy stays consistent across the app.
 * InterviewCard still inspects LIAISE_TEMPLATES_V2 directly because it
 * needs to branch on V2-specific fields (primary / rolePlaceholder) at
 * render time.
 */
export function findTemplate(
  templateId: string
): LiaiseTemplateV2 | TemplateDefinition | null {
  return LIAISE_TEMPLATES_V2[templateId] ?? TEMPLATES[templateId] ?? null;
}

/**
 * Generate the storage key for one question's response. Responses live in a
 * flat `Record<string, string>` keyed by `<domainId>_<questionIdx>` — this
 * helper is the single source of truth for that format so a domain rename
 * or schema tweak only has to change one place. Read AND write paths must
 * use this; do not hand-roll the `${domain.id}_${idx}` template literal
 * elsewhere in the file.
 */
function responseKey(domainId: string, questionIdx: number): string {
  return `${domainId}_${questionIdx}`;
}

/**
 * Count how many questions in this interview have a non-empty response,
 * including custom questions added by the clinician. Used by the per-card
 * progress indicator, the parent's overall total, and the summary table —
 * one helper instead of three near-identical loops.
 */
function countAnsweredResponses(iv: CollateralInterview): number {
  let count = 0;
  for (const val of Object.values(iv.responses)) {
    if (val && val.trim()) count++;
  }
  for (const domainCustoms of Object.values(iv.customQuestions)) {
    for (const cq of domainCustoms) {
      if (cq.response && cq.response.trim()) count++;
    }
  }
  return count;
}

/**
 * Build the database-row shape for one interview. Used by both the upsert
 * path (saveInterview — full payload) and the insert paths (addInterview /
 * duplicateInterview — minimal payload, since a fresh interview only has
 * id/template_id and gets fleshed out by the first debounced save).
 *
 * Centralising this lets schema changes touch one function instead of
 * three. The `mode` discriminates between full upsert payloads (include
 * every column) and minimal insert payloads (id/template_id only — Postgres
 * defaults handle the rest).
 */
function buildCollateralRow(
  iv: Pick<CollateralInterview, "id" | "templateId"> & Partial<CollateralInterview>,
  reportId: string,
  userId: string,
  mode: "full" | "minimal" = "full"
): CollateralInterviewRow {
  const base: CollateralInterviewRow = {
    id: iv.id,
    report_id: reportId,
    user_id: userId,
    template_id: iv.templateId,
  };
  if (mode === "minimal") return base;
  return {
    ...base,
    interviewee_name: iv.intervieweeName,
    interviewee_role: iv.intervieweeRole,
    interview_date: iv.date || null,
    interview_method: iv.method,
    responses: iv.responses,
    custom_questions: iv.customQuestions,
    general_notes: iv.generalNotes,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Decode a stored response value into a display string.
 *
 * V2 multi-select checklists are stored as JSON-encoded arrays (e.g.
 * '["Walking stick","Walker"]'). This helper flattens them to a comma-
 * separated string for display and for injection into the AI prompt.
 * Open questions and single-select checklists pass through unchanged.
 */
/**
 * Parse a stored multi-select response back into a string array. Returns an
 * empty array for empty / non-array values so callers can iterate without
 * null-guards. Single source of truth — used by both
 * `flattenStoredResponse` (joins the array for display) and
 * `ChecklistMultiInput` (toggles selections in the array).
 */
function parseStoredArray(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  try {
    const arr = JSON.parse(trimmed);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function flattenStoredResponse(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const arr = parseStoredArray(raw);
    if (arr.length > 0) return arr.filter(v => v.trim()).join(", ");
  }
  return raw;
}

/* ─── Evidence Bank (Liaise → cross-section) ────────────────────────── */

/**
 * One unit of evidence withdrawn from the Liaise bank. Each non-empty
 * interview response becomes an `EvidenceItem` so the report-generation
 * pipeline can route it to the right section. The shape is deliberately
 * flat and self-describing — the AI prompt receives a list of these and
 * doesn't need to chase IDs back to template / interview objects.
 */
export interface EvidenceItem {
  /** Stable id: `${interview.id}__${domain.id}__q${qIdx}` (or `__custom${ci}`). */
  id: string;
  /** Stakeholder's name as entered by the clinician. */
  informant: string;
  /** Stakeholder's role / relationship as entered by the clinician. */
  role: string;
  /** Template name — "Support Worker", "Parent / Carer", etc. */
  template: string;
  /** Domain name as displayed in the UI (e.g. "Personal ADLs"). */
  domain: string;
  /** Domain id for tag-based filtering (mirror of LiaiseDomainV2.id). */
  domainId: string;
  /** Tags inherited from the domain — drives section routing. */
  tags: LiaiseEvidenceTag[];
  /** Question text as the informant heard it (or "Custom: ..." for clinician adds). */
  question: string;
  /** Flattened answer — JSON arrays from checklist_multi are joined with ", ". */
  answer: string;
  /** Was this a clinician-added custom question? Useful for prompt nuance. */
  isCustom: boolean;
}

/**
 * Keyword → tag enrichment for custom questions. When a clinician adds a
 * custom question under any domain, the question's *content* may be about
 * a topic different from the parent domain's tags (e.g. they're in the
 * "Communication" domain but ask about self-harm). We run a small keyword
 * pass over the question text + answer and add any matching tags so the
 * evidence routes to the right section even when the parent domain
 * doesn't match. This is additive — original domain tags are preserved.
 *
 * Order matters: more specific keywords first. Multi-word keywords are
 * matched as substrings (case-insensitive).
 */
const KEYWORD_TAG_MAP: Array<{ keywords: string[]; tag: LiaiseEvidenceTag }> = [
  { keywords: ["shower", "bath", "toilet", "continence", "dress", "groom", "feed", "meal"], tag: "personal_adls" },
  { keywords: ["fall", "abscond", "wander", "self-harm", "self harm", "supervise", "left alone", "safety", "incident", "crisis"], tag: "risk" },
  { keywords: ["behav", "trigger", "meltdown", "aggress", "outburst", "dysregulat"], tag: "behaviour" },
  { keywords: ["mood", "depress", "anxi", "sleep", "mental health", "psychotic", "withdraw"], tag: "mental_health" },
  { keywords: ["money", "budget", "medic", "appointment", "schedul", "decision"], tag: "executive_iadls" },
  { keywords: ["clean", "cook", "laundry", "shop", "household", "domestic"], tag: "domestic_iadls" },
  { keywords: ["speak", "communic", "aac", "express", "verbal", "non-verbal", "understand"], tag: "communication" },
  { keywords: ["transfer", "wheelchair", "mobil", "balance", "walk", "stair", "gait"], tag: "mobility" },
  { keywords: ["learn", "memor", "cognit", "attention", "process", "executive"], tag: "cognition" },
  { keywords: ["respite", "burnout", "burnt out", "carer", "family load"], tag: "carer_sustainability" },
  { keywords: ["friend", "peer", "community", "isolat", "social"], tag: "social" },
  { keywords: ["support hour", "service", "funded", "plan", "ndis", "coordin"], tag: "supports_gaps" },
  { keywords: ["recommend", "more hours", "fewer hours"], tag: "recommendations" },
  { keywords: ["strength", "enjoy", "good at", "best when"], tag: "strengths" },
  { keywords: ["born", "diagnos", "history", "developmental", "milestone", "school year", "background"], tag: "background" },
];

/**
 * Run the keyword scanner over a piece of text and return additional tags
 * that should be attached. Returns ONLY tags that aren't already in
 * `existing` to avoid duplicates. Used to enrich custom-question evidence
 * where the parent domain may not match the question's actual topic.
 */
function autoTagFromText(
  text: string,
  existing: LiaiseEvidenceTag[],
): LiaiseEvidenceTag[] {
  const haystack = text.toLowerCase();
  const have = new Set<LiaiseEvidenceTag>(existing);
  const extras: LiaiseEvidenceTag[] = [];
  for (const { keywords, tag } of KEYWORD_TAG_MAP) {
    if (have.has(tag)) continue;
    if (keywords.some((kw) => haystack.includes(kw))) {
      extras.push(tag);
      have.add(tag);
    }
  }
  return extras;
}

/**
 * Walk a list of interviews and return every populated response as a
 * flat `EvidenceItem[]`. This is the "withdrawal" half of the bank
 * model — the report-generation pipeline calls this once per generation
 * run and passes the result to the edge function as `collateral_evidence`.
 *
 * Empty responses, "Other:" placeholder-only entries, and orphaned
 * interviews (whose template was removed) are filtered out.
 *
 * Optional `filter` lets a caller restrict to evidence relevant to a
 * specific section (e.g. only `tags: ["personal_adls"]` evidence for
 * the Personal ADLs narrative). When omitted the full bank is returned
 * and the AI prompt does the relevance filtering itself.
 *
 * Custom-question handling: clinician-added custom questions inherit
 * their parent domain's tags by default, but ALSO run through a keyword
 * scanner (KEYWORD_TAG_MAP above) that adds any tags matched in the
 * question/answer text. This catches the case where a clinician adds a
 * mobility question under the Communication domain — without enrichment
 * it would only route to communication; with enrichment it also reaches
 * the mobility narrative.
 */
export function gatherCollateralEvidence(
  interviews: CollateralInterview[],
  filter?: { tags?: LiaiseEvidenceTag[] },
): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const iv of interviews) {
    const tpl = LIAISE_TEMPLATES_V2[iv.templateId];
    // V1 interviews don't carry tags — skip from the evidence bank for
    // now. (V1 content is still rendered in the Methodology section's
    // collateral table.)
    if (!tpl) continue;

    for (const domain of tpl.domains) {
      const tags = (domain.tags ?? []) as LiaiseEvidenceTag[];
      const filterTags = filter?.tags;
      const filterActive = !!filterTags && filterTags.length > 0;
      // We DO NOT skip the whole domain on filter mismatch — a custom
      // question added under this domain may keyword-enrich into the
      // requested filter even if the domain's standard tags don't match.
      // Apply filter at the per-question level instead.
      const domainPassesFilter = !filterActive || tags.some((t) => filterTags!.includes(t));

      // Standard questions — filtered against the domain's tags only
      // (no per-question keyword enrichment, because their text is
      // template-fixed and already correctly tagged via the domain).
      if (domainPassesFilter) {
        domain.questions.forEach((q, qi) => {
          const raw = iv.responses[`${domain.id}_${qi}`] ?? "";
          const answer = flattenStoredResponse(raw).trim();
          if (!answer) return;
          out.push({
            id: `${iv.id}__${domain.id}__q${qi}`,
            informant: (iv.intervieweeName || "").trim() || "[Unnamed informant]",
            role: (iv.intervieweeRole || "").trim() || tpl.name,
            template: tpl.name,
            domain: domain.name,
            domainId: domain.id,
            tags,
            question: getQuestionText(q),
            answer,
            isCustom: false,
          });
        });
      }

      // Custom questions added by clinician — keyed by domain id, free
      // {question, response} pairs. Inherit the domain's tags AND run
      // through the keyword scanner so off-topic custom questions still
      // route to the section they actually belong in.
      const customs = iv.customQuestions[domain.id] || [];
      customs.forEach((cq, ci) => {
        const answer = (cq.response || "").trim();
        if (!answer || !cq.question.trim()) return;
        const enriched = [
          ...tags,
          ...autoTagFromText(`${cq.question} ${answer}`, tags),
        ];
        // Re-apply the filter against the enriched tag set — a custom
        // question that's off-topic for its parent domain may now match
        // the requested filter where it didn't before.
        if (filter?.tags && filter.tags.length > 0) {
          const overlap = enriched.some((t) => filter.tags!.includes(t));
          if (!overlap) return;
        }
        out.push({
          id: `${iv.id}__${domain.id}__custom${ci}`,
          informant: (iv.intervieweeName || "").trim() || "[Unnamed informant]",
          role: (iv.intervieweeRole || "").trim() || tpl.name,
          template: tpl.name,
          domain: domain.name,
          domainId: domain.id,
          tags: enriched,
          question: cq.question.trim(),
          answer,
          isCustom: true,
        });
      });
    }

    // General notes — treated as broadly applicable evidence with no
    // specific domain. Tagged "background" so they show up in disability-
    // profile sections and are otherwise picked up by the AI when relevant.
    const notes = (iv.generalNotes || "").trim();
    if (notes) {
      out.push({
        id: `${iv.id}__general_notes`,
        informant: (iv.intervieweeName || "").trim() || "[Unnamed informant]",
        role: (iv.intervieweeRole || "").trim() || tpl.name,
        template: tpl.name,
        domain: "General Notes",
        domainId: "_general",
        tags: ["background"],
        question: "(General clinician observations from this interview)",
        answer: notes,
        isCustom: false,
      });
    }
  }
  return out;
}

/* ─── LEGACY V1 Template definitions ─────────────────────────────────── */
/* These stay unchanged so existing interviews continue to render.      */
/* New interviews use LIAISE_TEMPLATES_V2 above.                         */
const TEMPLATES: Record<string, TemplateDefinition> = {
  support_worker: {
    id: "support_worker", name: "Support Worker", icon: "SW", color: "#2563eb",
    description: "Daily functioning, ADLs, behaviour, support needs, and observed capacity",
    domains: [
      { id: "daily_functioning", name: "Daily Functioning", questions: ["What does a typical day look like for them when you're supporting them?","What can they do independently?","What do they usually need prompting, supervision, or physical help with?","Are there certain times of day that are harder than others?"] },
      { id: "adls_iadls", name: "ADLs / IADLs", questions: ["How do they manage showering, dressing, toileting, eating?","How do they go with cooking, cleaning, shopping, laundry?","Can they manage medication, appointments, money, transport?"] },
      { id: "cognition_executive", name: "Cognition / Executive Functioning", questions: ["Do they remember tasks or do they need reminders?","Can they start and finish tasks on their own?","How do they go with planning, sequencing, problem-solving?","Do they understand risk and safety issues?"] },
      { id: "behaviour_emotional", name: "Behaviour / Emotional Regulation", questions: ["What tends to upset or dysregulate them?","How do they usually respond when overwhelmed?","What strategies help calm or redirect them?","Have you noticed any risks to themselves or others?"] },
      { id: "social_communication", name: "Social / Communication", questions: ["How do they communicate their needs?","Do they engage well with others?","Are there issues with boundaries, conflict, withdrawal, or misunderstanding?","How do they go in the community or in groups?"] },
      { id: "mobility_physical", name: "Mobility / Physical Support", questions: ["Do they need support with walking, transfers, stairs, community access?","Any falls, near falls, fatigue, pain, or endurance issues?","What equipment or environmental supports are they using?"] },
      { id: "support_needs", name: "Support Needs", questions: ["What support do you think is most essential for them right now?","Where do current supports seem insufficient?","What happens when support is not available?","Are there gaps in the roster or times where risk increases?"] },
      { id: "strengths", name: "Strengths", questions: ["What are they good at?","What do they enjoy?","When are they at their best?","What helps them be more independent?"] },
      { id: "consistency_variability", name: "Consistency / Variability", questions: ["Are they fairly consistent day to day, or does function vary a lot?","Are there good days and bad days?","What seems to influence that?"] },
    ],
  },
  support_coordinator: {
    id: "support_coordinator", name: "Support Coordinator", icon: "SC", color: "#0891b2",
    description: "Service gaps, plan context, risk, barriers, and funding recommendations",
    domains: [
      { id: "current_supports", name: "Current Supports", questions: ["What formal supports are currently in place?","How consistently are those supports actually being used?","Are there any services that have been hard to engage or maintain?","Are current supports meeting the person's needs?"] },
      { id: "service_gaps", name: "Service Gaps", questions: ["Where are the biggest gaps in the current plan?","What supports do you think are missing?","Are there supports funded but not realistically accessible?","What usually breaks down first when things aren't going well?"] },
      { id: "functional_impact", name: "Functional Impact", questions: ["From your perspective, what are the main areas where the participant struggles day to day?","What support needs come up most often across services?","Where do they need prompting, supervision, or hands-on assistance?","What has the biggest impact on their independence?"] },
      { id: "risk_sustainability", name: "Risk / Sustainability", questions: ["What risks are you most concerned about at the moment?","Are there concerns around carer burnout, placement breakdown, hospitalisation, disengagement, or crisis?","What tends to happen when supports are reduced or inconsistent?","How sustainable is the current arrangement?"] },
      { id: "barriers", name: "Barriers", questions: ["What barriers are stopping progress right now?","Are there issues with provider availability, engagement, transport, funding, rural access, behaviour, or mental health?","Are there any systemic issues making it harder for the participant to get what they need?"] },
      { id: "goals_engagement", name: "Participant Goals / Engagement", questions: ["What goals has the participant or family been prioritising?","How engaged are they with supports and services?","Do they understand their plan and what's available to them?","What tends to help or hinder engagement?"] },
      { id: "plan_funding", name: "Plan / Funding Context", questions: ["In your view, where is the current funding insufficient?","Are there any supports you think need stronger evidence or justification in the report?","What recommendations would likely make the biggest difference?","If this report is strong, what do you hope it helps secure?"] },
      { id: "collaboration_history", name: "Collaboration / History", questions: ["What have other providers been saying?","Have there been patterns across OT, psych, support work, behaviour support, etc.?","Has there been previous progress, stagnation, or deterioration?","Are there any past reports or events I should understand for context?"] },
    ],
  },
  parent_carer: {
    id: "parent_carer", name: "Parent / Carer", icon: "PC", color: "#7c3aed",
    description: "Home life, daily routines, carer capacity, and family context",
    domains: [
      { id: "daily_routine", name: "Daily Routine", questions: ["What does a typical day look like for them at home?","What can they do independently versus what do you help with?","What does their morning and evening routine look like?","How much time do you spend supporting them each day?"] },
      { id: "self_care", name: "Self-Care & Personal ADLs", questions: ["How do they manage showering, dressing, toileting?","Do they need reminding, supervising, or hands-on help?","Are there any continence issues?","How do they manage eating — can they prepare food, use utensils, eat safely?"] },
      { id: "home_tasks", name: "Domestic Tasks", questions: ["Can they help with household tasks like cleaning, laundry, cooking?","Do they need step-by-step instructions or can they initiate tasks?","What household tasks do you do entirely for them?"] },
      { id: "behaviour_mood", name: "Behaviour & Mood", questions: ["What tends to upset or overwhelm them?","How do they express frustration, anxiety, or distress?","Are there any behaviours of concern at home?","What helps settle or regulate them?","Have there been any incidents of self-harm, aggression, or absconding?"] },
      { id: "social_community", name: "Social & Community", questions: ["Do they have friends or social connections outside the home?","How do they go in community settings — shops, appointments, outings?","Can they use transport independently?","Do they attend any groups, programs, or activities?"] },
      { id: "sleep_health", name: "Sleep & Health", questions: ["How is their sleep — do they settle, wake during the night, need support?","Are there any current health concerns or hospitalisations?","How do they manage medications?"] },
      { id: "carer_capacity", name: "Carer Capacity & Sustainability", questions: ["How are you managing with the current level of care?","Do you have your own health issues that affect your capacity?","Do you work, have other children, or other caring responsibilities?","What would happen if you were unable to provide care temporarily?","Is there anyone else who helps — and how reliable is that support?"] },
      { id: "strengths_goals", name: "Strengths & Goals", questions: ["What are they good at or what do they enjoy?","What are your goals for them?","What supports would make the biggest difference for your family?"] },
      { id: "concerns", name: "Key Concerns", questions: ["What worries you most about their current situation?","What's the hardest part of your caring role right now?","Is there anything you want the NDIS planner to understand?"] },
    ],
  },
  teacher_educator: {
    id: "teacher_educator", name: "Teacher / Educator", icon: "TE", color: "#059669",
    description: "School functioning, learning, behaviour, social engagement, and classroom support",
    domains: [
      { id: "academic_learning", name: "Academic / Learning", questions: ["How are they performing academically relative to their peers?","Can they follow instructions and complete tasks independently?","What learning supports or modifications are currently in place?","What are their strengths as a learner?"] },
      { id: "classroom_behaviour", name: "Classroom Behaviour", questions: ["How do they manage in the classroom environment?","Are there any behaviours of concern during the school day?","What triggers dysregulation and how does it present?","What strategies does the school use to support regulation?"] },
      { id: "social_peers", name: "Social & Peer Interaction", questions: ["How do they interact with peers — do they initiate, respond, withdraw?","Do they have friends or tend to be socially isolated?","Are there any issues with boundaries, conflict, or bullying?","How do they go in unstructured settings like lunch or recess?"] },
      { id: "communication", name: "Communication", questions: ["How do they communicate — verbal, non-verbal, AAC?","Can they express their needs clearly to staff and peers?","Do they understand group instructions or need individual prompting?"] },
      { id: "self_care_school", name: "Self-Care at School", questions: ["Can they manage toileting, eating, and dressing independently at school?","Do they need support with transitions between activities or locations?","Are there any safety concerns during the school day?"] },
      { id: "support_aides", name: "Current School Supports", questions: ["Does the student have an aide — how many hours and what do they cover?","Is the current support level sufficient?","What additional support would make the biggest difference?"] },
      { id: "sensory", name: "Sensory & Environment", questions: ["Are there sensory issues that affect their participation?","What environmental modifications are in place?","How do they manage transitions, noise, or busy environments?"] },
    ],
  },
  allied_health: {
    id: "allied_health", name: "Allied Health Professional", icon: "AH", color: "#ea580c",
    description: "Clinical observations, treatment progress, and interdisciplinary perspective",
    domains: [
      { id: "role_involvement", name: "Role & Involvement", questions: ["What is your role and how long have you been working with the participant?","What has been the focus of your intervention?","How frequently do you see them and in what setting?"] },
      { id: "clinical_observations", name: "Clinical Observations", questions: ["What are the main areas of difficulty you've observed?","How does their presentation compare to when you first started working with them?","Are there specific functional limitations relevant to your discipline?"] },
      { id: "progress_outcomes", name: "Progress & Outcomes", questions: ["What progress has been made toward treatment goals?","What has worked well and what hasn't?","Are there barriers to progress from your perspective?"] },
      { id: "recommendations", name: "Recommendations", questions: ["What do you think they need more of or less of?","Are the current funded hours sufficient for your discipline?","What would happen if your service was discontinued or reduced?"] },
      { id: "risk_concerns", name: "Risk & Concerns", questions: ["Are there any safety or clinical risks you're monitoring?","Have there been any critical incidents or hospitalisations?","Are there concerns about engagement, compliance, or deterioration?"] },
      { id: "interdisciplinary", name: "Interdisciplinary", questions: ["How does your work intersect with other supports the participant receives?","Are there recommendations for OT specifically?","Is there anything you think is being missed across the team?"] },
    ],
  },
  // `employer` and `participant_self` V1 templates were removed in the
  // Apr 2026 cleanup — they were intentionally omitted from V2 (not
  // contacted / not self-reported in practice) and had no live interviews
  // referencing them. If a historical interview ever carried one of these
  // templateIds, the interview card's null-template branch will render
  // nothing and the card will be skipped.
};

interface TemplateDomain {
  id: string;
  name: string;
  questions: string[];
}

interface TemplateDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  domains: TemplateDomain[];
}

export interface CollateralInterview {
  id: string;
  templateId: string;
  intervieweeName: string;
  intervieweeRole: string;
  date: string;
  method: string;
  responses: Record<string, string>;
  customQuestions: Record<string, { question: string; response: string }[]>;
  generalNotes: string;
}

/**
 * Status for an individual interview's save cycle. Shown per-card as a small
 * indicator and used to gate the "Retry" button when a save fails.
 *   - idle:   no changes pending
 *   - saving: debounced save in flight (or pending)
 *   - saved:  last save succeeded
 *   - error:  last save failed; user should retry
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Database row shape for the `collateral_interviews` table. Local type so
 * the upsert/insert payloads are typed without depending on the generated
 * Supabase `Database` type (which is not exported from this file).
 * JSONB columns are typed as the structural shapes we actually store.
 */
type CollateralInterviewRow = {
  id: string;
  report_id: string;
  user_id: string;
  template_id: string;
  interviewee_name?: string;
  interviewee_role?: string;
  interview_date?: string | null;
  interview_method?: string;
  responses?: Record<string, string>;
  custom_questions?: Record<string, { question: string; response: string }[]>;
  general_notes?: string;
  updated_at?: string;
};

const INTERVIEW_METHODS = [
  { id: "phone", label: "Phone Call", icon: Phone },
  { id: "in_person", label: "In Person", icon: Home },
  { id: "email", label: "Email / Written", icon: Mail },
  { id: "telehealth", label: "Telehealth", icon: Monitor },
];

/* ─── V2 Checklist input helpers ─────────────────────────────────────── */

/**
 * Single-select checklist. Stores the selected option label as a plain
 * string so the existing `responses: Record<string, string>` shape is
 * preserved. When the user picks "Other", an additional text field appears
 * and the stored value becomes `"Other: <text>"`.
 */
function ChecklistSingleInput({
  options,
  allowOther,
  value,
  onChange,
  accentColor,
}: {
  options: string[];
  allowOther: boolean;
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}) {
  const isOther = value.startsWith("Other:") || value === "Other";
  const otherText = value.startsWith("Other:") ? value.slice("Other:".length).trim() : "";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(selected ? "" : opt)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded border transition-colors",
                selected
                  ? "text-white"
                  : "border-border/50 bg-background text-foreground hover:bg-muted/40"
              )}
              style={selected ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
            >
              {opt}
            </button>
          );
        })}
        {allowOther && (
          <button
            type="button"
            onClick={() => onChange(isOther ? "" : "Other:")}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded border transition-colors italic",
              isOther
                ? "text-white"
                : "border-dashed border-border/50 bg-background text-muted-foreground hover:bg-muted/40"
            )}
            style={isOther ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
          >
            Other…
          </button>
        )}
      </div>
      {allowOther && isOther && (
        <Input
          type="text"
          placeholder="Please describe"
          value={otherText}
          onChange={(e) => onChange(`Other: ${e.target.value}`)}
          className="h-7 text-xs"
        />
      )}
    </div>
  );
}

/**
 * Multi-select checklist. Stores selections as a JSON-encoded string array
 * (e.g. `'["Walking stick","Walker"]'`) so the existing responses shape is
 * preserved. When the user picks "Other", a text field appears and the
 * user's typed value is appended to the array as `"Other: <text>"`.
 *
 * The edge function and any AI prompt builder must flatten these JSON
 * arrays to human-readable strings before injection — see
 * `flattenStoredResponse` exported above.
 */
function ChecklistMultiInput({
  options,
  allowOther,
  value,
  onChange,
  accentColor,
}: {
  options: string[];
  allowOther: boolean;
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}) {
  // Parse the JSON-encoded array (or treat as empty). Shared parser with
  // `flattenStoredResponse` — see `parseStoredArray` near the top of the
  // file for the canonical decode logic.
  const parsed: string[] = useMemo(() => parseStoredArray(value), [value]);

  const otherEntry = parsed.find((v) => v.startsWith("Other:") || v === "Other");
  const otherText = otherEntry?.startsWith("Other:") ? otherEntry.slice("Other:".length).trim() : "";
  const hasOther = !!otherEntry;

  const commit = (next: string[]) => {
    const cleaned = next.filter((v, i, arr) => v && arr.indexOf(v) === i);
    onChange(cleaned.length > 0 ? JSON.stringify(cleaned) : "");
  };

  const toggle = (opt: string) => {
    if (parsed.includes(opt)) {
      commit(parsed.filter((v) => v !== opt));
    } else {
      commit([...parsed, opt]);
    }
  };

  const toggleOther = () => {
    if (hasOther) {
      commit(parsed.filter((v) => !v.startsWith("Other:") && v !== "Other"));
    } else {
      commit([...parsed, "Other:"]);
    }
  };

  const updateOtherText = (text: string) => {
    const withoutOther = parsed.filter((v) => !v.startsWith("Other:") && v !== "Other");
    commit([...withoutOther, `Other: ${text}`]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = parsed.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded border transition-colors",
                selected
                  ? "text-white"
                  : "border-border/50 bg-background text-foreground hover:bg-muted/40"
              )}
              style={selected ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
            >
              {opt}
            </button>
          );
        })}
        {allowOther && (
          <button
            type="button"
            onClick={toggleOther}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded border transition-colors italic",
              hasOther
                ? "text-white"
                : "border-dashed border-border/50 bg-background text-muted-foreground hover:bg-muted/40"
            )}
            style={hasOther ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
          >
            Other…
          </button>
        )}
      </div>
      {allowOther && hasOther && (
        <Input
          type="text"
          placeholder="Please describe"
          value={otherText}
          onChange={(e) => updateOtherText(e.target.value)}
          className="h-7 text-xs"
        />
      )}
    </div>
  );
}

/* ─── Save-status pill shown in each card header ─── */
/**
 * Compact inline indicator reflecting the per-card save state. Pure presentational —
 * all state transitions live in the parent <LiaiseMode>.
 *   - idle:   nothing shown (card hasn't been edited yet this session)
 *   - saving: muted "Saving…" label
 *   - saved:  subtle "Saved" label (auto-fades into the background after use)
 *   - error:  red "Couldn't save" label + Retry button
 */
function SaveStatusIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="text-[10px] text-muted-foreground italic px-1.5" aria-live="polite">
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-[10px] text-muted-foreground px-1.5 flex items-center gap-0.5" aria-live="polite">
        <CheckCircle2 className="h-3 w-3 text-green-600" aria-hidden />
        Saved
      </span>
    );
  }
  // error
  return (
    <span className="text-[10px] text-destructive px-1.5 flex items-center gap-1" aria-live="assertive">
      Couldn't save
      <button
        type="button"
        onClick={onRetry}
        className="underline font-medium hover:text-destructive/80"
        aria-label="Retry save"
      >
        Retry
      </button>
    </span>
  );
}

/* ─── Interview Card ─── */
function InterviewCard({
  interview,
  saveStatus,
  onUpdate,
  onRemove,
  onDuplicate,
  onRetrySave,
}: {
  interview: CollateralInterview;
  /** Current per-card save state — drives the "Saving…" / "Saved" / "Error"
   *  indicator shown in the card header. See SaveStatus in LiaiseMode. */
  saveStatus: SaveStatus;
  onUpdate: (iv: CollateralInterview) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  /** Invoked when the user clicks the "Retry" button on a failed save. */
  onRetrySave: () => void;
}) {
  // V2 templates are checked first; falls back to the legacy V1 set so existing
  // interviews continue to render. The two types share enough surface area
  // (id, name, icon, color, description, domains with id+name+questions) that
  // the header/meta rendering below can treat them uniformly — but the
  // per-question rendering branches based on whether this is a V2 template.
  const v2Template = LIAISE_TEMPLATES_V2[interview.templateId];
  const v1Template = TEMPLATES[interview.templateId];
  const template = v2Template ?? v1Template;
  const isV2 = !!v2Template;

  // Initial collapsed state: V2 templates auto-expand PRIMARY (★) domains
  // and collapse the rest. V1 templates keep the legacy behaviour of
  // everything expanded.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (!v2Template) return {};
    const initial: Record<string, boolean> = {};
    for (const d of v2Template.domains) {
      if (!d.primary) initial[d.id] = true;
    }
    return initial;
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rolePlaceholder = v2Template?.rolePlaceholder ?? "e.g. Daily support worker — 2 years";

  const toggleDomain = (domainId: string) =>
    setCollapsed((p) => ({ ...p, [domainId]: !p[domainId] }));

  const updateResponse = (domainId: string, questionIdx: number, value: string) => {
    onUpdate({
      ...interview,
      responses: { ...interview.responses, [responseKey(domainId, questionIdx)]: value },
    });
  };

  const updateCustomQ = (domainId: string, idx: number, field: "question" | "response", value: string) => {
    const customs = { ...interview.customQuestions };
    if (!customs[domainId]) customs[domainId] = [];
    customs[domainId] = customs[domainId].map((q, i) => (i === idx ? { ...q, [field]: value } : q));
    onUpdate({ ...interview, customQuestions: customs });
  };

  const addCustomQ = (domainId: string) => {
    const customs = { ...interview.customQuestions };
    if (!customs[domainId]) customs[domainId] = [];
    customs[domainId] = [...customs[domainId], { question: "", response: "" }];
    onUpdate({ ...interview, customQuestions: customs });
  };

  const removeCustomQ = (domainId: string, idx: number) => {
    const customs = { ...interview.customQuestions };
    customs[domainId] = customs[domainId].filter((_, i) => i !== idx);
    onUpdate({ ...interview, customQuestions: customs });
  };

  const answeredCount = useMemo(
    () => countAnsweredResponses(interview),
    [interview],
  );

  const totalQuestions = useMemo(() => {
    let count = template.domains.reduce((sum, d) => sum + d.questions.length, 0);
    for (const domainCustoms of Object.values(interview.customQuestions)) {
      count += domainCustoms.length;
    }
    return count;
  }, [template, interview.customQuestions]);

  if (!template) return null;

  return (
    <>
      <div className="border border-border/50 rounded-lg overflow-hidden mb-5">
        {/* Card Header */}
        <div
          className="px-4 py-3 border-b border-border/30"
          style={{ background: `linear-gradient(135deg, ${template.color}08, ${template.color}03)` }}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 font-mono"
                style={{ backgroundColor: template.color }}
              >
                {template.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-foreground">{template.name} Interview</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {answeredCount}/{totalQuestions} questions answered
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Save-status indicator. Shown inline with the action buttons
                  so the clinician gets immediate feedback that their edits
                  are tracked. The "Retry" button only appears on error —
                  clicking it runs the upsert again via onRetrySave. */}
              <SaveStatusIndicator status={saveStatus} onRetry={onRetrySave} />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDuplicate}>
                <Copy className="h-3 w-3 mr-1" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          </div>

          {/* Meta fields */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Interviewee Name</label>
              <Input
                type="text"
                placeholder="e.g. Jane Smith"
                value={interview.intervieweeName}
                onChange={(e) => onUpdate({ ...interview, intervieweeName: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Role / Relationship</label>
              <Input
                type="text"
                placeholder={rolePlaceholder}
                value={interview.intervieweeRole}
                onChange={(e) => onUpdate({ ...interview, intervieweeRole: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Date</label>
              <Input
                type="date"
                value={interview.date}
                onChange={(e) => onUpdate({ ...interview, date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="min-w-[130px]">
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1" id={`method-label-${interview.id}`}>Method</label>
              <div className="flex gap-1" role="group" aria-labelledby={`method-label-${interview.id}`}>
                {INTERVIEW_METHODS.map((m) => {
                  const active = interview.method === m.id;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onUpdate({ ...interview, method: m.id })}
                      title={m.label}
                      aria-label={`Interview method: ${m.label}`}
                      aria-pressed={active}
                      className={cn(
                        "p-1.5 rounded border transition-colors",
                        active
                          ? "border-accent bg-accent/10"
                          : "border-border/50 bg-background hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: active ? template.color : undefined }} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Domain sections */}
        {template.domains.map((domain) => {
          const isCollapsed = collapsed[domain.id];
          const isPrimary = isV2 && (domain as LiaiseDomainV2).primary === true;
          const domainAnswered = domain.questions.filter((_, qi: number) => {
            const v = interview.responses[responseKey(domain.id, qi)];
            return !!v && !!v.trim();
          }).length;
          const customQs = interview.customQuestions[domain.id] || [];
          const customAnswered = customQs.filter((cq) => cq.response && cq.response.trim()).length;
          const totalDomainQ = domain.questions.length + customQs.length;
          const totalDomainA = domainAnswered + customAnswered;

          return (
            <div key={domain.id} className="border-b border-border/20 last:border-b-0">
              <button
                onClick={() => toggleDomain(domain.id)}
                className="w-full px-4 py-2 flex justify-between items-center cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-[3px] h-3.5 rounded-sm" style={{ backgroundColor: template.color }} />
                  <span className="text-xs font-semibold text-foreground">{domain.name}</span>
                  {isPrimary && (
                    <Star className="h-3 w-3 fill-amber-400 stroke-amber-500" aria-label="Primary contribution area" />
                  )}
                  <span className="text-[11px] text-muted-foreground">({totalDomainA}/{totalDomainQ})</span>
                  {totalDomainA > 0 && totalDomainA === totalDomainQ && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-green-50 text-green-700 border-green-200">
                      COMPLETE
                    </Badge>
                  )}
                </div>
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {!isCollapsed && (
                <div>
                  {domain.questions.map((question, qi: number) => {
                    const key = responseKey(domain.id, qi);
                    const stripeClass = cn(
                      "px-4 py-2.5 border-b border-border/10",
                      qi % 2 === 0 ? "bg-background" : "bg-muted/10"
                    );

                    // V1: question is a plain string — render a textarea.
                    if (!isV2 || typeof question === "string") {
                      const legacyText = typeof question === "string" ? question : "";
                      return (
                        <div key={qi} className={stripeClass}>
                          <div className="text-xs text-foreground font-medium mb-1.5 leading-relaxed">
                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5">Q{qi + 1}</span>
                            {legacyText}
                          </div>
                          <Textarea
                            rows={2}
                            placeholder="Dot points, notes, or verbatim response..."
                            value={interview.responses[key] || ""}
                            onChange={(e) => updateResponse(domain.id, qi, e.target.value)}
                            className="text-xs resize-y min-h-[50px]"
                          />
                        </div>
                      );
                    }

                    // V2: question is a typed object — render based on type.
                    const v2q = question as LiaiseQuestionV2;
                    const storedValue = interview.responses[key] || "";

                    return (
                      <div key={qi} className={stripeClass}>
                        <div className="text-xs text-foreground font-medium mb-1.5 leading-relaxed">
                          <span className="font-mono text-[10px] text-muted-foreground mr-1.5">Q{qi + 1}</span>
                          {v2q.text}
                        </div>
                        {v2q.type === "open" && (
                          <Textarea
                            rows={2}
                            placeholder="Dot points, notes, or verbatim response..."
                            value={storedValue}
                            onChange={(e) => updateResponse(domain.id, qi, e.target.value)}
                            className="text-xs resize-y min-h-[50px]"
                          />
                        )}
                        {v2q.type === "checklist_single" && (
                          <ChecklistSingleInput
                            options={v2q.options}
                            allowOther={v2q.allowOther === true}
                            value={storedValue}
                            onChange={(v) => updateResponse(domain.id, qi, v)}
                            accentColor={template.color}
                          />
                        )}
                        {v2q.type === "checklist_multi" && (
                          <ChecklistMultiInput
                            options={v2q.options}
                            allowOther={v2q.allowOther === true}
                            value={storedValue}
                            onChange={(v) => updateResponse(domain.id, qi, v)}
                            accentColor={template.color}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Custom questions */}
                  {customQs.map((cq, ci) => (
                    <div key={`custom_${ci}`} className="px-4 py-2.5 bg-amber-50/50 border-b border-amber-100/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">CUSTOM</Badge>
                        <Input
                          type="text"
                          placeholder="Your question..."
                          value={cq.question}
                          onChange={(e) => updateCustomQ(domain.id, ci, "question", e.target.value)}
                          className="flex-1 h-7 text-xs font-medium border-amber-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomQ(domain.id, ci)}
                          aria-label="Remove this custom question"
                          className="text-muted-foreground hover:text-destructive px-1"
                        >
                          ×
                        </button>
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Response..."
                        value={cq.response}
                        onChange={(e) => updateCustomQ(domain.id, ci, "response", e.target.value)}
                        className="text-xs resize-y min-h-[50px] border-amber-200"
                      />
                    </div>
                  ))}

                  {/* Add custom question */}
                  <div className="px-4 py-2">
                    <button
                      onClick={() => addCustomQ(domain.id)}
                      className="text-[11px] px-2.5 py-1 rounded border border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      + Add custom question
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* General notes */}
        <div className="px-4 py-3 bg-muted/20 border-t border-border/30">
          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
            General Notes / Clinician Observations
          </label>
          <Textarea
            rows={3}
            placeholder="Additional observations, impressions, or context from the interview..."
            value={interview.generalNotes}
            onChange={(e) => onUpdate({ ...interview, generalNotes: e.target.value })}
            className="text-xs resize-y"
          />
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this interview?</AlertDialogTitle>
            <AlertDialogDescription>
              Responses will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Main Liaise Mode Component ─── */
interface LiaiseModeProps {
  reportId: string;
  interviews: CollateralInterview[];
  onUpdateInterviews: (interviews: CollateralInterview[]) => void;
}

export function LiaiseMode({ reportId, interviews, onUpdateInterviews }: LiaiseModeProps) {
  const { user } = useAuth();
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  // Per-interview save status. Exposed to InterviewCard so each card shows
  // its own "Saving…" / "Saved" / "Error — retry" indicator independently.
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  // Per-id debounce timers. Using a Map (not a single ref) fixes the bug
  // where rapidly switching between interviews would cancel the first one's
  // pending save and silently drop the edit.
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up any pending timers when the component unmounts. Without this,
  // a late-firing setTimeout could call saveInterview after the component
  // tree has unmounted, which in turn would try to update React state on
  // a stale tree and throw a console warning.
  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const setStatus = useCallback((id: string, status: SaveStatus) => {
    setSaveStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  // Upsert one interview to Supabase. Called from the debounced path below
  // (updateInterview) and directly from the retry-after-error path (exposed
  // via InterviewCard's retry button). Updates the per-id status so the UI
  // reflects in-flight / success / failure.
  const saveInterview = useCallback(async (iv: CollateralInterview) => {
    if (!user?.id) return;
    setStatus(iv.id, "saving");
    const { error } = await supabase
      .from("collateral_interviews")
      .upsert(buildCollateralRow(iv, reportId, user.id, "full"));
    if (error) {
      console.error("Save interview error:", error);
      setStatus(iv.id, "error");
      toast.error("Couldn't save interview — click Retry on the card");
    } else {
      setStatus(iv.id, "saved");
    }
  }, [reportId, user?.id, setStatus]);

  // Debounced save keyed per-interview-id. Each interview has its own
  // pending-save timer so editing interview A then interview B within the
  // debounce window saves BOTH (the previous implementation cancelled A).
  const debouncedSave = useCallback((iv: CollateralInterview) => {
    const existing = saveTimersRef.current.get(iv.id);
    if (existing) clearTimeout(existing);
    // Mark as saving so the card's indicator flips immediately — reassures
    // the clinician that their edit is tracked, even though the actual
    // network call is deferred by 500ms to coalesce rapid keystrokes.
    setStatus(iv.id, "saving");
    const timer = setTimeout(() => {
      saveInterview(iv);
      saveTimersRef.current.delete(iv.id);
    }, 500);
    saveTimersRef.current.set(iv.id, timer);
  }, [saveInterview, setStatus]);

  const addInterview = async (templateId: string) => {
    if (!user?.id) return;
    const newId = crypto.randomUUID();
    const newIv: CollateralInterview = {
      id: newId,
      templateId,
      intervieweeName: "",
      intervieweeRole: "",
      date: "",
      method: "",
      responses: {},
      customQuestions: {},
      generalNotes: "",
    };
    onUpdateInterviews([...interviews, newIv]);
    setShowTemplateSelector(false);

    // Seed status as "saved" so the new card doesn't flash "error" before
    // the user has touched it. The insert below races with the UI but the
    // card renders immediately from the optimistic append above.
    setStatus(newId, "saved");

    const { error } = await supabase
      .from("collateral_interviews")
      .insert(buildCollateralRow(newIv, reportId, user.id, "minimal"));
    if (error) {
      console.error("Insert interview error:", error);
      setStatus(newId, "error");
      toast.error("Couldn't create interview");
    }
  };

  const updateInterview = (idx: number, updated: CollateralInterview) => {
    const newInterviews = interviews.map((iv, i) => (i === idx ? updated : iv));
    onUpdateInterviews(newInterviews);
    debouncedSave(updated);
  };

  const removeInterview = async (idx: number) => {
    const iv = interviews[idx];
    const newInterviews = interviews.filter((_, i) => i !== idx);
    onUpdateInterviews(newInterviews);

    // Cancel any pending debounced save for this interview — without this,
    // a setTimeout that fires AFTER the DELETE would race-resurrect the
    // row on the server. Also drop its save-status entry so a stale "error"
    // pill doesn't reappear if the same id is later re-used (extremely
    // unlikely with crypto.randomUUID but cheap to defend against).
    const pending = saveTimersRef.current.get(iv.id);
    if (pending) {
      clearTimeout(pending);
      saveTimersRef.current.delete(iv.id);
    }
    setSaveStatuses((prev) => {
      if (!(iv.id in prev)) return prev;
      const { [iv.id]: _drop, ...rest } = prev;
      return rest;
    });

    const { error } = await supabase.from("collateral_interviews").delete().eq("id", iv.id);
    if (error) {
      console.error("Delete interview error:", error);
      toast.error("Couldn't remove interview from server (gone locally)");
    } else {
      toast.success("Interview removed");
    }
  };

  const duplicateInterview = async (idx: number) => {
    const original = interviews[idx];
    const newId = crypto.randomUUID();
    const dup: CollateralInterview = {
      ...original,
      id: newId,
      intervieweeName: "",
      intervieweeRole: "",
      date: "",
      responses: {},
      customQuestions: {},
      generalNotes: "",
    };
    onUpdateInterviews([...interviews, dup]);
    setStatus(newId, "saved");

    if (!user?.id) return;
    const { error } = await supabase
      .from("collateral_interviews")
      .insert(buildCollateralRow(dup, reportId, user.id, "minimal"));
    if (error) {
      console.error("Duplicate interview error:", error);
      setStatus(newId, "error");
      toast.error("Couldn't duplicate interview");
    }
  };

  const totalResponses = useMemo(
    () => interviews.reduce((sum, iv) => sum + countAnsweredResponses(iv), 0),
    [interviews],
  );

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const iv of interviews) {
      const t = findTemplate(iv.templateId);
      if (t) counts[t.name] = (counts[t.name] || 0) + 1;
    }
    return counts;
  }, [interviews]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6 border-b-2 border-foreground pb-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Liaise
          </h1>
          <span className="text-xs text-muted-foreground font-medium">
            Collateral Interviews — Background & Stakeholder Information
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          Select a stakeholder template, record responses during phone calls or from returned questionnaires.
          Notes are saved and transformed into NDIS-quality prose by AI during report generation.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-3 text-xs flex-wrap items-center">
          <span className="font-semibold text-foreground">{interviews.length} interviews</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{totalResponses} responses recorded</span>
          {Object.entries(summary).map(([name, count]) => (
            <span key={name} className="text-muted-foreground">{count}× {name}</span>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowTemplateSelector(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Interview
        </Button>
      </div>

      {/* Template selector dialog — shows V2 templates only for new interviews.
          Existing V1 interviews continue to render via the legacy template set
          but clinicians can no longer create new ones. */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Stakeholder Template</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Choose a template to start a new collateral interview. Questions are aligned to the functional capacity domains used in the report, so multiple informants can be triangulated.
          </p>
          <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
            {Object.values(LIAISE_TEMPLATES_V2).map((template) => {
              const totalQuestions = template.domains.reduce((s, d) => s + d.questions.length, 0);
              return (
                <button
                  key={template.id}
                  onClick={() => addInterview(template.id)}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border border-border/30 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 font-mono"
                    style={{ backgroundColor: template.color }}
                  >
                    {template.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{template.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">{template.description}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {template.domains.length} sections · {totalQuestions} questions
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {interviews.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-lg bg-muted/10">
          <Handshake className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground mb-1">No collateral interviews yet</div>
          <div className="text-xs text-muted-foreground/70 mb-4 max-w-md mx-auto">
            Collateral information from support workers, coordinators, carers, and other stakeholders strengthens
            your report with independent evidence. Interviews can be done over the phone during your assessment prep.
          </div>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={() => setShowTemplateSelector(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Start an Interview
            </Button>
          </div>
        </div>
      )}

      {/* Interview Cards */}
      {interviews.map((iv, idx) => (
        <InterviewCard
          key={iv.id}
          interview={iv}
          saveStatus={saveStatuses[iv.id] ?? "idle"}
          onUpdate={(updated) => updateInterview(idx, updated)}
          onRemove={() => removeInterview(idx)}
          onDuplicate={() => duplicateInterview(idx)}
          onRetrySave={() => saveInterview(iv)}
        />
      ))}

      {/* Collateral Summary Table */}
      {interviews.length > 0 && (
        <div className="border-2 border-foreground rounded-lg overflow-hidden mt-6">
          <div className="px-4 py-3 bg-foreground text-background">
            <h2 className="text-base font-bold">Collateral Summary</h2>
            <span className="text-[11px] opacity-70">
              This information will be included in the generated report
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Stakeholder</TableHead>
                <TableHead className="text-xs w-[140px]">Interviewee</TableHead>
                <TableHead className="text-xs text-center w-[70px]">Method</TableHead>
                <TableHead className="text-xs text-center w-[80px]">Date</TableHead>
                <TableHead className="text-xs text-center w-[80px]">Responses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((iv) => {
                const template = findTemplate(iv.templateId);
                if (!template) return null;
                const answered = countAnsweredResponses(iv);
                const method = INTERVIEW_METHODS.find((m) => m.id === iv.method);
                return (
                  <TableRow key={iv.id}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-[3px] h-3.5 rounded-sm" style={{ backgroundColor: template.color }} />
                        <span className="font-medium">{template.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-[11px]", iv.intervieweeName ? "text-foreground" : "text-muted-foreground")}>
                      {iv.intervieweeName || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {method ? (
                        <span title={method.label}>{<method.icon className="h-3.5 w-3.5 mx-auto text-muted-foreground" />}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-[11px] font-mono text-muted-foreground">
                      {iv.date || "—"}
                    </TableCell>
                    <TableCell className="text-center text-[11px] font-mono font-semibold" style={{ color: answered > 0 ? template.color : undefined }}>
                      {answered}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* Legacy V1 templates exported under LIAISE_TEMPLATES for backward
 * compatibility. Existing importers (ClientEditor, MethodologyAggregator)
 * can continue using this identifier for V1 interviews. For new V2
 * interviews, import LIAISE_TEMPLATES_V2 (defined near the top of this
 * file) or use getQuestionText() to normalise across both. */
export { TEMPLATES as LIAISE_TEMPLATES };

/**
 * Normalise a question value across V1 and V2 templates.
 *
 * V1 template questions are plain strings. V2 template questions are
 * discriminated-union objects of shape `{type, text, ...}`. This helper
 * returns the user-visible question text for either shape so importers
 * don't need to branch on the template version.
 */
export function getQuestionText(question: string | LiaiseQuestionV2 | undefined): string {
  if (!question) return "";
  if (typeof question === "string") return question;
  return question.text;
}
