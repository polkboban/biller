import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Wand2, AlertTriangle } from "lucide-react";
import {
  SCALAR_FIELDS,
  formatMoney,
  reconcile,
  type BillFields,
  type ScalarFieldKey,
} from "@/lib/bill-schema";

type Candidate = { model: string; label: string; parsed: BillFields | null; error: string | null; latencyMs: number | null };

function display(value: unknown, type: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return formatMoney(Number(value));
  return String(value);
}

function same(a: unknown, b: unknown, type: string): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (type === "money") return Math.abs(Number(a) - Number(b)) < 0.005;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export function FieldComparison({
  fields,
  candidates,
  onChange,
}: {
  fields: BillFields;
  candidates: Candidate[];
  onChange: (next: BillFields) => void;
}) {
  const [openItems, setOpenItems] = useState(true);
  const check = reconcile(fields);

  const setField = (key: ScalarFieldKey, raw: string, type: string) => {
    const value =
      raw === ""
        ? null
        : type === "money"
          ? Number.isFinite(Number(raw))
            ? Number(raw)
            : null
          : raw;
    onChange({ ...fields, [key]: value } as BillFields);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-px border-b border-border bg-border text-xs uppercase tracking-wide text-muted-foreground">
          <div className="bg-secondary px-3 py-2">Field</div>
          {candidates.map((c) => (
            <div key={c.model} className="bg-secondary px-3 py-2">
              {c.label}
              {c.latencyMs ? <span className="num ml-1 normal-case opacity-60">{(c.latencyMs / 1000).toFixed(1)}s</span> : null}
            </div>
          ))}
          {candidates.length < 2
            ? Array.from({ length: 2 - candidates.length }).map((_, i) => (
                <div key={i} className="bg-secondary px-3 py-2" />
              ))
            : null}
          <div className="bg-secondary px-3 py-2 text-primary">Final record</div>
        </div>

        {SCALAR_FIELDS.map((f) => {
          const values = candidates.map((c) => c.parsed?.[f.key] ?? null);
          const agree =
            values.length === 2 && same(values[0], values[1], f.type) && values[0] !== null;
          return (
            <div
              key={f.key}
              className="grid grid-cols-[1fr_1fr_1fr_1.1fr] items-center gap-px border-b border-border/60 bg-card text-sm last:border-0"
            >
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                {f.label}
                {agree ? <Check className="size-3.5 text-emerald-600" /> : null}
              </div>
              {candidates.map((c, i) => {
                const v = values[i];
                const isFinal = same(v, fields[f.key], f.type);
                return (
                  <button
                    key={c.model}
                    type="button"
                    disabled={v === null}
                    onClick={() => onChange({ ...fields, [f.key]: v } as BillFields)}
                    className={`px-3 py-2 text-left transition-colors disabled:cursor-default ${
                      isFinal && v !== null
                        ? "bg-accent/60"
                        : v === null
                          ? "text-muted-foreground/50"
                          : "hover:bg-secondary"
                    } ${!agree && v !== null ? "font-medium" : ""}`}
                  >
                    <span className={f.type === "money" ? "num" : ""}>{display(v, f.type)}</span>
                  </button>
                );
              })}
              {candidates.length < 2
                ? Array.from({ length: 2 - candidates.length }).map((_, i) => <div key={i} />)
                : null}
              <div className="px-2 py-1">
                <Input
                  value={fields[f.key] === null || fields[f.key] === undefined ? "" : String(fields[f.key])}
                  onChange={(e) => setField(f.key, e.target.value, f.type)}
                  className={`h-8 border-transparent bg-transparent focus-visible:border-input ${f.type === "money" ? "num text-right" : ""}`}
                  placeholder="—"
                />
              </div>
            </div>
          );
        })}
      </div>

      {!check.ok && check.expected !== null ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Totals don&apos;t reconcile: items + tax + charges − discount ={" "}
            <span className="num">{formatMoney(check.expected)}</span>, but the grand total reads{" "}
            <span className="num">{formatMoney(fields.grand_total)}</span> (off by{" "}
            <span className="num">{formatMoney(check.diff)}</span>).
          </span>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setOpenItems((v) => !v)}
          className="mb-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Wand2 className="size-4" />
          Line items ({fields.line_items.length}) — {openItems ? "hide" : "show"}
        </button>
        {openItems ? (
          <div className="grid gap-4 md:grid-cols-2">
            {candidates.map((c) => (
              <div key={c.model} className="rounded-md border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{c.label}</span>
                  {c.parsed?.confidence !== null && c.parsed?.confidence !== undefined ? (
                    <Badge variant="secondary" className="num">
                      {Math.round(c.parsed.confidence * 100)}% confident
                    </Badge>
                  ) : null}
                </div>
                {c.error ? (
                  <p className="text-sm text-destructive">{c.error}</p>
                ) : !c.parsed?.line_items.length ? (
                  <p className="text-sm text-muted-foreground">No line items read.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {c.parsed.line_items.map((li, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-1 pr-2">{li.description || "—"}</td>
                          <td className="num py-1 pr-2 text-right text-muted-foreground">{li.qty ?? ""}</td>
                          <td className="num py-1 text-right">{formatMoney(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!c.parsed?.line_items.length}
                  onClick={() => onChange({ ...fields, line_items: c.parsed?.line_items ?? [] })}
                >
                  Use these line items
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
