import { useState } from "react";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotesModeProps {
  notes: Record<string, string>;
  onUpdateNote: (sectionId: string, value: string) => void;
}

function SectionPanel({
  id,
  number,
  title,
  value,
  onChange,
  indent = false,
}: {
  id: string;
  number: string;
  title: string;
  value: string;
  onChange: (val: string) => void;
  indent?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const hasContent = value?.trim().length > 0;

  return (
    <div className={cn("border-b border-border/30 last:border-b-0", indent && "ml-6")}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">{number}</span>
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

export function NotesMode({ notes, onUpdateNote }: NotesModeProps) {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="bg-card border border-border/50 rounded-lg shadow-sm overflow-hidden">
        {TEMPLATE_SECTIONS.map((section) => (
          <div key={section.id}>
            <SectionPanel
              id={section.id}
              number={section.number}
              title={section.title}
              value={notes[section.id] ?? ""}
              onChange={(val) => onUpdateNote(section.id, val)}
            />
            {"subsections" in section &&
              section.subsections?.map((sub) => (
                <SectionPanel
                  key={sub.id}
                  id={sub.id}
                  number={sub.number}
                  title={sub.title}
                  value={notes[sub.id] ?? ""}
                  onChange={(val) => onUpdateNote(sub.id, val)}
                  indent
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
