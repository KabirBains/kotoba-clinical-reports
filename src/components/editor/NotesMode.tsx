import { useState } from "react";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { getSubsectionConfig, type SubsectionField } from "@/lib/subsection-fields";
import { type AssessmentInstance } from "@/lib/assessment-library";
import { type RecommendationInstance } from "@/lib/recommendations-library";
import { type DiagnosisInstance } from "@/lib/diagnosis-library";
import { type CollateralInterview } from "@/components/editor/LiaiseMode";
import { AssessmentsSection } from "@/components/editor/AssessmentsSection";
import { RecommendationsSection } from "@/components/editor/RecommendationsSection";
import { DiagnosisPicker } from "@/components/editor/DiagnosisPicker";
import { MethodologyAggregator } from "@/components/editor/MethodologyAggregator";
import { ParticipantGoals, type GoalInstance } from "@/components/editor/ParticipantGoals";
import { ParticipantReportDetails } from "@/components/editor/ParticipantReportDetails";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotesModeProps {
  notes: Record<string, string>;
  onUpdateNote: (sectionId: string, value: string) => void;
  assessments: AssessmentInstance[];
  onUpdateAssessments: (assessments: AssessmentInstance[]) => void;
  recommendations: RecommendationInstance[];
  onUpdateRecommendations: (recommendations: RecommendationInstance[]) => void;
  diagnoses: DiagnosisInstance[];
  onUpdateDiagnoses: (diagnoses: DiagnosisInstance[]) => void;
  collateralInterviews: CollateralInterview[];
  goals: GoalInstance[];
  onUpdateGoals: (goals: GoalInstance[]) => void;
  nilGoals: boolean;
  onToggleNilGoals: (val: boolean) => void;
  clientName?: string;
  ndisNumber?: string;
  clinicianProfile: {
    clinician_name: string | null;
    qualifications: string | null;
    ahpra_number: string | null;
    practice_name: string | null;
  } | null;
}

