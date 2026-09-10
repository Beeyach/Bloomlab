import { useState } from 'react';
import { Link } from 'react-router';
import { paymentsCatalog } from '@bloomlab/simulator-core';
import { Button, Stack, Field, Select } from '@bloomlab/design-system';
import { useCrmRun, CRM_SCENARIO_ID } from '../crm/useCrmRun';
import { Entry, Choice, SaveForm } from '../crm/AdvancedCrm';
import { runCommand } from '../crm/commands';
import styles from '../crm/crm.module.css';

const text = (d: FormData, key: string) => String(d.get(key) ?? '').trim();
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)} USD`;

export default function PaymentsLab() {
  const { run, loading, problem, refusal, apply, dismissRefusal } = useCrmRun();
  const [area, setArea] = useState('catalog');
  const [source, setSource] = useState('payment_link');
  if (loading || !run)
    return (
      <Stack gap={3}>
        <h1>Payments Lab</h1>
        <p role={problem ? 'alert' : 'status'}>
          {problem ?? 'Opening the shared training account…'}
        </p>
      </Stack>
    );
  const account = run.state.account;
  const catalog = paymentsCatalog(account);
  const contacts = Object.values(account.contacts).map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name ?? ''}`.trim(),
  }));
  const prices = Object.values(catalog.prices).map((p) => ({
    id: p.id,
    name: `${p.name} · ${dollars(p.cents)} · ${p.interval.replace('_', ' ')}`,
  }));
  return (
    <Stack gap={4} className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Payments Lab</h1>
        <p>
          Build the offer, then trace the payment. Every amount and outcome here is synthetic. No
          card, provider or real charge is involved.
        </p>
        <p>
          {account.account.name} · simulated time {run.state.clock.now}
        </p>
        <p>
          <Link to="/crm">Open this account in CRM</Link> ·{' '}
          <Link to={`/workflow?scenario=${CRM_SCENARIO_ID}`}>Workflow Lab</Link> ·{' '}
          <Link to={`/calendar?scenario=${CRM_SCENARIO_ID}`}>Calendar Lab</Link> ·{' '}
          <Link to={`/reporting?scenario=${CRM_SCENARIO_ID}`}>Reporting</Link>
        </p>
      </header>
      <nav aria-label="Payments areas">
        <ul className={styles.modes}>
          {[
            { id: 'catalog', label: 'Products & prices' },
            { id: 'offers', label: 'Links & invoices' },
            { id: 'checkout', label: 'Payment attempts' },
            { id: 'history', label: 'Ledger & subscriptions' },
          ].map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={styles.mode}
                aria-current={area === a.id ? 'page' : undefined}
                onClick={() => setArea(a.id)}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {refusal && (
        <section role="alert">
          <p>Bloomlab refused that change: {refusal.message}</p>
          <Button variant="ghost" onClick={dismissRefusal}>
            Dismiss
          </Button>
        </section>
      )}
      {problem && <p role="alert">That could not be saved: {problem}</p>}
      <div className={styles.advanced}>
        {area === 'catalog' && (
          <>
            <h2>Products & prices</h2>
            <p>
              A product is what is sold. A price fixes its amount and billing interval. Prices are
              immutable here so an edit cannot silently change an existing invoice or subscription.
            </p>
            <ul>
              {Object.values(account.products).map((p) => (
                <li key={p.id}>
                  {p.name} · {p.id}
                </li>
              ))}
            </ul>
            <ul>
              {prices.map((p) => (
                <li key={p.id}>
                  {p.name} · {p.id}
                </li>
              ))}
            </ul>
            {!prices.length && (
              <p>
                No Lab prices yet. Existing scenario products need an explicit price before
                checkout.
              </p>
            )}
            <SaveForm
              title="Save product"
              type="PRODUCT_SAVED"
              apply={apply}
              payload={(d) => ({ id: text(d, 'id'), name: text(d, 'name') })}
            >
              <Entry label="Product identifier (reuse to rename)" name="id" />
              <Entry label="Product name" name="name" />
            </SaveForm>
            <SaveForm
              title="Create price"
              type="PRICE_CREATED"
              apply={apply}
              payload={(d) => ({
                id: text(d, 'id'),
                name: text(d, 'name'),
                product_id: text(d, 'product'),
                cents: Number(text(d, 'cents')),
                interval: text(d, 'interval'),
              })}
            >
              <Entry label="New price identifier" name="id" />
              <Entry label="Price name" name="name" />
              <Choice label="Product" name="product" options={Object.values(account.products)} />
              <Entry label="Amount in US cents (2500 means $25)" name="cents" type="number" />
              <Choice
                label="Billing interval"
                name="interval"
                options={[
                  { id: 'one_time', name: 'One-time' },
                  { id: 'month', name: 'Monthly subscription' },
                  { id: 'year', name: 'Yearly subscription' },
                ]}
              />
            </SaveForm>
          </>
        )}
        {area === 'offers' && (
          <>
            <h2>Links & invoices</h2>
            <p>
              A payment link selects a price; an invoice also names the customer who owes it. These
              are local training offers, not public checkout URLs or sent invoices.
            </p>
            <ul>
              {Object.values(catalog.links).map((l) => (
                <li key={l.id}>
                  {l.name} · {l.id} · {l.active ? 'active' : 'inactive'} · {l.price_id}
                </li>
              ))}
            </ul>
            <ul>
              {Object.values(catalog.invoices).map((i) => (
                <li key={i.id}>
                  {i.id} · {contacts.find((c) => c.id === i.contact_id)?.name} · {dollars(i.cents)}{' '}
                  · {i.status}
                </li>
              ))}
            </ul>
            {!Object.keys(catalog.links).length && !Object.keys(catalog.invoices).length && (
              <p>No payment links or invoices yet.</p>
            )}
            <SaveForm
              title="Save payment link"
              type="PAYMENT_LINK_SAVED"
              apply={apply}
              payload={(d) => ({
                id: text(d, 'id'),
                name: text(d, 'name'),
                price_id: text(d, 'price'),
                active: text(d, 'active') === 'true',
              })}
            >
              <Entry label="Link identifier (reuse to edit)" name="id" />
              <Entry label="Link name" name="name" />
              <Choice label="Price" name="price" options={prices} />
              <Choice
                label="Link status"
                name="active"
                options={[
                  { id: 'true', name: 'Active' },
                  { id: 'false', name: 'Inactive' },
                ]}
              />
            </SaveForm>
            <SaveForm
              title="Create invoice"
              type="INVOICE_CREATED"
              apply={apply}
              payload={(d) => ({
                id: text(d, 'id'),
                contact_id: text(d, 'contact'),
                price_id: text(d, 'price'),
              })}
            >
              <Entry label="Invoice identifier" name="id" />
              <Choice label="Customer" name="contact" options={contacts} />
              <Choice
                label="One-time price"
                name="price"
                options={prices.filter((p) => catalog.prices[p.id]?.interval === 'one_time')}
              />
            </SaveForm>
          </>
        )}
        {area === 'checkout' && (
          <>
            <h2>Payment attempts</h2>
            <p>
              Choose a synthetic outcome. Failure records no revenue; a successful retry is a new
              attempt. Each attempt identifier is accepted once. Subscription charges are explicit
              events at the account clock, not automatic monthly billing.
            </p>
            <Field label="Payment source">
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="payment_link">Payment link</option>
                <option value="invoice">Invoice</option>
                <option value="subscription">Subscription retry / renewal</option>
              </Select>
            </Field>
            <SaveForm
              key={source}
              title="Record synthetic payment"
              type="PAYMENT_CHECKOUT"
              apply={apply}
              payload={(d) => ({
                id: text(d, 'id'),
                source,
                target_id: text(d, 'target'),
                contact_id: text(d, 'contact'),
                subscription_id: text(d, 'subscription'),
                outcome: text(d, 'outcome'),
                reason: text(d, 'reason'),
              })}
            >
              <Entry label="Unique payment attempt identifier" name="id" />
              <Choice
                label="Offer or subscription"
                name="target"
                options={
                  source === 'payment_link'
                    ? Object.values(catalog.links)
                    : source === 'invoice'
                      ? Object.values(catalog.invoices).map((i) => ({
                          id: i.id,
                          name: `${i.id} · ${i.status}`,
                        }))
                      : Object.values(catalog.subscriptions).map((s) => ({
                          id: s.id,
                          name: `${s.id} · ${s.status}`,
                        }))
                }
              />
              {source === 'payment_link' && (
                <>
                  <Choice label="Customer" name="contact" options={contacts} />
                  <Entry
                    label="New subscription identifier (unused for a one-time price)"
                    name="subscription"
                  />
                </>
              )}
              <Choice
                label="Synthetic outcome"
                name="outcome"
                options={[
                  { id: 'success', name: 'Success' },
                  { id: 'failed', name: 'Failed' },
                ]}
              />
              <Entry
                label="Failure reason (unused for success)"
                name="reason"
                value="Synthetic decline"
              />
            </SaveForm>
            <p>
              Payment Received can filter success or failed events. Refund uses its own workflow
              trigger. Configure and publish a workflow in this same account before recording the
              attempt.
            </p>
          </>
        )}
        {area === 'history' && (
          <>
            <h2>Ledger & subscriptions</h2>
            <p>
              Refunds reverse collected revenue; they do not cancel a subscription or reopen a paid
              invoice. Cancellation stops further subscription attempts. No money moves.
            </p>
            <ul>
              {Object.values(account.payments).map((p) => (
                <li key={p.id}>
                  {p.id} · {contacts.find((c) => c.id === p.contact_id)?.name} ·{' '}
                  {dollars(Math.round(p.amount * 100))} · {p.status}
                  {p.reason ? ` · ${p.reason}` : ''}
                </li>
              ))}
            </ul>
            {!Object.keys(account.payments).length && <p>No payments recorded yet.</p>}
            <ul>
              {Object.values(catalog.subscriptions).map((s) => (
                <li key={s.id}>
                  {s.id} · {s.price_id} · {s.status} · {s.successful_charges} successful charges{' '}
                  <Button
                    variant="ghost"
                    disabled={s.status === 'cancelled'}
                    onClick={() =>
                      void apply((r) =>
                        runCommand(r, { type: 'SUBSCRIPTION_CANCELLED', payload: { id: s.id } }),
                      )
                    }
                  >
                    Cancel {s.id}
                  </Button>
                </li>
              ))}
            </ul>
            <SaveForm
              title="Record full synthetic refund"
              type="REFUND_ISSUED"
              apply={apply}
              payload={(d) => ({ payment_id: text(d, 'payment'), reason: text(d, 'reason') })}
            >
              <Choice
                label="Received payment"
                name="payment"
                options={Object.values(account.payments)
                  .filter((p) => p.status === 'received')
                  .map((p) => ({
                    id: p.id,
                    name: `${p.id} · ${dollars(Math.round(p.amount * 100))}`,
                  }))}
              />
              <Entry label="Refund reason" name="reason" />
            </SaveForm>
            <h3>Shared event trail</h3>
            <ol>
              {run.state.log
                .filter((e) =>
                  [
                    'PAYMENT_RECEIVED',
                    'PAYMENT_FAILED',
                    'REFUND_ISSUED',
                    'WORKFLOW_ENROLLED',
                    'SUBSCRIPTION_CANCELLED',
                  ].includes(e.type),
                )
                .slice(-30)
                .map((e) => (
                  <li key={e.id}>
                    {e.sequence}: {e.type.toLowerCase().replaceAll('_', ' ')} · {e.at}
                  </li>
                ))}
            </ol>
          </>
        )}
        <p>
          Lab limits: USD, one item per invoice, full successful refunds only, no tax, proration,
          coupons, provider disputes, real invoice delivery or automatic renewal schedule. Training
          counters are not accounting advice or proof of real payment setup.
        </p>
      </div>
    </Stack>
  );
}
