import { useState, useMemo, useRef, useEffect } from "react";
import { DIAGNOSIS_LIBRARY, DIAGNOSIS_CATEGORIES, type DiagnosisInstance } from "@/lib/diagnosis-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Plus, X, Star, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosisPickerProps {
  diagnoses: DiagnosisInstance[];
  onUpdateDiagnoses: (diagnoses: DiagnosisInstance[]) => void;
}

function SearchDropdown({ onSelect, excludeIds }: {
  onSelect: (d: DiagnosisInstance) => void;
  excludeIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    let items = DIAGNOSIS_LIBRARY.filter(d => !excludeIds.has(d.id));
    if (selectedCategory) items = items.filter(d => d.category === selectedCategory);
    if (!query.trim()) return items.slice(0, 20);
    const terms = query.toLowerCase().trim().split(/\s+/);
    return items
      .map(d => {
        const searchText = `${d.name} ${d.icd10} ${d.dsm5 || ""} ${d.category} ${d.description}`.toLowerCase();
        let score = 0;
        let allMatch = true;
        for (const term of terms) {
          if (!searchText.includes(term)) { allMatch = false; break; }
          if (d.name.toLowerCase().includes(term)) score += 10;
          if (d.icd10.toLowerCase() === term || (d.dsm5 && d.dsm5.toLowerCase() === term)) score += 20;
          score += 1;
        }
        return { ...d, _score: score, _allMatch: allMatch };
      })
      .filter(d => d._allMatch)
      .sort((a, b) => b._score - a._score)
      .slice(0, 15);
  }, [query, excludeIds, selectedCategory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && highlightIndex >= 0 && filtered[highlightIndex]) {
      e.preventDefault();
      onSelect(filtered[highlightIndex]);
      setQuery("");
      setShowResults(false);
      setHighlightIndex(-1);
    } else if (e.key === "Escape") { setShowResults(false); }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && resultsRef.current) {
      const el = resultsRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  return (
    <div className="relative">
      {/* Category filters */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        <button
          onClick={() => { setSelectedCategory(null); setShowResults(true); }}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors",
            !selectedCategory
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
          )}
        >All</button>
        {DIAGNOSIS_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setSelectedCategory(selectedCategory === cat ? null : cat); setShowResults(true); }}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded border font-medium transition-colors",
              selectedCategory === cat
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            )}
          >{cat}</button>
        ))}
      </div>

      <Input
        ref={inputRef}
        type="text"
        placeholder="Search by diagnosis name, ICD-10 code, DSM-5 code, or keyword..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowResults(true); setHighlightIndex(-1); }}
        onFocus={() => setShowResults(true)}
        onKeyDown={handleKeyDown}
        className="text-sm"
      />

      {showResults && filtered.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 z-50 max-h-[360px] overflow-y-auto bg-popover border border-border rounded-b-lg shadow-lg"
        >
          {filtered.map((d, idx) => (
            <div
              key={d.id}
              onClick={() => { onSelect(d); setQuery(""); setShowResults(false); setHighlightIndex(-1); }}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={cn(
                "px-3 py-2 cursor-pointer border-b border-border/20 transition-colors",
                idx === highlightIndex ? "bg-accent/30" : idx % 2 === 0 ? "bg-background" : "bg-muted/20"
              )}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground leading-snug">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{d.description}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">{d.icd10}</span>
                  {d.dsm5 && (
                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">{d.dsm5}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && query && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 p-3 bg-popover border border-border rounded-b-lg text-sm text-muted-foreground text-center">
          No diagnoses found for "{query}". Add a custom diagnosis below.
        </div>
      )}

      {showResults && (
        <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />
      )}
    </div>
  );
}

function CustomDiagnosisForm({ onAdd }: { onAdd: (d: DiagnosisInstance) => void }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [icd10, setIcd10] = useState("");
  const [dsm5, setDsm5] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: "custom_" + Date.now(),
      name: name.trim(),
      icd10: icd10.trim() || "—",
      dsm5: dsm5.trim() || null,
      category: category.trim() || "Other",
      description: description.trim() || "",
      isCustom: true,
    });
    setName(""); setIcd10(""); setDsm5(""); setCategory(""); setDescription("");
    setShow(false);
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full mt-2 p-2 text-xs text-muted-foreground border border-dashed border-border rounded-md hover:border-foreground/30 hover:text-foreground transition-colors text-center"
      >
        + Add Custom Diagnosis (not in library)
      </button>
    );
  }

  return (
    <div className="mt-2 border border-yellow-300/50 rounded-lg p-3 bg-yellow-50/30 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-yellow-700">Custom Diagnosis</span>
        <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Diagnosis Name *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kabuki Syndrome" className="h-8 text-xs" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">ICD-10 Code</label>
          <Input value={icd10} onChange={e => setIcd10(e.target.value)} placeholder="e.g. Q89.8" className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">DSM-5 Code</label>
          <Input value={dsm5} onChange={e => setDsm5(e.target.value)} placeholder="e.g. 299.00" className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Category</label>
          <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Genetic" className="h-8 text-xs" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Plain-English Description</label>
        <textarea
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description for NDIS planners..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
      <Button size="sm" onClick={handleAdd} disabled={!name.trim()} className="h-7 text-xs">
        Add Custom Diagnosis
      </Button>
    </div>
  );
}

