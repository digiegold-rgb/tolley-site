import { getStripeClient } from '@/lib/stripe';

interface InvoiceForLink {
  id: string;
  total: number;
  invoiceNumber: string;
  contact?: { name: string; email?: string | null } | null;
}

export async function createInvoicePaymentLink(invoice: InvoiceForLink) {
  const stripe = getStripeClient();

  const product = await stripe.products.create({
    name: `Invoice ${invoice.invoiceNumber}`,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(invoice.total * 100),
    currency: 'usd',
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    },
    after_completion: {
      type: 'redirect',
      redirect: {
        url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://tolley.io'}/account/invoices/${invoice.id}/thank-you`,
      },
    },
  });

  return {
    paymentLinkId: paymentLink.id,
    paymentLinkUrl: paymentLink.url,
  };
}
