export const DEMO_SCENARIO_ID = 'DEMO_CROSSING_TEN_V1';

/** Internal demo mode is enabled only by adding ?demo=1 to the app URL. */
export function isDemoMode(): boolean {
  return typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === '1';
}
