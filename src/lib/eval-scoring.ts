import { SCALAR_FIELDS, type BillFields, type ScalarFieldKey } from "./bill-schema";

const MONEY_KEYS = new Set<ScalarFieldKey>([
  "subtotal",
  "cgst_amount",
  "sgst_amount",
  "igst_amount",
  "other_charges",
  "discount",
  "grand_total",
]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Levenshtein-based similarity, 0..1. */
export function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - d[x.length]![y.length]! / Math.max(x.length, y.length);
}

export type FieldVerdict = "correct" | "wrong" | "missed" | "n/a";

/** Compares one predicted field against the human-confirmed truth. */
export function scoreField(
  key: ScalarFieldKey,
  predicted: unknown,
  truth: unknown,
): FieldVerdict {
  const truthEmpty = truth === null || truth === undefined || truth === "";
  const predEmpty = predicted === null || predicted === undefined || predicted === "";
  if (truthEmpty) return "n/a";
  if (predEmpty) return "missed";

  if (MONEY_KEYS.has(key)) {
    const p = Number(predicted);
    const t = Number(truth);
    if (!Number.isFinite(p) || !Number.isFinite(t)) return "wrong";
    return Math.abs(p - t) <= Math.max(0.5, Math.abs(t) * 0.005) ? "correct" : "wrong";
  }
  if (key === "vendor_name") {
    return similarity(String(predicted), String(truth)) >= 0.85 ? "correct" : "wrong";
  }
  return norm(String(predicted)) === norm(String(truth)) ? "correct" : "wrong";
}

export type LineItemScore = { precision: number; recall: number };

export function scoreLineItems(pred: BillFields["line_items"], truth: BillFields["line_items"]): LineItemScore | null {
  if (!truth.length) return null;
  const remaining = [...truth];
  let hits = 0;
  for (const p of pred) {
    const idx = remaining.findIndex(
      (t) =>
        similarity(p.description, t.description) >= 0.7 &&
        (t.amount === null || p.amount === null || Math.abs((p.amount ?? 0) - (t.amount ?? 0)) <= Math.max(0.5, Math.abs(t.amount) * 0.01)),
    );
    if (idx >= 0) {
      hits++;
      remaining.splice(idx, 1);
    }
  }
  return {
    precision: pred.length ? hits / pred.length : 0,
    recall: hits / truth.length,
  };
}

export type ModelScore = {
  model: string;
  label: string;
  bills: number;
  perField: Record<string, { correct: number; wrong: number; missed: number }>;
  correct: number;
  wrong: number;
  missed: number;
  accuracy: number;
  avgLatencyMs: number | null;
  parseFailures: number;
  lineItemPrecision: number | null;
  lineItemRecall: number | null;
  failures: { billId: string; field: string; predicted: string; truth: string }[];
};

export type ScoredExtraction = {
  billId: string;
  model: string;
  modelLabel: string;
  parsed: BillFields | null;
  latencyMs: number | null;
  parseOk: boolean;
};

export function buildScores(
  extractions: ScoredExtraction[],
  truths: Map<string, BillFields>,
): ModelScore[] {
  const byModel = new Map<string, ScoredExtraction[]>();
  for (const e of extractions) {
    if (!truths.has(e.billId)) continue;
    const list = byModel.get(e.model) ?? [];
    list.push(e);
    byModel.set(e.model, list);
  }

  const out: ModelScore[] = [];
  for (const [model, rows] of byModel) {
    const score: ModelScore = {
      model,
      label: rows[0]?.modelLabel ?? model,
      bills: rows.length,
      perField: {},
      correct: 0,
      wrong: 0,
      missed: 0,
      accuracy: 0,
      avgLatencyMs: null,
      parseFailures: rows.filter((r) => !r.parseOk).length,
      lineItemPrecision: null,
      lineItemRecall: null,
      failures: [],
    };
    for (const f of SCALAR_FIELDS) score.perField[f.key] = { correct: 0, wrong: 0, missed: 0 };

    let latSum = 0;
    let latCount = 0;
    let liP = 0;
    let liR = 0;
    let liN = 0;

    for (const row of rows) {
      const truth = truths.get(row.billId)!;
      if (row.latencyMs) {
        latSum += row.latencyMs;
        latCount++;
      }
      for (const f of SCALAR_FIELDS) {
        const verdict = scoreField(f.key, row.parsed?.[f.key] ?? null, truth[f.key]);
        if (verdict === "n/a") continue;
        score.perField[f.key]![verdict]++;
        score[verdict]++;
        if (verdict !== "correct" && score.failures.length < 60) {
          score.failures.push({
            billId: row.billId,
            field: f.label,
            predicted: String(row.parsed?.[f.key] ?? "—"),
            truth: String(truth[f.key]),
          });
        }
      }
      const li = scoreLineItems(row.parsed?.line_items ?? [], truth.line_items);
      if (li) {
        liP += li.precision;
        liR += li.recall;
        liN++;
      }
    }

    const graded = score.correct + score.wrong + score.missed;
    score.accuracy = graded ? score.correct / graded : 0;
    score.avgLatencyMs = latCount ? Math.round(latSum / latCount) : null;
    score.lineItemPrecision = liN ? liP / liN : null;
    score.lineItemRecall = liN ? liR / liN : null;
    out.push(score);
  }
  return out.sort((a, b) => b.accuracy - a.accuracy);
}

export const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
