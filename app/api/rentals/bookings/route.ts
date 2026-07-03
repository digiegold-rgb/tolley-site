import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdminApiSession } from "@/lib/admin-auth";

const BOOKINGS_FILE = path.join(process.cwd(), "data", "bookings.json");

export interface Booking {
  id: string;
  customerName: string;
  phone: string;
  item: string;
  startDate: string;
  endDate: string;
  notes: string;
  returned: boolean;
  createdAt: string;
}

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

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const bookings = readBookings();
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { customerName, phone, item, startDate, endDate, notes } = body;

  if (!customerName || !item || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const booking: Booking = {
    id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    customerName,
    phone: phone ?? "",
    item,
    startDate,
    endDate,
    notes: notes ?? "",
    returned: false,
    createdAt: new Date().toISOString(),
  };

  const bookings = readBookings();
  bookings.push(booking);
  writeBookings(bookings);

  return NextResponse.json(booking, { status: 201 });
}
