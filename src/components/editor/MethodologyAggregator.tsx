import { useMemo } from "react";
import { type AssessmentInstance } from "@/lib/assessment-library";
import { type DiagnosisInstance } from "@/lib/diagnosis-library";
import { type CollateralInterview, LIAISE_TEMPLATES } from "./LiaiseMode";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Assessment Tool Registry (metadata for methodology display) ───
const ASSESSMENT_REGISTRY: Record<string, {
  shortName: string;
  category: string;
  rationale: string;
  synopsis: string;
}> = {
  "whodas-2.0": {
    shortName: "WHODAS 2.0",
    category: "Global Disability",
    rationale: "Selected to provide a standardised, cross-diagnostic measure of disability across all functional domains, enabling comparison with population norms and quantification of overall disability level.",
    synopsis: "A 36-item measure of health and disability across six domains. Items scored 0 (None) to 4 (Extreme).",
  },
  "frat": {
    shortName: "FRAT",
    category: "Safety / Risk",
    rationale: "Selected to screen for falls risk and identify modifiable risk factors to inform safe support planning and environmental modification recommendations.",
    synopsis: "Validated falls risk screening tool. Part 1 scores four risk factors with a total out of 20.",
  },
  "lawton-iadl": {
    shortName: "Lawton IADL",
    category: "Instrumental ADLs",
    rationale: "Selected to quantify the participant's capacity for complex daily living skills required for independent community living.",
    synopsis: "An 8-item measure of complex functional skills required for independent community living.",
  },
  "lsp-16": {
    shortName: "LSP-16",
    category: "Psychosocial Functioning",
    rationale: "Selected as a clinician-rated measure of general functioning for individuals with persistent mental illness, informing psychosocial support planning.",
    synopsis: "A 16-item clinician-rated measure of general functioning for individuals with persistent mental illness.",
  },
  "cans": {
    shortName: "CANS",
    category: "Care Needs Classification",
    rationale: "Selected to classify the overall level and intensity of care and support needed, providing an evidence-based framework for support planning aligned with NDIS funding categories.",
    synopsis: "A clinician-rated measure of the type and intensity of care and support needed. 28-item checklist.",
  },
  "sensory-profile": {
    shortName: "Sensory Profile",
    category: "Sensory Processing",
    rationale: "Selected to assess sensory processing patterns that impact daily functioning, social participation, and environmental tolerance.",
    synopsis: "A 60-item self-report measure assessing sensory processing patterns across four quadrants.",
  },
  "zarit": {
    shortName: "Zarit",
    category: "Carer Assessment",
    rationale: "Selected to quantify carer burden and sustainability of informal supports, providing evidence for the need for formal NDIS-funded supports.",
    synopsis: "A 22-item self-report measure completed by the caregiver. Total score out of 88.",
  },
  "dass-42": {
    shortName: "DASS-42",
    category: "Mental Health",
    rationale: "Selected to quantify the severity of negative emotional states impacting functional capacity, informing psychosocial support recommendations and risk assessment.",
    synopsis: "A 42-item self-report measure of Depression, Anxiety, and Stress.",
  },
};

const METHOD_LABELS: Record<string, string> = {
  phone: "Telephone",
  in_person: "In Person",
  email: "Email / Written",
  telehealth: "Telehealth",
};

interface MethodologyAggregatorProps {
  assessments: AssessmentInstance[];
  collateralInterviews: CollateralInterview[];
  diagnoses: DiagnosisInstance[];
  notes: Record<string, string>;
  onUpdateNote: (key: string, value: string) => void;
}

