import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import { Button, Field, Select, Sheet, StatusPill, ToolPanel } from '@bloomlab/design-system';
import { calendarZone, validateCalendar, type Calendar, type Slot } from '@bloomlab/simulator-core';

import {
  blankCalendar,
  bookAppointment,
  cancelAppointment,
  newCalendarId,
  rescheduleAppointment,
  saveCalendar,
  setAppointmentStatus,
} from './commands';
import { sameDefinition } from './edit';
import { Appointments, BookingPanel } from './Lifecycle';
import { chainSince, logWatermark } from './session';
import { Settings } from './Settings';
import { Resources } from './Resources';
import { saveResource } from './commands';
import { DEFAULT_CALENDAR_SCENARIO_ID, scenarioFor, useCalendarRun } from './useCalendarRun';
import { clockTime, schedule, VISIBLE_DAYS } from './week';
import { GROUP_LABELS, GROUPS, ISSUE_WORDS, type Group } from './words';
import { Workspace } from './Workspace';
import styles from './calendar.module.css';

/**
 * The Calendar Lab (CAL-001, CAL-003).
 *
 * A scheduling simulator. The workspace is a run of days because the thing being learnt is time:
 * change the duration, the buffers, the notice or the team and the openings under your hands
 * change while you watch. The configuration sits beside it in five groups rather than as three
 * permanent panels, because these are five different questions and only one of them is open at
 * once.
 *
 * Nothing about scheduling lives here. What is bookable is `simulator-core`; a saved calendar is
 * account state reached by an event (D-126); the run is the one every Lab shares (D-108); every
 * execution goes through the one door (D-109). What this screen owns is the draft under edit, the
 * chosen slot, the selected appointment and which settings group is open.
 */

const NARROW = '(max-width: 767px)';

function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;

const ORIGIN_WORDS: Record<string, string> = {
  injected: 'from the Lab',
  generated: 'caused by it',
  scheduled: 'a scheduled wake',
  clock: 'the clock',
  scenario: 'the scenario',
};

