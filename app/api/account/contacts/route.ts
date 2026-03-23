// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q');

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const contacts = await prisma.accountContact.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { invoices: true } },
      },
    });

    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const body = await request.json();
    const { name, email, phone, address, city, state, zip, isCustomer, isSupplier } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const contact = await prisma.accountContact.create({
      data: {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        isCustomer: isCustomer ?? false,
        isSupplier: isSupplier ?? false,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