function DiagnosisCard({ diagnosis, isPrimary, onRemove, onMakePrimary, onUpdateDescription }: {
  diagnosis: DiagnosisInstance;
  isPrimary: boolean;
  onRemove: () => void;
  onMakePrimary: () => void;
  onUpdateDescription: (desc: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden mb-2 transition-colors",
      isPrimary ? "border-foreground/40 bg-muted/20" : "border-border bg-background"
    )}>
      <div className="px-3 py-2.5 flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isPrimary && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-foreground text-background uppercase tracking-wider">
                Primary
              </span>
            )}
            <span className="text-sm font-bold text-foreground leading-snug">{diagnosis.name}</span>
          </div>
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
              ICD-10: {diagnosis.icd10}
            </span>
            {diagnosis.dsm5 && (
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-600">
                DSM-5: {diagnosis.dsm5}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">{diagnosis.category}</span>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {!isPrimary && (
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onMakePrimary} title="Set as primary">
              <Star className="h-3 w-3" />
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            <Info className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30 pt-2">
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Plain-English Description (for NDIS Planners)
          </label>
          <textarea
            rows={3}
            value={diagnosis.description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-muted/20 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            This description will appear in Section 6 of the report. Edit to match this participant's specific presentation.
          </p>
        </div>
      )}
    </div>
  );
}

export function DiagnosisPicker({ diagnoses, onUpdateDiagnoses }: DiagnosisPickerProps) {
  const [showSearch, setShowSearch] = useState(false);
  const selectedIds = useMemo(() => new Set(diagnoses.map(d => d.id)), [diagnoses]);

  const primaryDx = diagnoses.find(d => d.isPrimary);
  const primaryId = primaryDx?.id || (diagnoses.length > 0 ? diagnoses[0].id : null);

  const addDiagnosis = (d: DiagnosisInstance) => {
    const newDx = { ...d, isPrimary: diagnoses.length === 0 };
    onUpdateDiagnoses([...diagnoses, newDx]);
    setShowSearch(false);
  };

  const removeDiagnosis = (id: string) => {
    const remaining = diagnoses.filter(d => d.id !== id);
    // If removed was primary, make first remaining primary
    if (remaining.length > 0 && !remaining.some(d => d.isPrimary)) {
      remaining[0] = { ...remaining[0], isPrimary: true };
    }
    onUpdateDiagnoses(remaining);
  };

  const makePrimary = (id: string) => {
    onUpdateDiagnoses(diagnoses.map(d => ({ ...d, isPrimary: d.id === id })));
  };

  const updateDescription = (id: string, desc: string) => {
    onUpdateDiagnoses(diagnoses.map(d => d.id === id ? { ...d, description: desc } : d));
  };

  const sortedDiagnoses = useMemo(() => {
    return [...diagnoses].sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return 0;
    });
  }, [diagnoses]);

  return (
    <div className="border-b border-border/30">
      {/* Section header */}
      <div className="w-full flex items-center gap-3 px-5 py-3 text-left">
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 ml-[1.75rem]">6</span>
        <span className="text-sm font-semibold text-foreground flex-1">Diagnoses</span>
      </div>

      <div className="px-5 pb-5 pl-[4.5rem] space-y-3">
        {/* Summary + add button */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-3 text-xs items-center">
            <span className="font-semibold">{diagnoses.length} diagnosis{diagnoses.length !== 1 ? "es" : ""} selected</span>
            {primaryDx && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Primary: <strong>{primaryDx.name.split("—")[0].trim()}</strong></span>
              </>
            )}
            {diagnoses.length === 0 && (
              <span className="text-destructive font-medium">At least one diagnosis required</span>
            )}
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={() => setShowSearch(!showSearch)}>
            <Plus className="h-3 w-3 mr-1" /> Add Diagnosis
          </Button>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="border border-border rounded-lg p-3 bg-muted/20">
            <SearchDropdown
              onSelect={addDiagnosis}
              excludeIds={selectedIds}
            />
            <CustomDiagnosisForm onAdd={addDiagnosis} />
          </div>
        )}

        {/* Empty state */}
        {diagnoses.length === 0 && !showSearch && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-3xl mb-2">🏥</div>
            <div className="text-sm font-medium">No diagnoses added yet</div>
            <div className="text-xs mt-1">Click <strong>"+ Add Diagnosis"</strong> to search and select diagnoses.</div>
          </div>
        )}

        {/* Diagnosis cards */}
        {sortedDiagnoses.map(d => (
          <DiagnosisCard
            key={d.id}
            diagnosis={d}
            isPrimary={d.id === primaryId}
            onRemove={() => removeDiagnosis(d.id)}
            onMakePrimary={() => makePrimary(d.id)}
            onUpdateDescription={(desc) => updateDescription(d.id, desc)}
          />
        ))}
      </div>
    </div>
  );
}
