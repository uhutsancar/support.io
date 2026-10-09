// The owner's invoices, from Paddle (plan v10 BIL-06).
//
// Paddle is the merchant of record: it issues the invoice, with the company
// name and tax number the buyer entered at checkout, and mails it. The
// billing page lists the subscription's billed payments and hands out
// Paddle's short-lived PDF link for one of them — only for a payment that
// belongs to this organization's Paddle customer.

import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { billingConfig } from '../config/billing';
import type { BillingConfig } from '../config/billing';

export interface Invoice {
  id: string;
  number: string | null;
  billedAt: string | null;
  /** In major units, as Paddle billed it (tax included). */
  total: number | null;
  currency: string;
  status: string;
}

export interface InvoiceSource {
  /** The customer's billed and completed payments, newest first. */
  list(customerId: string, config: BillingConfig): Promise<Invoice[]>;
  /** A link to the payment's PDF, or null when it is not this customer's. */
  pdf(transactionId: string, customerId: string, config: BillingConfig): Promise<string | null>;
}

const client = (config: BillingConfig) =>
  new Paddle(config.apiKey as string, {
    environment: config.environment === 'production' ? Environment.production : Environment.sandbox
  });

const ZERO_DECIMAL = new Set(['JPY', 'KRW']);
const major = (amount: string | undefined, currency: string) =>
  amount === undefined ? null : Number(amount) / (ZERO_DECIMAL.has(currency) ? 1 : 100);

const paddleSource: InvoiceSource = {
  async list(customerId, config) {
    const page = await client(config)
      .transactions.list({
        customerId: [customerId],
        status: ['billed', 'completed'],
        orderBy: 'billed_at[DESC]',
        perPage: 24
      })
      .next();
    return page.map((tx) => ({
      id: tx.id,
      number: tx.invoiceNumber,
      billedAt: tx.billedAt,
      total: major(tx.details?.totals?.total, tx.currencyCode),
      currency: tx.currencyCode,
      status: tx.status
    }));
  },
  async pdf(transactionId, customerId, config) {
    const paddle = client(config);
    const tx = await paddle.transactions.get(transactionId);
    if (tx.customerId !== customerId) return null;
    return (await paddle.transactions.getInvoicePDF(transactionId)).url;
  }
};

let source: InvoiceSource = paddleSource;

/** Tests replace Paddle; null puts the real one back. */
export function useInvoiceSource(next: InvoiceSource | null): void {
  source = next ?? paddleSource;
}

export function listInvoices(customerId: string): Promise<Invoice[]> {
  return source.list(customerId, billingConfig());
}

/** The PDF link, or null when the payment is not this customer's. */
export function invoicePdf(customerId: string, transactionId: string): Promise<string | null> {
  return source.pdf(transactionId, customerId, billingConfig());
}
