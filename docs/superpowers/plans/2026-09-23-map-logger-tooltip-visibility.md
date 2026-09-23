# Map Logger Tooltip Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ẩn bảng logger khi vào Trang chủ theo mặc định, cho phép hiện từng bảng khi bấm marker và lưu lựa chọn hiện tất cả khi tải trang theo tài khoản.

**Architecture:** Cài đặt boolean được lưu trong `GeneralSetting` và tải cùng ngưỡng zoom. Logic hiển thị tooltip được tách thành hàm thuần để kiểm thử; `AdminSummary` quản lý logger đang chọn và công tắc lưu tức thời.

**Tech Stack:** React 18, React Leaflet, Express, Mongoose, Node test runner.

---

### Task 1: Cài đặt chung phía server

**Files:**
- Modify: `server/models/GeneralSetting.js`
- Modify: `server/controllers/generalSettingController.js`
- Create: `server/services/generalSetting.js`
- Test: `server/services/generalSetting.test.js`

- [ ] Viết test thất bại cho mặc định `false`, chuẩn hóa boolean và bảo toàn giá trị zoom.
- [ ] Chạy `node --test server/services/generalSetting.test.js` và xác nhận test thất bại vì module chưa tồn tại.
- [ ] Viết helper và dùng helper trong controller/model.
- [ ] Chạy lại test và xác nhận pass.

### Task 2: Logic tooltip và giao diện Trang chủ

**Files:**
- Create: `frontend/src/components/dashboard/mapTooltipVisibility.js`
- Test: `frontend/src/components/dashboard/mapTooltipVisibility.test.js`
- Modify: `frontend/src/components/dashboard/AdminSummary.jsx`

- [ ] Viết test thất bại cho logic hiện tất cả, ẩn tất cả và hiện logger vừa chọn.
- [ ] Chạy `node --test frontend/src/components/dashboard/mapTooltipVisibility.test.js` và xác nhận test thất bại vì module chưa tồn tại.
- [ ] Thêm state, tải cài đặt, công tắc lưu tức thời, tooltip theo logger được chọn và nút mở chi tiết.
- [ ] Chạy lại test và xác nhận pass.

### Task 3: Đồng bộ trang Cài đặt và xác minh

**Files:**
- Modify: `frontend/src/pages/SettingsHub.jsx`
- Modify: `SYSTEM.md`

- [ ] Đảm bảo lưu ngưỡng zoom không làm mất cờ hiển thị tooltip.
- [ ] Cập nhật tài liệu kỹ thuật.
- [ ] Chạy toàn bộ test mới, `npm run lint` và `npm run build` trong `frontend`.
- [ ] Đồng bộ môi trường test, kiểm tra trình duyệt, rồi mới deploy production và regression.
