import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_AID_OPTIONS,
  FREQUENCY_OPTIONS,
  MEDICATION_CATEGORIES,
  MEDICATION_LIBRARY,
  instantiateMedication,
  type MedicationInstance,
  type MedicationLibraryEntry,
} from "@/lib/medication-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Section 6a · Current Medications ─────────────────────────────────────
 * Searchable picker over ~210 commonly prescribed AU medications. The same
 * library entry can be added more than once (each becomes its own instance
 * with a unique instanceId). Per-participant fields (brand, strength,
 * quantity, frequency, timing, indication, admin aid, notes) are stored on
 * the MedicationInstance and persisted via the report `notes.__medications__`
 * key. Visual language follows DiagnosisPicker.
 */

interface MedicationPickerProps {
  medications: MedicationInstance[];
  onUpdateMedications: (next: MedicationInstance[]) => void;
  disabled?: boolean;
}

function SearchDropdown({
  onSelect,
  disabled,
}: {
  onSelect: (entry: MedicationLibraryEntry) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    let items = MEDICATION_LIBRARY;
    if (selectedCategory) items = items.filter((m) => m.category === selectedCategory);
    if (!query.trim()) return items.slice(0, 30);
    const terms = query.toLowerCase().trim().split(/\s+/);
    return items
      .map((m) => {
        const searchText = `${m.generic} ${m.brands.join(" ")} ${m.drugClass} ${m.category} ${m.commonIndication}`.toLowerCase();
        let score = 0;
        let allMatch = true;
        for (const term of terms) {
          if (!searchText.includes(term)) {
            allMatch = false;
            break;
          }
          if (m.generic.toLowerCase().includes(term)) score += 10;
          if (m.brands.some((b) => b.toLowerCase().includes(term))) score += 8;
          score += 1;
        }
        return { entry: m, score, allMatch };
      })
      .filter((x) => x.allMatch)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)
      .map((x) => x.entry);
  }, [query, selectedCategory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0 && filtered[highlightIndex]) {
      e.preventDefault();
      onSelect(filtered[highlightIndex]);
      setQuery("");
      setShowResults(false);
      setHighlightIndex(-1);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && resultsRef.current) {
      const el = resultsRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  return (
    <div className="relative">
      {/* Category filters */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setSelectedCategory(null);
            setShowResults(true);
          }}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors disabled:opacity-50",
            !selectedCategory
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30",
          )}
        >
          All
        </button>
        {MEDICATION_CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat}
            disabled={disabled}
            onClick={() => {
              setSelectedCategory(selectedCategory === cat ? null : cat);
              setShowResults(true);
            }}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded border font-medium transition-colors disabled:opacity-50",
              selectedCategory === cat
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <Input
        ref={inputRef}
        type="text"
        placeholder="Search by generic name, brand (Endone, Lyrica…), drug class, or indication"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => setShowResults(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="text-sm"
      />

      {showResults && filtered.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[360px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg"
        >
          {filtered.map((m, idx) => (
            <div
              key={m.id}
              onClick={() => {
                onSelect(m);
                setQuery("");
                setShowResults(false);
                setHighlightIndex(-1);
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={cn(
                "px-3 py-2 cursor-pointer border-b border-border/20 transition-colors",
                idx === highlightIndex
                  ? "bg-accent/30"
                  : idx % 2 === 0
                    ? "bg-background"
                    : "bg-muted/20",
              )}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground leading-snug">
                    {m.generic}
                    {m.brands.length > 0 && (
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        ({m.brands.slice(0, 2).join(", ")}
                        {m.brands.length > 2 ? "…" : ""})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    {m.drugClass} · {m.commonIndication}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 items-start">
                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                    {m.defaultStrength}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{m.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && query && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 p-3 bg-popover border border-border rounded-md text-sm text-muted-foreground text-center">
          No medications found for "{query}". Use "Add custom medication" below.
        </div>
      )}

      {showResults && (
        <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />
      )}
    </div>
  );
}

function CustomMedicationForm({
  onAdd,
  disabled,
}: {
  onAdd: (entry: MedicationLibraryEntry) => void;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [generic, setGeneric] = useState("");
  const [brand, setBrand] = useState("");
  const [drugClass, setDrugClass] = useState("");
  const [strength, setStrength] = useState("");
  const [quantity, setQuantity] = useState("1 tablet");
  const [frequency, setFrequency] = useState("Once daily");
  const [indication, setIndication] = useState("");
  const [route, setRoute] = useState("Oral");

  const handleAdd = () => {
    if (!generic.trim()) return;
    onAdd({
      id: "custom_med_" + Date.now(),
      generic: generic.trim(),
      brands: brand.trim() ? [brand.trim()] : [],
      drugClass: drugClass.trim() || "Unspecified",
      category: "Other / Custom",
      defaultStrength: strength.trim() || "",
      defaultQuantity: quantity.trim() || "1 tablet",
      defaultFrequency: frequency,
      commonIndication: indication.trim() || "",
      route: route.trim() || "Oral",
      isCustom: true,
    });
    setGeneric("");
    setBrand("");
    setDrugClass("");
    setStrength("");
    setQuantity("1 tablet");
    setFrequency("Once daily");
    setIndication("");
    setRoute("Oral");
    setShow(false);
  };

  if (!show) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShow(true)}
        className="w-full mt-2 p-2 text-xs text-muted-foreground border border-dashed border-border rounded-md hover:border-foreground/30 hover:text-foreground transition-colors text-center disabled:opacity-50"
      >
        + Add Custom Medication (not in library)
      </button>
    );
  }

  return (
    <div className="mt-2 border border-yellow-300/50 rounded-lg p-3 bg-yellow-50/30 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-yellow-700">Custom Medication</span>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Generic Name *
          </label>
          <Input
            value={generic}
            onChange={(e) => setGeneric(e.target.value)}
            placeholder="e.g. Avloire"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Brand
          </label>
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Tegretol"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Drug Class
          </label>
          <Input
            value={drugClass}
            onChange={(e) => setDrugClass(e.target.value)}
            placeholder="e.g. Anti-epileptic"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Strength
          </label>
          <Input
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            placeholder="e.g. 200mg"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Quantity
          </label>
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 1 tablet"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Frequency
          </label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Route
          </label>
          <Input
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder="e.g. Oral"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Indication
          </label>
          <Input
            value={indication}
            onChange={(e) => setIndication(e.target.value)}
            placeholder="e.g. Schizoaffective disorder"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <Button size="sm" onClick={handleAdd} disabled={!generic.trim()} className="h-7 text-xs">
        Add Custom Medication
      </Button>
    </div>
  );
}

function MedicationCard({
  medication,
  onUpdate,
  onRemove,
  disabled,
}: {
  medication: MedicationInstance;
  onUpdate: (patch: Partial<MedicationInstance>) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCustomFreq = !FREQUENCY_OPTIONS.includes(medication.frequency);
  const brandDisplay =
    medication.chosenBrand || (medication.brands && medication.brands[0]) || "";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="px-3 py-2.5 flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-foreground leading-snug">
              {brandDisplay && brandDisplay !== medication.generic
                ? brandDisplay
                : medication.generic}
            </span>
            {brandDisplay && brandDisplay !== medication.generic && (
              <span className="text-xs text-muted-foreground font-normal">
                ({medication.generic})
              </span>
            )}
          </div>
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
              {medication.strength || "—"}
            </span>
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-600">
              {medication.quantity || "—"}
            </span>
            <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-foreground">
              {medication.frequency || "—"}
              {medication.timing ? ` · ${medication.timing}` : ""}
            </span>
            <span className="text-[11px] text-muted-foreground">{medication.drugClass}</span>
          </div>
          {medication.indication && (
            <div className="text-[11px] text-muted-foreground mt-1 italic">
              For: {medication.indication}
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded((s) => !s)}
            title={expanded ? "Hide details" : "Edit"}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
            disabled={disabled}
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-3">
          {/* Brand */}
          {medication.brands && medication.brands.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Brand prescribed
              </label>
              <Select
                value={medication.chosenBrand || "__generic__"}
                onValueChange={(v) =>
                  onUpdate({ chosenBrand: v === "__generic__" ? "" : v })
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__generic__" className="text-xs">
                    — Generic only —
                  </SelectItem>
                  {medication.brands.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Strength + Quantity */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Strength
              </label>
              <Input
                value={medication.strength}
                onChange={(e) => onUpdate({ strength: e.target.value })}
                placeholder="e.g. 200mg"
                className="h-8 text-xs font-mono"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Quantity per dose
              </label>
              <Input
                value={medication.quantity}
                onChange={(e) => onUpdate({ quantity: e.target.value })}
                placeholder="e.g. 1 tablet, 2 puffs"
                className="h-8 text-xs"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Frequency + Timing */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Frequency
              </label>
              <Select
                value={isCustomFreq ? "Other (custom)" : medication.frequency}
                onValueChange={(v) => {
                  if (v === "Other (custom)") onUpdate({ frequency: "" });
                  else onUpdate({ frequency: v });
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCustomFreq && (
                <Input
                  value={medication.frequency}
                  onChange={(e) => onUpdate({ frequency: e.target.value })}
                  placeholder="e.g. Two tablets three times a day"
                  className="h-8 text-xs mt-1"
                  disabled={disabled}
                />
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Timing / Days (optional)
              </label>
              <Input
                value={medication.timing}
                onChange={(e) => onUpdate({ timing: e.target.value })}
                placeholder="e.g. at 7pm; Mon/Wed/Fri"
                className="h-8 text-xs"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Indication */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Indication (what is this prescribed for?)
            </label>
            <Input
              value={medication.indication}
              onChange={(e) => onUpdate({ indication: e.target.value })}
              placeholder="e.g. Schizoaffective disorder"
              className="h-8 text-xs"
              disabled={disabled}
            />
          </div>

          {/* Admin aid */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Administration aid
            </label>
            <Select
              value={medication.adminAid || "None"}
              onValueChange={(v) => onUpdate({ adminAid: v })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_AID_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a} className="text-xs">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Clinical notes (adherence, side-effects, monitoring)
            </label>
            <textarea
              rows={2}
              value={medication.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="e.g. Inconsistent adherence flagged by support worker; requires reminders and supervision."
              className="w-full px-3 py-2 text-xs bg-muted/20 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50"
              disabled={disabled}
            />
          </div>

          <div className="text-[10px] text-muted-foreground">
            Route: <strong>{medication.route}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export function MedicationPicker({
  medications,
  onUpdateMedications,
  disabled,
}: MedicationPickerProps) {
  const [showSearch, setShowSearch] = useState(false);

  const addMedication = (entry: MedicationLibraryEntry) => {
    onUpdateMedications([...medications, instantiateMedication(entry)]);
    // Keep search panel open for rapid multi-add (matches DiagnosisPicker UX)
  };

  const updateMedication = (instanceId: string, patch: Partial<MedicationInstance>) => {
    onUpdateMedications(
      medications.map((m) => (m.instanceId === instanceId ? { ...m, ...patch } : m)),
    );
  };

  const removeMedication = (instanceId: string) => {
    onUpdateMedications(medications.filter((m) => m.instanceId !== instanceId));
  };

  return (
    <div className="border-b border-border/30">
      {/* Section header — matches DiagnosisPicker pattern */}
      <div className="w-full flex items-center gap-3 px-5 py-3 text-left">
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 ml-[1.75rem]">
          6a
        </span>
        <span className="text-sm font-semibold text-foreground flex-1">Current Medications</span>
      </div>

      <div className="px-5 pb-5 pl-[4.5rem] space-y-3">
        {/* Summary + add button */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-3 text-xs items-center">
            <span className="font-semibold">
              {medications.length} medication{medications.length === 1 ? "" : "s"} recorded
            </span>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowSearch((s) => !s)}
            disabled={disabled}
          >
            <Plus className="h-3 w-3 mr-1" />
            {showSearch ? "Close search" : "Add Medication"}
          </Button>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="border border-border rounded-lg p-3 bg-muted/20">
            <SearchDropdown onSelect={addMedication} disabled={disabled} />
            <CustomMedicationForm onAdd={addMedication} disabled={disabled} />
          </div>
        )}

        {/* Empty state */}
        {medications.length === 0 && !showSearch && (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-sm font-medium">No medications recorded yet</div>
            <div className="text-xs mt-1">
              Click <strong>"+ Add Medication"</strong> to search the library or add a custom entry.
            </div>
          </div>
        )}

        {/* Medication cards */}
        {medications.length > 0 && (
          <div className="space-y-2">
            {medications.map((m) => (
              <MedicationCard
                key={m.instanceId}
                medication={m}
                onUpdate={(patch) => updateMedication(m.instanceId, patch)}
                onRemove={() => removeMedication(m.instanceId)}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}