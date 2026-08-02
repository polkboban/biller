import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODELS, normalizeFields, totalTax, type BillFields, type LineItem } from "./bill-schema";

export type BillRow = {
  id: string;
  image_path: string;
  original_filename: string | null;
  status: string;
  vendor_name: string | null;
  vendor_gstin: string | null;
  bill_number: string | null;
  bill_date: string | null;
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
  is_reviewed: boolean;
  zoho_expense_id: string | null;
  zoho_status: string;
  zoho_error: string | null;
  created_at: string;
};

export type ExtractionRow = {
  id: string;
  bill_id: string;
  model: string;
  model_label: string | null;
  parsed: BillFields | null;
  latency_ms: number | null;
  parse_ok: boolean;
  error: string | null;
};

/** Registers an uploaded image and kicks nothing off yet. */
export const createBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imagePath: string; filename: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bills")
      .insert({
        user_id: context.userId,
        image_path: data.imagePath,
        original_filename: data.filename,
        status: "uploaded",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** Runs both vision models against the bill image and stores each result. */
export const extractBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billId: string }) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { data: bill, error } = await context.supabase
      .from("bills")
      .select("id, image_path, is_reviewed")
      .eq("id", data.billId)
      .single();
    if (error || !bill) throw new Error("Bill not found.");

    const { data: signed, error: signErr } = await context.supabase.storage
      .from("bills")
      .createSignedUrl(bill.image_path as string, 900);
    if (signErr || !signed?.signedUrl) throw new Error("Could not read the bill image.");

    const { runVisionExtraction } = await import("./ai-vision.server");

    await context.supabase.from("bills").update({ status: "extracting" }).eq("id", bill.id);
    await context.supabase.from("extractions").delete().eq("bill_id", bill.id);

    const results = await Promise.all(
      MODELS.map(async (m) => {
        const r = await runVisionExtraction(m.id, signed.signedUrl, apiKey);
        return { model: m.id, label: m.label, ...r };
      }),
    );

    await context.supabase.from("extractions").insert(
      results.map((r) => ({
        bill_id: bill.id,
        user_id: context.userId,
        model: r.model,
        model_label: r.label,
        raw_response: r.raw.slice(0, 20000),
        parsed: r.parsed as never,
        latency_ms: r.latencyMs,
        parse_ok: r.parsed !== null,
        error: r.error,
      })),
    );

    // Seed the editable record from the first successful model, unless already reviewed.
    const seed = results.find((r) => r.parsed)?.parsed ?? null;
    const anyOk = results.some((r) => r.parsed);
    if (seed && !bill.is_reviewed) {
      await context.supabase
        .from("bills")
        .update({
          status: "extracted",
          vendor_name: seed.vendor_name,
          vendor_gstin: seed.vendor_gstin,
          bill_number: seed.bill_number,
          bill_date: seed.bill_date,
          line_items: seed.line_items,
          subtotal: seed.subtotal,
          cgst_amount: seed.cgst_amount,
          sgst_amount: seed.sgst_amount,
          igst_amount: seed.igst_amount,
          other_charges: seed.other_charges,
          discount: seed.discount,
          grand_total: seed.grand_total,
          currency: seed.currency,
          payment_mode: seed.payment_mode,
        })
        .eq("id", bill.id);
    } else {
      await context.supabase
        .from("bills")
        .update({ status: anyOk ? "extracted" : "failed" })
        .eq("id", bill.id);
    }

    return {
      billId: bill.id as string,
      results: results.map((r) => ({
        model: r.model,
        label: r.label,
        parsed: r.parsed,
        latencyMs: r.latencyMs,
        error: r.error,
      })),
    };
  });

export const listBills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bills")
      .select(
        "id, image_path, original_filename, status, vendor_name, bill_date, grand_total, currency, is_reviewed, zoho_status, zoho_expense_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: bill, error } = await context.supabase
      .from("bills")
      .select("*")
      .eq("id", data.billId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bill) return null;

    const { data: extractions } = await context.supabase
      .from("extractions")
      .select("id, bill_id, model, model_label, parsed, latency_ms, parse_ok, error")
      .eq("bill_id", data.billId)
      .order("model");

    const { data: signed } = await context.supabase.storage
      .from("bills")
      .createSignedUrl(bill.image_path as string, 3600);

    return {
      bill: bill as unknown as BillRow,
      extractions: (extractions ?? []) as unknown as ExtractionRow[],
      imageUrl: signed?.signedUrl ?? null,
    };
  });

