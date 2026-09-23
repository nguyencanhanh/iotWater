export const shouldShowLoggerTooltip = (showOnLoad, selectedLoggerId, loggerId, zoomAllowsAll = true) => (
  String(selectedLoggerId ?? "") === String(loggerId ?? "") || (showOnLoad && zoomAllowsAll)
);
