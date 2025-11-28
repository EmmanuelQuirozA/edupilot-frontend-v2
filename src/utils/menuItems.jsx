const MENU_ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="5" rx="2" fill="currentColor" />
      <rect x="13" y="10" width="8" height="11" rx="2" fill="currentColor" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="2" y="8" width="20" height="3" fill="currentColor" />
      <rect x="4" y="14" width="6" height="2" rx="1" fill="currentColor" />
      <rect x="12" y="14" width="4" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 2 8l10 5 7-3.5V15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-2" fill="currentColor" opacity="0.2" />
      <path d="M12 3 2 8l10 5 10-5-10-5Z" fill="currentColor" />
      <path d="M19 10v6a2 2 0 0 0 2 2h1" fill="currentColor" />
    </svg>
  ),
  teachers: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="4" width="12" height="8" rx="1.5" fill="currentColor" />
      <circle cx="6.5" cy="9" r="2.5" fill="currentColor" />
      <path d="M2 18a4.5 4.5 0 0 1 9 0v2H2v-2Z" fill="currentColor" />
      <rect x="11" y="13" width="8" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  schedules: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="3" y="8" width="18" height="3" fill="currentColor" />
      <rect x="7" y="3" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="15" y="3" width="2" height="4" rx="1" fill="currentColor" />
      <path
        d="M9 16l2 2 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  grades: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        fill="currentColor"
        opacity="0.2"
      />
      <path d="M14 3v5h5" fill="currentColor" />
      <rect x="8" y="12" width="8" height="2" rx="1" fill="currentColor" />
      <rect x="8" y="16" width="6" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  communications: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 3V7a3 3 0 0 1 3-3Z" fill="currentColor" />
      <path d="M10 12h6a2 2 0 0 1 2 2v5l3-2" fill="currentColor" opacity="0.3" />
    </svg>
  ),
};

const MENU_DEFINITIONS = [
  { key: 'dashboard', labelKey: 'dashboard' },
  { key: 'payments', labelKey: 'payments' },
  { key: 'students', labelKey: 'students' },
  { key: 'teachers', labelKey: 'teachers' },
  { key: 'schedules', labelKey: 'schedules' },
  { key: 'grades', labelKey: 'grades' },
  { key: 'communications', labelKey: 'communications' },
];

const ACCESS_CONTROL_MENU_MAP = {
  dashboard: 'dashboard',
  payments: 'payments',
  students: 'students',
  teachers: 'teachers',
  schedules: 'schedules',
  grades: 'grades',
  communications: 'communications',
};

export const normalizeRoleName = (roleName) => {
  if (typeof roleName !== 'string') {
    return '';
  }

  return roleName.trim().toUpperCase();
};

export const getRoleLabel = (translations, roleName) => {
  const normalizedRole = typeof roleName === 'string' ? roleName.trim().toLowerCase() : '';
  return translations?.home?.role?.[normalizedRole] ?? translations?.home?.role?.default ?? translations?.home?.roleLabel;
};

export const buildMenuItemsForRole = (_roleName, labels = {}, accessControlledKeys = []) => {
  const filteredKeys = Array.isArray(accessControlledKeys) ? accessControlledKeys : [];

  return MENU_DEFINITIONS.filter((item) => filteredKeys.includes(item.key)).map((item) => ({
    ...item,
    label: labels[item.labelKey] ?? item.labelKey,
    icon: MENU_ICONS[item.key],
  }));
};

export const deriveMenuKeysFromAccessControl = (accessControlModules = []) => {
  if (!Array.isArray(accessControlModules)) {
    return [];
  }

  const enabledMenuKeys = accessControlModules
    .filter((module) => module && module.enabled)
    .map((module) => module?.moduleKey ?? module?.module_key ?? module?.key)
    .filter((moduleKey) => typeof moduleKey === 'string' && moduleKey.trim())
    .map((moduleKey) => ACCESS_CONTROL_MENU_MAP[moduleKey.trim().toLowerCase()])
    .filter(Boolean);

  return Array.from(new Set(enabledMenuKeys));
};

export default buildMenuItemsForRole;
