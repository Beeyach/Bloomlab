import { fail } from './errors.ts';
import { requireString, type SimulatorEvent } from './events.ts';
import type { AccountState } from './state.ts';
import { entity, result, type ReducerResult } from './reducers/shared.ts';

export interface Price {
  id: string;
  product_id: string;
  name: string;
  cents: number;
  currency: 'USD';
  interval: 'one_time' | 'month' | 'year';
}
export interface PaymentLink {
  id: string;
  name: string;
  price_id: string;
  active: boolean;
}
export interface Invoice {
  id: string;
  contact_id: string;
  price_id: string;
  cents: number;
  status: 'open' | 'paid';
  created_at: string;
}
export interface Subscription {
  id: string;
  contact_id: string;
  price_id: string;
  status: 'active' | 'incomplete' | 'past_due' | 'cancelled';
  successful_charges: number;
  created_at: string;
}
export interface PaymentsCatalog {
  prices: Record<string, Price>;
  links: Record<string, PaymentLink>;
  invoices: Record<string, Invoice>;
  subscriptions: Record<string, Subscription>;
}
export const paymentsCatalog = (account: AccountState): PaymentsCatalog =>
  account.payments_catalog ?? { prices: {}, links: {}, invoices: {}, subscriptions: {} };
const invalid = (message: string): never => fail('INVALID_PAYLOAD', message, {});
const safeId = (event: SimulatorEvent, key = 'id') => {
  const id = requireString(event.payload, key, event.type);
  if (
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id) ||
    ['constructor', 'prototype', '__proto__'].includes(id)
  )
    invalid('Use a safe identifier, starting with a letter.');
  return id;
};

