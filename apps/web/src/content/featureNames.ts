import { content } from './bundle';

/** Native feature labels resolve through the same registry used by curriculum and the palette. */
export function nativeFeatureName(id: string): string {
  const feature = content.ghl_features.find((row) => row.id === id);
  if (!feature) throw new Error(`Missing HighLevel registry record: ${id}`);
  return feature.official_name;
}

export const NATIVE_LABELS = {
  customFields: nativeFeatureName('GHL-CRM-CUSTOM-FIELDS'),
  contacts: nativeFeatureName('GHL-CRM-CONTACTS'),
  companies: nativeFeatureName('GHL-CRM-COMPANIES'),
  objects: nativeFeatureName('GHL-CRM-CUSTOM-OBJECTS'),
  lists: nativeFeatureName('GHL-CRM-SMART-LISTS'),
  conversations: nativeFeatureName('GHL-CONV-CONVERSATIONS'),
  classBooking: nativeFeatureName('GHL-CAL-CLASSES'),
} as const;
