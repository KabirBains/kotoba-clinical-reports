import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { FileText } from "lucide-react";

interface ReportModeProps {
  reportContent: Record<string, string>;
}

export function ReportMode({ reportContent }: ReportModeProps) {
  const hasContent = Object.values(reportContent).some((v) => typeof v === 'string' && v.trim());

  if (!hasContent) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center text-muted-foreground">
        <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-2">No report generated yet</h2>
        <p className="text-sm max-w-md mx-auto">
          Switch to Notes mode and fill in your clinical notes, then click "Generate full report"
          to create a professionally formatted FCA report.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
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
    </div>
  );
}
