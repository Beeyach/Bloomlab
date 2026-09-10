import type {
  AssignmentReason,
  AssignmentStrategy,
  CalendarIssueCode,
  CalendarType,
  LocationKind,
} from '@bloomlab/simulator-core';

/**
 * What the Calendar Lab calls things (GHL-010).
 *
 * Where a control is a real HighLevel setting it carries HighLevel's own name, so a learner who
 * moves to the platform recognises it: Slot Interval, Minimum Scheduling Notice, Optimize for
 * Availability. Where Bloomlab has simplified something, the note under the control says so
 * rather than the label pretending otherwise.
 */

export const CALENDAR_TYPE_LABELS: Record<CalendarType, string> = {
  class: 'Class Booking',
  personal: 'Personal Booking',
  round_robin: 'Round Robin',
  service: 'Service Calendar',
};

export const CALENDAR_TYPE_HELP: Record<CalendarType, string> = {
  class: 'One host, multiple attendees. Overlapping bookings consume seats until capacity is full.',
  personal: 'One host, one appointment at a time. The calendar most consultations start as.',
  round_robin: 'A team. HighLevel picks the host from who is free and how the work is spread.',
  service: 'Named services, each with its own length, staff and place.',
};

export const ASSIGNMENT_LABELS: Record<AssignmentStrategy, string> = {
  single: 'The calendar’s host',
  optimize_availability: 'Optimize for Availability',
  optimize_equal: 'Optimize for Equal Distribution',
};

export const ASSIGNMENT_HELP: Record<AssignmentStrategy, string> = {
  single: 'Every booking goes to the one person on this calendar.',
  optimize_availability: 'The booking goes to the next team member who is free.',
  optimize_equal: 'The booking goes to whoever has fewest that month.',
};

/** Why this host, in one phrase the workspace can print under a slot. */
export const HOST_REASONS: Record<AssignmentReason, string> = {
  no_staff: 'no host on this calendar',
  only_host: 'the only one free',
  requested: 'the booker asked for them',
  next_available: 'next free in the team order',
  least_booked: 'fewest bookings this month',
};

export const LOCATION_LABELS: Record<LocationKind, string> = {
  address: 'Address',
  phone: 'Phone',
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  custom: 'Custom',
  ask_booker: 'Ask the Booker',
};

export const LOCATION_HELP: Record<LocationKind, string> = {
  address: 'Where they come to.',
  phone: 'The number that gets called.',
  zoom: 'A Zoom link. Bloomlab stores the link; it does not create Zoom meetings.',
  google_meet: 'A Meet link. Bloomlab stores the link; it does not create Meet calls.',
  custom: 'Anything else the booker should read.',
  ask_booker: 'The booker says where. Nothing is stored on the calendar.',
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  booked: 'New',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  showed: 'Showed',
  no_show: 'No-show',
};

/** The tone a status is drawn with. Colour is never the only signal — the word is always there. */
export const STATUS_TONE: Record<string, 'neutral' | 'positive' | 'caution' | 'critical'> = {
  booked: 'neutral',
  confirmed: 'positive',
  cancelled: 'critical',
  showed: 'positive',
  no_show: 'caution',
};

/** What each validation code means, said the way a person would say it. */
export const ISSUE_WORDS: Record<CalendarIssueCode, string> = {
  CLASS_NEEDS_ONE_HOST: 'Class host',
  CLASS_CAPACITY: 'Seats per class',
  NO_NAME: 'Name',
  INVALID_TIMEZONE: 'Time zone',
  DURATION_NOT_POSITIVE: 'Duration',
  INTERVAL_NOT_POSITIVE: 'Slot Interval',
  NEGATIVE_BUFFER: 'Buffer',
  NEGATIVE_NOTICE: 'Minimum Scheduling Notice',
  BOOKING_WINDOW_NOT_POSITIVE: 'Booking window',
  NO_AVAILABILITY: 'Working hours',
  INVALID_DAY: 'Working hours',
  INVALID_TIME_OF_DAY: 'Working hours',
  EMPTY_WINDOW: 'Working hours',
  OVERLAPPING_WINDOWS: 'Working hours',
  WINDOW_SHORTER_THAN_DURATION: 'Working hours',
  UNKNOWN_STAFF: 'Team',
  DUPLICATE_STAFF: 'Team',
  PERSONAL_NEEDS_ONE_HOST: 'Team',
  ROUND_ROBIN_NEEDS_STAFF: 'Team',
  STAFF_SELECTION_WITHOUT_STAFF: 'Team',
  SERVICE_NEEDS_NAME: 'Services',
  SERVICE_DURATION_NOT_POSITIVE: 'Services',
  SERVICE_STAFF_NOT_ON_CALENDAR: 'Services',
  SERVICE_LOCATION_UNKNOWN: 'Services',
  SERVICE_CALENDAR_NEEDS_SERVICE: 'Services',
  SERVICE_CALENDAR_NEEDS_STAFF: 'Services',
  SERVICES_ON_A_NON_SERVICE_CALENDAR: 'Services',
  LOCATION_NEEDS_VALUE: 'Locations',
  DEFAULT_LOCATION_UNKNOWN: 'Locations',
  NEGATIVE_CUTOFF: 'Booking rules',
};

/** The settings groups, which is how the configuration is arranged rather than one long form. */
export const GROUPS = ['basics', 'availability', 'staff', 'service', 'rules'] as const;
export type Group = (typeof GROUPS)[number];

export const GROUP_LABELS: Record<Group, string> = {
  basics: 'Basics',
  availability: 'Availability',
  staff: 'Staff & assignment',
  service: 'Service & location',
  rules: 'Booking rules',
};

/** What Bloomlab does not simulate, said where the learner is looking at the setting. */
export const OMISSIONS =
  'Date-specific hours, linked external calendars, Look Busy, grouped calendars and recurring appointments remain real-GoHighLevel work. This Lab adds class seats and service resource capacity to weekly hours, duration, buffers, notice, staff, assignment and locations. Resources use one account-wide capacity, not location-specific capacity or the separate Rooms & Equipment configuration.';
