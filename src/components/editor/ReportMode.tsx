import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { FileText } from "lucide-react";
import DownloadReportButton from "@/components/DownloadReportButton";
import type { ReportData } from "@/ai/reportAssembler";
import { type AssessmentInstance } from "@/lib/assessment-library";
import { type RecommendationInstance } from "@/lib/recommendations-library";

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
    section12_1: s("mobility"),
    section12_2: s("transfers"),
    section12_3: s("personal-adls"),
    section12_4: s("domestic-iadls"),
    section12_5: s("executive-iadls"),
    section12_6: s("cognition"),
    section12_7: s("communication"),
    section12_8: s("social-functioning"),
    section12_9: s("sensory-profile"),
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
    recommendations: recommendations.map((r) => ({
      support: typeof r.name === "string" ? r.name : "",
      category: typeof r.category === "string" ? r.category : "",
      currentHours: typeof r.currentHours === "string" ? r.currentHours : "",
      recommendedHours: typeof r.recommendedHours === "string" ? r.recommendedHours : "",
      ratio: typeof r.ratio === "string" ? r.ratio : "",
      tasks: Array.isArray(r.tasks) ? r.tasks.filter(Boolean).join(", ") : "",
      linkedSections: typeof r.linkedSections === "string" ? r.linkedSections : "",
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
