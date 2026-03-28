import { useState } from "react";
import type { ReportData } from "@/ai/reportAssembler";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface DownloadReportButtonProps {
  reportData: ReportData;
}

export default function DownloadReportButton({ reportData }: DownloadReportButtonProps) {
  const [status, setStatus] = useState<"idle" | "building" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const sectionKeys = [
    "section1", "section2", "section3", "section4", "section5",
    "section6", "section7", "section8", "section9", "section10",
    "section11", "section12_1", "section12_2", "section12_3",
    "section12_4", "section12_5", "section12_6", "section12_7",
    "section12_8", "section12_9", "section13", "section14",
    "section15", "section16", "section17", "section18", "section19",
  ];

  const completedCount = sectionKeys.filter(
    (key) => {
      const val = (reportData as any)[key];
      return typeof val === "string" && val.trim();
    }
  ).length;

  const totalSections = sectionKeys.length;
  const allComplete = completedCount === totalSections;

  const handleDownload = async () => {
    setStatus("building");
    setErrorMsg("");
    toast.info("Building report document...");

    try {
      const { data, error } = await supabase.functions.invoke("assemble-report", {
        body: {
          participant: reportData.participant,
          clinician: reportData.clinician,
          presentAtAssessment: reportData.presentAtAssessment,
          assessmentSetting: reportData.assessmentSetting,
          sections: {
            section1: reportData.section1 || "",
            section2: reportData.section2 || "",
            section3: reportData.section3 || "",
            section4: reportData.section4 || "",
            section5: reportData.section5 || "",
            section6: reportData.section6 || "",
            section7: reportData.section7 || "",
            section8: reportData.section8 || "",
            section9: reportData.section9 || "",
            section10: reportData.section10 || "",
            section11: reportData.section11 || "",
            section12_1: reportData.section12_1 || "",
            section12_2: reportData.section12_2 || "",
            section12_3: reportData.section12_3 || "",
            section12_4: reportData.section12_4 || "",
            section12_5: reportData.section12_5 || "",
            section12_6: reportData.section12_6 || "",
            section12_7: reportData.section12_7 || "",
            section12_8: reportData.section12_8 || "",
            section12_9: reportData.section12_9 || "",
            section13: reportData.section13 || "",
            section14: reportData.section14 || "",
            section15: reportData.section15 || "",
            section16: reportData.section16 || "",
            section17: reportData.section17 || "",
            section18: reportData.section18 || "",
            section19: reportData.section19 || "",
          },
          assessments: reportData.assessments || [],
          recommendations: reportData.recommendations || [],
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Assembly failed");

      // Decode base64 to binary
      const binaryString = atob(data.file);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName || `FCA_${(reportData.participant?.fullName || "Report").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("done");
      toast.success("Report downloaded!");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      console.error("Download error:", err);
      setErrorMsg(err.message || "Failed to build the report document.");
      setStatus("error");
      toast.error("Failed to download: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="border-2 border-primary rounded-lg overflow-hidden mt-6 mb-6">
      {/* Header */}
      <div className="px-4 py-3.5 bg-primary text-primary-foreground flex justify-between items-center">
        <div>
          <div className="text-base font-bold">Download Report</div>
          <div className="text-xs opacity-80">
            Assemble all approved sections into a formatted .docx file
          </div>
        </div>
        <div
          className={`text-xs font-bold px-3 py-1 rounded-md ${
            allComplete
              ? "bg-green-600 text-white"
              : "bg-yellow-600 text-white"
          }`}
        >
          {completedCount}/{totalSections} sections
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              allComplete ? "bg-green-600" : "bg-primary"
            }`}
            style={{ width: `${(completedCount / totalSections) * 100}%` }}
          />
        </div>

        {/* Warning if incomplete */}
        {!allComplete && (
          <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-md text-xs text-yellow-800 dark:text-yellow-200">
            <strong>{totalSections - completedCount} sections</strong> have not
            been completed yet. You can still download, but incomplete sections
            will show "[Section not yet completed]".
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="px-3 py-2 bg-destructive/10 rounded-md text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Success */}
        {status === "done" && (
          <div className="px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-md text-xs text-green-700 dark:text-green-300 font-semibold flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            Report downloaded successfully. Check your downloads folder.
          </div>
        )}

        {/* Download button */}
        <Button
          onClick={handleDownload}
          disabled={status === "building"}
          className="w-full"
          size="lg"
        >
          {status === "building" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Building report…
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download .docx Report
            </>
          )}
        </Button>

        {/* File name preview */}
        <div className="text-[11px] text-muted-foreground text-center">
          File: FCA_{(reportData.participant?.fullName || "Participant").replace(/\s+/g, "_")}
          _{reportData.clinician?.dateOfReport || new Date().toISOString().slice(0, 10)}.docx
        </div>
      </div>
    </div>
  );
}
