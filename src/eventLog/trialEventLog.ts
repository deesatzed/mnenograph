import type { TrialEvent, SingleTrialMode } from '../types/sessionSchema';
import { sha256Hex, canonicalizeJson } from '../registry/protocolRegistry';

/**
 * Deterministic Mulberry32 PRNG for reproducible trial generation & stratified bootstrap CIs.
 */
export function createSeededPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Appends a new TrialEvent to an immutable array (returns a frozen copy) so historical events
 * can never be mutated in place.
 */
export function appendTrialEvent(
  log: readonly TrialEvent[],
  event: Omit<TrialEvent, 'eventId' | 'trialIndex' | 'technicalFrameDrop'>
): readonly TrialEvent[] {
  const trialIndex = log.length;
  const technicalFrameDrop = event.maxFrameDeltaMs > 50.0;
  const fullEvent: TrialEvent = Object.freeze({
    ...event,
    eventId: `${event.stationId}-T${String(trialIndex + 1).padStart(3, '0')}`,
    trialIndex,
    technicalFrameDrop
  });
  return Object.freeze([...log, fullEvent]);
}

export function computeEventLogSha256(log: readonly TrialEvent[]): string {
  return sha256Hex(canonicalizeJson(log));
}

/**
 * Determines session-level PresentationMode ("OBSERVATORY_3D_SPOTLIGHT_LOCK" | "PLAIN_STATIC_2D" | "MIXED_MODES")
 * from the recorded trial events and initial mode (per Inventive Catalyst Finding 3).
 */
export function resolveSessionPresentationMode(
  log: readonly TrialEvent[],
  currentMode: SingleTrialMode
): 'OBSERVATORY_3D_SPOTLIGHT_LOCK' | 'PLAIN_STATIC_2D' | 'MIXED_MODES' {
  if (log.length === 0) return currentMode;
  const modes = new Set<SingleTrialMode>(log.map((e) => e.presentationMode));
  modes.add(currentMode);
  if (modes.size > 1) return 'MIXED_MODES';
  return currentMode;
}