export const saveBillFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billId: string; fields: BillFields; markReviewed: boolean }) => input)
  .handler(async ({ data, context }) => {
    const f = normalizeFields(data.fields);
    const { error } = await context.supabase
      .from("bills")
      .update({
        vendor_name: f.vendor_name,
        vendor_gstin: f.vendor_gstin,
        bill_number: f.bill_number,
        bill_date: f.bill_date,
        line_items: f.line_items,
        subtotal: f.subtotal,
        cgst_amount: f.cgst_amount,
        sgst_amount: f.sgst_amount,
        igst_amount: f.igst_amount,
        other_charges: f.other_charges,
        discount: f.discount,
        grand_total: f.grand_total,
        currency: f.currency,
        payment_mode: f.payment_mode,
        is_reviewed: data.markReviewed,
        status: data.markReviewed ? "reviewed" : "extracted",
      })
      .eq("id", data.billId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: bill } = await context.supabase
      .from("bills")
      .select("image_path")
      .eq("id", data.billId)
      .maybeSingle();
    if (bill?.image_path) {
      await context.supabase.storage.from("bills").remove([bill.image_path as string]);
    }
    const { error } = await context.supabase.from("bills").delete().eq("id", data.billId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Creates the matching Expense (and vendor) in Zoho Books. */
export const pushToZoho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: bill, error } = await context.supabase
      .from("bills")
      .select("*")
      .eq("id", data.billId)
      .single();
    if (error || !bill) throw new Error("Bill not found.");
    if (bill.zoho_expense_id) {
      return { alreadyPushed: true, expenseId: bill.zoho_expense_id as string };
    }
    if (bill.grand_total === null) {
      throw new Error("Set a grand total before pushing to Zoho Books.");
    }

    const { createExpense, ZohoNotConnectedError } = await import("./zoho.server");
    try {
      const result = await createExpense({
        vendorName: bill.vendor_name as string | null,
        date: bill.bill_date as string | null,
        amount: Number(bill.grand_total),
        taxAmount: totalTax({
          cgst_amount: bill.cgst_amount === null ? null : Number(bill.cgst_amount),
          sgst_amount: bill.sgst_amount === null ? null : Number(bill.sgst_amount),
          igst_amount: bill.igst_amount === null ? null : Number(bill.igst_amount),
        }),
        reference: bill.bill_number as string | null,
        description: `Handwritten bill${bill.vendor_name ? ` from ${bill.vendor_name}` : ""} captured via AI extraction.`,
      });
      await context.supabase
        .from("bills")
        .update({
          zoho_expense_id: result.expenseId,
          zoho_vendor_id: result.vendorId,
          zoho_status: "pushed",
          zoho_error: null,
          zoho_pushed_at: new Date().toISOString(),
        })
        .eq("id", bill.id);
      return { alreadyPushed: false, expenseId: result.expenseId };
    } catch (err) {
      const message =
        err instanceof ZohoNotConnectedError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown Zoho Books error";
      await context.supabase
        .from("bills")
        .update({ zoho_status: "error", zoho_error: message })
        .eq("id", bill.id);
      throw new Error(message);
    }
  });

/** Everything the evaluation page needs: reviewed bills + their model outputs. */
export const getEvaluationData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: bills, error } = await context.supabase
      .from("bills")
      .select("*")
      .eq("is_reviewed", true)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = (bills ?? []).map((b) => b.id as string);
    if (!ids.length) return { bills: [], extractions: [] };

    const { data: extractions } = await context.supabase
      .from("extractions")
      .select("id, bill_id, model, model_label, parsed, latency_ms, parse_ok, error")
      .in("bill_id", ids);

    return {
      bills: (bills ?? []) as unknown as BillRow[],
      extractions: (extractions ?? []) as unknown as ExtractionRow[],
    };
  });
