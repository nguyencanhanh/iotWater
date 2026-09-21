import { StyleSheet } from "react-native";
import { colors, radius, shadows, spacing } from "../theme";

export const screenStyles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background
  },
  topGlow: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    height: 92,
    left: 0,
    opacity: 0.16,
    position: "absolute",
    right: 0,
    top: 0
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 104
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: "#cbd5e1",
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800"
  },
  outlineButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  outlineText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800"
  },
  listItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
    ...shadows.soft
  },
  selectedItem: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  itemSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#fecaca",
    borderRadius: radius.lg,
    borderWidth: 1,
    color: "#991b1b",
    marginBottom: spacing.md,
    padding: spacing.md
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  pillText: {
    fontSize: 12,
    fontWeight: "900"
  }
});
