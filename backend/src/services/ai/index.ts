'use strict';

// Provider selection.
//
// Which vendor is in use is decided here and nowhere else. Adding one means a
// new file next to this and a case below; nothing upstream changes.

import { DisabledProvider, AIError } from './provider';
import { AnthropicProvider, DEFAULT_MODEL } from './anthropicProvider';
import type { AIProvider } from './provider';

let instance: AIProvider | null = null;

function build(): AIProvider {
  // AI_PROVIDER lets a deployment pin the vendor; left unset it is inferred
  // from whichever credential is present, so a normal install only needs the
  // key.
  const configured = (process.env.AI_PROVIDER || '').toLowerCase();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // An explicit off switch, so a deployment holding a key can still disable the
  // feature without removing the credential.
  if (process.env.AI_ENABLED === 'false') return new DisabledProvider();

  if (configured === 'anthropic' || (!configured && apiKey)) {
    if (!apiKey) return new DisabledProvider();
    return new AnthropicProvider({
      apiKey,
      model: process.env.AI_MODEL || DEFAULT_MODEL
    });
  }

  return new DisabledProvider();
}

// Built once per process and reused; the SDK client holds a connection pool.
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
