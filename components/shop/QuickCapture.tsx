"use client";

import { useState } from "react";
import Image from "next/image";
import { PhotoSourcePicker } from "./PhotoSourcePicker";
import { uploadShopPhoto } from "@/lib/shop/upload-client";

interface QuickCaptureProps {
  onSuccess: () => void;
}

export function QuickCapture({ onSuccess }: QuickCaptureProps) {
  const [step, setStep] = useState<"capture" | "details" | "posting">("capture");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    suggestedTitle?: string;
    suggestedCategory?: string;
    suggestedPrice?: { low: number; mid: number; high: number };
  } | null>(null);
  function handleCapture(fileList: FileList) {
    const file = fileList[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
      setStep("details");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!title || !imageFile) return;
    setStep("posting");

    try {
      // Upload image — client-direct to Blob to handle full-res photos
      const url = await uploadShopPhoto(imageFile);

      // Create product
      const res = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          targetPrice: price ? parseFloat(price) : undefined,
          category: aiSuggestions?.suggestedCategory || undefined,
          imageUrls: [url],
          status: "draft",
        }),
      });

      if (!res.ok) throw new Error("Create failed");
      const product = await res.json();

      // Auto-enrich with AI
      setEnriching(true);
      try {
        const enrichRes = await fetch(`/api/shop/products/${product.id}/ai-enrich`, {
          method: "POST",
        });
        if (enrichRes.ok) {
          const { suggestions } = await enrichRes.json();
          setAiSuggestions(suggestions);
        }
      } catch {
        // AI enrichment is optional
      }
      setEnriching(false);

      onSuccess();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("details");
    }
  }

  if (step === "capture") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <PhotoSourcePicker onFiles={handleCapture}>
          {(openPicker) => (
            <button
              onClick={openPicker}
              className="shop-upload-zone mx-auto flex h-32 w-32 items-center justify-center rounded-2xl"
            >
              <div className="text-center">
                <p className="text-4xl">📸</p>
                <p className="mt-1 text-xs text-white/40">Snap & List</p>
              </div>
            </button>
          )}
        </PhotoSourcePicker>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex gap-4">
        {imagePreview && (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
            <Image src={imagePreview} alt="" fill className="object-cover" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            type="text"
            placeholder="What is this?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="shop-input w-full rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="shop-input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {enriching && (
        <p className="mt-2 text-xs text-purple-400">AI analyzing...</p>
      )}

      {aiSuggestions && (
        <div className="mt-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2">
          <p className="text-xs text-purple-300">
            AI: {aiSuggestions.suggestedCategory || ""} &middot;{" "}
            {aiSuggestions.suggestedPrice
              ? `$${aiSuggestions.suggestedPrice.low}-${aiSuggestions.suggestedPrice.high}`
              : ""}
          </p>
          {aiSuggestions.suggestedTitle && (
            <button
              onClick={() => setTitle(aiSuggestions.suggestedTitle!)}
              className="mt-1 text-[0.65rem] text-purple-400 underline"
            >
              Use: {aiSuggestions.suggestedTitle}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={step === "posting" || !title}
          className="shop-btn-primary flex-1 rounded-lg py-2.5 text-sm"
        >
          {step === "posting" ? "Creating..." : "Create Draft"}
        </button>
        <button
          onClick={() => {
            setStep("capture");
            setImageFile(null);
            setImagePreview("");
            setTitle("");
            setPrice("");
            setAiSuggestions(null);
          }}
          className="rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white/50"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
