import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdminApiSession } from "@/lib/admin-auth";
import type { Booking } from "../route";

const BOOKINGS_FILE = path.join(process.cwd(), "data", "bookings.json");

function readBookings(): Booking[] {
  try {
    const raw = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    return JSON.parse(raw) as Booking[];
  } catch {
    return [];
  }
}

function writeBookings(bookings: Booking[]) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), "utf-8");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const bookings = readBookings();
  const idx = bookings.findIndex((b) => b.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  bookings[idx] = { ...bookings[idx], ...body };
  writeBookings(bookings);

  return NextResponse.json(bookings[idx]);
}
