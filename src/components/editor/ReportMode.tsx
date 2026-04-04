import { useState, useRef, useEffect, useCallback } from "react";
import { type CollateralInterview, LIAISE_TEMPLATES } from "./LiaiseMode";
import { buildMethodologyText } from "./MethodologyAggregator";
import { PARTICIPANT_KEYS, CLINICIAN_KEYS } from "./ParticipantReportDetails";
import { cn } from "@/lib/utils";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { FileText, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DownloadReportButton from "@/components/DownloadReportButton";
import type { ReportData } from "@/ai/reportAssembler";
import { type AssessmentInstance, getScoreForOption } from "@/lib/assessment-library";
import { type DiagnosisInstance } from "@/lib/diagnosis-library";
import { type GoalInstance } from "./ParticipantGoals";
import { type RecommendationInstance, OUTCOME_OPTIONS } from "@/lib/recommendations-library";
import { QualityScorecard, QualitySummaryBar, type Scorecard, type IssueStatus, type QualityIssue } from "./QualityScorecard";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
/* ─── Editable cell component ─── */
function EditableCell({ value, onChange, style, redText }: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  redText?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [editing]);

  if (editing) {
    return (
      <td style={{ ...style, padding: "4px 8px" }}>
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={() => { onChange(draft); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className="w-full text-sm bg-transparent border border-border/50 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-accent/50"
          style={{ color: redText ? "#991b1b" : undefined }}
        />
      </td>
    );
  }

  return (
    <td
      onClick={() => setEditing(true)}
      style={{
        ...style,
        cursor: "pointer",
        color: redText ? "#991b1b" : style?.color,
      }}
      className="hover:bg-muted/40 transition-colors"
      title="Click to edit"
    >
      {value || "—"}
    </td>
  );
}

/* ─── WHODAS 2.0 domain table helper ─── */
const WHODAS_DOMAINS = [
  { name: "Cognition", items: [1,2,3,4,5,6], max: 24 },
  { name: "Mobility", items: [7,8,9,10,11], max: 20 },
  { name: "Self-Care", items: [12,13,14], max: 12 },
  { name: "Getting Along", items: [15,16,17,18,19,20], max: 24 },
  { name: "Life Activities (Household)", items: [21,22,23,24], max: 16 },
  { name: "Life Activities (Work/School)", items: [25,26,27,28], max: 16, optional: true },
  { name: "Participation", items: [29,30,31,32,33,34,35,36], max: 32 },
];

const WHODAS_SCORE_MAP: Record<string, number> = {
  "None": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Extreme / Cannot do": 4,
};

function whodasClassification(pct: number): { label: string; color: string } {
  if (pct <= 4) return { label: "None", color: "#16a34a" };
  if (pct <= 24) return { label: "Mild", color: "#65a30d" };
  if (pct <= 49) return { label: "Moderate", color: "#d97706" };
  if (pct <= 95) return { label: "Severe", color: "#dc2626" };
  return { label: "Extreme", color: "#7f1d1d" };
}

interface WhodasDomainRow {
  name: string;
  raw: number;
  max: number;
  pct: number;
  cls: { label: string; color: string };
  assessed: boolean;
}

function buildWhodasDomainRows(scores: Record<string, string>): WhodasDomainRow[] {
  return WHODAS_DOMAINS.map((d) => {
    let sum = 0;
    let answered = 0;
    for (const itemNum of d.items) {
      // Try all key formats: "whodas-1", "1", "item_1", "q1"
      const val = scores[`whodas-${itemNum}`] ?? scores[String(itemNum)] ?? scores[`item_${itemNum}`] ?? scores[`q${itemNum}`];
      if (val !== undefined && val !== null && val !== "") {
        // Value may be a numeric string ("3") or a label ("Severe")
        const numeric = Number(val);
        if (!isNaN(numeric)) {
          sum += numeric;
          answered++;
        } else if (val in WHODAS_SCORE_MAP) {
          sum += WHODAS_SCORE_MAP[val];
          answered++;
        }
      }
    }
    const assessed = answered > 0;
    const pct = assessed ? Math.round((sum / d.max) * 100) : 0;
    return {
      name: d.name,
      raw: sum,
      max: d.max,
      pct,
      cls: assessed ? whodasClassification(pct) : { label: "Not assessed", color: "#a1a1aa" },
      assessed,
    };
  });
}

function WhodasDomainTable({ scores }: { scores: Record<string, string> }) {
  const rows = buildWhodasDomainRows(scores);
  const assessed = rows.filter(r => r.assessed);
  const totalRaw = assessed.reduce((s, r) => s + r.raw, 0);
  const totalMax = assessed.reduce((s, r) => s + r.max, 0);
  const totalPct = totalMax > 0 ? Math.round((totalRaw / totalMax) * 100) : 0;
  const totalCls = totalMax > 0 ? whodasClassification(totalPct) : { label: "Not assessed", color: "#a1a1aa" };

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-2">Domain Results</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs h-8">Domain</TableHead>
            <TableHead className="text-xs h-8 text-right">Raw Score</TableHead>
            <TableHead className="text-xs h-8 text-right">Percentage</TableHead>
            <TableHead className="text-xs h-8 text-right">Classification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="text-xs py-1.5 font-medium">{r.name}</TableCell>
              <TableCell className="text-xs py-1.5 text-right font-mono">
                {r.assessed ? `${r.raw}/${r.max}` : "--"}
              </TableCell>
              <TableCell className="text-xs py-1.5 text-right font-mono">
                {r.assessed ? `${r.pct}%` : "--"}
              </TableCell>
              <TableCell className="text-xs py-1.5 text-right font-semibold" style={{ color: r.cls.color }}>
                {r.cls.label}
              </TableCell>
            </TableRow>
          ))}
          {/* Total row */}
          <TableRow className="border-t-2 border-border">
            <TableCell className="text-xs py-1.5 font-bold">TOTAL</TableCell>
            <TableCell className="text-xs py-1.5 text-right font-mono font-bold">
              {totalMax > 0 ? `${totalRaw}/${totalMax}` : "--"}
            </TableCell>
            <TableCell className="text-xs py-1.5 text-right font-mono font-bold">
              {totalMax > 0 ? `${totalPct}%` : "--"}
            </TableCell>
            <TableCell className="text-xs py-1.5 text-right font-bold" style={{ color: totalCls.color }}>
              {totalCls.label}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── DASS-42 subscale table helper ─── */
