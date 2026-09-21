export const colors = {
  primary: "#0f766e",
  primaryDark: "#064e3b",
  primarySoft: "#ccfbf1",
  accent: "#2563eb",
  accentSoft: "#dbeafe",
  background: "#eef7f6",
  backgroundDeep: "#d9f0ed",
  surface: "#ffffff",
  surfaceSoft: "#f8fafc",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  warning: "#d97706",
  warningSoft: "#fff7ed",
  success: "#059669",
  successSoft: "#ecfdf5"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 14,
  xl: 22
};

export const shadows = {
  card: {
    elevation: 3,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 14
  },
  soft: {
    elevation: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  }
};

export const typography = {
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  body: {
    color: colors.text,
    fontSize: 15
  },
  muted: {
    color: colors.muted,
    fontSize: 13
  }
};
