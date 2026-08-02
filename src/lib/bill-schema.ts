/** Shared, browser-safe types + normalisers for handwritten Indian bill extraction. */

export type LineItem = {
  description: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
};

export type BillFields = {
  vendor_name: string | null;
  vendor_gstin: string | null;
  bill_number: string | null;
  bill_date: string | null; // ISO yyyy-mm-dd
  line_items: LineItem[];
  subtotal: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  other_charges: number | null;
  discount: number | null;
  grand_total: number | null;
  currency: string | null;
  payment_mode: string | null;
  confidence: number | null;
};

export const MODELS = [
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    blurb: "Strong on messy handwriting and regional scripts",
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    blurb: "Strong on totals and tax arithmetic",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const SCALAR_FIELDS = [
  { key: "vendor_name", label: "Vendor name", type: "text" },
  { key: "vendor_gstin", label: "Vendor GSTIN", type: "text" },
  { key: "bill_number", label: "Bill number", type: "text" },
  { key: "bill_date", label: "Bill date", type: "date" },
  { key: "subtotal", label: "Subtotal", type: "money" },
  { key: "cgst_amount", label: "CGST", type: "money" },
  { key: "sgst_amount", label: "SGST", type: "money" },
  { key: "igst_amount", label: "IGST", type: "money" },
  { key: "other_charges", label: "Other charges", type: "money" },
  { key: "discount", label: "Discount", type: "money" },
  { key: "grand_total", label: "Grand total", type: "money" },
  { key: "currency", label: "Currency", type: "text" },
  { key: "payment_mode", label: "Payment mode", type: "text" },
] as const;

export type ScalarFieldKey = (typeof SCALAR_FIELDS)[number]["key"];

export const emptyFields = (): BillFields => ({
  vendor_name: null,
  vendor_gstin: null,
  bill_number: null,
  bill_date: null,
  line_items: [],
  subtotal: null,
  cgst_amount: null,
  sgst_amount: null,
  igst_amount: null,
  other_charges: null,
  discount: null,
  grand_total: null,
  currency: "INR",
  payment_mode: null,
  confidence: null,
});

/** Parses Indian-style money strings: "₹ 1,23,456.50", "Rs.450/-", "1 250". */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[₹$]|rs\.?|inr/gi, "")
    .replace(/\/-\s*$/, "")
    .replace(/[,\s]/g, "")
    .trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Normalises Indian date formats (DD/MM/YYYY, DD-MM-YY, 12 Aug 2024) to ISO. */
export function parseIndianDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  const numeric = raw.match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2,4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += year > 70 ? 1900 : 2000;
    return build(year, month, day);
  }

  const worded = raw.match(/^(\d{1,2})[\s\-]*([A-Za-z]{3,9})[\s\-,]*(\d{2,4})$/);
  if (worded) {
    const day = Number(worded[1]);
    const month = MONTHS[worded[2]!.slice(0, 4).toLowerCase()] ?? MONTHS[worded[2]!.slice(0, 3).toLowerCase()];
    let year = Number(worded[3]);
    if (year < 100) year += year > 70 ? 1900 : 2000;
    if (month) return build(year, month, day);
  }
  return null;
}

function build(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function str(v: unknown): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(n\/?a|none|null|unknown|-)$/i.test(t)) return null;
  return t;
}

/** Coerces whatever a model returned into the canonical BillFields shape. */
export function normalizeFields(raw: unknown): BillFields {
  const out = emptyFields();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  out.vendor_name = str(r["vendor_name"] ?? r["vendor"]);
  out.vendor_gstin = str(r["vendor_gstin"] ?? r["gstin"])?.toUpperCase().replace(/\s/g, "") ?? null;
  out.bill_number = str(r["bill_number"] ?? r["invoice_number"]);
  out.bill_date = parseIndianDate(r["bill_date"] ?? r["date"]);
  out.subtotal = parseMoney(r["subtotal"]);
  out.cgst_amount = parseMoney(r["cgst_amount"]);
  out.sgst_amount = parseMoney(r["sgst_amount"]);
  out.igst_amount = parseMoney(r["igst_amount"]);
  out.other_charges = parseMoney(r["other_charges"]);
  out.discount = parseMoney(r["discount"]);
  out.grand_total = parseMoney(r["grand_total"] ?? r["total"]);
  out.currency = str(r["currency"])?.toUpperCase() ?? "INR";
  out.payment_mode = str(r["payment_mode"]);
  const conf = typeof r["confidence"] === "number" ? r["confidence"] : null;
  out.confidence = conf === null ? null : Math.max(0, Math.min(1, conf));

  const items = r["line_items"];
  if (Array.isArray(items)) {
    out.line_items = items.slice(0, 60).map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      return {
        description: str(o["description"] ?? o["item"] ?? o["name"]) ?? "",
        qty: parseMoney(o["qty"] ?? o["quantity"]),
        rate: parseMoney(o["rate"] ?? o["price"]),
        amount: parseMoney(o["amount"] ?? o["total"]),
      };
    });
  }
  return out;
}

export function totalTax(f: Partial<BillFields>): number {
  return (f.cgst_amount ?? 0) + (f.sgst_amount ?? 0) + (f.igst_amount ?? 0);
}

/** Checks line items + tax + charges - discount ≈ grand total. */
export function reconcile(f: BillFields): {
  ok: boolean;
  expected: number | null;
  diff: number | null;
} {
  const base =
    f.subtotal ??
    (f.line_items.length
      ? f.line_items.reduce((s, i) => s + (i.amount ?? 0), 0)
      : null);
  if (base === null || f.grand_total === null) return { ok: true, expected: null, diff: null };
  const expected = base + totalTax(f) + (f.other_charges ?? 0) - (f.discount ?? 0);
  const diff = Math.round((f.grand_total - expected) * 100) / 100;
  return { ok: Math.abs(diff) <= Math.max(1, Math.abs(expected) * 0.01), expected, diff };
}

export function formatMoney(n: number | null | undefined, currency = "INR"): string {
  if (n === null || n === undefined) return "—";
  const sym = currency === "INR" ? "₹" : "";
  return sym + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
