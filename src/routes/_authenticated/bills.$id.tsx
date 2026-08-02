import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getBill, saveBillFields, pushToZoho, extractBill, deleteBill } from "@/lib/bills.functions";
import { emptyFields, formatMoney, type BillFields, type LineItem } from "@/lib/bill-schema";
import { FieldComparison } from "@/components/field-comparison";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Send, RefreshCw, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bills/$id")({
  head: () => ({
    meta: [
      { title: "Bill detail — Biller" },
      { name: "description", content: "Compare both model readings of this handwritten bill, correct it, and post it to Zoho Books." },
      { property: "og:title", content: "Bill detail — Biller" },
      { property: "og:description", content: "Field-by-field comparison of two vision models on one handwritten bill." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillDetail,
});

function BillDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchBill = useServerFn(getBill);
  const save = useServerFn(saveBillFields);
  const push = useServerFn(pushToZoho);
  const rerun = useServerFn(extractBill);
  const remove = useServerFn(deleteBill);

  const { data, isLoading } = useQuery({
    queryKey: ["bill", id],
    queryFn: () => fetchBill({ data: { billId: id } }),
  });

  const [fields, setFields] = useState<BillFields>(emptyFields());
  const [busy, setBusy] = useState<null | "save" | "zoho" | "rerun">(null);

  useEffect(() => {
    if (!data?.bill) return;
    const b = data.bill;
    setFields({
      vendor_name: b.vendor_name,
      vendor_gstin: b.vendor_gstin,
      bill_number: b.bill_number,
      bill_date: b.bill_date,
      line_items: (Array.isArray(b.line_items) ? b.line_items : []) as LineItem[],
      subtotal: num(b.subtotal),
      cgst_amount: num(b.cgst_amount),
      sgst_amount: num(b.sgst_amount),
      igst_amount: num(b.igst_amount),
      other_charges: num(b.other_charges),
      discount: num(b.discount),
      grand_total: num(b.grand_total),
      currency: b.currency ?? "INR",
      payment_mode: b.payment_mode,
      confidence: null,
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">That bill no longer exists.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/bills">Back to ledger</Link>
        </Button>
      </div>
    );
  }

  const bill = data.bill;
  const candidates = data.extractions.map((e) => ({
    model: e.model,
    label: e.model_label ?? e.model,
    parsed: e.parsed,
    error: e.error,
    latencyMs: e.latency_ms,
  }));

  const doSave = async (markReviewed: boolean) => {
    setBusy("save");
    try {
      await save({ data: { billId: id, fields, markReviewed } });
      await qc.invalidateQueries({ queryKey: ["bill", id] });
      await qc.invalidateQueries({ queryKey: ["bills"] });
      toast.success(markReviewed ? "Marked reviewed — it now counts as ground truth." : "Saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const doPush = async () => {
    setBusy("zoho");
    try {
      const res = await push({ data: { billId: id } });
      await qc.invalidateQueries({ queryKey: ["bill", id] });
      toast.success(res.alreadyPushed ? "Already in Zoho Books." : "Expense created in Zoho Books.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Zoho Books push failed.");
    } finally {
      setBusy(null);
    }
  };

  const doRerun = async () => {
    setBusy("rerun");
    try {
      await rerun({ data: { billId: id } });
      await qc.invalidateQueries({ queryKey: ["bill", id] });
      toast.success("Both models read it again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-extraction failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Link to="/bills" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Ledger
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{bill.vendor_name || "Untitled bill"}</h1>
          <p className="mt-1 text-muted-foreground">
            <span className="num">{formatMoney(fields.grand_total, fields.currency ?? "INR")}</span>
            {bill.bill_date ? <span className="num"> · {bill.bill_date}</span> : null}
            {bill.original_filename ? ` · ${bill.original_filename}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={doRerun} disabled={busy !== null}>
            {busy === "rerun" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Re-extract
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={busy !== null}
            onClick={async () => {
              await remove({ data: { billId: id } });
              await qc.invalidateQueries({ queryKey: ["bills"] });
              navigate({ to: "/bills" });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <div>
          {data.imageUrl ? (
            <a href={data.imageUrl} target="_blank" rel="noreferrer">
              <img
                src={data.imageUrl}
                alt={`Handwritten bill${bill.vendor_name ? ` from ${bill.vendor_name}` : ""}`}
                className="w-full rounded-md border border-border bg-card object-contain"
                loading="lazy"
              />
            </a>
          ) : (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Image unavailable
            </div>
          )}
          <div className="mt-4 space-y-3 rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Zoho Books</span>
              <Badge variant={bill.zoho_status === "pushed" ? "default" : bill.zoho_status === "error" ? "destructive" : "outline"}>
                {bill.zoho_status}
              </Badge>
            </div>
            {bill.zoho_expense_id ? (
              <p className="num text-xs text-muted-foreground">Expense {bill.zoho_expense_id}</p>
            ) : null}
            {bill.zoho_error ? <p className="text-xs text-destructive">{bill.zoho_error}</p> : null}
            <Button
              className="w-full"
              onClick={doPush}
              disabled={busy !== null || bill.zoho_status === "pushed" || fields.grand_total === null}
            >
              {busy === "zoho" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {bill.zoho_status === "pushed" ? "Posted to Zoho" : "Push expense to Zoho"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The vendor is matched by name, or created if it isn&apos;t there yet.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <FieldComparison fields={fields} candidates={candidates} onChange={setFields} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => doSave(false)} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save draft
            </Button>
            <Button onClick={() => doSave(true)} disabled={busy !== null}>
              Mark reviewed &amp; score models
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function num(v: number | null): number | null {
  return v === null || v === undefined ? null : Number(v);
}
