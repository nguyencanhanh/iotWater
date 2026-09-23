import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GENERAL_SETTING,
  normalizeGeneralSetting,
  normalizeGeneralSettingUpdate,
} from "./generalSetting.js";

test("cài đặt mặc định ẩn bảng logger khi tải bản đồ", () => {
  assert.equal(DEFAULT_GENERAL_SETTING.showMapTooltipsOnLoad, false);
});

test("chuẩn hóa boolean từ dữ liệu API", () => {
  assert.equal(normalizeGeneralSetting({ showMapTooltipsOnLoad: true }).showMapTooltipsOnLoad, true);
  assert.equal(normalizeGeneralSetting({ showMapTooltipsOnLoad: false }).showMapTooltipsOnLoad, false);
  assert.equal(normalizeGeneralSetting({}).showMapTooltipsOnLoad, false);
});

test("payload cập nhật giữ giá trị hiện tại nếu request không gửi trường tương ứng", () => {
  assert.deepEqual(
    normalizeGeneralSettingUpdate(
      { mapTooltipMinZoom: 18 },
      { mapTooltipMinZoom: 15, showMapTooltipsOnLoad: true }
    ),
    { mapTooltipMinZoom: 18, showMapTooltipsOnLoad: true }
  );
  assert.deepEqual(
    normalizeGeneralSettingUpdate(
      { showMapTooltipsOnLoad: false },
      { mapTooltipMinZoom: 17, showMapTooltipsOnLoad: true }
    ),
    { mapTooltipMinZoom: 17, showMapTooltipsOnLoad: false }
  );
});
