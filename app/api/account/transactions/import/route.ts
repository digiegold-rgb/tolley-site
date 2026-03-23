// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { parseBluevineCSV } from '@/lib/account/csv-parser';
import { categorize } from '@/lib/account/categorizer';

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const csvContent = await file.text();
    const parsed = parseBluevineCSV(csvContent);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid transactions found in CSV' }, { status: 400 });
    }

    // Check for existing hashes to dedup
    const hashes = parsed.map((t) => t.importHash);
    const existing = await prisma.ledgerTransaction.findMany({
      where: { importHash: { in: hashes } },
      select: { importHash: true },
    });
    const existingHashes = new Set(existing.map((e) => e.importHash));

    const toInsert = parsed.filter((t) => !existingHashes.has(t.importHash));
    const skipped = parsed.length - toInsert.length;

    let needsReviewCount = 0;

    // Categorize and insert
    const insertData = await Promise.all(
      toInsert.map(async (tx) => {
        const cat = await categorize(tx.description, tx.amount);
        const needsReview = !cat || cat.needsReview === true;
        if (needsReview) needsReviewCount++;

        return {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          importHash: tx.importHash,
          source: 'bluevine-csv',
          accountCode: cat?.accountCode || null,
          autoCategory: cat?.accountCode || null,
          autoNote: cat?.note || null,
          autoConfidence: cat?.confidence || null,
          needsReview,
        };
      }),
    );

    if (insertData.length > 0) {
      await prisma.ledgerTransaction.createMany({ data: insertData });
    }

    return NextResponse.json({
      inserted: insertData.length,
      skipped,
      needsReview: needsReviewCount,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