export default function CalendarLab() {
  const [params, setParams] = useSearchParams();
  const scenarioId = scenarioFor(params.get('scenario') ?? '')
    ? (params.get('scenario') as string)
    : DEFAULT_CALENDAR_SCENARIO_ID;
  const { run, scenario, runs, loading, busy, refusal, problem, perform, reset, switchRun } =
    useCalendarRun(scenarioId);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);

  const calendarId = params.get('calendar');
  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const [stored, setStored] = useState<{ key: string; version: number; draft: Calendar } | null>(
    null,
  );
  const [group, setGroup] = useState<Group>('basics');
  const [settingsOpen, setSettingsOpen] = useState(false);
  /**
   * Everything a choice on one calendar means: the slot picked, the appointment selected, the
   * service and the host asked for. Held together and keyed by the calendar, so switching
   * calendars drops all of it at once without an effect that has to remember to.
   */
  const [scope, setScope] = useState<{
    key: string;
    chosen: Slot | null;
    selected: string | null;
    serviceId: string;
    staffId: string;
  }>({ key: '', chosen: null, selected: null, serviceId: '', staffId: '' });
  const [pickedContact, setPickedContact] = useState<string | null>(null);
  const [bookedBy, setBookedBy] = useState<'customer' | 'staff'>('customer');
  const [watermark, setWatermark] = useState<number | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const account = run?.state.account ?? null;
  const saved: Calendar | null =
    account && calendarId ? (account.calendars[calendarId] ?? null) : null;
  const savedVersion = saved?.version ?? 0;

  // No calendar chosen yet: the URL takes the first the account has. A router change, not state.
  useEffect(() => {
    if (!account || calendarId) return;
    const first = Object.values(account.calendars).sort((a, b) => a.name.localeCompare(b.name))[0];
    if (first) setParam({ calendar: first.id });
  }, [account, calendarId, setParam]);

  const draft: Calendar | null = useMemo(() => {
    if (!account || !calendarId) return null;
    if (stored && stored.key === calendarId && stored.version === savedVersion) return stored.draft;
    return saved ?? blankCalendar(calendarId, 'New calendar', account.account.timezone);
  }, [account, calendarId, saved, savedVersion, stored]);

  const change = (next: Calendar) => {
    if (!calendarId) return;
    setStored({ key: calendarId, version: savedVersion, draft: next });
  };

  const here = scope.key === calendarId ? scope : null;
  const chosen = here?.chosen ?? null;
  const selected = here?.selected ?? null;
  const serviceId = here?.serviceId ?? '';
  const staffId = here?.staffId ?? '';
  const inScope = (patch: Partial<typeof scope>) =>
    setScope({
      key: calendarId ?? '',
      chosen,
      selected,
      serviceId,
      staffId,
      ...patch,
    });

  // A test booking starts with whoever the account lists first, until the learner picks somebody.
  const firstContact = account
    ? (Object.values(account.contacts).sort((a, b) => a.first_name.localeCompare(b.first_name))[0]
        ?.id ?? '')
    : '';
  const contactId = pickedContact ?? firstContact;

  const issues = useMemo(
    () => (draft && account ? validateCalendar(draft, account) : []),
    [draft, account],
  );
  const errors = issues.filter((issue) => issue.severity === 'error');

  const zone = account && draft ? calendarZone(account, draft) : 'UTC';

  const appointments = useMemo(() => {
    if (!account || !saved) return [];
    return Object.values(account.appointments)
      .filter((row) => row.calendar_id === saved.id)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
  }, [account, saved]);
  const selectedAppointment = appointments.find((row) => row.id === selected) ?? null;

  // The schedule is drawn from the SAVED calendar, because unsaved edits are not what the account
  // would offer anybody. When an appointment is selected the same workspace becomes its move
  // picker: ignore the appointment's old hold and preserve the duration/service it was booked for.
  const days = useMemo(() => {
    if (!account || !run || !saved) return [];
    return schedule(
      account,
      saved,
      run.state.clock.now,
      selectedAppointment
        ? {
            service_id: selectedAppointment.service_id,
            duration_minutes: selectedAppointment.duration_minutes,
            ignore_appointment_id: selectedAppointment.id,
          }
        : {
            service_id: serviceId || null,
            staff_id: staffId || null,
          },
    );
  }, [account, run, saved, selectedAppointment, serviceId, staffId]);

  const chain = useMemo(
    () => (run && account && watermark !== null ? chainSince(run, watermark, account) : []),
    [run, account, watermark],
  );

  const act = async (command: Parameters<typeof perform>[0]) => {
    if (!run) return null;
    const from = logWatermark(run);
    const result = await perform(command);
    if (result?.ok) setWatermark(from);
    return result;
  };

  const save = async () => {
    if (!run || !scenario || !draft || !calendarId) return;
    const result = await act((current) => saveCalendar(current, scenario, draft));
    if (result?.ok) {
      const accepted = result.run.state.account.calendars[draft.id];
      if (accepted) setStored({ key: calendarId, version: accepted.version, draft: accepted });
    }
  };

  const book = async () => {
    if (!scenario || !saved || !chosen || !contactId) return;
    const service = saved.services.find((row) => row.id === serviceId) ?? null;
    const result = await act((current) =>
      bookAppointment(current, scenario, {
        contact_id: contactId,
        calendar_id: saved.id,
        slot: chosen,
        service_id: service?.id ?? null,
        location_id: service?.location_id ?? saved.default_location_id,
        booked_by: bookedBy,
      }),
    );
    if (result?.ok) inScope({ chosen: null });
  };

  const addCalendar = () => {
    if (!account) return;
    const id = newCalendarId();
    setStored({
      key: id,
      version: 0,
      draft: blankCalendar(id, 'New calendar', account.account.timezone),
    });
    setParam({ calendar: id });
    setGroup('basics');
    if (narrow) setSettingsOpen(true);
  };

  if (loading) {
    return (
      <div className={styles.screen}>
        <p className={styles.muted}>Opening the training account…</p>
      </div>
    );
  }

  if (!scenario || !run || !account || !draft) {
    return (
      <div className={styles.screen}>
        <h1 className={styles.title}>Calendar Lab</h1>
        <p className={styles.muted}>{problem ?? 'This scenario is not available.'}</p>
      </div>
    );
  }

  const calendars = Object.values(account.calendars).sort((a, b) => a.name.localeCompare(b.name));
  const dirty = !saved || !sameDefinition(saved, draft);

  const settings = (
    <>
      <div className={styles.groupTabs} role="tablist" aria-label="Calendar settings">
        {GROUPS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={group === name}
            className={group === name ? `${styles.groupTab} ${styles.groupTabOn}` : styles.groupTab}
            onClick={() => setGroup(name)}
            data-testid={`group-${name}`}
          >
            {GROUP_LABELS[name]}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={GROUP_LABELS[group]}>
        <Settings group={group} draft={draft} account={account} onChange={change} />
        {group === 'service' && (
          <Resources
            busy={busy}
            onSave={(resource) => act((current) => saveResource(current, scenario, resource))}
          />
        )}
      </div>
    </>
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calendar Lab</h1>
        <p className={styles.lead}>
          Scheduling for {scenario.title}. Set what the appointment is, when it can happen and who
          takes it, then book one and watch the same account react.
        </p>
      </header>

      <div className={styles.accountBar}>
        <dl className={styles.facts}>
          <div>
            <dt>Account</dt>
            <dd>{account.account.name}</dd>
          </div>
          <div>
            <dt>Simulator time</dt>
            <dd>{clockTime(run.state.clock.now, run.state.clock.timezone)}</dd>
          </div>
          <div>
            <dt>Appointments</dt>
            <dd>{Object.keys(account.appointments).length}</dd>
          </div>
        </dl>
        <div className={styles.runControls}>
          {runs.length > 1 && (
            <Field label="Saved run">
              <Select
                value={run.state.run_id}
                onChange={(event) => void switchRun(event.target.value)}
                data-testid="calendar-run"
              >
                {runs.map((summary) => (
                  <option key={summary.run_id} value={summary.run_id}>
                    {clockTime(summary.updated_at, run.state.clock.timezone)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {confirmingReset ? (
            <>
              <span className={styles.rowNote}>Reset the whole account?</span>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmingReset(false);
                  setStored(null);
                  setScope({ key: '', chosen: null, selected: null, serviceId: '', staffId: '' });
                  setWatermark(null);
                  void reset();
                }}
                data-testid="calendar-reset-confirm"
              >
                Reset
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmingReset(true)}
              data-testid="calendar-reset"
            >
              Reset the account
            </Button>
          )}
        </div>
      </div>

      {refusal && (
        <p className={styles.refusal} role="alert" data-testid="calendar-refusal">
          {refusal.message}
        </p>
      )}
      {problem && <p className={styles.refusal}>{problem}</p>}

      <div className={styles.calendarBar}>
        <Field label="Calendar">
          <Select
            value={calendarId ?? ''}
            onChange={(event) => setParam({ calendar: event.target.value })}
            data-testid="calendar-picker"
          >
            {!saved && calendarId && <option value={calendarId}>{draft.name} (unsaved)</option>}
            {calendars.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" onClick={addCalendar} data-testid="calendar-add">
          New calendar
        </Button>
        <span className={styles.saveState} data-testid="calendar-save-state">
          {dirty ? 'Unsaved changes' : `Saved · version ${savedVersion}`}
        </span>
        <Button onClick={() => void save()} disabled={busy || !dirty} data-testid="calendar-save">
          Save
        </Button>
        {narrow && (
          <Button
            variant="secondary"
            onClick={() => setSettingsOpen(true)}
            data-testid="settings-open"
          >
            Settings
          </Button>
        )}
      </div>

      {issues.length > 0 && (
        <ul className={styles.issues} data-testid="calendar-issues">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <StatusPill
                label={issue.severity === 'error' ? 'Error' : 'Note'}
                tone={issue.severity === 'error' ? 'error' : 'warning'}
              />
              <span className={styles.issueWhere}>{ISSUE_WORDS[issue.code]}</span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.layout}>
        <ToolPanel
          title={
            saved
              ? `${saved.name} — the next ${VISIBLE_DAYS} days`
              : 'Save this calendar to see its times'
          }
          className={styles.schedulePanel}
          density="high"
        >
          {saved ? (
            <>
              {dirty && (
                <p className={styles.notice} data-testid="calendar-stale">
                  These are the times the saved calendar offers. Save to see your changes here.
                </p>
              )}
              <Workspace
                days={days}
                account={account}
                calendar={saved}
                zone={zone}
                chosen={chosen}
                onChoose={(slot) => inScope({ chosen: slot })}
                selectedAppointment={selected}
                onSelectAppointment={(id) => inScope({ selected: id })}
              />
            </>
          ) : (
            <p className={styles.muted}>
              This calendar is not in the account yet. Save it and its openings appear here.
            </p>
          )}
        </ToolPanel>

        {!narrow && (
          <ToolPanel title="Configuration" className={styles.settingsPanel} density="high">
            {settings}
          </ToolPanel>
        )}
      </div>

      <div className={styles.lower}>
        <ToolPanel title="Test a booking" className={styles.bookingPanel} density="high">
          {saved && errors.length === 0 ? (
            <BookingPanel
              account={account}
              calendar={saved}
              zone={zone}
              slot={selectedAppointment ? null : chosen}
              contactId={contactId}
              serviceId={serviceId}
              staffId={staffId}
              bookedBy={bookedBy}
              busy={busy}
              onContact={setPickedContact}
              onService={(id) => inScope({ serviceId: id, chosen: null, selected: null })}
              onStaff={(id) => inScope({ staffId: id, chosen: null, selected: null })}
              onBookedBy={setBookedBy}
              onBook={() => void book()}
            />
          ) : (
            <p className={styles.muted} data-testid="booking-blocked">
              {saved
                ? 'Fix the errors above before booking against this calendar.'
                : 'Save this calendar first.'}
            </p>
          )}
        </ToolPanel>

        <ToolPanel title="Appointments" className={styles.appointmentPanel} density="high">
          {saved && (
            <Appointments
              account={account}
              calendar={saved}
              zone={zone}
              appointments={appointments}
              selected={selected}
              chosen={chosen}
              busy={busy}
              onSelect={(id) => inScope({ selected: id === selected ? null : id, chosen: null })}
              onConfirm={(id) =>
                scenario &&
                void act((current) => setAppointmentStatus(current, scenario, id, 'confirmed'))
              }
              onStatus={(id, status) =>
                scenario &&
                void act((current) => setAppointmentStatus(current, scenario, id, status))
              }
              onReschedule={(id) =>
                scenario &&
                chosen &&
                void act((current) => rescheduleAppointment(current, scenario, id, chosen)).then(
                  (result) => {
                    if (result?.ok) inScope({ chosen: null });
                  },
                )
              }
              onCancel={(id) =>
                scenario && void act((current) => cancelAppointment(current, scenario, id))
              }
            />
          )}
        </ToolPanel>
      </div>

      <section className={styles.chain} aria-label="What the account did">
        <h2 className={styles.panelHeading}>What the account did</h2>
        {chain.length === 0 ? (
          <p className={styles.muted}>
            Nothing yet. Saving, booking, confirming, moving or cancelling puts a real event through
            the engine, and everything it causes appears here in the run&rsquo;s own order.
          </p>
        ) : (
          <ol className={styles.chainList} data-testid="calendar-chain">
            {chain.map((entry) => (
              <li key={entry.sequence} className={styles.chainRow}>
                <span className={styles.chainType}>{entry.type}</span>
                <span className={styles.chainOrigin} data-origin={entry.origin}>
                  {ORIGIN_WORDS[entry.origin] ?? entry.origin}
                </span>
                <span className={styles.chainDetail}>{entry.detail}</span>
                <span className={styles.chainAt}>
                  {clockTime(entry.at, run.state.clock.timezone)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {narrow && (
        <Sheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Configuration"
          side="bottom"
        >
          {settings}
        </Sheet>
      )}
    </div>
  );
}
