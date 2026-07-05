import type { CSSProperties } from 'react';
import { DOMAIN_META, LEVEL_TITLES, type Domain, type DomainId } from './types';

type DomainVisual = {
  label: string;
  icon: string;
  color: string;
  accent: string;
};

const DEFAULT_DOMAIN_ORDER = ['military', 'builder', 'self'] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function buildAccent(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return rgbToHex(
    Math.round(rgb.r * 0.72),
    Math.round(rgb.g * 0.72),
    Math.round(rgb.b * 0.72),
  );
}

function buildSubtle(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return 'rgba(74,250,74,0.08)';
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
}

function titleizeDomainId(domainId: string): string {
  return domainId
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || 'Domain';
}

function fallbackColorForDomain(domainId: string): string {
  let hash = 0;
  for (const char of domainId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const r = 70 + (hash % 110);
  const g = 130 + ((hash >> 8) % 90);
  const b = 70 + ((hash >> 16) % 110);
  return rgbToHex(r, g, b);
}

export function sortDomains<T extends { id: string; name?: string | null; created_at?: string | null }>(domains: T[]): T[] {
  return [...domains].sort((left, right) => {
    const leftIndex = DEFAULT_DOMAIN_ORDER.indexOf(left.id as typeof DEFAULT_DOMAIN_ORDER[number]);
    const rightIndex = DEFAULT_DOMAIN_ORDER.indexOf(right.id as typeof DEFAULT_DOMAIN_ORDER[number]);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    }
    const leftCreated = left.created_at?.trim() || '';
    const rightCreated = right.created_at?.trim() || '';
    if (leftCreated && rightCreated && leftCreated !== rightCreated) {
      return leftCreated.localeCompare(rightCreated);
    }
    return (left.name ?? left.id).localeCompare(right.name ?? right.id);
  });
}

export function getDomainRecord(domainId: string, domains?: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>): Pick<Domain, 'id' | 'name' | 'icon' | 'color'> | null {
  return domains?.find((domain) => domain.id === domainId) ?? null;
}

export function getDomainMeta(
  domainId: DomainId | null | undefined,
  domains?: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>,
): DomainVisual {
  if (!domainId) {
    return {
      label: 'Global',
      icon: '[*]',
      color: '#4afa4a',
      accent: '#1e7a1e',
    };
  }

  const fallback = DOMAIN_META[domainId as keyof typeof DOMAIN_META];
  const record = getDomainRecord(domainId, domains);
  const color = normalizeHexColor(record?.color) ?? fallback?.color ?? fallbackColorForDomain(domainId);

  return {
    label: record?.name?.trim() || fallback?.label || titleizeDomainId(domainId),
    icon: record?.icon?.trim() || fallback?.icon || `[${domainId.slice(0, 1).toUpperCase()}]`,
    color,
    accent: fallback?.accent ?? buildAccent(color),
  };
}

export function getDomainLabel(
  domainId: DomainId | null | undefined,
  domains?: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>,
): string {
  return getDomainMeta(domainId, domains).label;
}

export function getDomainThemeStyle(
  domainOrId: Pick<Domain, 'id' | 'name' | 'icon' | 'color'> | DomainId | null | undefined,
  domains?: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>,
): CSSProperties {
  const meta = typeof domainOrId === 'string' || !domainOrId
    ? getDomainMeta(domainOrId, domains)
    : getDomainMeta(domainOrId.id, [domainOrId]);

  return {
    ['--domain-primary' as string]: meta.color,
    ['--domain-subtle' as string]: buildSubtle(meta.color),
    ['--domain-accent' as string]: meta.accent,
  };
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? LEVEL_TITLES[10];
}

export function getDefaultDomainId(domains: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>): DomainId {
  return sortDomains(domains)[0]?.id ?? 'military';
}
