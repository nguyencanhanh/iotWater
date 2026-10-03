// Bieu tuong cho loai su co bac 2, ve ben trong vong tron trang cua ghim (tam 20,19.5 r10.5
// trong khung 40x52). "{c}" duoc thay bang mau theo muc do ro ri. Key phai khop TYPE_ICONS
// trong server/controllers/incidentTypeController.js.
export const POINT_ICONS = [
  { key: "drop", label: "Giọt nước", svg: '<path d="M20 11.5c2.6 3.4 5 6.6 5 9.4a5 5 0 0 1-10 0c0-2.8 2.4-6 5-9.4z" fill="{c}"/>' },
  {
    key: "faucet",
    label: "Vòi nước",
    svg: '<path d="M12 14.5h7.5v-2.3h3v2.3h1.6a2.6 2.6 0 0 1 2.6 2.6v2.6h-3v-2h-11.7z" fill="{c}"/><path d="M24.9 21.6c.9 1.2 1.6 2.2 1.6 3a1.6 1.6 0 0 1-3.2 0c0-.8.7-1.8 1.6-3z" fill="{c}"/>',
  },
  {
    key: "pipe",
    label: "Ống vỡ",
    svg: '<rect x="10.5" y="16" width="19" height="7" rx="1.6" fill="{c}"/><path d="M19.2 14.8l2 3.6-2 1.6 2 3.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    key: "valve",
    label: "Van",
    svg: '<path d="M11 16l8.2 4.3L11 24.6zM29 16l-8.2 4.3 8.2 4.3z" fill="{c}"/><rect x="18.8" y="12.6" width="2.4" height="7" fill="{c}"/><rect x="15.2" y="11.2" width="9.6" height="2.4" rx="1" fill="{c}"/>',
  },
  {
    key: "meter",
    label: "Đồng hồ",
    svg: '<circle cx="20" cy="19.5" r="7.2" fill="none" stroke="{c}" stroke-width="2.6"/><path d="M20 19.5l3.6-3.6" stroke="{c}" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="19.5" r="1.6" fill="{c}"/>',
  },
  {
    key: "tee",
    label: "Tê",
    svg: '<rect x="10.8" y="13.4" width="18.4" height="5.6" rx="1.3" fill="{c}"/><rect x="17.2" y="17" width="5.6" height="10.4" rx="1.3" fill="{c}"/>',
  },
  { key: "elbow", label: "Cút", svg: '<path d="M11.5 13.2h10.2a4.2 4.2 0 0 1 4.2 4.2v9.8h-5.6v-8.4h-8.8z" fill="{c}"/>' },
  {
    key: "wrench",
    label: "Cờ lê",
    svg: '<path d="M26.3 12.1a4.8 4.8 0 0 0-6.2 5.8l-6.7 6.7 2.4 2.4 6.7-6.7a4.8 4.8 0 0 0 5.8-6.2l-2.7 2.7-2.3-.6-.6-2.3z" fill="{c}"/>',
  },
  {
    key: "warning",
    label: "Cảnh báo",
    svg: '<path d="M20 11.2l8.8 15.4H11.2z" fill="{c}"/><rect x="19" y="16" width="2" height="5.6" rx=".8" fill="#fff"/><rect x="19" y="22.8" width="2" height="2" rx="1" fill="#fff"/>',
  },
];

const BY_KEY = Object.fromEntries(POINT_ICONS.map((icon) => [icon.key, icon]));

export const getPointIconSvg = (key, color) => (BY_KEY[key] || BY_KEY.drop).svg.replaceAll("{c}", color);

// Hinh nho (vong tron trang + bieu tuong) cho o chon bieu tuong va chu giai.
export const iconPreviewMarkup = (key, color = "#0f766e", size = 22) => (
  `<svg viewBox="9 8.5 22 22" width="${size}" height="${size}"><circle cx="20" cy="19.5" r="10.5" fill="#fff" stroke="${color}" stroke-width="1.2"/>${getPointIconSvg(key, color)}</svg>`
);
