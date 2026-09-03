import type { PendingEvent, SimulatorEventType, SimulatorScenario } from '../src/index.ts';

/**
 * A scenario shaped like the authored ones: a med spa with booked consultations, a confirmation
 * workflow, and two events queued for the day after the run starts. Everything the engine reads
 * is here, so the tests exercise the same code path the product does.
 */
export function scenario(overrides: Partial<SimulatorScenario> = {}): SimulatorScenario {
  return {
    id: 'SC-test-clinic',
    title: 'Test clinic',
    simulation_time: '2026-09-03T09:00:00-05:00',
    timezone: 'America/Chicago',
    seed: 4021,
    initial_account_state: {
      contacts: [
        {
          id: 'maria',
          first_name: 'Maria',
          last_name: 'Delgado',
          email: 'maria@example.com',
          phone: '+15125550142',
          tags: ['meta-lead'],
          custom_fields: { treatment_interest: 'Signature Facial' },
          timezone: 'America/Chicago',
          source: 'Meta lead ad',
        },
        // No phone: an SMS to Jordan is skipped, not silently sent.
        { id: 'jordan', first_name: 'Jordan', email: 'jordan@example.com', tags: ['meta-lead'] },
        // Do-not-disturb: receives nothing on any channel.
        { id: 'lena', first_name: 'Lena', phone: '+15125550177', dnd: true },
      ],
      tags: ['meta-lead', 'booked', 'no-show'],
      custom_fields: [
        {
          key: 'treatment_interest',
          label: 'Treatment interest',
          type: 'dropdown',
          options: ['Signature Facial', 'Membership', 'Laser'],
        },
        {
          key: 'consult_outcome',
          label: 'Consult outcome',
          type: 'dropdown',
          options: ['Booked', 'Thinking about it', 'Not a fit'],
        },
      ],
      custom_values: [{ key: 'front_desk_phone', value: '+15125550100' }],
      pipelines: [
        {
          id: 'consultations',
          name: 'Consultations',
          stages: ['New Lead', 'Booked', 'Showed', 'Won'],
        },
      ],
      opportunities: [
        {
          id: 'opp-maria',
          contact_id: 'maria',
          pipeline_id: 'consultations',
          stage: 'Booked',
          value: 410,
        },
      ],
      calendars: [
        {
          id: 'consultation',
          name: 'Consultation',
          duration_minutes: 30,
          timezone: 'America/Chicago',
        },
      ],
      appointments: [
        {
          id: 'appt-maria',
          contact_id: 'maria',
          calendar_id: 'consultation',
          starts_at: '2026-09-04T15:00:00-05:00',
        },
      ],
      forms: [
        {
          id: 'consult-request',
          name: 'Consultation Request',
          fields: ['first_name', 'phone', 'email', 'treatment_interest'],
        },
      ],
      surveys: [{ id: 'intake', name: 'Intake', fields: ['treatment_interest'] }],
      products: [{ id: 'facial', name: 'Signature Facial', price: 410 }],
      workflows: [
        {
          id: 'wf-booking-confirmation',
          name: 'Booking Confirmation',
          trigger: {
            ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT',
            filters: [{ field: 'calendar', operator: 'is', value: 'consultation' }],
          },
          nodes: [
            {
              id: 'n1',
              type: 'action',
              ghl_feature_id: 'GHL-WF-SEND-SMS',
              label: 'Confirmation SMS',
              config: { template: 'You are booked.' },
              position: { x: 0, y: 120 },
            },
            {
              id: 'n2',
              type: 'action',
              ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
              config: { tag: 'booked' },
              position: { x: 0, y: 240 },
            },
            { id: 'n3', type: 'end', position: { x: 0, y: 360 } },
          ],
          edges: [
            { from: 'n1', to: 'n2' },
            { from: 'n2', to: 'n3' },
          ],
          settings: { allow_reentry: false, timezone: 'America/Chicago' },
        },
      ],
    },
    scheduled_events: [
      {
        at: '2026-09-04T15:35:00-05:00',
        type: 'appointment.status_changed',
        payload: { appointment_id: 'appt-maria', status: 'no_show' },
        description: 'Maria does not arrive.',
      },
      {
        at: '2026-09-03T10:00:00-05:00',
        type: 'tag.added',
        payload: { contact_id: 'maria', tag: 'no-show' },
      },
    ],
    injectable_events: [
      {
        id: 'maria-cancels',
        type: 'appointment.status_changed',
        description: 'Maria cancels the evening before.',
        payload: { appointment_id: 'appt-maria', status: 'cancelled' },
      },
      {
        id: 'jordan-books-late',
        type: 'appointment.booked',
        description: 'Jordan books 40 minutes from now.',
        payload: {
          appointment_id: 'appt-jordan',
          contact_id: 'jordan',
          calendar_id: 'consultation',
          minutes_from_now: 40,
        },
      },
    ],
    ...overrides,
  };
}

/** The registry slice the scenario validator needs, with one REAL_GHL entry to refuse. */
export const FEATURES = [
  { id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT', fidelity: 'A' as const },
  { id: 'GHL-WF-SEND-SMS', fidelity: 'A' as const },
  { id: 'GHL-WF-ADD-CONTACT-TAG', fidelity: 'A' as const },
  { id: 'GHL-WF-WAIT', fidelity: 'B' as const },
  { id: 'GHL-SNAP-SNAPSHOTS', fidelity: 'REAL_GHL' as const },
];

/** An event as a caller would inject it: the run stamps identity and order. */
export const event = (
  type: SimulatorEventType,
  at: string,
  payload: Record<string, unknown> = {},
): PendingEvent => ({ type, at, payload, origin: 'injected' });

export const NOW = '2026-09-03T09:00:00-05:00';
