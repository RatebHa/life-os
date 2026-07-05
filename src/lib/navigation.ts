export interface NavigationItem {
  path: string;
  label: string;
  description: string;
}

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { path: '/today', label: 'TODAY', description: 'Plan quickly. Protect the next move.' },
  { path: '/inbox', label: 'INBOX', description: 'Capture first. Decide later.' },
  { path: '/tasks', label: 'TASKS', description: 'Manage commitments and staging.' },
  { path: '/habits', label: 'HABITS', description: 'Keep repeated behavior honest.' },
  { path: '/goals', label: 'GOALS', description: 'Keep direction tied to action.' },
  { path: '/notes', label: 'NOTES', description: 'Think, reflect, and connect ideas.' },
  { path: '/weekly-review', label: 'REVIEW', description: 'Reset the next week with intent.' },
];

export const SUPPORT_NAV_ITEMS: NavigationItem[] = [
  { path: '/overview', label: 'OVERVIEW', description: 'Check balance, drift, and reliability.' },
  { path: '/calendar', label: 'CALENDAR', description: 'See activity by date.' },
  { path: '/templates', label: 'ROUTINES', description: 'Launch reusable systems when needed.' },
  { path: '/analytics', label: 'DATA', description: 'Inspect patterns and friction.' },
  { path: '/settings', label: 'SETTINGS', description: 'Protect and tune the system.' },
];

export const SHORTCUT_ITEMS = [
  { keys: 'CTRL+K', label: 'GLOBAL SEARCH' },
  { keys: 'CTRL+N', label: 'QUICK CAPTURE' },
  { keys: 'CTRL+Z', label: 'UNDO LATEST' },
  { keys: 'ALT+1', label: 'TODAY' },
  { keys: 'ALT+2', label: 'INBOX' },
  { keys: 'ALT+3', label: 'TASKS' },
  { keys: 'ALT+4', label: 'HABITS' },
  { keys: 'ALT+5', label: 'GOALS' },
  { keys: 'ALT+6', label: 'NOTES' },
  { keys: 'ALT+7', label: 'WEEKLY REVIEW' },
  { keys: 'ALT+8', label: 'OVERVIEW' },
  { keys: 'ALT+9', label: 'CALENDAR' },
  { keys: '?', label: 'SHOW SHORTCUTS' },
] as const;

export const PAGE_SHORTCUTS: Record<string, string> = {
  '1': '/today',
  '2': '/inbox',
  '3': '/tasks',
  '4': '/habits',
  '5': '/goals',
  '6': '/notes',
  '7': '/weekly-review',
  '8': '/overview',
  '9': '/calendar',
};

const PAGE_META_LOOKUP: NavigationItem[] = [
  ...PRIMARY_NAV_ITEMS,
  ...SUPPORT_NAV_ITEMS,
  { path: '/domain', label: 'DOMAIN', description: 'Inspect one life area at a time.' },
];

export function getNavigationMeta(pathname: string): NavigationItem & { sectionLabel: string } {
  const normalizedPath = pathname === '/' ? '/today' : pathname;
  const matched = PAGE_META_LOOKUP.find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`));

  if (matched) {
    const sectionLabel = PRIMARY_NAV_ITEMS.some((item) => item.path === matched.path)
      ? 'PRIMARY WORKFLOW'
      : matched.path === '/domain'
        ? 'DOMAIN VIEW'
        : 'SUPPORT PANEL';

    return {
      ...matched,
      sectionLabel,
    };
  }

  return {
    path: normalizedPath,
    label: 'WORKSPACE',
    description: 'Local-first commitment system.',
    sectionLabel: 'WORKSPACE',
  };
}
