/** Server-only Zoho Books access via the Lovable connector gateway. */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/zoho_books";

export class ZohoNotConnectedError extends Error {
  constructor() {
    super("Zoho Books is not connected yet. Connect it from the chat, then retry the push.");
    this.name = "ZohoNotConnectedError";
  }
}

function keys() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const zohoKey = process.env["ZOHO_BOOKS_API_KEY"];
  if (!lovableKey || !zohoKey) throw new ZohoNotConnectedError();
  return { lovableKey, zohoKey };
}

async function zoho<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { lovableKey, zohoKey } = keys();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": zohoKey,
      "Content-Type": "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho Books request failed [${res.status}]: ${text.slice(0, 500)}`);
  }
  const json = JSON.parse(text) as T & { code?: number; message?: string };
  if (typeof json.code === "number" && json.code !== 0) {
    throw new Error(`Zoho Books error ${json.code}: ${json.message ?? "unknown"}`);
  }
  return json;
}

export async function getOrganizationId(): Promise<string> {
  const data = await zoho<{ organizations?: { organization_id: string }[] }>("/organizations");
  const id = data.organizations?.[0]?.organization_id;
  if (!id) throw new Error("No Zoho Books organization found for this account.");
  return id;
}

export async function findOrCreateVendor(orgId: string, vendorName: string): Promise<string> {
  const search = await zoho<{ contacts?: { contact_id: string; contact_name: string }[] }>(
    `/contacts?organization_id=${orgId}&contact_type=vendor&contact_name_contains=${encodeURIComponent(vendorName)}`,
  );
  const match = search.contacts?.find(
    (c) => c.contact_name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
  ) ?? search.contacts?.[0];
  if (match) return match.contact_id;

  const created = await zoho<{ contact?: { contact_id: string } }>(
    `/contacts?organization_id=${orgId}`,
    { method: "POST", body: { contact_name: vendorName, contact_type: "vendor" } },
  );
  const id = created.contact?.contact_id;
  if (!id) throw new Error("Zoho Books did not return a vendor id.");
  return id;
}

async function firstExpenseAccountId(orgId: string): Promise<string> {
  const data = await zoho<{ chartofaccounts?: { account_id: string; account_type: string }[] }>(
    `/chartofaccounts?organization_id=${orgId}&filter_by=AccountType.Expense`,
  );
  const id = data.chartofaccounts?.[0]?.account_id;
  if (!id) throw new Error("No expense account found in Zoho Books.");
  return id;
}

export type ExpenseInput = {
  vendorName: string | null;
  date: string | null;
  amount: number;
  taxAmount: number;
  reference: string | null;
  description: string;
};

export async function createExpense(input: ExpenseInput): Promise<{
  expenseId: string;
  vendorId: string | null;
  organizationId: string;
}> {
  const orgId = await getOrganizationId();
  const vendorId = input.vendorName ? await findOrCreateVendor(orgId, input.vendorName) : null;
  const accountId = await firstExpenseAccountId(orgId);

  const payload: Record<string, unknown> = {
    account_id: accountId,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    amount: input.amount,
    tax_amount: input.taxAmount || 0,
    is_inclusive_tax: true,
    description: input.description.slice(0, 500),
    ...(vendorId ? { vendor_id: vendorId } : {}),
    ...(input.reference ? { reference_number: input.reference } : {}),
  };

  const created = await zoho<{ expense?: { expense_id: string } }>(
    `/expenses?organization_id=${orgId}`,
    { method: "POST", body: payload },
  );
  const expenseId = created.expense?.expense_id;
  if (!expenseId) throw new Error("Zoho Books did not return an expense id.");
  return { expenseId, vendorId, organizationId: orgId };
}
