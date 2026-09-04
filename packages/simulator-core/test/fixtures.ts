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

/**
 * The same clinic, with a one-day wait in front of the confirmation SMS. Enrolment now runs a
 * workflow to its end in the same tick (Phase 12), so a test that needs a run that is still
 * *active* — re-entry refusals, manual step and exit events — parks it here first.
 */
export function withWaitBefore(base: SimulatorScenario = scenario()): SimulatorScenario {
  return {
    ...base,
    initial_account_state: {
      ...base.initial_account_state,
      workflows: (base.initial_account_state.workflows ?? []).map((workflow) =>
        workflow.id === 'wf-booking-confirmation'
          ? {
              ...workflow,
              nodes: [
                {
                  id: 'n0',
                  type: 'wait' as const,
                  ghl_feature_id: 'GHL-WF-WAIT',
                  label: 'Wait a day',
                  config: { wait_type: 'period', days: 1 },
                  position: { x: 0, y: 60 },
                },
                ...workflow.nodes,
              ],
              edges: [{ from: 'n0', to: 'n1' }, ...workflow.edges],
            }
          : workflow,
      ),
    },
  };
}

/**
 * The Calendar Lab's shape of account (Phase 14).
 *
 * Three calendars covering the three families Phase 14 simulates, two team members so round robin
 * has something to distribute, one existing booking that gets in the way, and four workflows: two
 * appointment-scoped ones, a cancellation recovery filtered to Cancelled, and a form-triggered
 * one that must survive a cancellation untouched.
 *
 * Deliberately not pre-solved. `consultation` is the calendar the learner configures; it starts
 * with hours, a host and a thirty-minute duration and nothing else, so buffers, notice, services
 * and locations are work rather than decoration.
 *
 * The clock is Tuesday 8 September 2026, 09:00 America/Chicago. `nadia` is owned by Nia and
 * hosted by Theo, which is the pair that proves contact owner and appointment host are different
 * things (D-130).
 */
