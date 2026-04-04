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
import { Handshake, Plus, Copy, Trash2, ChevronDown, ChevronRight, CheckCircle2, Phone, Home, Mail, Monitor, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Template definitions ─── */
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
  const template = TEMPLATES[interview.templateId];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

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
                placeholder="e.g. Daily support worker — 2 years"
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
          const domainAnswered = domain.questions.filter((_, qi) => {
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
                  {domain.questions.map((question, qi) => {
                    const key = `${domain.id}_${qi}`;
                    return (
                      <div
                        key={qi}
                        className={cn("px-4 py-2.5 border-b border-border/10", qi % 2 === 0 ? "bg-background" : "bg-muted/10")}
                      >
                        <div className="text-xs text-foreground font-medium mb-1.5 leading-relaxed">
                          <span className="font-mono text-[10px] text-muted-foreground mr-1.5">Q{qi + 1}</span>
                          {question}
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
      const t = TEMPLATES[iv.templateId];
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

      {/* Template selector dialog */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Stakeholder Template</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Choose a template to start a new collateral interview. You can add multiple interviews of the same type.
          </p>
          <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
            {Object.values(TEMPLATES).map((template) => (
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
                  {template.domains.length} sections · {template.domains.reduce((s, d) => s + d.questions.length, 0)} questions
                </div>
              </button>
            ))}
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
                const template = TEMPLATES[iv.templateId];
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

export { TEMPLATES as LIAISE_TEMPLATES };
