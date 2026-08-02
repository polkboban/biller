/** Server-only Lovable AI Gateway helper for vision extraction. */
import { normalizeFields, type BillFields } from "./bill-schema";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const EXTRACTION_PROMPT = `You read photographs of handwritten Indian bills, receipts and kachcha invoices.
Transcribe carefully: figures may be in Devanagari or regional scripts, amounts may use lakh-style comma grouping, dates are usually DD/MM/YYYY.

Return ONLY a JSON object (no prose, no markdown fences) with exactly these keys:
{
  "vendor_name": string|null,
  "vendor_gstin": string|null,
  "bill_number": string|null,
  "bill_date": string|null,
  "line_items": [{"description": string, "qty": number|null, "rate": number|null, "amount": number|null}],
  "subtotal": number|null,
  "cgst_amount": number|null,
  "sgst_amount": number|null,
  "igst_amount": number|null,
  "other_charges": number|null,
  "discount": number|null,
  "grand_total": number|null,
  "currency": string|null,
  "payment_mode": string|null,
  "confidence": number
}
Rules: numbers must be plain JSON numbers with no currency symbols or commas. Use null when a field is genuinely absent or illegible — never guess. "confidence" is your overall 0-1 confidence in the transcription. Keep the bill_date exactly as written on the bill.`;

export type ExtractionResult = {
  parsed: BillFields | null;
  raw: string;
  latencyMs: number;
  error: string | null;
};

/** Pulls the first balanced JSON object out of a model response. */
export function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function runVisionExtraction(
  model: string,
  imageUrl: string,
  apiKey: string,
): Promise<ExtractionResult> {
  const started = Date.now();
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_completion_tokens: 4000,
  };

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      const friendly =
        res.status === 429
          ? "Rate limited by the AI gateway — try again in a moment."
          : res.status === 402
            ? "AI credits exhausted for this workspace."
            : `AI request failed [${res.status}]: ${text.slice(0, 400)}`;
      return { parsed: null, raw: text, latencyMs: Date.now() - started, error: friendly };
    }

    const json = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const obj = extractJson(content);
    if (!obj) {
      return {
        parsed: null,
        raw: content,
        latencyMs: Date.now() - started,
        error: "Model did not return parseable JSON.",
      };
    }
    return {
      parsed: normalizeFields(obj),
      raw: content,
      latencyMs: Date.now() - started,
      error: null,
    };
  } catch (err) {
    return {
      parsed: null,
      raw: "",
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Unexpected AI gateway error",
    };
  }
}