export function calendarScenario(overrides: Partial<SimulatorScenario> = {}): SimulatorScenario {
  const weekdays = [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '17:00' }));
  return {
    id: 'SC-test-calendar',
    title: 'Test calendar account',
    simulation_time: '2026-09-08T09:00:00-05:00',
    timezone: 'America/Chicago',
    seed: 4114,
    initial_account_state: {
      users: [
        { id: 'nia', name: 'Nia Okafor', role: 'admin' as const },
        { id: 'theo', name: 'Theo Marsh' },
        { id: 'ivy', name: 'Ivy Chen' },
      ],
      contacts: [
        {
          id: 'nadia',
          first_name: 'Nadia',
          last_name: 'Haddad',
          email: 'nadia@example.com',
          phone: '+15125550188',
          owner_id: 'nia',
          timezone: 'America/Chicago',
        },
        { id: 'priya', first_name: 'Priya', phone: '+15125550190' },
      ],
      tags: ['booked', 'win-back', 'confirmed-soon'],
      calendars: [
        {
          id: 'consultation',
          name: 'Consultation',
          type: 'personal' as const,
          duration_minutes: 30,
          slot_interval_minutes: 30,
          timezone: 'America/Chicago',
          availability: weekdays,
          staff_ids: ['theo'],
          locations: [
            { id: 'studio', kind: 'address' as const, value: '18 Rue Sainte, Marseille' },
            { id: 'phone-line', kind: 'phone' as const, value: '+15125550100' },
          ],
          default_location_id: 'studio',
        },
        {
          id: 'team-intro',
          name: 'Team Intro',
          type: 'round_robin' as const,
          duration_minutes: 30,
          slot_interval_minutes: 30,
          timezone: 'America/Chicago',
          availability: [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '12:00' })),
          staff_ids: ['theo', 'ivy'],
          assignment: 'optimize_availability' as const,
        },
        {
          id: 'treatments',
          name: 'Treatments',
          type: 'service' as const,
          duration_minutes: 30,
          slot_interval_minutes: 15,
          timezone: 'America/Chicago',
          availability: [{ day: 2, start: '10:00', end: '16:00' }],
          staff_ids: ['ivy', 'nia'],
          locations: [
            { id: 'room-1', kind: 'address' as const, value: '18 Rue Sainte, Marseille' },
            { id: 'call', kind: 'phone' as const, value: '+15125550100' },
          ],
          default_location_id: 'room-1',
          services: [
            {
              id: 'facial',
              name: 'Signature Facial',
              duration_minutes: 45,
              staff_ids: ['ivy'],
              location_id: 'room-1',
            },
            { id: 'consult-call', name: 'Consult Call', duration_minutes: 15, location_id: 'call' },
          ],
        },
      ],
      appointments: [
        {
          id: 'appt-nadia',
          contact_id: 'nadia',
          calendar_id: 'consultation',
          starts_at: '2026-09-08T11:00:00-05:00',
          host_id: 'theo',
        },
      ],
      forms: [{ id: 'enquiry', name: 'Enquiry', fields: ['first_name', 'phone'] }],
      workflows: [
        {
          id: 'wf-booking-confirmation',
          name: 'Booking Confirmation',
          trigger: {
            ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT',
            filters: [{ field: 'calendar', operator: 'is' as const, value: 'consultation' }],
          },
          nodes: [
            {
              id: 'w1',
              type: 'wait' as const,
              ghl_feature_id: 'GHL-WF-WAIT',
              label: 'The day before',
              config: { wait_type: 'appointment', relative: 'before', hours: 24 },
              position: { x: 0, y: 60 },
            },
            {
              id: 'n1',
              type: 'action' as const,
              ghl_feature_id: 'GHL-WF-SEND-SMS',
              label: 'Reminder',
              config: { template: 'See you at {{appointment.start_time}}.' },
              position: { x: 0, y: 180 },
            },
            { id: 'n2', type: 'end' as const, position: { x: 0, y: 300 } },
          ],
          edges: [
            { from: 'w1', to: 'n1' },
            { from: 'n1', to: 'n2' },
          ],
          settings: { allow_reentry: true, timezone: 'America/Chicago' },
        },
        {
          id: 'wf-cancellation-recovery',
          name: 'Cancellation Recovery',
          trigger: {
            ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
            filters: [{ field: 'appointment_status', operator: 'is' as const, value: 'cancelled' }],
          },
          nodes: [
            {
              id: 'c1',
              type: 'action' as const,
              ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
              config: { tag: 'win-back' },
              position: { x: 0, y: 120 },
            },
            { id: 'c2', type: 'end' as const, position: { x: 0, y: 240 } },
          ],
          edges: [{ from: 'c1', to: 'c2' }],
          settings: { allow_reentry: true, timezone: 'America/Chicago' },
        },
        {
          id: 'wf-confirmed-prep',
          name: 'Confirmed Prep',
          trigger: {
            ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
            filters: [{ field: 'appointment_status', operator: 'is' as const, value: 'confirmed' }],
          },
          nodes: [
            {
              id: 'p1',
              type: 'action' as const,
              ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
              config: { tag: 'confirmed-soon' },
              position: { x: 0, y: 120 },
            },
            { id: 'p2', type: 'end' as const, position: { x: 0, y: 240 } },
          ],
          edges: [{ from: 'p1', to: 'p2' }],
          settings: { allow_reentry: true, timezone: 'America/Chicago' },
        },
        {
          id: 'wf-enquiry-nurture',
          name: 'Enquiry Nurture',
          trigger: { ghl_feature_id: 'GHL-WF-FORM-SUBMITTED', filters: [] },
          nodes: [
            {
              id: 'e1',
              type: 'wait' as const,
              ghl_feature_id: 'GHL-WF-WAIT',
              label: 'Three days',
              config: { wait_type: 'period', days: 3 },
              position: { x: 0, y: 60 },
            },
            {
              id: 'e2',
              type: 'action' as const,
              ghl_feature_id: 'GHL-WF-SEND-SMS',
              config: { template: 'Still thinking it over?' },
              position: { x: 0, y: 180 },
            },
            { id: 'e3', type: 'end' as const, position: { x: 0, y: 300 } },
          ],
          edges: [
            { from: 'e1', to: 'e2' },
            { from: 'e2', to: 'e3' },
          ],
          settings: { allow_reentry: false, timezone: 'America/Chicago' },
        },
      ],
    },
    ...overrides,
  };
}

