import { useState } from "react";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { getSubsectionConfig, type SubsectionField } from "@/lib/subsection-fields";
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
        <input
          type="text"
          value={notes[noteKey] || ""}
          onChange={(e) => onUpdateNote(noteKey, e.target.value)}
          placeholder={field.placeholder}
          className="flex-1 h-9 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
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
        (f) =>
          notes[`${id}__${f.id}__notes`]?.trim() ||
          notes[`${id}__${f.id}__rating`]?.trim()
      )
    : (notes[id] ?? "").trim().length > 0;

  return (
    <div className="ml-6 border-b border-border/30 last:border-b-0">
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
  const hasContent = value?.trim().length > 0;

  return (
    <div className="border-b border-border/30 last:border-b-0">
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

export function NotesMode({ notes, onUpdateNote }: NotesModeProps) {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="bg-card border border-border/50 rounded-lg shadow-sm overflow-hidden">
        {TEMPLATE_SECTIONS.map((section) => (
          <div key={section.id}>
            {/* Top-level sections (not functional-capacity parent) get a plain textarea */}
            {section.id !== "functional-capacity" && (
              <SectionPanel
                id={section.id}
                number={section.number}
                title={section.title}
                value={notes[section.id] ?? ""}
                onChange={(val) => onUpdateNote(section.id, val)}
              />
            )}

            {/* Functional capacity parent header (no textarea, just header) */}
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
