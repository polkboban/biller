import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getEvaluationData } from "@/lib/bills.functions";
import { buildScores, pct, type ScoredExtraction } from "@/lib/eval-scoring";
import { SCALAR_FIELDS, type BillFields, type LineItem } from "@/lib/bill-schema";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/evaluate")({
  head: () => ({
    meta: [
      { title: "Model benchmark — Bahi Khata" },
      {
        name: "description",
        content: "Field-level accuracy, line-item precision and latency for each vision model, scored against your reviewed bills.",
      },
      { property: "og:title", content: "Model benchmark — Bahi Khata" },
      { property: "og:description", content: "Which vision model reads handwritten Indian bills best? Scored on your own data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvaluatePage,
});

function EvaluatePage() {
  const fetchEval = useServerFn(getEvaluationData);
  const { data, isLoading } = useQuery({ queryKey: ["evaluation"], queryFn: () => fetchEval() });

  const scores = useMemo(() => {
    if (!data?.bills.length) return [];
    const truths = new Map<string, BillFields>();
    for (const b of data.bills) {
      truths.set(b.id, {
        vendor_name: b.vendor_name,
        vendor_gstin: b.vendor_gstin,
        bill_number: b.bill_number,
        bill_date: b.bill_date,
        line_items: (Array.isArray(b.line_items) ? b.line_items : []) as LineItem[],
        subtotal: n(b.subtotal),
        cgst_amount: n(b.cgst_amount),
        sgst_amount: n(b.sgst_amount),
        igst_amount: n(b.igst_amount),
        other_charges: n(b.other_charges),
        discount: n(b.discount),
        grand_total: n(b.grand_total),
        currency: b.currency,
        payment_mode: b.payment_mode,
        confidence: null,
      });
    }
    const rows: ScoredExtraction[] = data.extractions.map((e) => ({
      billId: e.bill_id,
      model: e.model,
      modelLabel: e.model_label ?? e.model,
      parsed: e.parsed,
      latencyMs: e.latency_ms,
      parseOk: e.parse_ok,
    }));
    return buildScores(rows, truths);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const reviewed = data?.bills.length ?? 0;

  return (
    <div>
      <h1 className="font-display text-4xl">Benchmark</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Every bill you mark reviewed becomes ground truth. Each model is scored against it field by
        field, with money compared at ±1% tolerance and vendor names by fuzzy match.
      </p>

      {!reviewed || !scores.length ? (
        <div className="mt-12 rounded-md border border-dashed border-border p-12 text-center">
          <Gauge className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            No reviewed bills yet. Correct a bill and mark it reviewed to start scoring.
          </p>
          <Button asChild className="mt-4">
            <Link to="/bills">Open the ledger</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {scores.map((s, i) => (
              <div
                key={s.model}
                className={`rounded-md border bg-card p-5 ${i === 0 ? "border-primary" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl">{s.label}</h2>
                  {i === 0 ? <Trophy className="size-5 text-primary" /> : null}
                </div>
                <p className="num mt-3 text-4xl">{pct(s.accuracy)}</p>
                <p className="text-sm text-muted-foreground">field accuracy over {s.bills} bills</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Avg latency" value={s.avgLatencyMs ? `${(s.avgLatencyMs / 1000).toFixed(1)}s` : "—"} />
                  <Stat label="Parse failures" value={String(s.parseFailures)} />
                  <Stat label="Line-item precision" value={pct(s.lineItemPrecision)} />
                  <Stat label="Line-item recall" value={pct(s.lineItemRecall)} />
                  <Stat label="Correct fields" value={String(s.correct)} />
                  <Stat label="Wrong / missed" value={`${s.wrong} / ${s.missed}`} />
                </dl>
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-display text-2xl">Accuracy by field</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  {scores.map((s) => (
                    <th key={s.model} className="px-4 py-2.5 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCALAR_FIELDS.map((f) => (
                  <tr key={f.key} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{f.label}</td>
                    {scores.map((s) => {
                      const p = s.perField[f.key];
                      const graded = p ? p.correct + p.wrong + p.missed : 0;
                      return (
                        <td key={s.model} className="num px-4 py-2 text-right">
                          {graded ? pct(p!.correct / graded) : "—"}
                          <span className="ml-1 text-xs text-muted-foreground">({graded})</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 font-display text-2xl">Where they slipped</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {scores.map((s) => (
              <div key={s.model} className="rounded-md border border-border bg-card p-4">
                <p className="font-medium">{s.label}</p>
                {!s.failures.length ? (
                  <p className="mt-2 text-sm text-muted-foreground">No mismatches recorded.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {s.failures.slice(0, 12).map((f, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2 border-b border-border/50 pb-1.5 last:border-0">
                        <span className="text-muted-foreground">{f.field}:</span>
                        <span className="text-destructive line-through">{f.predicted}</span>
                        <span className="text-emerald-700">{f.truth}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

function n(v: number | null): number | null {
  return v === null || v === undefined ? null : Number(v);
}