function StructuredField({
  field,
  subsectionId,
  notes,
  onUpdateNote,
}: {
  field: SubsectionField;
  subsectionId: string;
  notes: Record<string, string>;
  onUpdateNote: (key: string, value: string) => void;
}) {
  const noteKey = `${subsectionId}__${field.id}__notes`;
  const ratingKey = `${subsectionId}__${field.id}__rating`;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground tracking-wide">
        {field.label}
      </label>
      <div className={cn("flex gap-2", field.ratingOptions ? "flex-col sm:flex-row" : "")}>
        {field.ratingOptions && (
          <Select
            value={notes[ratingKey] || ""}
            onValueChange={(val) => onUpdateNote(ratingKey, val)}
          >
            <SelectTrigger className="h-9 text-xs sm:w-52 w-full bg-background border-border/60 shrink-0">
              <SelectValue placeholder="Select rating…" />
            </SelectTrigger>
            <SelectContent>
              {field.ratingOptions.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <textarea
          rows={2}
          value={notes[noteKey] || ""}
          onChange={(e) => onUpdateNote(noteKey, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
            }
          }}
          placeholder={field.placeholder}
          style={{ resize: "vertical", minHeight: "60px" }}
          className="flex-1 px-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

function StructuredSubsectionPanel({
  id,
  number,
  title,
  notes,
  onUpdateNote,
}: {
  id: string;
  number: string;
  title: string;
  notes: Record<string, string>;
  onUpdateNote: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const config = getSubsectionConfig(id);

  const hasContent = config
    ? config.fields.some(
        (f) => {
          const nv = notes[`${id}__${f.id}__notes`];
          const rv = notes[`${id}__${f.id}__rating`];
          return (typeof nv === 'string' && nv.trim()) || (typeof rv === 'string' && rv.trim());
        }
      )
    : (typeof notes[id] === 'string' ? notes[id].trim() : '').length > 0;

  return (
    <div data-section-id={id} className="ml-6 border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">
          {number}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        {hasContent && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
      </button>
      {open && config && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-4">
          {config.fields.map((field) => (
            <StructuredField
              key={field.id}
              field={field}
              subsectionId={id}
              notes={notes}
              onUpdateNote={onUpdateNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionPanel({
  id,
  number,
  title,
  value,
  onChange,
}: {
  id: string;
  number: string;
  title: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasContent = (typeof value === 'string' ? value.trim() : '').length > 0;

  return (
    <div data-section-id={id} className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">
          {number}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        {hasContent && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pl-[4.5rem]">
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your notes here... dot points, rough observations, anything."
            className="w-full min-h-[120px] p-3 text-sm bg-muted/30 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
          />
        </div>
      )}
    </div>
  );
}

export function NotesMode({ notes, onUpdateNote, assessments, onUpdateAssessments, recommendations, onUpdateRecommendations, diagnoses, onUpdateDiagnoses, collateralInterviews, goals, onUpdateGoals, nilGoals, onToggleNilGoals, clientName, ndisNumber, clinicianProfile }: NotesModeProps) {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="bg-card border border-border/50 rounded-lg shadow-sm overflow-hidden">
        {TEMPLATE_SECTIONS.map((section) => (
          <div key={section.id}>
            {/* Assessments section */}
            {section.id === "assessments" && (
              <AssessmentsSection
                assessments={assessments}
                onUpdateAssessments={onUpdateAssessments}
              />
            )}

            {/* Recommendations section */}
            {section.id === "recommendations" && (
              <RecommendationsSection
                recommendations={recommendations}
                onUpdateRecommendations={onUpdateRecommendations}
              />
            )}

            {/* Diagnoses section — replaced with DiagnosisPicker */}
            {section.id === "diagnoses" && (
              <DiagnosisPicker
                diagnoses={diagnoses}
                onUpdateDiagnoses={onUpdateDiagnoses}
              />
            )}

            {/* Methodology section — auto-populated aggregator */}
            {section.id === "methodology" && (
              <MethodologyAggregator
                assessments={assessments}
                collateralInterviews={collateralInterviews}
                diagnoses={diagnoses}
                notes={notes}
                onUpdateNote={onUpdateNote}
              />
            )}

            {/* Participant Goals section — dynamic goals builder */}
            {section.id === "participant-goals" && (
              <ParticipantGoals
                goals={goals}
                onUpdateGoals={onUpdateGoals}
                nilGoals={nilGoals}
                onToggleNilGoals={onToggleNilGoals}
                clientName={clientName}
              />
            )}

            {/* Section 1 — Participant & Report Details */}
            {section.id === "participant-details" && (
              <ParticipantReportDetails
                notes={notes}
                onUpdateNote={onUpdateNote}
                clientName={clientName}
                ndisNumber={ndisNumber}
                clinicianProfile={clinicianProfile}
              />
            )}

            {/* Top-level sections (not functional-capacity, assessments, recommendations, diagnoses, methodology, participant-goals, or participant-details) get a plain textarea */}
            {section.id !== "functional-capacity" && section.id !== "assessments" && section.id !== "recommendations" && section.id !== "diagnoses" && section.id !== "methodology" && section.id !== "participant-goals" && section.id !== "participant-details" && (
              <SectionPanel
                id={section.id}
                number={section.number}
                title={section.title}
                value={notes[section.id] ?? ""}
                onChange={(val) => onUpdateNote(section.id, val)}
              />
            )}

            {/* Functional capacity parent header */}
            {section.id === "functional-capacity" && (
              <div className="border-b border-border/30">
                <div className="w-full flex items-center gap-3 px-5 py-3 text-left">
                  <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 ml-[1.75rem]">
                    {section.number}
                  </span>
                  <span className="text-sm font-semibold text-foreground flex-1">
                    {section.title}
                  </span>
                </div>
              </div>
            )}

            {/* Structured subsections */}
            {"subsections" in section &&
              section.subsections?.map((sub) => (
                <StructuredSubsectionPanel
                  key={sub.id}
                  id={sub.id}
                  number={sub.number}
                  title={sub.title}
                  notes={notes}
                  onUpdateNote={onUpdateNote}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