/**
 * The Funnel Lab's shape of account (Phase 13): the pieces a funnel connects to — a form, a
 * survey, a calendar, a product — one contact the account already knows, and a workflow triggered
 * by a form submission. No funnel: what the learner builds is the thing under test.
 */
export function funnelScenario(overrides: Partial<SimulatorScenario> = {}): SimulatorScenario {
  return {
    id: 'SC-test-funnel',
    title: 'Test funnel account',
    simulation_time: '2026-09-08T09:00:00-05:00',
    timezone: 'America/Chicago',
    seed: 5309,
    initial_account_state: {
      contacts: [
        {
          id: 'nadia',
          first_name: 'Nadia',
          last_name: 'Haddad',
          email: 'nadia@example.com',
          phone: '+15125550188',
          tags: ['returning'],
          custom_fields: { treatment_interest: 'Signature Facial' },
          timezone: 'America/Chicago',
        },
      ],
      tags: ['returning', 'new-lead', 'booked'],
      custom_fields: [
        {
          key: 'treatment_interest',
          label: 'Treatment interest',
          type: 'dropdown',
          options: ['Signature Facial', 'Membership', 'Laser'],
        },
        {
          key: 'budget_band',
          label: 'Budget band',
          type: 'dropdown',
          options: ['Under 200', '200 to 500', 'Over 500'],
        },
      ],
      calendars: [
        {
          id: 'consultation',
          name: 'Consultation',
          duration_minutes: 30,
          timezone: 'America/Chicago',
          minimum_notice_minutes: 60,
          availability: [
            { day: 1, start: '09:00', end: '17:00' },
            { day: 2, start: '09:00', end: '17:00' },
            { day: 3, start: '09:00', end: '17:00' },
            { day: 4, start: '09:00', end: '17:00' },
            { day: 5, start: '09:00', end: '17:00' },
          ],
        },
      ],
      forms: [
        {
          id: 'consult-request',
          name: 'Consultation Request',
          fields: ['first_name', 'last_name', 'email', 'phone', 'treatment_interest'],
        },
      ],
      surveys: [
        { id: 'fit-check', name: 'Fit Check', fields: ['treatment_interest', 'budget_band'] },
      ],
      products: [{ id: 'glow-membership', name: 'Glow Membership', price: 149, recurring: true }],
      workflows: [
        {
          id: 'wf-new-lead-welcome',
          name: 'New Lead Welcome',
          trigger: {
            ghl_feature_id: 'GHL-WF-FORM-SUBMITTED',
            filters: [{ field: 'form', operator: 'is' as const, value: 'consult-request' }],
          },
          nodes: [
            {
              id: 'n1',
              type: 'action' as const,
              ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
              label: 'Tag the lead',
              config: { tag: 'new-lead' },
              position: { x: 0, y: 120 },
            },
            {
              id: 'n2',
              type: 'action' as const,
              ghl_feature_id: 'GHL-WF-SEND-SMS',
              label: 'Welcome text',
              config: {
                template: 'Hi {{contact.first_name}}, thanks for asking.',
                purpose: 'welcome',
              },
              position: { x: 0, y: 240 },
            },
            { id: 'n3', type: 'end' as const, position: { x: 0, y: 360 } },
          ],
          edges: [
            { from: 'n1', to: 'n2' },
            { from: 'n2', to: 'n3' },
          ],
          settings: { allow_reentry: false, timezone: 'America/Chicago' },
        },
      ],
      funnels: [],
    },
    ...overrides,
  };
}
