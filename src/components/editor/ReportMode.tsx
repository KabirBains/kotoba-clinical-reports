import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { FileText } from "lucide-react";
import DownloadReportButton from "@/components/DownloadReportButton";
import type { ReportData } from "@/ai/reportAssembler";
import { type AssessmentInstance, getScoreForOption } from "@/lib/assessment-library";
import { type RecommendationInstance, OUTCOME_OPTIONS } from "@/lib/recommendations-library";

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
  clinicianProfile: {
    clinician_name: string | null;
    qualifications: string | null;
    ahpra_number: string | null;
    practice_name: string | null;
  } | null;
}

// Map app note keys → reportAssembler section keys
function buildReportData(props: ReportModeProps): ReportData {
  const { notes, reportContent, clientName, clientDiagnosis, ndisNumber, assessments, recommendations, clinicianProfile } = props;

  // Use reportContent (AI-generated prose) if available, fallback to raw notes
  const s = (noteKey: string, reportKey?: string) => {
    const rc = reportContent[noteKey] || reportContent[reportKey || ""];
    if (typeof rc === "string" && rc.trim()) return rc;
    const n = notes[noteKey];
    return typeof n === "string" ? n : "";
  };

  const today = new Date().toLocaleDateString("en-AU");

  return {
    participant: {
      fullName: clientName || "Participant",
      dob: notes["participant-dob"] || "",
      age: notes["participant-age"] || "",
      ndisNumber: ndisNumber || "",
      address: notes["participant-address"] || "",
      primaryContact: notes["participant-contact"] || "",
      primaryDiagnosis: clientDiagnosis || "",
      secondaryDiagnoses: notes["secondary-diagnoses"] || "",
    },
    clinician: {
      name: clinicianProfile?.clinician_name || "",
      qualifications: clinicianProfile?.qualifications || "",
      ahpra: clinicianProfile?.ahpra_number || "",
      organisation: clinicianProfile?.practice_name || "",
      phoneEmail: "",
      dateOfAssessment: notes["assessment-date"] || "",
      dateOfReport: today,
      otServicesCommenced: notes["ot-services-commenced"] || "",
    },
    presentAtAssessment: notes["present-at-assessment"] || "",
    assessmentSetting: notes["assessment-setting"] || "",
    section1: s("reason-referral"),
    section2: s("background"),
    section3: s("participant-goals"),
    section4: s("diagnoses"),
    section5: s("ot-case-history"),
    section6: s("methodology"),
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
  };
}

export function ReportMode(props: ReportModeProps) {
  const { reportContent } = props;
  const hasContent = Object.values(reportContent).some((v) => typeof v === "string" && v.trim());

  const reportData = buildReportData(props);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
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
                      // Find matching assessment instance to get raw scores for WHODAS domain table
                      const matchingAssessment = isWhodas
                        ? props.assessments.find(a => a.definitionId === "whodas-2.0" || a.name?.toLowerCase().includes("whodas"))
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

                        {/* Generic Results table (non-WHODAS) */}
                        {!isWhodas && (entry.scoreRows?.length > 0 || entry.total || entry.classification) && (
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
                      const rec = props.recommendations.find(r => r.id === recId || r.supportName === entry.supportName);
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
                                      <td style={{ padding: "8px 12px" }}>{entry.currentHours || "—"}</td>
                                    </tr>
                                    <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                      <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Recommended provision</td>
                                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>{entry.recommendedHours || "—"}</td>
                                    </tr>
                                    <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                      <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Support ratio</td>
                                      <td style={{ padding: "8px 12px" }}>{entry.ratio || "—"}</td>
                                    </tr>
                                  </>
                                )}
                                {entry.isCapital && entry.estimatedCost && (
                                  <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                    <td style={{ width: "200px", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#6b7280", fontWeight: 500 }}>Estimated cost</td>
                                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>{entry.estimatedCost}</td>
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
                                    <td style={{ padding: "8px 12px" }}>{justification}</td>
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
                                    <td style={{ padding: "8px 12px", color: "#991b1b" }}>{consequence}</td>
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
                                    <td style={{ padding: "8px 12px" }}>{s34}</td>
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

      {/* Download button — always visible */}
      <DownloadReportButton reportData={reportData} />
    </div>
  );
}
