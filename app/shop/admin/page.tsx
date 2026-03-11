"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { SHOP_CATEGORIES, formatPrice, timeAgo } from "@/lib/shop";

interface ShopItem {
  id: string;
  title: string;
  price: number;
  description: string | null;
  category: string | null;
  imageUrls: string[];
  status: string;
  createdAt: string;
  soldAt: string | null;
}

interface Stats {
  active: number;
  soldThisWeek: number;
  total: number;
}

export default function ShopAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [items, setItems] = useState<ShopItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    active: 0,
    soldThisWeek: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Check if already authed
  useEffect(() => {
    fetch("/api/shop/items?status=active&admin_check=1")
      .then((r) => {
        // If we can fetch items, check if admin cookie exists by trying admin endpoint
        return fetch("/api/shop/items", { method: "POST", body: "{}" });
      })
      .then((r) => {
        if (r.status !== 401) {
          setAuthed(true);
          loadItems();
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/shop/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setAuthed(true);
      loadItems();
    } else {
      setPinError("Wrong PIN");
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const [activeRes, allRes] = await Promise.all([
        fetch("/api/shop/items?status=active"),
        fetch("/api/shop/items?status=all"),
      ]);
      const activeItems: ShopItem[] = await activeRes.json();
      const allItems: ShopItem[] = await allRes.json();

      setItems(allItems.sort((a, b) => {
        // Active items first, then by date desc
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }));

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const soldThisWeek = allItems.filter(
        (i) => i.status === "sold" && i.soldAt && new Date(i.soldAt).getTime() > weekAgo
      ).length;

      setStats({
        active: activeItems.length,
        soldThisWeek,
        total: allItems.length,
      });
    } catch (err) {
      console.error("Failed to load items:", err);
    }
    setLoading(false);
  }

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

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !price) return;
    setPosting(true);
    setSuccess("");

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

      // Create item
      const res = await fetch("/api/shop/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          price: parseFloat(price),
          description: description || undefined,
          category: category || undefined,
          imageUrls,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || errBody.error || `HTTP ${res.status}`);
      }

      // Reset form
      setTitle("");
      setPrice("");
      setDescription("");
      setCategory("");
      setImageFiles([]);
      setImagePreviews([]);
      setShowForm(false);
      setSuccess("Item posted!");
      setTimeout(() => setSuccess(""), 3000);
      loadItems();
    } catch (err) {
      console.error("Post failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to post item: ${msg}`);
    }
    setPosting(false);
  }

  async function markSold(id: string) {
    await fetch(`/api/shop/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sold" }),
    });
    loadItems();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/shop/items/${id}`, { method: "DELETE" });
    loadItems();
  }

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-white/40">Loading...</p>
      </div>
    );
  }

  // PIN gate
  if (!authed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <form
          onSubmit={handlePin}
          className="shop-pin-card w-full max-w-xs rounded-2xl p-6 text-center"
        >
          <h2 className="text-lg font-bold text-white">Admin Access</h2>
          <p className="mt-1 text-sm text-white/40">Enter your PIN</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="shop-input mt-4 w-full rounded-lg px-4 py-3 text-center text-2xl tracking-[0.3em]"
            placeholder="••••"
          />
          {pinError && (
            <p className="mt-2 text-sm text-red-400">{pinError}</p>
          )}
          <button
            type="submit"
            className="shop-btn-primary mt-4 w-full rounded-lg px-4 py-3"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="shop-stat p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.active}</p>
          <p className="text-xs text-white/40">Active</p>
        </div>
        <div className="shop-stat p-3 text-center">
          <p className="text-2xl font-bold text-green-400">
            {stats.soldThisWeek}
          </p>
          <p className="text-xs text-white/40">Sold (7d)</p>
        </div>
        <div className="shop-stat p-3 text-center">
          <p className="text-2xl font-bold text-white/60">{stats.total}</p>
          <p className="text-xs text-white/40">Total</p>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="mt-4 rounded-lg bg-green-500/15 border border-green-500/30 px-4 py-2 text-center text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Add button or form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="shop-btn-primary mt-4 w-full rounded-xl px-4 py-4 text-lg"
        >
          + Add Item
        </button>
      ) : (
        <form
          onSubmit={handlePost}
          className="shop-admin-form mt-4 rounded-xl p-4"
        >
          <h3 className="font-semibold text-white">New Item</h3>

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
                    <Image
                      src={src}
                      alt=""
                      fill
                      className="object-cover"
                    />
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
                className="shop-upload-zone flex w-full items-center justify-center rounded-xl py-8"
              >
                <div className="text-center">
                  <p className="text-3xl">📷</p>
                  <p className="mt-1 text-sm text-white/40">
                    Tap to add photo
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Title */}
          <input
            type="text"
            placeholder="Item title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="shop-input mt-3 w-full rounded-lg px-4 py-3"
          />

          {/* Price */}
          <input
            type="number"
            inputMode="decimal"
            placeholder="Price"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="shop-input mt-2 w-full rounded-lg px-4 py-3"
          />

          {/* Description */}
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="shop-input mt-2 w-full rounded-lg px-4 py-3 resize-none"
          />

          {/* Category */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="shop-input mt-2 w-full rounded-lg px-4 py-3"
          >
            <option value="">Category (optional)</option>
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Buttons */}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={posting || !title || !price}
              className="shop-btn-primary flex-1 rounded-lg py-3"
            >
              {posting ? "Posting..." : "Post"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setImageFiles([]);
                setImagePreviews([]);
              }}
              className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      <div className="mt-6 space-y-2">
        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-white/30">Loading...</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                item.status === "sold"
                  ? "border-white/5 opacity-50"
                  : "border-white/10"
              }`}
              style={{
                background:
                  item.status === "sold"
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              {/* Thumbnail */}
              {item.imageUrls.length > 0 ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={item.imageUrls[0]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                  📦
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {item.title}
                  {item.status === "sold" && (
                    <span className="ml-2 text-green-400">SOLD</span>
                  )}
                </p>
                <p className="text-sm text-purple-300">
                  {formatPrice(item.price)}
                </p>
                <p className="text-xs text-white/25">
                  {timeAgo(new Date(item.createdAt))}
                </p>
              </div>

              {/* Actions */}
              {item.status === "active" && (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => markSold(item.id)}
                    className="shop-btn-sold rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Sold
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="shop-btn-delete rounded-lg px-2 py-1.5 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
              {item.status === "sold" && (
                <button
                  onClick={() => deleteItem(item.id)}
                  className="shop-btn-delete shrink-0 rounded-lg px-2 py-1.5 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
