import { useEffect } from "react";
import { useMap } from "react-leaflet";
export default function MapRecenter({ position }) {
const map = useMap();

useEffect(() => {
if (position) {
map.setView(position, map.getZoom(), {
animate: true,
});
}
}, [position, map]);

return null;
}

/* =========================================================
STAT CARD
========================================================= */

