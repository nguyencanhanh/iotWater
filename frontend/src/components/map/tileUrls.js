// Anh ve tinh Google + lop chu (ten duong). Lop chu tat nhom "dia diem" (s.t:2 = poi,
// p.v:off = an) de bo bieu tuong nha hang, benh vien, quan ca phe... chi giu duong va ten duong.
export const SATELLITE_TILE_URL = "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
export const LABEL_TILE_URL = "https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&apistyle=s.t%3A2%7Cp.v%3Aoff";
export const TILE_SUBDOMAINS = ["mt1", "mt2", "mt3"];

// Leaflet mac dinh chi cho phong to toi muc 18. Anh ve tinh Google o Bac Giang co toi muc 20;
// muc 21 Leaflet phong to tiep x2 tu anh muc 20 (hoi nhoe nhung de cham diem / ve ong chinh xac).
export const MAP_MAX_ZOOM = 21;
export const TILE_MAX_NATIVE_ZOOM = 20;
