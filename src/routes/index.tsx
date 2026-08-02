import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ReceiptIndianRupee, ScanLine, GitCompare, Upload } from "lucide-react";
import { MODELS } from "@/lib/bill-schema";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Biller — AI extraction for handwritten Indian bills" },
      {
        name: "description",
        content:
          "Read handwritten Indian bills with two vision AI models side by side, correct the ledger, and push clean expenses into Zoho Books.",
      },
      { property: "og:title", content: "Biller — AI extraction for handwritten Indian bills" },
      {
        property: "og:description",
        content:
          "Compare two vision models on the same receipt, fix what they miss, and post the expense to Zoho Books.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <ReceiptIndianRupee className="size-5 text-primary" />
          <span className="font-display text-xl">Biller</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-16 pt-10">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
          Handwritten bills · GST · Zoho Books
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] md:text-6xl">
          The scribbled receipt, read twice and booked once.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Photograph a handwritten kirana bill. Two vision models read it in parallel, you keep the
          better answer field by field, and the corrected expense lands in Zoho Books with the
          vendor created for you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/upload">
              <Upload className="size-4" /> Capture a bill
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/evaluate">
              <GitCompare className="size-4" /> See the benchmark
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: ScanLine,
              title: "Two readers, one truth",
              body: `${MODELS.map((m) => m.label).join(" and ")} extract the same bill independently. Agreement is a green tick; disagreement is where you look.`,
            },
            {
              icon: GitCompare,
              title: "Scored, not guessed",
              body: "Every correction you make becomes ground truth, so the benchmark page reports real field accuracy and latency per model.",
            },
            {
              icon: ReceiptIndianRupee,
              title: "Booked in Zoho",
              body: "CGST, SGST and IGST are carried through, the vendor is matched or created, and the expense is posted to your organisation.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-md border border-border bg-card p-5">
              <c.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-xl">{c.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
