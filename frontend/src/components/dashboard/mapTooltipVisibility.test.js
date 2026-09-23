import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowLoggerTooltip } from "./mapTooltipVisibility.js";

test("ẩn tooltip khi cài đặt mặc định tắt và chưa chọn logger", () => {
  assert.equal(shouldShowLoggerTooltip(false, null, 28429), false);
});

test("hiện tooltip của logger vừa bấm khi cài đặt mặc định tắt", () => {
  assert.equal(shouldShowLoggerTooltip(false, 28429, 28429, true), true);
  assert.equal(shouldShowLoggerTooltip(false, 28429, 28430, true), false);
  assert.equal(shouldShowLoggerTooltip(false, 28429, 28429, false), true);
});

test("hiện mọi tooltip khi cài đặt mặc định bật", () => {
  assert.equal(shouldShowLoggerTooltip(true, null, 28429, true), true);
  assert.equal(shouldShowLoggerTooltip(true, 28430, 28429, true), true);
  assert.equal(shouldShowLoggerTooltip(true, null, 28429, false), false);
});