const DASS42_SUBSCALE_DEFS = [
  { id: "depression", name: "Depression (D)", items: [3,5,10,13,16,17,21,24,26,31,34,37,38,42], max: 42, thresholds: [{max:9,label:"Normal",color:"#16a34a"},{max:13,label:"Mild",color:"#65a30d"},{max:20,label:"Moderate",color:"#d97706"},{max:27,label:"Severe",color:"#dc2626"},{max:999,label:"Extremely Severe",color:"#7f1d1d"}] },
  { id: "anxiety", name: "Anxiety (A)", items: [2,4,7,9,15,19,20,23,25,28,30,36,40,41], max: 42, thresholds: [{max:7,label:"Normal",color:"#16a34a"},{max:9,label:"Mild",color:"#65a30d"},{max:14,label:"Moderate",color:"#d97706"},{max:19,label:"Severe",color:"#dc2626"},{max:999,label:"Extremely Severe",color:"#7f1d1d"}] },
  { id: "stress", name: "Stress (S)", items: [1,6,8,11,12,14,18,22,27,29,32,33,35,39], max: 42, thresholds: [{max:14,label:"Normal",color:"#16a34a"},{max:18,label:"Mild",color:"#65a30d"},{max:25,label:"Moderate",color:"#d97706"},{max:33,label:"Severe",color:"#dc2626"},{max:999,label:"Extremely Severe",color:"#7f1d1d"}] },
];

