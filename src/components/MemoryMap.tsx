import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapLocation {
  date: string;
  note: string | null;
  latitude: number;
  longitude: number;
}

interface MemoryMapProps {
  center: [number, number];
  locations: MapLocation[];
}

export default function MemoryMap({ center, locations }: MemoryMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={locations.length === 1 ? 12 : 4}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full rounded-b-2xl"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {locations.map((loc, i) => (
        <Marker key={i} position={[loc.latitude, loc.longitude]}>
          <Popup>
            <span className="font-body text-xs">
              {loc.date}{loc.note ? ` — ${loc.note}` : ""}
            </span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
