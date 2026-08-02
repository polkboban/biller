import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createBill, extractBill } from "@/lib/bills.functions";
import { MODELS } from "@/lib/bill-schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Loader2, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Capture a bill — Biller" },
      {
        name: "description",
        content: "Upload a handwritten Indian bill and let two vision models extract vendor, date, GST and totals.",
      },
      { property: "og:title", content: "Capture a bill — Biller" },
      { property: "og:description", content: "Two vision models read your handwritten receipt in parallel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const STAGES = ["Uploading the image", "Reading with both models", "Reconciling totals"];

function UploadPage() {
  const navigate = useNavigate();
  const create = useServerFn(createBill);
  const extract = useServerFn(extractBill);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handle = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick a photo or scan of the bill.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setStage(0);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expired. Sign in again.");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("bills").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { id } = await create({ data: { imagePath: path, filename: file.name } });
      setStage(1);
      await extract({ data: { billId: id } });
      setStage(2);
      navigate({ to: "/bills/$id", params: { id } });
    } catch (err) {
      setStage(null);
      toast.error(err instanceof Error ? err.message : "Something went wrong reading that bill.");
    }
  };

  const busy = stage !== null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Capture a bill</h1>
      <p className="mt-2 text-muted-foreground">
        A clear, flat photo works best. Both models read the same image, so nothing is thrown away.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) void handle(file);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`mt-8 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-primary bg-accent/50" : "border-border bg-card hover:border-primary/50"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Selected bill preview"
            className="mx-auto max-h-72 rounded-md border border-border object-contain"
          />
        ) : (
          <ImagePlus className="mx-auto size-10 text-muted-foreground" />
        )}
        <p className="mt-4 font-medium">
          {preview ? "Reading this bill…" : "Drop a bill photo here, or click to browse"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">JPG, PNG or HEIC-converted image</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handle(file);
          }}
        />
      </div>

      {busy ? (
        <ol className="mt-8 space-y-2">
          {STAGES.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-3 text-sm ${
                i <= stage ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {i === stage ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <span
                  className={`size-2 rounded-full ${i < stage ? "bg-primary" : "bg-border"}`}
                />
              )}
              {label}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {MODELS.map((m) => (
            <div key={m.id} className="rounded-md border border-border bg-card p-4">
              <p className="font-medium">{m.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.blurb}</p>
            </div>
          ))}
        </div>
      )}

      {!busy ? (
        <Button className="mt-8" onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" /> Choose a bill
        </Button>
      ) : null}
    </div>
  );
}
