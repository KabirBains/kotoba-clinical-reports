import { SUBSECTION_FIELDS, type SubsectionConfig } from "@/lib/subsection-fields";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface DomainRow {
  label: string;
  rating: string;
  observation: string;
}

interface DomainTable {
  number: string;
  title: string;
  rows: DomainRow[];
}

/**
 * Extract structured domain data from the flat notes map.
 * Compound keys follow: {subsectionId}__{fieldId}__rating / __notes
 */
export function buildFunctionalCapacityTables(
  notes: Record<string, string>
): DomainTable[] {
  const section14 = TEMPLATE_SECTIONS.find((s) => s.id === "functional-capacity");
  if (!section14 || !("subsections" in section14)) return [];

  const tables: DomainTable[] = [];

  for (const sub of section14.subsections) {
    const config: SubsectionConfig | undefined = SUBSECTION_FIELDS.find(
      (c) => c.subsectionId === sub.id
    );
    if (!config) continue;

    const rows: DomainRow[] = [];

    for (const field of config.fields) {
      const rating = notes[`${sub.id}__${field.id}__rating`] || "";
      const observation = notes[`${sub.id}__${field.id}__notes`] || "";

      // Include row if any data exists; otherwise mark "Not documented"
      if (rating || observation) {
        rows.push({ label: field.label, rating: rating || "—", observation: observation || "—" });
      } else {
        rows.push({ label: field.label, rating: "Not documented", observation: "Not documented" });
      }
    }

    // Only include subsection if at least one row has real data
    const hasData = rows.some(
      (r) => r.rating !== "Not documented" || r.observation !== "Not documented"
    );
    if (hasData) {
      tables.push({ number: sub.number, title: sub.title, rows });
    }
  }

  return tables;
}

/** Render Section 14 as clinical summary tables in Report Mode */
export function FunctionalCapacityReport({
  notes,
}: {
  notes: Record<string, string>;
}) {
  const tables = buildFunctionalCapacityTables(notes);

  if (tables.length === 0) return null;

  return (
    <div className="space-y-8">
      <h2 className="text-base font-semibold text-foreground border-b border-border/30 pb-2">
        14. Functional Capacity — Domain Observations
      </h2>

      {tables.map((domain) => (
        <div key={domain.number} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground/80">
            {domain.number} {domain.title}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Task / Area</TableHead>
                <TableHead className="w-[25%]">Functional Level</TableHead>
                <TableHead>Observations / Support Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domain.rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>{row.rating}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{row.observation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