function Dass42DomainTable({ scores }: { scores: Record<string, string> }) {
  const rows = DASS42_SUBSCALE_DEFS.map(sub => {
    let sum = 0; let answered = 0;
    for (const n of sub.items) {
      const v = scores[String(n)];
      if (v !== undefined && v !== "") { sum += parseInt(v) || 0; answered++; }
    }
    let cls = { label: "Not assessed", color: "#a1a1aa" };
    if (answered > 0) {
      for (const t of sub.thresholds) { if (sum <= t.max) { cls = { label: t.label, color: t.color }; break; } }
    }
    return { name: sub.name, sum, max: sub.items.length * 3, answered, total: sub.items.length, cls };
  });

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-2">Subscale Results</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs h-8">Subscale</TableHead>
            <TableHead className="text-xs h-8 text-right">Score</TableHead>
            <TableHead className="text-xs h-8 text-right">Max</TableHead>
            <TableHead className="text-xs h-8 text-right">Classification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="text-xs py-1.5 font-medium">{r.name}</TableCell>
              <TableCell className="text-xs py-1.5 text-right font-mono">
                {r.answered > 0 ? r.sum : "--"}
              </TableCell>
              <TableCell className="text-xs py-1.5 text-right font-mono text-muted-foreground">
                {r.max}
              </TableCell>
              <TableCell className="text-xs py-1.5 text-right font-semibold" style={{ color: r.cls.color }}>
                {r.cls.label}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
import { FunctionalCapacityReport } from "./FunctionalCapacityTables";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportModeProps {
  reportContent: Record<string, string>;
  notes: Record<string, string>;
  clientName: string;
  clientDiagnosis: string;
  ndisNumber: string;
  assessments: AssessmentInstance[];
  recommendations: RecommendationInstance[];
  diagnoses: DiagnosisInstance[];
  collateralInterviews?: CollateralInterview[];
  goals?: GoalInstance[];
  nilGoals?: boolean;
  onUpdateGoals?: (goals: GoalInstance[]) => void;
  onUpdateRecommendation?: (index: number, updated: RecommendationInstance) => void;
  onUpdateReportContent?: (key: string, value: string) => void;
  onUpdateNote?: (key: string, value: string) => void;
  clinicianProfile: {
    clinician_name: string | null;
    qualifications: string | null;
    ahpra_number: string | null;
    practice_name: string | null;
  } | null;
  // Quality check props
  qualityCheckStatus: "idle" | "checking" | "complete" | "correcting";
  scorecard: Scorecard | null;
  issueStatuses: Record<string, IssueStatus>;
  scorecardVisible: boolean;
  hasUnresolvedIssues: boolean;
  onQualityCheck: () => void;
  onAcceptIssue: (id: string) => void;
  onDismissIssue: (id: string) => void;
  onAcknowledgeIssue: (id: string) => void;
  onAcceptAllIssues: () => void;
  onApplyCorrections: () => void;
  onToggleScorecard: () => void;
  onRecheck: () => void;
  onClearAndRecheck: () => void;
  onFindInReport: (issue: QualityIssue) => void;
}

// Map app note keys → reportAssembler section keys
function buildReportData(props: ReportModeProps): ReportData {
  const { notes, reportContent, clientName, clientDiagnosis, ndisNumber, assessments, recommendations, clinicianProfile, diagnoses, collateralInterviews } = props;

  // Use reportContent (AI-generated prose) if available, fallback to raw notes
  const s = (noteKey: string, reportKey?: string) => {
    const rc = reportContent[noteKey] || reportContent[reportKey || ""];
    if (typeof rc === "string" && rc.trim()) return rc;
    const n = notes[noteKey];
    return typeof n === "string" ? n : "";
  };

  const today = new Date().toLocaleDateString("en-AU");

  // Derive primary/secondary diagnoses from picker
  const primaryDx = diagnoses?.find(d => d.isPrimary) || diagnoses?.[0];
  const secondaryDxs = diagnoses?.filter(d => d.id !== primaryDx?.id) || [];
  const primaryDiagnosisText = primaryDx?.name || clientDiagnosis || "";
  const secondaryDiagnosesText = secondaryDxs.map(d => d.name).join("; ") || notes["secondary-diagnoses"] || "";

  return {
    participant: {
      fullName: notes[PARTICIPANT_KEYS.fullName] || clientName || "Participant",
      dob: notes[PARTICIPANT_KEYS.dob] || notes["participant-dob"] || "",
      age: (() => {
        const dob = notes[PARTICIPANT_KEYS.dob];
        if (!dob) return notes["participant-age"] || "";
        const birth = new Date(dob);
        const today = new Date();
        let years = today.getFullYear() - birth.getFullYear();
        const md = today.getMonth() - birth.getMonth();
        if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) years--;
        return years >= 0 ? `${years} years` : "";
      })(),
      ndisNumber: notes[PARTICIPANT_KEYS.ndisNumber] || ndisNumber || "",
      address: notes[PARTICIPANT_KEYS.address] || notes["participant-address"] || "",
      primaryContact: notes[PARTICIPANT_KEYS.primaryContact] || notes["participant-contact"] || "",
      primaryDiagnosis: primaryDiagnosisText,
      secondaryDiagnoses: secondaryDiagnosesText,
    },
    clinician: {
      name: clinicianProfile?.clinician_name || "",
      qualifications: clinicianProfile?.qualifications || "",
      ahpra: clinicianProfile?.ahpra_number || "",
      organisation: clinicianProfile?.practice_name || "",
      phoneEmail: notes[CLINICIAN_KEYS.phoneEmail] || "",
      dateOfAssessment: notes[CLINICIAN_KEYS.dateOfAssessment] || notes["assessment-date"] || "",
      dateOfReport: notes[CLINICIAN_KEYS.dateOfReport] || today,
      otServicesCommenced: notes["ot-services-commenced"] || "",
    },
    presentAtAssessment: notes["present-at-assessment"] || "",
    assessmentSetting: notes["assessment-setting"] || "",
    section1: s("reason-referral"),
    section2: s("background"),
    section3: (() => {
      const goalsArr = props.goals || [];
      const isNil = props.nilGoals;
      if (isNil) return `${clientName || "The participant"} currently has no NDIS goals. This may be due to the participant being new to the NDIS, awaiting their first plan, or undergoing a plan reassessment.`;
      const filled = goalsArr.filter(g => g.text.trim());
      if (filled.length > 0) return filled.map((g, i) => `${i + 1}. "${g.text}"`).join("\n");
      return s("participant-goals");
    })(),
    section4: diagnoses && diagnoses.length > 0
      ? diagnoses.map(d => `${d.name} (ICD-10: ${d.icd10}${d.dsm5 ? `, DSM-5: ${d.dsm5}` : ""})\n${d.description}`).join("\n\n")
      : s("diagnoses"),
    section5: s("ot-case-history"),
    section6: s("methodology") || buildMethodologyText(assessments, collateralInterviews || [], diagnoses || [], notes),
    section7: s("informal-supports"),
    section8: s("home-environment"),
    section9: s("social-environment"),
    section10: s("typical-week"),
    section11: s("risk-safety"),
    section12_1: s("mobility", "section12_1"),
    section12_2: s("transfers", "section12_2"),
    section12_3: s("personal-adls", "section12_3"),
    section12_4: s("domestic-iadls", "section12_4"),
    section12_5: s("executive-iadls", "section12_5"),
    section12_6: s("cognition", "section12_6"),
    section12_7: s("communication", "section12_7"),
    section12_8: s("social-functioning", "section12_8"),
    section12_9: s("sensory-profile", "section12_9"),
    section13: s("assessments"),
    section14: s("limitations-barriers"),
    section15: s("functional-impact"),
    section16: s("recommendations"),
    section17: notes["risks-insufficient-funding"] || "",
    section18: s("review-monitoring"),
    section19: notes["section-34-statement"] || "",
    assessments: assessments.map((a) => ({
      tool: typeof a.name === "string" ? a.name : "",
      date: "",
      score: "",
      classification: "",
      whySelected: "",
    })),
    recommendations: recommendations.map((r, idx) => ({
      support: r.supportName || "",
      category: r.ndisCategory || "",
      currentHours: r.currentHours || "",
      recommendedHours: r.recommendedHours || "",
      ratio: r.ratio || "",
      tasks: Array.isArray(r.tasks) ? r.tasks.filter(Boolean).join(", ") : "",
      linkedSections: Array.isArray(r.linkedSections) ? r.linkedSections.join(", ") : "",
      justification: r.justification || "",
      consequence: r.consequence || "",
      outcomes: Array.isArray(r.outcomes) ? r.outcomes.map(o => OUTCOME_OPTIONS.find(opt => opt.id === o)?.label || o).join(", ") : "",
      s34Justification: r.s34Justification || "",
      estimatedCost: r.estimatedCost || "",
    })),
    collateralInterviews: (collateralInterviews || []).map(iv => ({
      intervieweeName: iv.intervieweeName,
      intervieweeRole: iv.intervieweeRole,
      method: iv.method === "phone" ? "Phone" : iv.method === "in_person" ? "In person" : iv.method === "email" ? "Email" : iv.method === "telehealth" ? "Telehealth" : "",
      date: iv.date,
    })),
  };
}

