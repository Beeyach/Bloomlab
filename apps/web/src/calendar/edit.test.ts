import { describe, expect, it } from 'vitest';

import type { Calendar } from '@bloomlab/simulator-core';

import { blankCalendar } from './commands';
import * as edit from './edit';

/**
 * The draft edits (CAL-001).
 *
 * These are pure, so they are tested as pure functions. What is worth pinning is not that a field
 * changes but that the definition stays coherent when it does: removing a location does not leave
 * a service pointing at a ghost, changing the type does not leave a round-robin rule on a personal
 * calendar, and taking somebody off the team takes them off its services too.
 */

const base = (): Calendar => blankCalendar('cal-test', 'Test', 'America/Chicago');

describe('the simple fields', () => {
  it('renames and sets numbers', () => {
    expect(edit.rename(base(), 'Consults').name).toBe('Consults');
    expect(edit.setNumber(base(), 'pre_buffer_minutes', 15).pre_buffer_minutes).toBe(15);
    expect(edit.setTimezone(base(), null).timezone).toBeNull();
  });

  it('lets the slot interval follow the duration until it is set apart from it', () => {
    const followed = edit.setDuration(base(), 45);
    expect(followed.slot_interval_minutes).toBe(45);
    const apart = edit.setNumber(followed, 'slot_interval_minutes', 15);
    expect(edit.setDuration(apart, 60).slot_interval_minutes).toBe(15);
  });
});

describe('changing the family puts back what no longer means anything', () => {
  it('keeps one host on a personal calendar', () => {
    const team = edit.addStaff(edit.addStaff(edit.setType(base(), 'round_robin'), 'a'), 'b');
    expect(team.staff_ids).toEqual(['a', 'b']);
    expect(team.assignment).toBe('optimize_availability');
    const personal = edit.setType(team, 'personal');
    expect(personal.staff_ids).toEqual(['a']);
    expect(personal.assignment).toBe('single');
  });

  it('drops services when the calendar stops being a service calendar', () => {
    const service = edit.addService(edit.setType(base(), 'service'), 'Facial');
    expect(service.services).toHaveLength(1);
    expect(edit.setType(service, 'personal').services).toEqual([]);
  });

  it('turns staff selection off when it cannot mean anything', () => {
    const team = edit.setStaffSelection(
      edit.addStaff(edit.setType(base(), 'round_robin'), 'a'),
      true,
    );
    expect(edit.setType(team, 'personal').staff_selection).toBe(false);
  });
});

describe('working hours', () => {
  it('adds, edits and removes, keeping the week in order', () => {
    let calendar: Calendar = { ...base(), availability: [] };
    calendar = edit.addWindow(calendar, { day: 3, start: '09:00', end: '12:00' });
    calendar = edit.addWindow(calendar, { day: 1, start: '13:00', end: '17:00' });
    expect(calendar.availability.map((row) => row.day)).toEqual([1, 3]);
    calendar = edit.editWindow(calendar, 0, { start: '08:00' });
    expect(calendar.availability[0]?.start).toBe('08:00');
    calendar = edit.removeWindow(calendar, 0);
    expect(calendar.availability).toHaveLength(1);
  });

  it('sets the whole working week at once', () => {
    const week = edit.setWeekdays(base(), '10:00', '16:00');
    expect(week.availability).toHaveLength(5);
    expect(week.availability.every((row) => row.start === '10:00')).toBe(true);
  });
});

describe('the team', () => {
  const team = () => {
    let calendar = edit.setType(base(), 'round_robin');
    calendar = edit.addStaff(calendar, 'theo');
    calendar = edit.addStaff(calendar, 'ivy');
    return calendar;
  };

  it('refuses to add the same person twice', () => {
    expect(edit.addStaff(team(), 'theo').staff_ids).toEqual(['theo', 'ivy']);
  });

  it('moves somebody in the order the distribution rules break ties on', () => {
    expect(edit.moveStaff(team(), 'ivy', -1).staff_ids).toEqual(['ivy', 'theo']);
    expect(edit.moveStaff(team(), 'theo', -1).staff_ids).toEqual(['theo', 'ivy']);
    expect(edit.moveStaff(team(), 'ivy', 1).staff_ids).toEqual(['theo', 'ivy']);
  });

  it('takes a removed person off the services too', () => {
    let calendar = edit.setType(team(), 'service');
    calendar = edit.addService(calendar, 'Facial');
    const serviceId = calendar.services[0]?.id as string;
    calendar = edit.toggleServiceStaff(calendar, serviceId, 'ivy');
    expect(calendar.services[0]?.staff_ids).toEqual(['ivy']);
    calendar = edit.removeStaff(calendar, 'ivy');
    expect(calendar.staff_ids).toEqual(['theo']);
    expect(calendar.services[0]?.staff_ids).toEqual([]);
  });
});

describe('services and locations stay pointed at something real', () => {
  it('makes the first location the default', () => {
    const calendar = edit.addLocation(base(), 'address', '18 Rue Sainte');
    expect(calendar.default_location_id).toBe(calendar.locations[0]?.id);
  });

  it('clears the default and any service that used a removed location', () => {
    let calendar = edit.addLocation(edit.setType(base(), 'service'), 'address', 'Room 1');
    const locationId = calendar.locations[0]?.id as string;
    calendar = edit.addService(calendar, 'Facial');
    const serviceId = calendar.services[0]?.id as string;
    calendar = edit.editService(calendar, serviceId, { location_id: locationId });
    calendar = edit.removeLocation(calendar, locationId);
    expect(calendar.locations).toEqual([]);
    expect(calendar.default_location_id).toBeNull();
    expect(calendar.services[0]?.location_id).toBeNull();
  });

  it('toggles a service’s eligible staff on and off', () => {
    let calendar = edit.addStaff(edit.setType(base(), 'service'), 'ivy');
    calendar = edit.addService(calendar, 'Facial');
    const serviceId = calendar.services[0]?.id as string;
    calendar = edit.toggleServiceStaff(calendar, serviceId, 'ivy');
    expect(calendar.services[0]?.staff_ids).toEqual(['ivy']);
    calendar = edit.toggleServiceStaff(calendar, serviceId, 'ivy');
    expect(calendar.services[0]?.staff_ids).toEqual([]);
  });
});

describe('sameDefinition ignores the version', () => {
  it('says two versions of one unchanged calendar are the same', () => {
    const a = base();
    const b = { ...base(), version: 7 };
    expect(edit.sameDefinition(a, b)).toBe(true);
    expect(edit.sameDefinition(a, edit.rename(b, 'Other'))).toBe(false);
  });
});
