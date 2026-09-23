'use strict';

// Provider selection.
//
// Which model backend is in use is decided here and nowhere else. Adding one
// means a new file next to this and a case below; nothing upstream changes.

import { DisabledProvider, AIError } from './provider';
import type { AIProvider } from './provider';

let instance: AIProvider | null = null;

function build(): AIProvider {
  return new DisabledProvider();
}

// Built once per process and reused.
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