export function ReportMode(props: ReportModeProps) {
  const { reportContent } = props;
  const hasContent = Object.values(reportContent).some((v) => typeof v === "string" && v.trim());
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [highlightedIssue, setHighlightedIssue] = useState<QualityIssue | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  const reportData = buildReportData(props);

  // Find-in-report handler: scroll to and highlight flagged text
  const handleFindInReport = useCallback((issue: QualityIssue) => {
    setHighlightedText(issue.flaggedText);
    setHighlightedIssue(issue);

    // Scroll to the text after a tick so highlights render
    setTimeout(() => {
      const container = reportContainerRef.current;
      if (!container) return;
      const mark = container.querySelector("mark[data-quality-highlight]");
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, []);

  // Wire this handler to the parent prop
  useEffect(() => {
    // The parent calls props.onFindInReport which we handle here
  }, []);

  // Helper: wrap flagged text in a highlight mark within rendered HTML
  const highlightContent = useCallback((html: string): string => {
    if (!highlightedText || !html) return html;
    const idx = html.indexOf(highlightedText);
    if (idx === -1) return html;
    return (
      html.substring(0, idx) +
      `<mark data-quality-highlight style="background-color: #fef08a; padding: 2px 0; border-radius: 2px;">` +
      highlightedText +
      `</mark>` +
      html.substring(idx + highlightedText.length)
    );
  }, [highlightedText]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4" ref={reportContainerRef}>
      {!hasContent ? (
        <div className="py-20 text-center text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <h2 className="text-lg font-medium mb-2">No report generated yet</h2>
          <p className="text-sm max-w-md mx-auto">
            Switch to Notes mode and fill in your clinical notes, then click "Generate full report"
            to create a professionally formatted FCA report.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-lg shadow-sm p-8 space-y-8">
          {TEMPLATE_SECTIONS.map((section) => {
            // Section 1 — Participant & Report Details: render editable front-matter tables
            if (section.id === "participant-details") {
              const p = reportData.participant;
              const c = reportData.clinician;
              const participantRows: [string, string, string][] = [
                ["Full Name", p.fullName, PARTICIPANT_KEYS.fullName],
                ["Date of Birth", p.dob, PARTICIPANT_KEYS.dob],
                ["Age", p.age, ""],
                ["NDIS Number", p.ndisNumber, PARTICIPANT_KEYS.ndisNumber],
                ["Address", p.address, PARTICIPANT_KEYS.address],
                ["Primary Contact / Guardian", p.primaryContact, PARTICIPANT_KEYS.primaryContact],
              ];
              const clinicianRows: [string, string, string][] = [
                ["Report Author", c.name, ""],
                ["Qualifications", c.qualifications, ""],
                ["AHPRA Registration No.", c.ahpra, ""],
                ["Organisation / Practice", c.organisation, ""],
                ["Phone / Email", c.phoneEmail, CLINICIAN_KEYS.phoneEmail],
                ["Date of Assessment", c.dateOfAssessment, CLINICIAN_KEYS.dateOfAssessment],
                ["Date of Report", c.dateOfReport, CLINICIAN_KEYS.dateOfReport],
                ["Report Type", "Functional Capacity Assessment (FCA)", ""],
              ];

              return (
                <div key={section.id} className="space-y-6">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    {section.number}. {section.title}
                  </h2>

                  {/* Participant Details */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Participant Details
                    </p>
                    <Table>
                      <TableBody>
                        {participantRows.map(([label, val, noteKey], idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs py-1.5 w-[200px] bg-muted/30 text-muted-foreground font-semibold">
                              {label}
                            </TableCell>
                            {noteKey ? (
                              <EditableCell
                                value={val}
                                onChange={(v) => props.onUpdateNote?.(noteKey, v)}
                                style={{ padding: "6px 12px", fontSize: "13px" }}
                              />
                            ) : (
                              <TableCell className="text-xs py-1.5">
                                {val || "—"}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Clinician Details */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Provider / Clinician Details
                    </p>
                    <Table>
                      <TableBody>
                        {clinicianRows.map(([label, val, noteKey], idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs py-1.5 w-[200px] bg-muted/30 text-muted-foreground font-semibold">
                              {label}
                            </TableCell>
                            {noteKey ? (
                              <EditableCell
                                value={val}
                                onChange={(v) => props.onUpdateNote?.(noteKey, v)}
                                style={{ padding: "6px 12px", fontSize: "13px" }}
                              />
                            ) : (
                              <TableCell className="text-xs py-1.5">
                                {val || "—"}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            }

            // Section 14 — render AI-generated prose per domain, with raw table as collapsible fallback
            if (section.id === "functional-capacity") {
              const DOMAIN_MAP = [
                { reportKey: "section12_1", noteId: "mobility", label: "14.1 Mobility" },
                { reportKey: "section12_2", noteId: "transfers", label: "14.2 Transfers" },
                { reportKey: "section12_3", noteId: "personal-adls", label: "14.3 Personal ADLs" },
                { reportKey: "section12_4", noteId: "domestic-iadls", label: "14.4 Domestic IADLs" },
                { reportKey: "section12_5", noteId: "executive-iadls", label: "14.5 Executive IADLs" },
                { reportKey: "section12_6", noteId: "cognition", label: "14.6 Cognition" },
                { reportKey: "section12_7", noteId: "communication", label: "14.7 Communication" },
                { reportKey: "section12_8", noteId: "social-functioning", label: "14.8 Social Functioning" },
                { reportKey: "section12_9", noteId: "sensory-profile", label: "14.9 Sensory Profile" },
              ];

              const hasAnyDomainProse = DOMAIN_MAP.some(d => {
                const content = reportContent[d.reportKey];
                return typeof content === "string" && content.trim();
              });

              if (!hasAnyDomainProse) {
                return (
                  <FunctionalCapacityReport
                    key={section.id}
                    notes={props.notes}
                  />
                );
              }

              return (
                <div key={section.id} className="space-y-8">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    14. Functional Capacity — Domain Observations
                  </h2>
                  {DOMAIN_MAP.map((domain) => {
                    const raw = reportContent[domain.reportKey];
                    if (!raw?.trim()) return null;

                    // Try to parse as structured per-row JSON
                    let structured: Record<string, { text: string; rating: string; label: string }> | null = null;
                    try {
                      structured = JSON.parse(raw);
                    } catch {
                      // Not JSON — legacy single-block prose
                    }

                    if (structured && typeof structured === "object" && !structured._fullText) {
                      // Render per-row with subheadings
                      return (
                        <div key={domain.reportKey} className="space-y-4">
                          <h3 className="text-sm font-semibold text-foreground/80">{domain.label}</h3>
                          {Object.entries(structured).map(([fieldId, entry]) => {
                            if (!entry?.text) return null;
                            return (
                              <div key={fieldId} className="space-y-1 pl-2 border-l-2 border-border/20">
                                <h4 className="text-sm font-medium text-foreground/70">{entry.label || fieldId}</h4>
                                {entry.rating && (
                                  <p className="text-xs text-muted-foreground italic">
                                    Support level: {entry.rating}
                                  </p>
                                )}
                                <div
                                  className="prose prose-sm max-w-none text-foreground/90"
                                  contentEditable
                                  suppressContentEditableWarning
                                  dangerouslySetInnerHTML={{ __html: entry.text }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    // Fallback: render as single prose block (legacy or _fullText)
                    const proseText = structured?._fullText?.text || raw;
                    return (
                      <div key={domain.reportKey} className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground/80">{domain.label}</h3>
                        <div
                          className="prose prose-sm max-w-none text-foreground/90"
                          contentEditable
                          suppressContentEditableWarning
                          dangerouslySetInnerHTML={{ __html: proseText }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Section 15 — Assessments: render per-assessment structured
            if (section.id === "assessments") {
              const rawContent = reportContent["assessments"];
              if (!rawContent) return null;

              // Try parsing as structured per-assessment JSON
              let perAssessment: Record<string, {
                name: string;
                dateAdministered: string;
                synopsis: string;
                scoreRows: { label: string; value: string }[];
                total: string;
                classification: string;
                interpretation: string;
              }> | null = null;
              try {
                perAssessment = JSON.parse(rawContent);
              } catch {
                // Legacy: plain text blob
              }

              if (perAssessment && typeof perAssessment === "object") {
                const entries = Object.entries(perAssessment);
                return (
                  <div key={section.id} className="space-y-8">
                    <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                      {section.number}. {section.title}
                    </h2>
                    {entries.map(([aId, entry], idx) => {
                      const isWhodas = aId.includes("whodas") || entry.name?.toLowerCase().includes("whodas");
                      const isDass42 = aId.includes("dass") || entry.name?.toLowerCase().includes("dass");
                      // Find matching assessment instance
                      const matchingAssessment = isWhodas
                        ? props.assessments.find(a => a.definitionId === "whodas-2.0" || a.name?.toLowerCase().includes("whodas"))
                        : isDass42
                        ? props.assessments.find(a => a.definitionId === "dass-42" || a.name?.toLowerCase().includes("dass"))
                        : null;

                      return (
                      <div key={aId} className="space-y-4 pl-2 border-l-2 border-accent/20">
                        {/* Assessment heading */}
                        <h3 className="text-sm font-semibold text-foreground">
                          15.{idx + 1} {entry.name}
                        </h3>
                        {entry.dateAdministered && (
                          <p className="text-xs text-muted-foreground italic">
                            Date administered: {entry.dateAdministered}
                          </p>
                        )}

                        {/* Synopsis */}
                        {entry.synopsis && (
                          <div className="bg-muted/20 border border-border/30 rounded-md p-3">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Synopsis</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{entry.synopsis}</p>
                          </div>
                        )}

                        {/* AI Interpretation (before results table) */}
                        {entry.interpretation && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Interpretation</h4>
                            <div
                              className="prose prose-sm max-w-none text-foreground/90"
                              contentEditable
                              suppressContentEditableWarning
                              dangerouslySetInnerHTML={{ __html: entry.interpretation }}
                            />
                          </div>
                        )}

                        {/* WHODAS Domain Results Table */}
                        {isWhodas && matchingAssessment?.scores && (
                          <WhodasDomainTable scores={matchingAssessment.scores} />
                        )}

                        {/* DASS-42 Subscale Results Table */}
                        {isDass42 && matchingAssessment?.scores && (
                          <Dass42DomainTable scores={matchingAssessment.scores} />
                        )}

                        {/* Generic Results table (non-WHODAS, non-DASS) */}
                        {!isWhodas && !isDass42 && (entry.scoreRows?.length > 0 || entry.total || entry.classification) && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Results</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs h-8">Measure</TableHead>
                                  <TableHead className="text-xs h-8 text-right">Result</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {entry.total && (
                                  <TableRow>
                                    <TableCell className="text-xs py-1.5 font-medium">Total Score</TableCell>
                                    <TableCell className="text-xs py-1.5 text-right font-mono">{entry.total}</TableCell>
                                  </TableRow>
                                )}
                                {entry.classification && (
                                  <TableRow>
                                    <TableCell className="text-xs py-1.5 font-medium">Classification</TableCell>
                                    <TableCell className="text-xs py-1.5 text-right font-medium text-accent">{entry.classification}</TableCell>
                                  </TableRow>
                                )}
                                {entry.scoreRows?.map((row, ri) => (
                                  <TableRow key={ri}>
                                    <TableCell className="text-xs py-1.5 text-foreground/80">{row.label}</TableCell>
                                    <TableCell className="text-xs py-1.5 text-right font-mono">{row.value}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                );
              }

              // Fallback: render as single prose block (legacy)
              return (
                <div key={section.id} className="space-y-3">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    {section.number}. {section.title}
                  </h2>
                  <div
                    className="prose prose-sm max-w-none text-foreground/90"
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: rawContent }}
                  />
                </div>
              );
            }

            // Section 18 — Recommendations: render per-card structured
            if (section.id === "recommendations") {
              const rawContent = reportContent["recommendations"];
              if (!rawContent) return null;

              let perCard: Record<string, { text: string; supportName: string; category: string; currentHours: string; recommendedHours: string; ratio: string; estimatedCost: string; isCapital: boolean }> | null = null;
              try {
                perCard = JSON.parse(rawContent);
              } catch {
                // Legacy: plain text blob
              }

              if (perCard && typeof perCard === "object") {
                const entries = Object.entries(perCard);
                // Find the matching recommendation instance for each card
                return (
                  <div key={section.id} className="space-y-6">
                    <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                      {section.number}. {section.title}
                    </h2>
                    {entries.map(([recId, entry], idx) => {
                      // Find matching recommendation instance for tasks, outcomes, consequence, etc.
                      const recIdx = props.recommendations.findIndex(r => r.id === recId || r.supportName === entry.supportName);
                      const rec = recIdx >= 0 ? props.recommendations[recIdx] : null;
                      const tasks = rec?.tasks?.filter(Boolean) || [];
                      const outcomeLabels = (rec?.outcomes || []).map(o => OUTCOME_OPTIONS.find(opt => opt.id === o)?.label || o);
                      const consequence = rec?.consequence || "";
                      const linkedSections = rec?.linkedSections?.filter(Boolean) || [];
                      const justification = rec?.justification || "";
                      const s34 = rec?.s34Justification || "";

                      return (
                        <div key={recId}>
                          {idx > 0 && <hr className="border-border/30 mb-6" />}
                          <div className="space-y-3">
                            {/* Heading row */}
                            <div className="flex items-center justify-between" style={{ borderLeft: "4px solid #6b7280", paddingLeft: "12px" }}>
                              <h3 style={{ fontSize: "16px", fontWeight: 600 }} className="text-foreground">
                                18.{idx + 1} {entry.supportName}
                              </h3>
                              <span style={{ fontSize: "12px", backgroundColor: "#f3f4f6", color: "#374151", padding: "2px 10px", borderRadius: "9999px" }}>
                                {entry.category}
                              </span>
                            </div>

                            {/* Key-value table */}
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                              <tbody>
                                {!entry.isCapital && (
                                  <>
                                    <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                     <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Current provision</td>
                                      <EditableCell
                                        value={entry.currentHours || ""}
                                        onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, currentHours: v }); }}
                                        style={{ padding: "8px 12px" }}
                                      />
                                    </tr>
                                    <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                      <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Recommended provision</td>
                                      <EditableCell
                                        value={entry.recommendedHours || ""}
                                        onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, recommendedHours: v }); }}
                                        style={{ padding: "8px 12px", fontWeight: 700 }}
                                      />
                                    </tr>
                                    <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                      <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Support ratio</td>
                                      <EditableCell
                                        value={entry.ratio || ""}
                                        onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, ratio: v }); }}
                                        style={{ padding: "8px 12px" }}
                                      />
                                    </tr>
                                  </>
                                )}
                                {entry.isCapital && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Estimated cost</td>
                                    <EditableCell
                                      value={entry.estimatedCost || ""}
                                      onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, estimatedCost: v }); }}
                                      style={{ padding: "8px 12px", fontWeight: 700 }}
                                    />
                                  </tr>
                                )}
                                {tasks.length > 0 && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500, verticalAlign: "top" }}>Tasks covered</td>
                                    <td style={{ padding: "8px 12px" }}>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                        {tasks.map((t, ti) => (
                                          <span key={ti} style={{ fontSize: "12px", backgroundColor: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: "4px" }}>{t}</span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {justification && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500, verticalAlign: "top" }}>Clinical justification</td>
                                    <EditableCell
                                      value={justification}
                                      onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, justification: v }); }}
                                      style={{ padding: "8px 12px" }}
                                    />
                                  </tr>
                                )}
                                {outcomeLabels.length > 0 && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500, verticalAlign: "top" }}>Expected outcomes</td>
                                    <td style={{ padding: "8px 12px" }}>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                        {outcomeLabels.map((o, oi) => (
                                          <span key={oi} style={{ fontSize: "12px", backgroundColor: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: "4px" }}>{o}</span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {consequence && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500, verticalAlign: "top" }}>Without this support</td>
                                    <EditableCell
                                      value={consequence}
                                      onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, consequence: v }); }}
                                      style={{ padding: "8px 12px" }}
                                      redText
                                    />
                                  </tr>
                                )}
                                {linkedSections.length > 0 && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500, verticalAlign: "top" }}>Linked report sections</td>
                                    <td style={{ padding: "8px 12px" }}>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                        {linkedSections.map((s, si) => (
                                          <span key={si} style={{ fontSize: "12px", fontFamily: "monospace", backgroundColor: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: "4px" }}>S.{s}</span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {s34 && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500, verticalAlign: "top" }}>Why NDIS-funded</td>
                                    <EditableCell
                                      value={s34}
                                      onChange={(v) => { if (rec && recIdx >= 0) props.onUpdateRecommendation?.(recIdx, { ...rec, s34Justification: v }); }}
                                      style={{ padding: "8px 12px" }}
                                    />
                                  </tr>
                                )}
                              </tbody>
                            </table>

                            {/* AI narrative block */}
                            {entry.text && (
                              <div style={{ backgroundColor: "#f9fafb", borderLeft: "3px solid #9ca3af", padding: "12px 16px", borderRadius: "0 6px 6px 0" }}>
                                <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI-generated narrative</p>
                                <div
                                  className="prose prose-sm max-w-none"
                                  style={{ fontSize: "14px", color: "#1f2937" }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  dangerouslySetInnerHTML={{ __html: entry.text }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Fallback: render as single prose block (legacy)
              return (
                <div key={section.id} className="space-y-3">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    {section.number}. {section.title}
                  </h2>
                  <div
                    className="prose prose-sm max-w-none text-foreground/90"
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: rawContent }}
                  />
                </div>
              );
            }

            // Section 5 — Participant Goals: render structured goals table
            if (section.id === "participant-goals") {
              const goalsArr = props.goals || [];
              const isNil = props.nilGoals;
              const filledGoals = goalsArr.filter(g => g.text.trim());
              const hasGoals = filledGoals.length > 0 || isNil;

              if (!hasGoals && !reportContent["participant-goals"]) return null;

              return (
                <div key={section.id} className="space-y-4">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    {section.number}. {section.title}
                  </h2>

                  {isNil ? (
                    <p className="text-sm text-foreground/80 italic leading-relaxed">
                      {props.clientName || "The participant"} currently has no NDIS goals. This may be due to the participant being new to the NDIS, awaiting their first plan, or undergoing a plan reassessment.
                    </p>
                  ) : filledGoals.length > 0 ? (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        NDIS Goals (Participant's Own Words)
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-8 w-12 text-center">#</TableHead>
                            <TableHead className="text-xs h-8">Goal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filledGoals.map((g, idx) => (
                            <TableRow key={g.id}>
                              <TableCell className="text-center py-1.5 font-mono text-xs font-bold">
                                {idx + 1}
                              </TableCell>
                              <EditableCell
                                value={`"${g.text}"`}
                                onChange={(v) => {
                                  const cleaned = v.replace(/^"|"$/g, "");
                                  if (props.onUpdateGoals) {
                                    const updated = [...goalsArr];
                                    const realIdx = goalsArr.findIndex(og => og.id === g.id);
                                    if (realIdx >= 0) {
                                      updated[realIdx] = { ...updated[realIdx], text: cleaned };
                                      props.onUpdateGoals(updated);
                                    }
                                  }
                                }}
                                style={{ padding: "8px 12px", fontStyle: "italic" }}
                              />
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  ) : reportContent["participant-goals"] ? (
                    <div
                      className="prose prose-sm max-w-none text-foreground/90"
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: reportContent["participant-goals"] }}
                    />
                  ) : null}
                </div>
              );
            }

            // Section 6 — Diagnoses: render structured table from picker data
            if (section.id === "diagnoses") {
              const dxList = props.diagnoses || [];
              if (dxList.length === 0 && !reportContent["diagnoses"]) return null;

              const primaryDx = dxList.find(d => d.isPrimary) || dxList[0];
              const secondaryDxs = dxList.filter(d => d.id !== primaryDx?.id);

              return (
                <div key={section.id} className="space-y-4">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    {section.number}. {section.title}
                  </h2>

                  {dxList.length > 0 ? (
                    <>
                      {/* Diagnoses summary table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-8">Diagnosis</TableHead>
                            <TableHead className="text-xs h-8 text-center w-16">Type</TableHead>
                            <TableHead className="text-xs h-8 text-center w-20">ICD-10</TableHead>
                            <TableHead className="text-xs h-8 text-center w-20">DSM-5</TableHead>
                            <TableHead className="text-xs h-8 text-center w-24">Category</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[primaryDx, ...secondaryDxs].filter(Boolean).map((d) => (
                            <TableRow key={d!.id}>
                              <TableCell className="text-xs py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-0.5 h-3.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: d!.id === primaryDx?.id ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.3)" }}
                                  />
                                  <span className={d!.id === primaryDx?.id ? "font-bold" : ""}>{d!.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-1.5">
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                  d!.id === primaryDx?.id
                                    ? "bg-foreground text-background"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {d!.id === primaryDx?.id ? "1°" : "2°"}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-1.5 font-mono text-xs font-semibold text-emerald-600">
                                {d!.icd10}
                              </TableCell>
                              <TableCell className="text-center py-1.5 font-mono text-xs text-violet-600">
                                {d!.dsm5 || "—"}
                              </TableCell>
                              <TableCell className="text-center py-1.5 text-xs text-muted-foreground">
                                {d!.category}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Diagnosis descriptions */}
                      <div className="space-y-3 mt-4">
                        {[primaryDx, ...secondaryDxs].filter(Boolean).map((d) => (
                          <div key={d!.id} className="pl-3 border-l-2 border-border/30">
                            <h4 className="text-sm font-semibold text-foreground/80 mb-1">
                              {d!.name}
                              {d!.id === primaryDx?.id && (
                                <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-foreground text-background uppercase">Primary</span>
                              )}
                            </h4>
                            <p className="text-sm text-foreground/80 leading-relaxed">{d!.description}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Fallback to AI-generated prose if no structured diagnoses */
                    reportContent["diagnoses"] && (
                      <div
                        className="prose prose-sm max-w-none text-foreground/90"
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: reportContent["diagnoses"] }}
                      />
                    )
                  )}
                </div>
              );
            }

            // Methodology section — auto-populated structured tables
            if (section.id === "methodology") {
              const content = reportContent[section.id];
              const interviews = props.collateralInterviews || [];
              const assessmentList = props.assessments || [];
              const dxList = props.diagnoses || [];
              const obs = props.notes["__methodology_observation__"]?.trim();
              const env = props.notes["__methodology_environment__"]?.trim();
              const add = props.notes["__methodology_additional__"]?.trim();

              const hasAnything = content || interviews.length > 0 || assessmentList.length > 0 || dxList.length > 0 || obs || env || add;
              if (!hasAnything) return null;

              const METHODOLOGY_REGISTRY: Record<string, { category: string; rationale: string }> = {
                "whodas-2.0": { category: "Global Disability", rationale: "Standardised cross-diagnostic measure of disability across all functional domains." },
                "frat": { category: "Safety / Risk", rationale: "Falls risk screening to inform safe support planning." },
                "lawton-iadl": { category: "Instrumental ADLs", rationale: "Quantifies capacity for complex daily living skills." },
                "lsp-16": { category: "Psychosocial Functioning", rationale: "Clinician-rated measure of general functioning for persistent mental illness." },
                "cans": { category: "Care Needs", rationale: "Classifies level and intensity of care needed." },
                "sensory-profile": { category: "Sensory Processing", rationale: "Assesses sensory processing patterns impacting daily functioning." },
                "zarit": { category: "Carer Assessment", rationale: "Quantifies carer burden and sustainability of informal supports." },
                "dass-42": { category: "Mental Health", rationale: "Quantifies severity of depression, anxiety, and stress." },
              };

              return (
                <div key={section.id} className="space-y-4">
                  <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                    {section.number}. {section.title}
                  </h2>

                  {/* AI-generated prose (if generated) */}
                  {content && (
                    <div
                      className="prose prose-sm max-w-none text-foreground/90"
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: highlightContent(content) }}
                    />
                  )}

                  {/* Observation notes */}
                  {(obs || env) && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground/80">Clinical Observations</h3>
                      {obs && <p className="text-sm text-foreground/80">{obs}</p>}
                      {env && <p className="text-sm text-foreground/80">{env}</p>}
                    </div>
                  )}

                  {/* Assessments table */}
                  {assessmentList.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground/80">Standardised Assessments Administered</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-8">Assessment Tool</TableHead>
                            <TableHead className="text-xs h-8 text-center w-24">Category</TableHead>
                            <TableHead className="text-xs h-8">Rationale for Selection</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assessmentList.map((a) => {
                            const reg = METHODOLOGY_REGISTRY[a.definitionId];
                            return (
                              <TableRow key={a.id}>
                                <TableCell className="text-xs py-1.5 font-medium">{a.name}</TableCell>
                                <TableCell className="text-xs py-1.5 text-center text-muted-foreground">{reg?.category || "—"}</TableCell>
                                <TableCell className="text-xs py-1.5 text-muted-foreground">{reg?.rationale || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Collateral sources table */}
                  {interviews.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground/80">Collateral Sources</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-8">Stakeholder Type</TableHead>
                            <TableHead className="text-xs h-8">Interviewee</TableHead>
                            <TableHead className="text-xs h-8 text-center">Method</TableHead>
                            <TableHead className="text-xs h-8 text-center">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {interviews.map((iv) => {
                            const template = LIAISE_TEMPLATES[iv.templateId];
                            const methodLabel = iv.method === "phone" ? "Phone" : iv.method === "in_person" ? "In person" : iv.method === "email" ? "Email" : iv.method === "telehealth" ? "Telehealth" : "—";
                            return (
                              <TableRow key={iv.id}>
                                <TableCell className="text-xs py-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-[3px] h-3.5 rounded-sm" style={{ backgroundColor: template?.color || "#6b7280" }} />
                                    <span className="font-medium">{template?.name || iv.templateId}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs py-1.5">{iv.intervieweeName || "—"}</TableCell>
                                <TableCell className="text-xs py-1.5 text-center">{methodLabel}</TableCell>
                                <TableCell className="text-xs py-1.5 text-center font-mono">{iv.date || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Diagnoses considered */}
                  {dxList.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground/80">Diagnoses Considered</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {dxList.map((d) => (
                          <span key={d.id} className="text-xs px-2 py-1 rounded border border-border/50 bg-muted/30 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-semibold text-emerald-600">{d.icd10}</span>
                            <span className="font-medium">{d.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional notes */}
                  {add && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground/80">Additional Notes</h3>
                      <p className="text-sm text-foreground/80">{add}</p>
                    </div>
                  )}
                </div>
              );
            }

            const content = reportContent[section.id];
            if (!content) return null;
            return (
              <div key={section.id} className="space-y-3">
                <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
                  {section.number}. {section.title}
                </h2>
                <div
                  className="prose prose-sm max-w-none text-foreground/90"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Quality summary bar (persistent) */}
      {props.scorecard && (
        <div className="mt-6">
          <QualitySummaryBar
            scorecard={props.scorecard}
            issueStatuses={props.issueStatuses}
            isExpanded={props.scorecardVisible}
            onToggle={props.onToggleScorecard}
          />
        </div>
      )}

      {/* Quality scorecard panel (inline, collapsible) */}
      {props.scorecardVisible && props.scorecard && (
        <div className="mt-3">
          <QualityScorecard
            scorecard={props.scorecard}
            issueStatuses={props.issueStatuses}
            onAccept={props.onAcceptIssue}
            onDismiss={props.onDismissIssue}
            onAcknowledge={props.onAcknowledgeIssue}
            onAcceptAll={props.onAcceptAllIssues}
            onApplyCorrections={props.onApplyCorrections}
            onClose={props.onToggleScorecard}
            onRecheck={props.onRecheck}
            onClearAndRecheck={props.onClearAndRecheck}
            onFindInReport={(issue) => {
              handleFindInReport(issue);
              props.onFindInReport(issue);
            }}
            isApplying={props.qualityCheckStatus === "correcting"}
            isRechecking={props.qualityCheckStatus === "checking"}
          />
        </div>
      )}

      {/* Highlighted issue popover */}
      {highlightedIssue && highlightedText && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border border-border shadow-lg rounded-lg p-4 max-w-sm space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="text-sm font-semibold text-foreground">{highlightedIssue.criterion}: {highlightedIssue.title}</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setHighlightedText(null); setHighlightedIssue(null); }}>
              <span className="text-xs">✕</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{highlightedIssue.description}</p>
          {highlightedIssue.suggestedFix && (
            <div className="text-xs p-2 rounded" style={{ backgroundColor: "hsl(142 76% 36% / 0.06)", borderLeft: "3px solid hsl(142 76% 36% / 0.4)" }}>
              <span className="font-medium text-muted-foreground">Suggested: </span>"{highlightedIssue.suggestedFix}"
            </div>
          )}
          <div className="flex gap-2">
            {highlightedIssue.tier === "auto_correct" && highlightedIssue.suggestedFix ? (
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                props.onAcceptIssue(highlightedIssue.id);
                setHighlightedText(null);
                setHighlightedIssue(null);
              }}>
                Accept Fix
              </Button>
            ) : (
              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                props.onAcknowledgeIssue(highlightedIssue.id);
                setHighlightedText(null);
                setHighlightedIssue(null);
              }}>
                Mark as Reviewed
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 mt-6">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  disabled={!hasContent || props.qualityCheckStatus === "checking" || props.hasUnresolvedIssues}
                  onClick={props.onQualityCheck}
                  className="border-primary/50 text-primary hover:bg-primary/5"
                >
                  {props.qualityCheckStatus === "checking" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking quality…</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2" /> Check Report Quality</>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {props.hasUnresolvedIssues && (
              <TooltipContent>
                <p>Resolve all current issues before running a new quality check.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <DownloadReportButton reportData={reportData} />
      </div>
    </div>
  );
}
