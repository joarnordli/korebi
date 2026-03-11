/**
 * Lightweight EXIF GPS parser — no dependencies.
 * Reads GPS latitude & longitude from JPEG EXIF data.
 */

interface GpsCoords {
  latitude: number;
  longitude: number;
}

export async function extractGpsFromFile(file: File): Promise<GpsCoords | null> {
  try {
    const buffer = await file.arrayBuffer();
    return extractGps(new DataView(buffer));
  } catch {
    return null;
  }
}

function extractGps(view: DataView): GpsCoords | null {
  // Check JPEG SOI marker
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);
    if (marker === 0xffe1) {
      // APP1 — EXIF
      const length = view.getUint16(offset + 2);
      return parseExifGps(view, offset + 4, length - 2);
    }
    // Skip non-APP1 markers
    if ((marker & 0xff00) !== 0xff00) return null;
    const segLen = view.getUint16(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

function parseExifGps(view: DataView, start: number, _length: number): GpsCoords | null {
  // "Exif\0\0"
  if (
    view.getUint8(start) !== 0x45 ||
    view.getUint8(start + 1) !== 0x78 ||
    view.getUint8(start + 2) !== 0x69 ||
    view.getUint8(start + 3) !== 0x66
  )
    return null;

  const tiffStart = start + 6;
  const byteOrder = view.getUint16(tiffStart);
  const le = byteOrder === 0x4949; // little-endian

  const get16 = (o: number) => view.getUint16(o, le);
  const get32 = (o: number) => view.getUint32(o, le);

  // IFD0
  const ifdOffset = get32(tiffStart + 4);
  const ifd0Start = tiffStart + ifdOffset;
  const ifd0Count = get16(ifd0Start);

  let gpsIfdPointer: number | null = null;
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = ifd0Start + 2 + i * 12;
    const tag = get16(entryOffset);
    if (tag === 0x8825) {
      // GPSInfoIFDPointer
      gpsIfdPointer = get32(entryOffset + 8);
      break;
    }
  }

  if (gpsIfdPointer === null) return null;

  const gpsStart = tiffStart + gpsIfdPointer;
  const gpsCount = get16(gpsStart);

  let latRef: string | null = null;
  let lonRef: string | null = null;
  let latVals: number[] | null = null;
  let lonVals: number[] | null = null;

  for (let i = 0; i < gpsCount; i++) {
    const entryOffset = gpsStart + 2 + i * 12;
    const tag = get16(entryOffset);

    if (tag === 1) {
      // GPSLatitudeRef
      latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === 2) {
      // GPSLatitude
      const valOffset = tiffStart + get32(entryOffset + 8);
      latVals = readRationals(view, valOffset, 3, le);
    } else if (tag === 3) {
      // GPSLongitudeRef
      lonRef = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === 4) {
      // GPSLongitude
      const valOffset = tiffStart + get32(entryOffset + 8);
      lonVals = readRationals(view, valOffset, 3, le);
    }
  }

  if (!latVals || !lonVals || !latRef || !lonRef) return null;

  let latitude = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
  let longitude = lonVals[0] + lonVals[1] / 60 + lonVals[2] / 3600;
  if (latRef === "S") latitude = -latitude;
  if (lonRef === "W") longitude = -longitude;

  if (latitude === 0 && longitude === 0) return null;
  if (isNaN(latitude) || isNaN(longitude)) return null;

  return { latitude, longitude };
}

function readRationals(
  view: DataView,
  offset: number,
  count: number,
  le: boolean
): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const num = view.getUint32(offset + i * 8, le);
    const den = view.getUint32(offset + i * 8 + 4, le);
    values.push(den === 0 ? 0 : num / den);
  }
  return values;
}
