export const DEFAULT_GENERAL_SETTING = Object.freeze({
  mapTooltipMinZoom: 15,
  showMapTooltipsOnLoad: false,
});

const normalizeZoom = (value) => {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return DEFAULT_GENERAL_SETTING.mapTooltipMinZoom;
  return Math.min(Math.max(Math.round(zoom), 1), 22);
};

export const normalizeGeneralSetting = (setting = {}) => ({
  mapTooltipMinZoom: normalizeZoom(setting.mapTooltipMinZoom),
  showMapTooltipsOnLoad: setting.showMapTooltipsOnLoad === true,
});

export const normalizeGeneralSettingUpdate = (update = {}, current = {}) => {
  const normalizedCurrent = normalizeGeneralSetting(current);
  return {
    mapTooltipMinZoom: Object.prototype.hasOwnProperty.call(update, "mapTooltipMinZoom")
      ? normalizeZoom(update.mapTooltipMinZoom)
      : normalizedCurrent.mapTooltipMinZoom,
    showMapTooltipsOnLoad: Object.prototype.hasOwnProperty.call(update, "showMapTooltipsOnLoad")
      ? update.showMapTooltipsOnLoad === true
      : normalizedCurrent.showMapTooltipsOnLoad,
  };
};
