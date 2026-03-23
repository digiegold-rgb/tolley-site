'use client';

import { useEffect, useState, useCallback } from 'react';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  account?: { code: string; name: string } | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  subTotal: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  contact: Contact | null;
  lineItems: LineItem[];
}

export default function InvoicePrintClient({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Invoice not found');
      setInvoice(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    if (invoice && !loading) {
      // Small delay to ensure DOM is painted
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [invoice, loading]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Loading invoice...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#c00' }}>
        {error || 'Invoice not found'}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          /* Hide all parent layout elements when printing */
          body > div > div > h1,
          body > div > div > nav,
          body > div > div > div > .print-hide {
            display: none !important;
          }
          /* The print container itself */
          .invoice-print-container {
            position: fixed !important;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99999;
            background: #fff !important;
            padding: 0 !important;
          }
          @page {
            margin: 0.75in;
            size: letter;
          }
        }
        @media screen {
          .invoice-print-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 99999;
            background: #fff;
            overflow-y: auto;
          }
        }
      `}</style>
      <div
        className="invoice-print-container"
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#111',
          padding: '40px',
          lineHeight: 1.5,
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#111' }}>
                Your KC Homes LLC
              </h1>
              <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0' }}>
                Independence, MO
              </p>
              <p style={{ color: '#666', fontSize: '14px', margin: '2px 0 0' }}>
                tolley.io
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: '#0891b2' }}>
                INVOICE
              </h2>
              <p style={{ fontSize: '16px', fontWeight: 600, margin: '4px 0 0' }}>
                {invoice.invoiceNumber}
              </p>
              <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                Status: {invoice.status}
              </p>
            </div>
          </div>

          {/* Bill To + Dates */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
            <div>
              <p style={{ fontSize: '12px', textTransform: 'uppercase', color: '#999', margin: '0 0 4px', letterSpacing: '0.5px' }}>
                Bill To
              </p>
              {invoice.contact ? (
                <>
                  <p style={{ fontWeight: 600, margin: 0 }}>{invoice.contact.name}</p>
                  {invoice.contact.email && (
                    <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                      {invoice.contact.email}
                    </p>
                  )}
                  {invoice.contact.phone && (
                    <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                      {invoice.contact.phone}
                    </p>
                  )}
                  {invoice.contact.address && (
                    <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                      {invoice.contact.address}
                      {invoice.contact.city && `, ${invoice.contact.city}`}
                      {invoice.contact.state && `, ${invoice.contact.state}`}
                      {invoice.contact.zip && ` ${invoice.contact.zip}`}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: '#999' }}>—</p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '12px', textTransform: 'uppercase', color: '#999', margin: 0, letterSpacing: '0.5px' }}>
                  Issue Date
                </p>
                <p style={{ fontWeight: 500, margin: 0 }}>
                  {new Date(invoice.issueDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {invoice.dueDate && (
                <div>
                  <p style={{ fontSize: '12px', textTransform: 'uppercase', color: '#999', margin: 0, letterSpacing: '0.5px' }}>
                    Due Date
                  </p>
                  <p style={{ fontWeight: 500, margin: 0 }}>
                    {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reference */}
          {invoice.reference && (
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              <strong>Reference:</strong> {invoice.reference}
            </p>
          )}

          {/* Line Items Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '10px 0', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Description
                </th>
                <th style={{ textAlign: 'center', padding: '10px 0', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '60px' }}>
                  Qty
                </th>
                <th style={{ textAlign: 'right', padding: '10px 0', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px' }}>
                  Unit Price
                </th>
                <th style={{ textAlign: 'right', padding: '10px 0', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 0' }}>{item.description}</td>
                  <td style={{ padding: '10px 0', textAlign: 'center', color: '#666' }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: '#666', fontFamily: 'monospace' }}>
                    {fmt.format(item.unitAmount)}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt.format(item.lineAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
            <div style={{ width: '250px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                <span style={{ color: '#666' }}>Subtotal</span>
                <span style={{ fontFamily: 'monospace' }}>{fmt.format(invoice.subTotal)}</span>
              </div>
              {invoice.amountPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                  <span style={{ color: '#666' }}>Paid</span>
                  <span style={{ fontFamily: 'monospace', color: '#059669' }}>
                    -{fmt.format(invoice.amountPaid)}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0 0',
                  fontSize: '18px',
                  fontWeight: 700,
                  borderTop: '2px solid #111',
                  marginTop: '6px',
                }}
              >
                <span>Amount Due</span>
                <span style={{ fontFamily: 'monospace', color: '#0891b2' }}>
                  {fmt.format(invoice.amountDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '20px' }}>
              <p style={{ fontSize: '12px', textTransform: 'uppercase', color: '#999', margin: '0 0 4px', letterSpacing: '0.5px' }}>
                Notes
              </p>
              <p style={{ fontSize: '13px', color: '#666', whiteSpace: 'pre-wrap', margin: 0 }}>
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '60px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
            <p style={{ margin: 0 }}>Thank you for your business.</p>
            <p style={{ margin: '4px 0 0' }}>Your KC Homes LLC — tolley.io</p>
          </div>
        </div>
      </div>
    </>
  );
}
