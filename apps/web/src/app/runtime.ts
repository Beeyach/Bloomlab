import type { RuntimeEnvironment } from '@bloomlab/shared';

/**
 * Maps the Vite mode to a Bloomlab environment (spec §104). Builds select the mode with
 * `vite build --mode preview|production`; the Worker gets the same name via wrangler vars.
 */
const MODE_TO_ENVIRONMENT: Readonly<Record<string, RuntimeEnvironment>> = {
  development: 'local',
  test: 'local',
  preview: 'preview',
  production: 'production',
};

export function getRuntimeEnvironment(mode: string = import.meta.env.MODE): RuntimeEnvironment {
  const environment = MODE_TO_ENVIRONMENT[mode];
  if (!environment) throw new Error(`Vite mode "${mode}" has no Bloomlab environment mapping`);
  return environment;
}
