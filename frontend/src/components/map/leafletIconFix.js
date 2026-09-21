import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite bam hash vao ten file anh nen Leaflet khong tu tim duoc icon mac dinh.
// Phai goi o moi chunk co dung <Marker>, khong chi rieng man hinh tong quan.
let applied = false;

export const applyLeafletIconFix = () => {
  if (applied) return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });
  applied = true;
};

applyLeafletIconFix();

export default applyLeafletIconFix;
