/**
 * Mock for @tauri-apps/api/core
 * All Tauri invoke calls are intercepted here so tests run in jsdom without Rust.
 * Individual tests can override specific commands via vi.mocked(invoke).mockResolvedValueOnce(...)
 */
import { vi } from 'vitest';

export const invoke = vi.fn().mockResolvedValue(undefined);
