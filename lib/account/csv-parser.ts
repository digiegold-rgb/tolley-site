import { createHash } from 'crypto';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'RECEIVE' | 'SPEND';
  importHash: string;
}

function makeHash(date: string, amount: number, description: string): string {
  return createHash('sha256')
    .update(`${date}${amount}${description}`)
    .digest('hex');
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseBluevineCSV(csvContent: string): ParsedTransaction[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, ''));
  const dateIdx = header.indexOf('date');
  const descIdx = header.indexOf('description');
  const debitIdx = header.indexOf('debit');
  const creditIdx = header.indexOf('credit');

  if (dateIdx === -1 || descIdx === -1) {
    throw new Error('CSV missing required columns: Date, Description');
  }

  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    if (fields.length < Math.max(dateIdx, descIdx, debitIdx, creditIdx) + 1) continue;

    const dateStr = fields[dateIdx].replace(/"/g, '');
    const description = fields[descIdx].replace(/"/g, '');
    const debit = parseFloat(fields[debitIdx]?.replace(/[",$ ]/g, '') || '0') || 0;
    const credit = parseFloat(fields[creditIdx]?.replace(/[",$ ]/g, '') || '0') || 0;

    if (!dateStr || !description) continue;

    const amount = credit > 0 ? credit : debit;
    const type: 'RECEIVE' | 'SPEND' = credit > 0 ? 'RECEIVE' : 'SPEND';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    results.push({
      date,
      description,
      amount: Math.abs(amount),
      type,
      importHash: makeHash(dateStr, amount, description),
    });
  }

  return results;
}