export function MethodologyAggregator({
  assessments,
  collateralInterviews,
  diagnoses,
  notes,
  onUpdateNote,
}: MethodologyAggregatorProps) {
  const [open, setOpen] = useState(true);

  const assessmentCount = assessments.length;
  const interviewCount = collateralInterviews.length;
  const diagnosisCount = diagnoses.length;
  const hasObservation = !!(notes["__methodology_observation__"]?.trim());
  const hasEnvironment = !!(notes["__methodology_environment__"]?.trim());
  const hasAdditional = !!(notes["__methodology_additional__"]?.trim());

  const hasContent = assessmentCount > 0 || interviewCount > 0 || diagnosisCount > 0 || hasObservation || hasEnvironment || hasAdditional;

  return (
    <div data-section-id="methodology" className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">8</span>
        <span className="text-sm font-medium text-foreground flex-1">Methodology & Assessments Used</span>
        {hasContent && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            This section auto-populates from your scoring tools, Liaise interviews, and diagnoses. You can also add clinical observation notes below.
          </p>

          {/* ─── A: Standardised Assessments ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-semibold text-foreground">
                Standardised Assessments
                <span className="ml-1.5 text-muted-foreground font-normal">({assessmentCount})</span>
              </h3>
            </div>
            {assessmentCount === 0 ? (
              <p className="text-xs text-muted-foreground/60 pl-3">
                No assessments completed yet. Complete a scoring tool in the Assessments section and it will appear here automatically.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Assessment Tool</TableHead>
                    <TableHead className="text-xs h-8 text-center w-24">Category</TableHead>
                    <TableHead className="text-xs h-8">Rationale for Selection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => {
                    const reg = ASSESSMENT_REGISTRY[a.definitionId];
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 uppercase">Auto</span>
                            <span className="font-medium">{a.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs py-1.5 text-center text-muted-foreground">
                          {reg?.category || "—"}
                        </TableCell>
                        <TableCell className="text-xs py-1.5 text-muted-foreground leading-relaxed">
                          {reg?.rationale || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* ─── B: Collateral Sources ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              <h3 className="text-xs font-semibold text-foreground">
                Collateral Sources
                <span className="ml-1.5 text-muted-foreground font-normal">({interviewCount} — from Liaise)</span>
              </h3>
            </div>
            {interviewCount === 0 ? (
              <p className="text-xs text-muted-foreground/60 pl-3">
                No collateral interviews recorded. Complete interviews in the Liaise tab and they will appear here automatically.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Informant</TableHead>
                    <TableHead className="text-xs h-8">Role / Relationship</TableHead>
                    <TableHead className="text-xs h-8 text-center w-20">Method</TableHead>
                    <TableHead className="text-xs h-8 text-center w-20">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collateralInterviews.map((iv) => {
                    const template = LIAISE_TEMPLATES[iv.templateId];
                    const methodLabel = METHOD_LABELS[iv.method] || iv.method || "—";
                    return (
                      <TableRow key={iv.id}>
                        <TableCell className="text-xs py-1.5 font-medium">{iv.intervieweeName || "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 text-muted-foreground">
                          {iv.intervieweeRole || template?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs py-1.5 text-center">{methodLabel}</TableCell>
                        <TableCell className="text-xs py-1.5 text-center font-mono">{iv.date || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* ─── C: Diagnoses Considered ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-violet-500" />
              <h3 className="text-xs font-semibold text-foreground">
                Diagnoses Considered
                <span className="ml-1.5 text-muted-foreground font-normal">({diagnosisCount} — from Diagnosis Picker)</span>
              </h3>
            </div>
            {diagnosisCount === 0 ? (
              <p className="text-xs text-muted-foreground/60 pl-3">
                No diagnoses selected. Add diagnoses in Section 6 and they will appear here automatically.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pl-3">
                {diagnoses.map((d) => (
                  <span key={d.id} className="text-xs px-2 py-1 rounded border border-border/50 bg-muted/30 flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold text-emerald-600">{d.icd10}</span>
                    <span className="font-medium text-foreground">{d.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ─── D: Clinical Observation Notes (manual) ─── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-foreground" />
              <h3 className="text-xs font-semibold text-foreground">Clinical Observations</h3>
            </div>
            <div className="space-y-2 pl-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Additional Methodology Notes
                </label>
                <textarea
                  rows={2}
                  value={notes["__methodology_additional__"] || ""}
                  onChange={(e) => onUpdateNote("__methodology_additional__", e.target.value)}
                  placeholder="Any additional methodology details, clinical reasoning, or contextual notes..."
                  className="w-full px-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50"
                  style={{ minHeight: 50 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: Build methodology text for AI generation / report data ───
export function buildMethodologyText(
  assessments: AssessmentInstance[],
  collateralInterviews: CollateralInterview[],
  diagnoses: DiagnosisInstance[],
  notes: Record<string, string>,
): string {
  const parts: string[] = [];

  const obs = notes["__methodology_observation__"]?.trim();
  if (obs) parts.push(`Clinical observation: ${obs}`);

  const env = notes["__methodology_environment__"]?.trim();
  if (env) parts.push(`Environmental assessment: ${env}`);

  if (assessments.length > 0) {
    parts.push("Standardised assessments administered:");
    for (const a of assessments) {
      const reg = ASSESSMENT_REGISTRY[a.definitionId];
      parts.push(`- ${a.name}${a.dateAdministered ? ` (${a.dateAdministered})` : ""}: ${reg?.synopsis || ""} ${reg?.rationale || ""}`);
    }
  }

  if (collateralInterviews.length > 0) {
    parts.push("Collateral information gathered:");
    for (const ci of collateralInterviews) {
      const methodLabel = METHOD_LABELS[ci.method] || ci.method || "interview";
      const template = LIAISE_TEMPLATES[ci.templateId];
      parts.push(`- ${methodLabel} interview with ${ci.intervieweeName || "[Name]"}, ${ci.intervieweeRole || template?.name || ""}${ci.date ? `, ${ci.date}` : ""}`);
    }
  }

  if (diagnoses.length > 0) {
    parts.push(`Diagnoses considered: ${diagnoses.map(d => `${d.name} (${d.icd10})`).join("; ")}`);
  }

  const add = notes["__methodology_additional__"]?.trim();
  if (add) parts.push(`Additional notes: ${add}`);

  return parts.join("\n\n");
}
