"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { SHOP_CATEGORIES } from "@/lib/shop";
import { SOURCING_TYPES, CONDITIONS } from "@/lib/shop/types";

interface ProductFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  lotId?: string;
}

export function ProductForm({ onSuccess, onCancel, lotId }: ProductFormProps) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState("");
  const [sku, setSku] = useState("");
  const [upc, setUpc] = useState("");
  const [sourcingType, setSourcingType] = useState("");
  const [sourcingVendor, setSourcingVendor] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImageFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setPosting(true);

    try {
      // Upload images
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const upRes = await fetch("/api/shop/upload", {
          method: "POST",
          body: formData,
        });
        if (!upRes.ok) throw new Error("Upload failed");
        const { url } = await upRes.json();
        imageUrls.push(url);
      }

      const res = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          targetPrice: price ? parseFloat(price) : undefined,
          description: description || undefined,
          category: category || undefined,
          brand: brand || undefined,
          condition: condition || undefined,
          sku: sku || undefined,
          upc: upc || undefined,
          sourcingType: sourcingType || undefined,
          sourcingVendor: sourcingVendor || undefined,
          costBasis: costBasis ? parseFloat(costBasis) : undefined,
          shippingCost: shippingCost ? parseFloat(shippingCost) : undefined,
          imageUrls,
          lotId: lotId || undefined,
          status: "draft",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed: ${msg}`);
    }
    setPosting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/12 bg-white/[0.04] p-4"
    >
      <h3 className="font-semibold text-white">New Product</h3>

      {/* Photo upload */}
      <div className="mt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        {imagePreviews.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg">
                <Image src={src} alt="" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-white/20 text-2xl text-white/30"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shop-upload-zone flex w-full items-center justify-center rounded-xl py-6"
          >
            <div className="text-center">
              <p className="text-2xl">📷</p>
              <p className="mt-1 text-xs text-white/40">Add photos</p>
            </div>
          </button>
        )}
      </div>

      {/* Core fields */}
      <input
        type="text"
        placeholder="Product title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="shop-input mt-3 w-full rounded-lg px-4 py-3 text-sm"
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Target price"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="shop-input rounded-lg px-4 py-3 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="shop-input rounded-lg px-4 py-3 text-sm"
        >
          <option value="">Category</option>
          {SHOP_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="shop-input mt-2 w-full rounded-lg px-4 py-3 text-sm resize-none"
      />

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-2 text-xs text-purple-400 hover:text-purple-300"
      >
        {showAdvanced ? "- Hide" : "+ Show"} sourcing & details
      </button>

      {showAdvanced && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            />
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            >
              <option value="">Condition</option>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="SKU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            />
            <input
              type="text"
              placeholder="UPC"
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sourcingType}
              onChange={(e) => setSourcingType(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            >
              <option value="">Sourcing type</option>
              {SOURCING_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Vendor name"
              value={sourcingVendor}
              onChange={(e) => setSourcingVendor(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Cost basis"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Shipping cost"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              className="shop-input rounded-lg px-4 py-2.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={posting || !title}
          className="shop-btn-primary flex-1 rounded-lg py-3 text-sm"
        >
          {posting ? "Creating..." : "Create Product"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
