import { PROVIDER_PROFILES, type HarnessProvider, type ProviderId } from '@cloud-hermes/core';
import { createHarnessProvider } from './provider';

/** The order providers are tried when none has been chosen explicitly. */
const PREFERENCE: readonly ProviderId[] = ['claude', 'gemini'];

/**
 * Picks the first available harness provider. Onboarding lets the operator
 * choose and authenticate one explicitly; this is the default until then.
 */
export async function resolveProvider(): Promise<HarnessProvider | null> {
  for (const id of PREFERENCE) {
    const provider = createHarnessProvider(PROVIDER_PROFILES[id]);
    const availability = await provider.checkAvailability();
    if (availability.available) return provider;
  }
  return null;
}
