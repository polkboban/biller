/** Server-only AI Gateway helper for vision extraction using Google Gemini directly. */
import { normalizeFields, type BillFields } from "./bill-schema";

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
  model: string, // Kept for compatibility, but we will default to Gemini Flash
  imageUrl: string,
  apiKey: string,
): Promise<ExtractionResult> {
  const started = Date.now();
  
  try {
    // 1. Fetch the image from Supabase (or any URL) to get the raw bytes
    const imageReq = await fetch(imageUrl);
    if (!imageReq.ok) {
      throw new Error(`Failed to fetch image from storage: ${imageReq.statusText}`);
    }
    
    // 2. Convert the image to base64 which Gemini requires
    const arrayBuffer = await imageReq.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageReq.headers.get("content-type") || "image/jpeg";

    // 3. Construct the Google Gemini request payload
    const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + apiKey;
    const body = {
      contents: [
        {
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json", // Forces Gemini to return pure JSON
        temperature: 0.1,
      },
    };

    // 4. Send the request to Google
    const res = await fetch(geminiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      const friendly = res.status === 429
        ? "Rate limited by Google API — try again in a moment."
        : `Google API error [${res.status}]: ${json?.error?.message || "Unknown error"}`;
      return { parsed: null, raw: JSON.stringify(json), latencyMs: Date.now() - started, error: friendly };
    }

    // 5. Extract and parse the response
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
      error: err instanceof Error ? err.message : "Unexpected Gemini API error",
    };
  }
}