/** Local payment facts only. No card data, gateway, charge request, tax or hidden recurring clock. */
export function paymentsCatalogChanged(
  account: AccountState,
  event: SimulatorEvent,
): ReducerResult {
  const p = event.payload;
  const id = safeId(event);
  const catalog = paymentsCatalog(account);
  const input = [
    {
      kind: 'input' as const,
      at: event.at,
      event_id: event.id,
      data: { id, operation: event.type },
    },
  ];
  if (event.type === 'PRODUCT_SAVED') {
    const existing = account.products[id];
    const product = {
      id,
      name: requireString(p, 'name', event.type),
      price: existing?.price ?? 0,
      recurring: existing?.recurring ?? false,
    };
    return result({ ...account, products: { ...account.products, [id]: product } }, input);
  }
  if (event.type === 'PRICE_CREATED') {
    if (catalog.prices[id]) invalid('Prices are immutable. Create a new price identifier instead.');
    const productId = requireString(p, 'product_id', event.type);
    entity(account.products, productId, 'product', event.type);
    if (
      !Number.isSafeInteger(p.cents) ||
      (p.cents as number) <= 0 ||
      (p.cents as number) > 100_000_000
    )
      invalid('Price must be 1–100,000,000 whole US cents.');
    if (!['one_time', 'month', 'year'].includes(String(p.interval)))
      invalid('Choose one-time, monthly or yearly.');
    const price: Price = {
      id,
      product_id: productId,
      name: requireString(p, 'name', event.type),
      cents: p.cents as number,
      currency: 'USD',
      interval: p.interval as Price['interval'],
    };
    return result(
      {
        ...account,
        products: Object.values(catalog.prices).some((row) => row.product_id === productId)
          ? account.products
          : {
              ...account.products,
              [productId]: {
                ...account.products[productId]!,
                price: price.cents / 100,
                recurring: price.interval !== 'one_time',
              },
            },
        payments_catalog: { ...catalog, prices: { ...catalog.prices, [id]: price } },
      },
      input,
    );
  }
  if (event.type === 'PAYMENT_LINK_SAVED') {
    const priceId = requireString(p, 'price_id', event.type);
    entity(catalog.prices, priceId, 'price', event.type);
    if (typeof p.active !== 'boolean') invalid('A payment link needs an active flag.');
    const link = {
      id,
      price_id: priceId,
      name: requireString(p, 'name', event.type),
      active: p.active as boolean,
    };
    return result(
      { ...account, payments_catalog: { ...catalog, links: { ...catalog.links, [id]: link } } },
      input,
    );
  }
  if (event.type === 'INVOICE_CREATED') {
    if (catalog.invoices[id]) invalid('That invoice already exists.');
    const contactId = requireString(p, 'contact_id', event.type);
    entity(account.contacts, contactId, 'contact', event.type);
    const priceId = requireString(p, 'price_id', event.type);
    const price = entity(catalog.prices, priceId, 'price', event.type);
    if (price.interval !== 'one_time')
      invalid(
        'This Lab’s single-line invoice needs a one-time price. Use a payment link for a subscription.',
      );
    const invoice: Invoice = {
      id,
      contact_id: contactId,
      price_id: priceId,
      cents: price.cents,
      status: 'open',
      created_at: event.at,
    };
    return result(
      {
        ...account,
        payments_catalog: { ...catalog, invoices: { ...catalog.invoices, [id]: invoice } },
      },
      input,
    );
  }
  if (event.type === 'SUBSCRIPTION_CANCELLED') {
    const subscription = entity(catalog.subscriptions, id, 'subscription', event.type);
    if (subscription.status === 'cancelled') invalid('That subscription is already cancelled.');
    return result(
      {
        ...account,
        payments_catalog: {
          ...catalog,
          subscriptions: {
            ...catalog.subscriptions,
            [id]: { ...subscription, status: 'cancelled' },
          },
        },
      },
      input,
    );
  }
  if (event.type !== 'PAYMENT_CHECKOUT') return invalid('Unsupported payments operation.');
  if (account.payments[id])
    invalid('That payment attempt already exists. Reusing it cannot charge twice.');
  if (!['success', 'failed'].includes(String(p.outcome)))
    invalid('Choose a synthetic success or failure.');
  const success = p.outcome === 'success';
  const targetId = requireString(p, 'target_id', event.type);
  const source = requireString(p, 'source', event.type);
  let contactId: string;
  let priceId: string;
  let subscription: Subscription | null = null;
  let next = catalog;
  if (source === 'payment_link') {
    const link = entity(catalog.links, targetId, 'payment link', event.type);
    if (!link.active) invalid('That payment link is inactive.');
    contactId = requireString(p, 'contact_id', event.type);
    priceId = link.price_id;
    const price = entity(catalog.prices, priceId, 'price', event.type);
    if (price.interval !== 'one_time') {
      const subscriptionId = safeId(event, 'subscription_id');
      if (catalog.subscriptions[subscriptionId])
        invalid(
          'That subscription already exists. Record its next attempt using the subscription source.',
        );
      subscription = {
        id: subscriptionId,
        contact_id: contactId,
        price_id: priceId,
        status: success ? 'active' : 'incomplete',
        successful_charges: success ? 1 : 0,
        created_at: event.at,
      };
    }
  } else if (source === 'invoice') {
    const invoice = entity(catalog.invoices, targetId, 'invoice', event.type);
    if (invoice.status === 'paid') invalid('That invoice is already paid.');
    contactId = invoice.contact_id;
    priceId = invoice.price_id;
    if (success)
      next = {
        ...next,
        invoices: { ...next.invoices, [targetId]: { ...invoice, status: 'paid' } },
      };
  } else if (source === 'subscription') {
    const previous = entity(catalog.subscriptions, targetId, 'subscription', event.type);
    if (previous.status === 'cancelled') invalid('A cancelled subscription cannot be charged.');
    contactId = previous.contact_id;
    priceId = previous.price_id;
    subscription = {
      ...previous,
      status: success ? 'active' : previous.successful_charges === 0 ? 'incomplete' : 'past_due',
      successful_charges: previous.successful_charges + (success ? 1 : 0),
    };
  } else return invalid('Choose payment link, invoice or subscription.');
  entity(account.contacts, contactId, 'contact', event.type);
  const price = entity(catalog.prices, priceId, 'price', event.type);
  if (subscription)
    next = { ...next, subscriptions: { ...next.subscriptions, [subscription.id]: subscription } };
  const generated = [
    {
      type: success ? ('PAYMENT_RECEIVED' as const) : ('PAYMENT_FAILED' as const),
      at: event.at,
      origin: 'generated' as const,
      source: { kind: 'reducer' as const, id: 'payments_lab', caused_by: event.id },
      payload: {
        payment_id: id,
        contact_id: contactId,
        product_id: price.product_id,
        amount: price.cents / 100,
        payment_source: source,
        price_id: priceId,
        subscription_id: subscription?.id ?? null,
        invoice_id: source === 'invoice' ? targetId : null,
        reason: success ? null : requireString(p, 'reason', event.type),
      },
    },
  ];
  return result({ ...account, payments_catalog: next }, input, generated);
}
