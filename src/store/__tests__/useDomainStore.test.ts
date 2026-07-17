import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useDomainStore } from '../useDomainStore';
import type { Domain } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    id: 'military',
    name: 'Military',
    icon: '[M]',
    color: '#D4A73D',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    streak_current: 0,
    streak_longest: 0,
    streak_freeze_tokens: 0,
    last_activity_date: null,
    ...overrides,
  };
}

beforeEach(() => {
  useDomainStore.setState({ domains: [], activeDomain: null, isLoading: false });
  vi.clearAllMocks();
});

describe('useDomainStore', () => {
  it('loadDomains: populates and sorts domains (military, builder, self first)', async () => {
    mockInvoke.mockResolvedValueOnce([
      makeDomain({ id: 'self', name: 'Self' }),
      makeDomain({ id: 'military', name: 'Military' }),
      makeDomain({ id: 'builder', name: 'Builder' }),
    ]);

    await useDomainStore.getState().loadDomains();

    expect(useDomainStore.getState().domains.map((d) => d.id)).toEqual(['military', 'builder', 'self']);
  });

  it('loadDomains: handles error gracefully (keeps existing state, no rethrow)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await expect(useDomainStore.getState().loadDomains()).resolves.toBeUndefined();
    expect(useDomainStore.getState().domains).toEqual([]);
  });

  it('setDomains: sorts the provided domains', () => {
    useDomainStore.getState().setDomains([
      makeDomain({ id: 'builder', name: 'Builder' }),
      makeDomain({ id: 'military', name: 'Military' }),
    ]);

    expect(useDomainStore.getState().domains.map((d) => d.id)).toEqual(['military', 'builder']);
  });

  it('setActiveDomain: sets the active domain id', () => {
    useDomainStore.getState().setActiveDomain('builder');
    expect(useDomainStore.getState().activeDomain).toBe('builder');
  });

  it('getDomain: returns the matching domain or undefined', () => {
    useDomainStore.setState({ domains: [makeDomain({ id: 'military' })] });

    expect(useDomainStore.getState().getDomain('military')?.id).toBe('military');
    expect(useDomainStore.getState().getDomain('builder')).toBeUndefined();
  });

  it('useStreakFreeze: replaces the matching domain with the updated one', async () => {
    useDomainStore.setState({ domains: [makeDomain({ id: 'military', streak_freeze_tokens: 2 })] });
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military', streak_freeze_tokens: 1 }));

    const updated = await useDomainStore.getState().useStreakFreeze('military');

    expect(updated.streak_freeze_tokens).toBe(1);
    expect(useDomainStore.getState().domains[0].streak_freeze_tokens).toBe(1);
  });

  it('useStreakFreeze: rethrows on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('No freeze tokens available'));

    await expect(useDomainStore.getState().useStreakFreeze('military')).rejects.toThrow('No freeze tokens available');
  });

  it('createDomain: adds and sorts the new domain, and sets it active if none was active', async () => {
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military' }));

    const created = await useDomainStore.getState().createDomain({ name: 'Military', icon: '[M]', color: '#D4A73D' });

    expect(created.id).toBe('military');
    expect(useDomainStore.getState().domains).toHaveLength(1);
    expect(useDomainStore.getState().activeDomain).toBe('military');
  });

  it('createDomain: does not override an already-active domain', async () => {
    useDomainStore.setState({ activeDomain: 'builder' });
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military' }));

    await useDomainStore.getState().createDomain({ name: 'Military', icon: '[M]', color: '#D4A73D' });

    expect(useDomainStore.getState().activeDomain).toBe('builder');
  });

  it('updateDomainProfile: replaces the matching domain by id', async () => {
    useDomainStore.setState({ domains: [makeDomain({ id: 'military', name: 'Military' })] });
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military', name: 'Army' }));

    await useDomainStore.getState().updateDomainProfile({ id: 'military', name: 'Army' });

    expect(useDomainStore.getState().domains[0].name).toBe('Army');
  });

  it('deleteDomain: removes the domain and clears activeDomain if it was the deleted one', async () => {
    useDomainStore.setState({
      domains: [makeDomain({ id: 'military' }), makeDomain({ id: 'builder' })],
      activeDomain: 'military',
    });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useDomainStore.getState().deleteDomain('military');

    expect(useDomainStore.getState().domains).toHaveLength(1);
    expect(useDomainStore.getState().activeDomain).toBe('builder');
  });
});
