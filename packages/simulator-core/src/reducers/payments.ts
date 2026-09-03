import { fail } from '../errors.ts';
import { optionalString, requireNumber, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, Payment } from '../state.ts';
import { bumpAnalytics, entity, put, result, type ReducerResult } from './shared.ts';

/** Payments (PAY-001). Revenue in a report is the sum of what the run actually collected. */

function record(
  account: AccountState,
  event: SimulatorEvent,
  status: Payment['status'],
): { payment: Payment; account: AccountState } {
  const id = requireString(event.payload, 'payment_id', event.type);
  if (account.payments[id]) {
    fail('DUPLICATE_ENTITY', `A payment ${id} already exists`, { payment_id: id });
  }
  const contactId = requireString(event.payload, 'contact_id', event.type);
  entity(account.contacts, contactId, 'contact', event.type);
  const productId = optionalString(event.payload, 'product_id');
  if (productId) entity(account.products, productId, 'product', event.type);
  const amount = requireNumber(event.payload, 'amount', event.type);
  if (amount < 0) {
    fail('INVALID_PAYLOAD', `${event.type} amount cannot be negative`, { amount });
  }
  const payment: Payment = {
    id,
    contact_id: contactId,
    product_id: productId,
    amount,
    status,
    reason: optionalString(event.payload, 'reason'),
    at: event.at,
  };
  return { payment, account: { ...account, payments: put(account.payments, id, payment) } };
}

export function paymentReceived(account: AccountState, event: SimulatorEvent): ReducerResult {
  const { payment, account: withPayment } = record(account, event, 'received');
  const next = bumpAnalytics(withPayment, {
    payments_received: account.analytics.payments_received + 1,
    revenue: account.analytics.revenue + payment.amount,
  });
  return result(next, [
    {
      kind: 'input',
      at: event.at,
      contact_id: payment.contact_id,
      event_id: event.id,
      data: { payment_id: payment.id, amount: payment.amount, product_id: payment.product_id },
    },
  ]);
}

export function paymentFailed(account: AccountState, event: SimulatorEvent): ReducerResult {
  const { payment, account: withPayment } = record(account, event, 'failed');
  const next = bumpAnalytics(withPayment, {
    payments_failed: account.analytics.payments_failed + 1,
  });
  return result(next, [
    {
      kind: 'failure',
      at: event.at,
      contact_id: payment.contact_id,
      event_id: event.id,
      data: { payment_id: payment.id, amount: payment.amount },
      reason: payment.reason ?? 'payment_failed',
    },
  ]);
}

/** A refund reverses a payment that was actually received, and takes its revenue back out. */
export function refundIssued(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'payment_id', event.type);
  const existing = entity(account.payments, id, 'payment', event.type);
  if (existing.status !== 'received') {
    fail('INVALID_PAYLOAD', `Payment ${id} is ${existing.status} and cannot be refunded`, {
      payment_id: id,
      status: existing.status,
    });
  }
  const refunded: Payment = {
    ...existing,
    status: 'refunded',
    reason: optionalString(event.payload, 'reason'),
  };
  const next = bumpAnalytics(
    { ...account, payments: put(account.payments, id, refunded) },
    {
      refunds_issued: account.analytics.refunds_issued + 1,
      revenue: account.analytics.revenue - existing.amount,
    },
  );
  return result(next, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: { payment_id: id, amount: existing.amount },
      reason: refunded.reason,
    },
  ]);
}
