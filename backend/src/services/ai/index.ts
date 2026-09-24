'use strict';

// Provider selection.
//
// Which model backend is in use is decided here and nowhere else. There is one
// real backend — the self-hosted model behind vLLM — and the disabled provider
// for every server where it is switched off or misconfigured. There is no
// fallback to any other model: without ours, conversations go to a person.

import { DisabledProvider, AIError } from './provider';
import { VllmProvider } from './vllmProvider';
import { aiConfig } from '../../config/ai';
import type { AIProvider } from './provider';

let instance: AIProvider | null = null;

function build(): AIProvider {
  const config = aiConfig();
  return config ? new VllmProvider(config) : new DisabledProvider();
}

// Built once per process and reused; the provider owns the concurrency limit,
// so there must be exactly one.
function getProvider(): AIProvider {
  if (!instance) instance = build();
  return instance;
}

// Test seam: lets a test install a stub without reaching into module internals.
function setProvider(provider: AIProvider | null): void {
  instance = provider;
}

function resetProvider(): void {
  instance = null;
}

export { getProvider, setProvider, resetProvider, AIError };
