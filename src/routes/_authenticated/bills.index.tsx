import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listBills } from "@/lib/bills.functions";
import { formatMoney } from "@/lib/bill-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bills/")({
  head: () => ({
    meta: [
      { title: "Bill ledger — Biller" },
      { name: "description", content: "Every handwritten bill you captured, its review state and Zoho Books status." },
      { property: "og:title", content: "Bill ledger — Biller" },
      { property: "og:description", content: "Track extraction, review and Zoho Books posting for each bill." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillsPage,
});

const ZOHO_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pushed: "default",
  error: "destructive",
  pending: "outline",
};

function BillsPage() {
  const fetchBills = useServerFn(listBills);
  const { data, isLoading } = useQuery({ queryKey: ["bills"], queryFn: () => fetchBills() });

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Ledger</h1>
          <p className="mt-2 text-muted-foreground">
            {data?.length ? `${data.length} bill${data.length === 1 ? "" : "s"} captured` : "Nothing captured yet"}
          </p>
        </div>
        <Button asChild>
          <Link to="/upload">Capture a bill</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <div className="mt-12 rounded-md border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            Your first extraction will show up here with both model readings side by side.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Bill date</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Review</th>
                <th className="px-4 py-2.5 font-medium">Zoho</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <Link to="/bills/$id" params={{ id: b.id }} className="font-medium hover:underline">
                      {b.vendor_name || b.original_filename || "Untitled bill"}
                    </Link>
                  </td>
                  <td className="num px-4 py-2.5 text-muted-foreground">{b.bill_date ?? "—"}</td>
                  <td className="num px-4 py-2.5 text-right">
                    {formatMoney(b.grand_total, b.currency ?? "INR")}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={b.is_reviewed ? "default" : "secondary"}>
                      {b.is_reviewed ? "Reviewed" : b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={ZOHO_TONE[b.zoho_status] ?? "outline"}>{b.zoho_status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
