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

export interface LiaiseDomainV2 {
  id: string;
  name: string;
  /** When true, the domain auto-expands in the UI and is marked as the informant's primary contribution area. */
  primary?: boolean;
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
        id: "mobility_transfers",
        name: "Mobility & Transfers",
        questions: [
          { type: "checklist_multi", text: "Mobility aids currently used during your shifts", options: [...MOBILITY_AIDS_OPTIONS], allowOther: true },
          { type: "checklist_single", text: "Typical level of physical assistance with transfers (bed/chair/toilet/car)", options: ["Independent", "Set-up / verbal prompting only", "Minimal hands-on (steadying, guiding)", "Moderate assistance (one person)", "Full assistance (two people or hoist)"] },
          { type: "open", text: "During your shifts, how does [name] get around the home and community?" },
          { type: "open", text: "Are there environments or distances that become harder over a shift — stairs, uneven ground, fatigue?" },
          { type: "open", text: "Any near-falls, falls, or stumbles you've witnessed?" },
        ],
      },
      {
        id: "personal_adls",
        name: "Personal ADLs",
        questions: [
          { type: "checklist_single", text: "Typical support level for showering / bathing", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Typical support level for dressing", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Typical support level for toileting", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Continence status — day", options: [...CONTINENCE_OPTIONS] },
          { type: "checklist_single", text: "Continence status — night", options: [...CONTINENCE_OPTIONS] },
          { type: "open", text: "Walk me through [name]'s typical morning routine during your shifts. Where do you step in?" },
          { type: "open", text: "Any accidents, hygiene concerns, or dignity issues you manage?" },
          { type: "open", text: "How do they manage eating — utensils, modified texture, initiation, pace?" },
        ],
      },
      {
        id: "domestic_iadls",
        name: "Domestic IADLs",
        questions: [
          { type: "checklist_multi", text: "Domestic tasks you currently support during shifts", options: ["Meal preparation", "Cleaning / tidying", "Laundry", "Shopping", "Grocery planning", "Rubbish / recycling"], allowOther: true },
          { type: "checklist_single", text: "Level of initiation in domestic tasks", options: ["Independently initiates", "Initiates with verbal prompt", "Requires step-by-step prompting", "Task must be set up and guided throughout", "Cannot participate"] },
          { type: "open", text: "What domestic tasks does [name] do during your shifts, and where do you take over?" },
          { type: "open", text: "Are there safety issues with kitchen tasks (hot surfaces, sharps) that require direct supervision?" },
        ],
      },
      {
        id: "executive_iadls",
        name: "Executive IADLs",
        questions: [
          { type: "checklist_single", text: "Medication management", options: ["Self-administers independently", "Self-administers with verbal prompt", "Support worker prompts + supervises", "Support worker administers", "Managed by family / clinical team"] },
          { type: "checklist_single", text: "Money management", options: ["Independent", "Manages small purchases only", "Requires support for all transactions", "Fully managed by others"] },
          { type: "checklist_single", text: "Transport", options: ["Independent public transport", "Public transport with support", "Support worker transport only", "Family transport only", "Rarely leaves home"] },
          { type: "open", text: "How do you support [name] with medications during your shifts?" },
          { type: "open", text: "Any concerns about community access or transport dependence?" },
        ],
      },
      {
        id: "cognition_learning",
        name: "Cognition & Learning",
        questions: [
          { type: "checklist_single", text: "Following multi-step instructions", options: ["Follows independently", "Follows after one repetition", "Needs step-by-step breakdown", "Cannot follow even simple multi-step instructions"] },
          { type: "checklist_single", text: "Task initiation", options: ["Initiates independently", "Initiates with verbal prompt", "Requires hands-on set-up", "Does not initiate"] },
          { type: "open", text: "Do they remember conversations, appointments, or routines between shifts? How much prompting do you provide?" },
          { type: "open", text: "Have you noticed difficulties with problem-solving or decision-making?" },
          { type: "open", text: "Are they able to start and finish tasks independently, or do you support both ends?" },
        ],
      },
      {
        id: "communication",
        name: "Communication",
        questions: [
          { type: "checklist_multi", text: "Primary communication methods", options: [...COMMS_METHOD_OPTIONS], allowOther: true },
          { type: "open", text: "How does [name] express their needs to you — immediate needs vs. more abstract ones?" },
          { type: "open", text: "Do they understand your instructions first time, or need them repeated, rephrased, or shown?" },
          { type: "open", text: "Any situations where communication breaks down — fatigue, stress, unfamiliar people?" },
        ],
      },
      {
        id: "social_functioning",
        name: "Social Functioning",
        questions: [
          { type: "checklist_single", text: "Community participation during your shifts", options: ["Independent in community", "Community access with 1:1 support", "Community access with 2:1 support", "Home-based only by preference", "Home-based only by necessity"] },
          { type: "open", text: "How does [name] interact with you, other support workers, and people in the community?" },
          { type: "open", text: "Do they manage boundaries, conflict, and personal space appropriately?" },
          { type: "open", text: "Any social difficulties — withdrawal, over-familiarity, aggression, misreading cues?" },
        ],
      },
      {
        id: "behaviour_emotional",
        name: "Behaviour & Emotional Regulation",
        questions: [
          { type: "checklist_multi", text: "Behaviours of concern observed during your shifts", options: ["None", "Self-injurious behaviour", "Physical aggression toward others", "Verbal aggression", "Property damage", "Absconding / wandering", "Refusing supports", "Shutdown / withdrawal"], allowOther: true },
          { type: "checklist_single", text: "Frequency of behaviours of concern", options: [...FREQUENCY_OPTIONS] },
          { type: "open", text: "What tends to trigger dysregulation or meltdowns during your shifts?" },
          { type: "open", text: "What strategies have you found genuinely work to help them regulate?" },
          { type: "open", text: "Is there a formal PBS or behaviour support plan you follow? How effective is it?" },
        ],
      },
      {
        id: "sensory_processing",
        name: "Sensory Processing",
        questions: [
          { type: "open", text: "Are there sounds, lights, textures, smells, or crowds that bother [name] or help them feel regulated?" },
          { type: "open", text: "Do they seek or avoid particular sensory input?" },
          { type: "open", text: "How do you adapt the environment during your shifts to support them?" },
        ],
      },
      {
        id: "risk_safety",
        name: "Risk & Safety",
        questions: [
          { type: "checklist_single", text: "Can [name] be safely left alone?", options: ["Yes, any duration", "Yes, for short periods (<1 hr)", "Yes, with check-ins", "No, requires continuous supervision"] },
          { type: "checklist_multi", text: "Safety risks you manage during your shifts", options: ["Falls", "Wandering / absconding", "Kitchen / fire safety", "Medication errors", "Self-harm", "Aggression toward others", "Vulnerability to strangers / exploitation", "Road / traffic safety", "Swallowing / choking"], allowOther: true },
          { type: "checklist_single", text: "Critical incidents in the past 12 months (to your knowledge)", options: ["None", "1", "2-3", "4-5", "6+"] },
          { type: "open", text: "Describe the most significant safety incident you've witnessed or responded to." },
          { type: "open", text: "What routines or precautions do you always follow during your shifts?" },
        ],
      },
      {
        id: "health_wellbeing",
        name: "Health & Wellbeing",
        questions: [
          { type: "checklist_single", text: "Sleep pattern", options: ["Settled and consistent", "Occasional disruption", "Frequent night waking", "Severely disrupted — major daytime impact"] },
          { type: "open", text: "How is [name]'s general health — any chronic conditions, pain, fatigue you manage?" },
          { type: "open", text: "Any health changes over the time you've worked with them?" },
        ],
      },
      {
        id: "strengths_interests",
        name: "Strengths & Interests",
        questions: [
          { type: "open", text: "What is [name] genuinely good at, and what do they enjoy?" },
          { type: "open", text: "When are they at their best — most regulated, most engaged, most independent?" },
          { type: "open", text: "What do people often underestimate about them?" },
        ],
      },
      {
        id: "current_supports_gaps",
        name: "Current Supports — What I Deliver",
        primary: true,
        questions: [
          { type: "checklist_single", text: "How many hours per week do you currently work with [name]?", options: ["Less than 5", "5-10", "11-20", "21-40", "40+"] },
          { type: "checklist_single", text: "Your assessment of current support adequacy during your shifts", options: ["Adequate — able to meet their needs", "Stretched but manageable", "Insufficient — unmet needs during shifts", "Inadequate — safety concerns when support ends"] },
          { type: "open", text: "Walk me through what you typically do during a shift with [name]. What does your role cover?" },
          { type: "open", text: "What are you seeing work really well for them right now?" },
          { type: "open", text: "Where are you seeing unmet needs during your shifts?" },
          { type: "open", text: "What happens when supports are reduced, cancelled, or a worker doesn't turn up?" },
        ],
      },
      {
        id: "goals_aspirations",
        name: "Goals & Aspirations",
        questions: [
          { type: "open", text: "What does [name] talk about wanting to do, achieve, or learn?" },
          { type: "open", text: "What do you think would make the biggest positive difference in their life right now?" },
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
        id: "mobility_transfers",
        name: "Mobility & Transfers",
        questions: [
          { type: "checklist_multi", text: "Mobility aids used at home or in community", options: [...MOBILITY_AIDS_OPTIONS], allowOther: true },
          { type: "checklist_single", text: "Home access — stairs", options: ["No stairs / not relevant", "Manages stairs independently", "Needs supervision on stairs", "Needs physical assistance on stairs", "Cannot use stairs"] },
          { type: "open", text: "How does [name] get around at home? Any specific areas that are hard (bathroom, bed transfers)?" },
          { type: "open", text: "Can they manage community mobility — footpaths, shops, crowds, distances?" },
          { type: "open", text: "Any falls, near-falls, or fatigue issues you've noticed?" },
        ],
      },
      {
        id: "personal_adls",
        name: "Personal ADLs",
        questions: [
          { type: "checklist_single", text: "Typical support level for showering at home", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Typical support level for dressing at home", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Typical support level for toileting at home", options: [...SUPPORT_LEVEL_OPTIONS] },
          { type: "checklist_single", text: "Continence — day", options: [...CONTINENCE_OPTIONS] },
          { type: "checklist_single", text: "Continence — night", options: [...CONTINENCE_OPTIONS] },
          { type: "checklist_single", text: "Roughly how much time per day do you spend on personal-care support?", options: ["Less than 30 min", "30-60 min", "1-2 hours", "2-4 hours", "4+ hours"] },
          { type: "open", text: "Walk me through [name]'s typical morning at home. Where do you step in?" },
          { type: "open", text: "Any continence, hygiene, or dignity concerns you're managing?" },
          { type: "open", text: "How do they manage eating — utensils, food choices, mealtime behaviour, independence?" },
        ],
      },
      {
        id: "domestic_iadls",
        name: "Domestic IADLs",
        questions: [
          { type: "checklist_multi", text: "Domestic tasks you do entirely for [name]", options: ["Meal preparation", "Cleaning", "Laundry", "Shopping", "Bed-making", "Dishes"], allowOther: true },
          { type: "checklist_single", text: "Can [name] be left alone at home?", options: ["Yes, any duration", "Yes, for a few hours", "Yes, for short periods only", "No, never"] },
          { type: "open", text: "Can [name] help with household tasks at all? What do they initiate vs. need prompting for?" },
          { type: "open", text: "What precautions do you take if you step out briefly?" },
        ],
      },
      {
        id: "executive_iadls",
        name: "Executive IADLs",
        questions: [
          { type: "checklist_single", text: "Medication management at home", options: ["Self-administers independently", "Self-administers with prompt", "Parent / carer supervises", "Parent / carer administers"] },
          { type: "checklist_single", text: "Money management", options: ["Independent", "Small purchases only", "Needs support for all", "Fully managed by family"] },
          { type: "checklist_single", text: "Transport", options: ["Drives or public transport independently", "Public transport with support", "Family transport only", "Rarely leaves home"] },
          { type: "open", text: "How much of [name]'s day-to-day admin (appointments, bills, scheduling) do you manage?" },
          { type: "open", text: "Are they able to use phones, computers, and everyday technology?" },
        ],
      },
      {
        id: "cognition_learning",
        name: "Cognition & Learning",
        questions: [
          { type: "checklist_single", text: "Memory for conversations, appointments, plans", options: ["Reliable", "Occasional lapses", "Frequently forgets", "No functional memory — requires constant reminding"] },
          { type: "checklist_single", text: "Decision-making about everyday things", options: ["Makes own decisions", "Makes decisions with some input", "Needs guided decision-making", "Cannot make everyday decisions"] },
          { type: "open", text: "Can they make decisions and solve everyday problems, or do you step in?" },
          { type: "open", text: "Have you noticed changes over time — gains or declines?" },
          { type: "open", text: "Do they understand risk and consequences?" },
        ],
      },
      {
        id: "communication",
        name: "Communication",
        questions: [
          { type: "checklist_multi", text: "Primary communication methods at home", options: [...COMMS_METHOD_OPTIONS], allowOther: true },
          { type: "open", text: "How does [name] express their needs, preferences, or distress at home?" },
          { type: "open", text: "Do they understand normal conversation, or do things need to be simplified?" },
          { type: "open", text: "Are there situations where communication becomes much harder?" },
        ],
      },
      {
        id: "social_functioning",
        name: "Social Functioning",
        questions: [
          { type: "checklist_single", text: "Social connections outside the family", options: ["Has regular friends / relationships", "Some acquaintances, limited contact", "No friends outside family", "Isolated — concerning"] },
          { type: "checklist_multi", text: "Concerns (tick any that apply)", options: ["Boundaries with strangers", "Exploitation risk", "Social withdrawal", "Over-dependence on parent", "Conflict with peers", "None of these"] },
          { type: "open", text: "How do they go in family gatherings, neighbourhood, community?" },
          { type: "open", text: "Do they seek social contact or prefer to be alone? Any concerns?" },
          { type: "open", text: "Have their social connections changed over time?" },
        ],
      },
      {
        id: "behaviour_emotional",
        name: "Behaviour & Emotional Regulation",
        questions: [
          { type: "checklist_multi", text: "Behaviours of concern at home (past 6 months)", options: ["None", "Self-injurious behaviour", "Aggression toward family", "Aggression toward others outside family", "Property damage", "Absconding", "Self-neglect", "Refusing medication / care", "Shutdown / extended withdrawal"], allowOther: true },
          { type: "checklist_single", text: "Frequency of behaviours of concern", options: [...FREQUENCY_OPTIONS] },
          { type: "open", text: "What tends to trigger distress, anger, or meltdowns at home?" },
          { type: "open", text: "What helps calm or regulate them? What makes it worse?" },
          { type: "open", text: "How has their behaviour changed over time — especially in the last 12 months?" },
          { type: "open", text: "Any incidents of self-harm, aggression, property damage, police involvement, or hospitalisation?" },
        ],
      },
      {
        id: "sensory_processing",
        name: "Sensory Processing",
        questions: [
          { type: "open", text: "Are there things at home or in public that bother them — noise, touch, crowds, fluorescent lights, food, clothing?" },
          { type: "open", text: "Do they seek particular sensations (rocking, pressure, spinning, particular foods)?" },
          { type: "open", text: "How have you adapted home or routines to manage this?" },
        ],
      },
      {
        id: "risk_safety",
        name: "Risk & Safety",
        questions: [
          { type: "checklist_single", text: "Can [name] be left alone at home during the day?", options: ["Yes, any duration", "Yes, a few hours", "Yes, short periods only (<1 hr)", "No, never"] },
          { type: "checklist_single", text: "Can [name] be left alone overnight?", options: ["Yes", "Only if someone is checking in", "No, requires overnight support"] },
          { type: "checklist_multi", text: "Safety concerns in the last 12 months", options: ["Falls", "Wandering / absconding", "Hospitalisation", "Self-harm", "Aggression requiring intervention", "Police involvement", "Fire / kitchen incident", "Traffic / road incident", "Exploitation or concerning contact with strangers"], allowOther: true },
          { type: "open", text: "What are you most worried about in terms of [name]'s safety?" },
          { type: "open", text: "Describe the most significant safety incident in the last 12 months." },
          { type: "open", text: "Any risks at night, during transitions, or in unfamiliar environments?" },
        ],
      },
      {
        id: "health_wellbeing",
        name: "Health & Wellbeing",
        questions: [
          { type: "checklist_single", text: "Sleep pattern", options: ["Settled", "Occasional disruption", "Frequent waking", "Severely disrupted"] },
          { type: "checklist_single", text: "Current medical specialists involved", options: ["None", "1", "2-3", "4+"] },
          { type: "open", text: "Any current conditions, medications, or specialists involved?" },
          { type: "open", text: "How do they cope with medical appointments, tests, procedures?" },
          { type: "open", text: "Any changes in weight, appetite, hygiene, or mood that concern you?" },
        ],
      },
      {
        id: "strengths_interests",
        name: "Strengths & Interests",
        questions: [
          { type: "open", text: "What is [name] really good at? What do they enjoy?" },
          { type: "open", text: "When do you see them at their best?" },
          { type: "open", text: "What helps them be more independent, more settled, or more engaged?" },
          { type: "open", text: "What would you want the assessor to know about them beyond their difficulties?" },
        ],
      },
      {
        id: "current_supports_gaps",
        name: "Current Supports",
        questions: [
          { type: "checklist_multi", text: "Formal supports currently used", options: ["Support workers / disability support", "Therapy (OT / SLP / PT / psych / BS)", "Respite", "School / educational support", "Community programs", "Allied health", "Specialist medical", "None"], allowOther: true },
          { type: "checklist_single", text: "Your assessment of current support adequacy", options: ["Meets our family's needs", "Stretched but manageable", "Insufficient — significant gaps", "Inadequate — family at breaking point"] },
          { type: "open", text: "Which current supports are genuinely working?" },
          { type: "open", text: "What's missing? Where do you feel left to manage on your own?" },
          { type: "open", text: "What happens when supports aren't available — weekends, holidays, staff turnover?" },
        ],
      },
      {
        id: "carer_sustainability",
        name: "Carer Sustainability",
        primary: true,
        questions: [
          { type: "checklist_single", text: "How many hours per day do you spend providing direct care or supervision?", options: ["<1 hr", "1-2 hrs", "3-4 hrs", "5-8 hrs", "8-12 hrs", "12+ hrs / around the clock"] },
          { type: "checklist_multi", text: "Carer burden factors (tick any that apply)", options: ["My own physical health affected", "My own mental health affected", "Had to reduce / leave paid work", "Sleep chronically disrupted", "Social isolation", "Financial stress", "Strain on relationships", "No backup support available", "No respite currently"] },
          { type: "checklist_single", text: "Current respite situation", options: ["Adequate respite in place", "Some respite, not enough", "Minimal respite", "No respite at all"] },
          { type: "open", text: "How are you managing with the current level of care? Please be honest — this matters for the assessment." },
          { type: "open", text: "Do you have your own health issues, work, or other caring responsibilities that affect your capacity?" },
          { type: "open", text: "Who else helps? What would happen if you were sick, in hospital, or unable to care for a period?" },
          { type: "open", text: "What would you need to keep this sustainable over the next 1-2 years?" },
        ],
      },
      {
        id: "goals_aspirations",
        name: "Goals & Aspirations",
        questions: [
          { type: "open", text: "What are your goals for [name] over the next 1-2 years?" },
          { type: "open", text: "What does [name] say they want — if anything?" },
          { type: "open", text: "What do you think would make the biggest difference for your family?" },
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
    rolePlaceholder: "e.g. Year 5 teacher — since Feb 2025",
    version: 2,
    domains: [
      {
        id: "mobility_transfers",
        name: "Mobility & Transfers",
        questions: [
          { type: "checklist_single", text: "Mobility around school", options: ["Fully independent", "Supervision in some environments (PE, stairs, excursions)", "1:1 support required for mobility", "Wheelchair / equipment user"] },
          { type: "open", text: "How does [name] get around the school — classroom, playground, stairs, bus lines?" },
          { type: "open", text: "Are there environments that are difficult — PE, excursions, crowded corridors?" },
          { type: "open", text: "Any falls, fatigue during the day, or concerns you've observed?" },
        ],
      },
      {
        id: "personal_adls",
        name: "Personal ADLs (School Context)",
        questions: [
          { type: "checklist_single", text: "Toileting independence at school", options: ["Independent", "Prompting only", "Supervision", "Hands-on support", "Not yet toilet-trained / requires toileting program"] },
          { type: "open", text: "Can [name] manage toileting, eating, and basic grooming independently at school?" },
          { type: "open", text: "Do they need help with uniform, shoes, bags, lunch boxes?" },
          { type: "open", text: "Any hygiene concerns that affect their day?" },
        ],
      },
      {
        id: "cognition_learning",
        name: "Cognition & Learning",
        primary: true,
        questions: [
          { type: "checklist_single", text: "Academic performance vs. year-level expectations", options: ["At or above year level", "Slightly below year level", "Significantly below year level (1-2 years)", "Well below year level (3+ years)", "Individualised curriculum / functional programming"] },
          { type: "checklist_single", text: "Following classroom instructions", options: ["Follows group instructions independently", "Follows group instructions with repetition", "Requires 1:1 delivery of instructions", "Cannot follow classroom instructions even 1:1"] },
          { type: "checklist_multi", text: "Formal accommodations in place", options: ["IEP / ILP", "Teacher aide", "Adjusted curriculum", "Sensory adjustments", "Assessment accommodations", "AAC / communication supports", "Behaviour support plan", "None"], allowOther: true },
          { type: "open", text: "How is [name] performing academically? Specific areas of strength and difficulty?" },
          { type: "open", text: "What are their learning strengths, and which areas are hardest?" },
          { type: "open", text: "How do they handle unstructured problem-solving vs. structured tasks?" },
          { type: "open", text: "How effective are the current accommodations?" },
          { type: "open", text: "Any formal assessments, diagnostic reports, or IEP/ILP goals you can share?" },
        ],
      },
      {
        id: "communication",
        name: "Communication",
        questions: [
          { type: "checklist_multi", text: "Primary communication methods at school", options: ["Verbal", "Written", "Gesture", "AAC device", "PECS", "Sign", "Behaviour"], allowOther: true },
          { type: "checklist_single", text: "Asking for help when stuck", options: ["Asks appropriately", "Asks after prompting", "Rarely asks — shuts down or gives up", "Never asks — requires adult initiation"] },
          { type: "open", text: "How does [name] communicate in the classroom?" },
          { type: "open", text: "Do they understand group instructions, or need 1:1 delivery?" },
          { type: "open", text: "Any difficulties with reading, writing, or comprehension beyond year-level expectations?" },
        ],
      },
      {
        id: "social_functioning",
        name: "Social Functioning",
        questions: [
          { type: "checklist_single", text: "Peer relationships", options: ["Has a stable friendship group", "Has 1-2 friends", "On the edge of peer groups", "Isolated from peers"] },
          { type: "checklist_multi", text: "Social concerns observed", options: ["Being bullied", "Bullying others", "Exclusion by peers", "Difficulty reading social cues", "Inappropriate physical contact", "Boundary issues", "None of these"] },
          { type: "open", text: "How does [name] go with peers during class, breaks, and group activities?" },
          { type: "open", text: "How do they manage group work, turn-taking, sharing?" },
        ],
      },
      {
        id: "behaviour_emotional",
        name: "Behaviour & Emotional Regulation",
        questions: [
          { type: "checklist_multi", text: "Classroom behaviours observed", options: ["Withdrawal / shutdown", "Disruption", "Aggression toward peers", "Aggression toward staff", "Property damage", "Absconding from classroom / school", "Self-injury", "None of these"] },
          { type: "checklist_single", text: "Behaviour incidents in past 6 months", options: ["None", "1-2", "3-5", "6-10", "More than 10"] },
          { type: "open", text: "What dysregulates [name] in the classroom — noise, transitions, unstructured time, academic demands, peer conflict?" },
          { type: "open", text: "What strategies have worked to help them regulate?" },
          { type: "open", text: "Any suspensions, safety plans, or formal behaviour management?" },
        ],
      },
      {
        id: "sensory_processing",
        name: "Sensory Processing",
        questions: [
          { type: "open", text: "Are there sensory aspects of the school environment that affect them — assembly, bells, fluorescent lights, uniforms, lunch hall?" },
          { type: "open", text: "What sensory strategies or environmental adjustments have helped?" },
        ],
      },
      {
        id: "risk_safety",
        name: "Risk & Safety",
        questions: [
          { type: "checklist_single", text: "Supervision needs at school", options: ["Group supervision adequate", "Increased supervision in unstructured time", "Requires 1:1 supervision in some contexts", "Requires full-time 1:1 supervision"] },
          { type: "open", text: "Any safety concerns at school — wandering, risk-taking, playground incidents, safety awareness?" },
          { type: "open", text: "Any emergency responses, injuries, or incidents requiring intervention?" },
        ],
      },
      {
        id: "strengths_interests",
        name: "Strengths & Interests",
        questions: [
          { type: "open", text: "What is [name] really good at — academically, socially, creatively, physically?" },
          { type: "open", text: "What subjects, activities, or moments bring out their best?" },
          { type: "open", text: "What do you wish other people understood about them?" },
        ],
      },
      {
        id: "current_supports_gaps",
        name: "School-Based Supports",
        questions: [
          { type: "checklist_single", text: "Aide / specialist support hours", options: ["None", "Part-time", "Full-time", "Shared across class", "Not sure"] },
          { type: "open", text: "What school-based supports does [name] currently receive?" },
          { type: "open", text: "Is that support sufficient? Where are the gaps?" },
          { type: "open", text: "What additional support, equipment, or adjustments would make the biggest difference?" },
        ],
      },
      {
        id: "goals_aspirations",
        name: "Goals & Aspirations",
        questions: [
          { type: "open", text: "What are your learning and participation goals for [name] this year?" },
          { type: "open", text: "What do you see as their biggest obstacle right now?" },
          { type: "open", text: "What outcomes do you hope this assessment helps unlock?" },
        ],
      },
    ],
  },

  allied_health_v2: {
    id: "allied_health_v2",
    name: "Allied Health Professional",
    icon: "AH",
    color: "#ea580c",
    description: "Clinical specialist (OT, SLP, PT, psych, behaviour support, dietitian, etc.) — clinical interpretation, intervention outcomes, and recommendations",
    rolePlaceholder: "e.g. Occupational Therapist — weekly since Jan 2024",
    version: 2,
    domains: [
      {
        id: "role_involvement",
        name: "Role & Involvement",
        questions: [
          { type: "checklist_single", text: "Frequency of contact", options: ["Weekly or more", "Fortnightly", "Monthly", "Less than monthly", "Episodic / consultative"] },
          { type: "checklist_multi", text: "Setting of involvement", options: ["Clinic / rooms", "Home visits", "School visits", "Community", "Telehealth", "Inpatient / hospital"] },
          { type: "open", text: "What is your discipline and role? How long have you worked with [name]?" },
          { type: "open", text: "What was the focus of your involvement when it began? Has that changed over time?" },
        ],
      },
      {
        id: "mobility_transfers",
        name: "Mobility & Transfers",
        questions: [
          { type: "open", text: "What are your clinical observations of [name]'s mobility, transfers, and upper-limb function?" },
          { type: "open", text: "Are they using equipment or mobility aids — prescribed by whom, and used consistently / correctly?" },
          { type: "open", text: "Any red flags around falls, pain, deconditioning, or change in function?" },
        ],
      },
      {
        id: "personal_adls",
        name: "Personal ADLs",
        questions: [
          { type: "checklist_single", text: "Clinical assessment of overall personal care function", options: ["Independent", "Mild support needs", "Moderate support needs", "High support needs", "Fully dependent"] },
          { type: "open", text: "What self-care areas have you assessed or worked on with [name]?" },
          { type: "open", text: "What level of function have you observed for showering, dressing, toileting, feeding?" },
          { type: "open", text: "Has this changed over the time you've known them?" },
        ],
      },
      {
        id: "domestic_iadls",
        name: "Domestic IADLs",
        questions: [
          { type: "open", text: "From your assessment, what level of competence does [name] demonstrate in domestic tasks?" },
          { type: "open", text: "Are there specific barriers to independence you've identified?" },
        ],
      },
      {
        id: "executive_iadls",
        name: "Executive IADLs",
        questions: [
          { type: "open", text: "How does [name] manage higher-order tasks — medication, money, appointments, transport, technology?" },
          { type: "open", text: "What executive function challenges have you observed or formally assessed?" },
        ],
      },
      {
        id: "cognition_learning",
        name: "Cognition & Learning",
        questions: [
          { type: "checklist_multi", text: "Formal cognitive or developmental assessments you have conducted or are aware of", options: ["WAIS / WISC", "Vineland", "ACE / ACE-III", "MoCA / MMSE", "Developmental screen (ASQ, Bayley)", "Neuropsych battery", "None"], allowOther: true },
          { type: "open", text: "What cognitive or learning difficulties have you formally assessed or clinically observed?" },
          { type: "open", text: "How do these impact day-to-day function?" },
          { type: "open", text: "Any diagnostic, screening, or assessment results you can share?" },
        ],
      },
      {
        id: "communication",
        name: "Communication",
        questions: [
          { type: "open", text: "How does [name] communicate, and what communication supports are effective?" },
          { type: "open", text: "What are their receptive and expressive strengths and difficulties?" },
          { type: "open", text: "Any language, pragmatic, or literacy difficulties you've assessed?" },
        ],
      },
      {
        id: "social_functioning",
        name: "Social Functioning",
        questions: [
          { type: "open", text: "From a clinical perspective, what social difficulties does [name] present with?" },
          { type: "open", text: "Are there interventions that have helped improve their social functioning?" },
          { type: "open", text: "Any concerns about isolation, exploitation, or relational difficulty?" },
        ],
      },
      {
        id: "behaviour_emotional",
        name: "Behaviour & Emotional Regulation",
        questions: [
          { type: "checklist_single", text: "Behaviour support plan status", options: ["Formal BSP in place", "BSP being developed", "Informal strategies only", "No plan — needed", "No plan — not needed"] },
          { type: "open", text: "What behavioural or emotional regulation difficulties have you been working with?" },
          { type: "open", text: "What antecedents and strategies have been most relevant clinically?" },
          { type: "open", text: "Any restrictive practices in use? Authorised by whom?" },
        ],
      },
      {
        id: "sensory_processing",
        name: "Sensory Processing",
        questions: [
          { type: "open", text: "Have you assessed sensory processing? What profile or pattern have you identified?" },
          { type: "open", text: "What environmental modifications or sensory strategies have been effective?" },
        ],
      },
      {
        id: "risk_safety",
        name: "Risk & Safety",
        questions: [
          { type: "checklist_multi", text: "Clinical risks you have identified or managed", options: ["Self-harm", "Suicidality", "Aggression", "Falls", "Swallowing / aspiration", "Medication misadventure", "Clinical deterioration", "Hospitalisation risk", "Safeguarding concern"], allowOther: true },
          { type: "open", text: "Describe the key clinical risks for this participant." },
          { type: "open", text: "Any critical incidents or escalations in the period you've known them?" },
          { type: "open", text: "Any safeguarding concerns or mandatory reports you've made?" },
        ],
      },
      {
        id: "health_wellbeing",
        name: "Health & Wellbeing",
        questions: [
          { type: "open", text: "Any relevant health, sleep, nutrition, medication, or wellbeing factors from your clinical involvement?" },
          { type: "open", text: "Have you liaised with medical specialists? Any findings relevant to functional capacity?" },
        ],
      },
      {
        id: "strengths_interests",
        name: "Strengths & Interests",
        questions: [
          { type: "open", text: "From your clinical work, what strengths and protective factors does [name] demonstrate?" },
          { type: "open", text: "What has worked in engagement and motivation?" },
        ],
      },
      {
        id: "current_supports_gaps",
        name: "Clinical Recommendations",
        primary: true,
        questions: [
          { type: "checklist_single", text: "Current funded hours for your discipline — adequacy", options: ["Adequate", "Slightly insufficient", "Significantly insufficient", "Severely insufficient", "Over-funded"] },
          { type: "open", text: "What interventions have you been providing, and what has the impact been?" },
          { type: "open", text: "What progress has been made, and what has been hard to shift?" },
          { type: "open", text: "What other disciplines or supports do you think [name] needs?" },
          { type: "open", text: "If your service were to stop tomorrow, what would happen?" },
          { type: "open", text: "What clinical recommendations would you make for this report? (equipment, therapy hours, support ratios, environmental adjustments, specialist referrals)" },
          { type: "open", text: "From your clinical view, what would be reasonable and necessary under the NDIS framework?" },
        ],
      },
      {
        id: "goals_aspirations",
        name: "Goals & Aspirations",
        questions: [
          { type: "open", text: "What functional goals have you been working toward with [name]?" },
          { type: "open", text: "What is a realistic prognosis over the next 1-2 years?" },
          { type: "open", text: "What do you see as the priority outcomes for their NDIS plan?" },
        ],
      },
    ],
  },

  support_coordinator_v2: {
    id: "support_coordinator_v2",
    name: "Support Coordinator",
    icon: "SC",
    color: "#0891b2",
    description: "Systems view, plan oversight, and the primary owner of recommendation candidates for the report",
    rolePlaceholder: "e.g. Support Coordinator — managing plan since Sep 2023",
    version: 2,
    domains: [
      {
        id: "executive_iadls",
        name: "Plan Admin (Brief)",
        questions: [
          { type: "open", text: "From your coordination visits and provider reports, how does [name] manage plan-related admin — appointments, service bookings, provider comms?" },
          { type: "open", text: "Are they involved in plan decisions, or does the family / guardian manage this?" },
        ],
      },
      {
        id: "cognition_learning",
        name: "Cognition (Brief)",
        questions: [
          { type: "open", text: "From provider reports and your visits, what are the main cognitive or learning difficulties affecting engagement with services?" },
          { type: "open", text: "Does [name] understand their plan and what's available to them?" },
        ],
      },
      {
        id: "communication",
        name: "Communication (Brief)",
        questions: [
          { type: "open", text: "How does [name] communicate with you and with providers?" },
          { type: "open", text: "Any communication barriers affecting service access?" },
        ],
      },
      {
        id: "social_functioning",
        name: "Social Engagement (Brief)",
        questions: [
          { type: "open", text: "How engaged is [name] with community, services, and social participation?" },
          { type: "open", text: "Any concerns about isolation, exploitation, or social difficulty affecting service access?" },
        ],
      },
      {
        id: "behaviour_emotional",
        name: "Behaviour & Service Continuity",
        questions: [
          { type: "open", text: "From reports and observations, what behavioural or emotional challenges affect service engagement or continuity?" },
          { type: "open", text: "Any behaviour incidents that have affected service delivery (providers withdrawing, placement at risk, etc.)?" },
        ],
      },
      {
        id: "risk_safety",
        name: "Risk & Safety",
        questions: [
          { type: "checklist_multi", text: "Current risks you are actively managing", options: ["Placement breakdown risk", "Hospitalisation risk", "Crisis / behavioural escalation", "Service disengagement", "Carer burnout / family breakdown", "Safeguarding", "Housing instability", "Financial / plan-utilisation risk"], allowOther: true },
          { type: "checklist_single", text: "Critical incidents managed in past 12 months", options: ["None", "1-2", "3-5", "6+"] },
          { type: "open", text: "What risks are you most concerned about right now?" },
          { type: "open", text: "What usually breaks down first when things aren't going well for [name]?" },
          { type: "open", text: "Any critical incidents you've managed or been aware of during your coordination?" },
        ],
      },
      {
        id: "health_wellbeing",
        name: "Health & Wellbeing (Brief)",
        questions: [
          { type: "open", text: "From your coordination, any health, medication, or appointment management issues affecting functioning?" },
        ],
      },
      {
        id: "current_supports_gaps",
        name: "Current Supports & Recommendations",
        primary: true,
        questions: [
          { type: "checklist_multi", text: "Currently funded and in-use supports", options: ["Core support workers", "Core daily living", "Core community participation", "Capacity building — allied health", "Capacity building — daily activity", "Capacity building — employment", "Capital — AT (assistive technology)", "Capital — home modifications", "SIL / supported independent living", "SDA", "Respite / STA", "Behaviour support", "Therapy (OT / SLP / PT / psych)", "Plan management", "Support coordination"], allowOther: true },
          { type: "checklist_multi", text: "Supports that are funded but NOT being used effectively (flag for this report)", options: ["Core support workers", "Therapy", "Community participation", "Capacity building", "Capital items funded but not purchased", "None"], allowOther: true },
          { type: "checklist_single", text: "Current overall plan adequacy", options: ["Adequate — meeting reasonable and necessary", "Adequate for current functioning but needs will increase", "Under-funded in specific areas (see below)", "Significantly under-funded across multiple areas", "Over-funded in specific areas (see below)"] },
          { type: "checklist_multi", text: "Specific under-funded areas (tick all that apply)", options: ["Support worker hours", "Support ratios (need 2:1 but 1:1 funded)", "Therapy hours", "Behaviour support", "Community access", "Respite", "AT / equipment", "Home modifications", "SIL", "Transport", "Specialist input", "Plan management", "SC hours"], allowOther: true },
          { type: "open", text: "Walk me through the formal supports currently in place. Which are being used consistently and which aren't?" },
          { type: "open", text: "Where are the biggest gaps in the current plan?" },
          { type: "open", text: "Are there supports funded but not realistically accessible (provider shortages, rural, provider fit)?" },
          { type: "open", text: "What specific changes to the plan do you think would make the biggest difference? Be specific: hours, ratios, new categories, equipment." },
          { type: "open", text: "If you could make 3 concrete recommendations to the NDIS planner, what would they be?" },
          { type: "open", text: "Are there any support categories that should be reduced or redirected?" },
          { type: "open", text: "What would adequate look like for this participant over the next 12 months?" },
          { type: "open", text: "Are there recurring conversations with providers this assessment should document?" },
        ],
      },
      {
        id: "goals_aspirations",
        name: "Goals & Engagement",
        questions: [
          { type: "open", text: "What goals has [name] or their family been prioritising?" },
          { type: "open", text: "How engaged are they with supports and plan implementation?" },
          { type: "open", text: "Are there barriers to engagement that this report should document?" },
        ],
      },
      {
        id: "collaboration_history",
        name: "Collaboration & History",
        questions: [
          { type: "open", text: "What have other providers been saying in their reports or team meetings?" },
          { type: "open", text: "Any patterns across the team — stagnation, progress, deterioration?" },
          { type: "open", text: "Any historical events (trauma, crisis, previous reports) the assessor should understand?" },
        ],
      },
    ],
  },
};

/* ─── V1/V2 interop helpers ──────────────────────────────────────────── */

/** Checks whether a template id belongs to the V2 template set. */
export function isV2Template(templateId: string): boolean {
  return templateId in LIAISE_TEMPLATES_V2;
}

/**
 * Decode a stored response value into a display string.
 *
 * V2 multi-select checklists are stored as JSON-encoded arrays (e.g.
 * '["Walking stick","Walker"]'). This helper flattens them to a comma-
 * separated string for display and for injection into the AI prompt.
 * Open questions and single-select checklists pass through unchanged.
 */
export function flattenStoredResponse(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.filter(v => typeof v === "string" && v.trim()).join(", ");
    } catch { /* fall through to raw */ }
  }
  return raw;
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
  employer: {
    id: "employer", name: "Employer / Workplace", icon: "EM", color: "#d97706",
    description: "Workplace functioning, accommodations, and vocational capacity",
    domains: [
      { id: "role_tasks", name: "Role & Tasks", questions: ["What is their current role and what tasks does it involve?","How many hours do they work and what is the schedule?","What tasks can they complete independently?"] },
      { id: "workplace_function", name: "Workplace Functioning", questions: ["How do they manage the physical demands of the role?","Can they follow multi-step instructions and manage task sequences?","How do they manage time, prioritisation, and deadlines?","Are there attendance or punctuality issues?"] },
      { id: "social_workplace", name: "Social & Interpersonal", questions: ["How do they get along with colleagues and supervisors?","Are there any interpersonal difficulties or communication issues?","Can they manage feedback and direction appropriately?"] },
      { id: "accommodations", name: "Accommodations & Support", questions: ["What accommodations or modifications are currently in place?","Do they have a support worker or job coach present?","What additional support would help them sustain employment?"] },
      { id: "strengths_concerns", name: "Strengths & Concerns", questions: ["What are their workplace strengths?","What concerns you most about their ability to maintain this role?","Is the current arrangement sustainable long-term?"] },
    ],
  },
  participant_self: {
    id: "participant_self", name: "Participant (Self-Report)", icon: "PR", color: "#6366f1",
    description: "The participant's own perspective on their daily life, goals, and support needs",
    domains: [
      { id: "daily_life", name: "Daily Life", questions: ["What does a normal day look like for you?","What things can you do on your own?","What do you need help with?","Is there anything you used to be able to do that's become harder?"] },
      { id: "goals_wishes", name: "Goals & Wishes", questions: ["What do you want to be able to do that you can't do right now?","What are your goals for the next 12 months?","What would make the biggest difference in your life right now?"] },
      { id: "supports_experience", name: "Experience with Supports", questions: ["What supports are working well for you?","Is there anything you wish was different about your current supports?","Do you feel like you have enough help?","Are there times you feel unsafe or unsupported?"] },
      { id: "social_wellbeing", name: "Social & Wellbeing", questions: ["Do you see friends or family regularly?","Do you get out into the community as much as you'd like?","How are you feeling generally — mood, energy, motivation?","Is there anything worrying you at the moment?"] },
      { id: "strengths_interests", name: "Strengths & Interests", questions: ["What are you good at?","What do you enjoy doing?","When do you feel happiest or most confident?"] },
    ],
  },
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
  // Parse the JSON-encoded array (or treat as empty).
  const parsed: string[] = useMemo(() => {
    if (!value) return [];
    const trimmed = value.trim();
    if (!trimmed.startsWith("[")) return [];
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }, [value]);

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

/* ─── Interview Card ─── */
function InterviewCard({
  interview,
  onUpdate,
  onRemove,
  onDuplicate,
}: {
  interview: CollateralInterview;
  onUpdate: (iv: CollateralInterview) => void;
  onRemove: () => void;
  onDuplicate: () => void;
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
    const key = `${domainId}_${questionIdx}`;
    onUpdate({ ...interview, responses: { ...interview.responses, [key]: value } });
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

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const val of Object.values(interview.responses)) {
      if (val && val.trim()) count++;
    }
    for (const domainCustoms of Object.values(interview.customQuestions)) {
      for (const cq of domainCustoms) {
        if (cq.response && cq.response.trim()) count++;
      }
    }
    return count;
  }, [interview.responses, interview.customQuestions]);

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
            <div className="flex gap-1.5">
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
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Method</label>
              <div className="flex gap-1">
                {INTERVIEW_METHODS.map((m) => {
                  const active = interview.method === m.id;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onUpdate({ ...interview, method: m.id })}
                      title={m.label}
                      className={cn(
                        "p-1.5 rounded border transition-colors",
                        active
                          ? "border-accent bg-accent/10"
                          : "border-border/50 bg-background hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: active ? template.color : undefined }} />
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
            const key = `${domain.id}_${qi}`;
            return interview.responses[key] && interview.responses[key].trim();
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
                    const key = `${domain.id}_${qi}`;
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
                        <button onClick={() => removeCustomQ(domain.id, ci)} className="text-muted-foreground hover:text-destructive px-1">
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save to Supabase
  const saveInterview = useCallback(async (iv: CollateralInterview) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("collateral_interviews")
      .upsert({
        id: iv.id,
        report_id: reportId,
        user_id: user.id,
        template_id: iv.templateId,
        interviewee_name: iv.intervieweeName,
        interviewee_role: iv.intervieweeRole,
        interview_date: iv.date || null,
        interview_method: iv.method,
        responses: iv.responses as any,
        custom_questions: iv.customQuestions as any,
        general_notes: iv.generalNotes,
        updated_at: new Date().toISOString(),
      } as any);
    if (error) console.error("Save interview error:", error);
  }, [reportId, user?.id]);

  const debouncedSave = useCallback((iv: CollateralInterview) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveInterview(iv), 500);
  }, [saveInterview]);

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

    // Insert into Supabase
    const { error } = await supabase.from("collateral_interviews").insert({
      id: newId,
      report_id: reportId,
      user_id: user.id,
      template_id: templateId,
    } as any);
    if (error) {
      console.error("Insert interview error:", error);
      toast.error("Failed to create interview");
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

    const { error } = await supabase.from("collateral_interviews").delete().eq("id", iv.id);
    if (error) console.error("Delete interview error:", error);
    else toast.success("Interview removed");
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

    if (user?.id) {
      await supabase.from("collateral_interviews").insert({
        id: newId,
        report_id: reportId,
        user_id: user.id,
        template_id: dup.templateId,
      } as any);
    }
  };

  const totalResponses = useMemo(() => {
    let count = 0;
    for (const iv of interviews) {
      for (const val of Object.values(iv.responses)) {
        if (val && val.trim()) count++;
      }
      for (const domainCustoms of Object.values(iv.customQuestions)) {
        for (const cq of domainCustoms) {
          if (cq.response && cq.response.trim()) count++;
        }
      }
    }
    return count;
  }, [interviews]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const iv of interviews) {
      // Look up template in both V2 and V1 sets so the summary counts
      // existing V1 interviews alongside new V2 interviews.
      const t = LIAISE_TEMPLATES_V2[iv.templateId] ?? TEMPLATES[iv.templateId];
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
          onUpdate={(updated) => updateInterview(idx, updated)}
          onRemove={() => removeInterview(idx)}
          onDuplicate={() => duplicateInterview(idx)}
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
                const template = LIAISE_TEMPLATES_V2[iv.templateId] ?? TEMPLATES[iv.templateId];
                if (!template) return null;
                const responseCount = Object.values(iv.responses).filter((v) => v && v.trim()).length;
                const customCount = Object.values(iv.customQuestions)
                  .flat()
                  .filter((cq) => cq.response && cq.response.trim()).length;
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
                    <TableCell className="text-center text-[11px] font-mono font-semibold" style={{ color: responseCount + customCount > 0 ? template.color : undefined }}>
                      {responseCount + customCount}
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
