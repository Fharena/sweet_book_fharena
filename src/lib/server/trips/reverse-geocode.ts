import { isMeaningfulLocationLabel } from "@/lib/trip-grouping";
import type { GeoPoint, ImportedPhoto } from "@/lib/trip-domain";

type ReverseGeocodeResponse = {
  display_name?: string;
  address?: Partial<Record<string, string>>;
};

const reverseGeocodeCache = new Map<string, Promise<string | null>>();

const CITY_KEYS = ["city", "town", "village", "municipality", "county"] as const;
const LOCAL_KEYS = [
  "suburb",
  "neighbourhood",
  "quarter",
  "hamlet",
  "city_district",
  "borough",
  "district",
] as const;

const IGNORED_DISPLAY_TOKENS = [
  "대한민국",
  "Republic of Korea",
  "South Korea",
  "한국",
  "Korea",
];

function cleanLabelPart(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function dedupeJoinedParts(parts: Array<string | null | undefined>) {
  const cleaned = parts
    .map((part) => cleanLabelPart(part))
    .filter((part): part is string => Boolean(part));

  return cleaned.filter((part, index) => cleaned.indexOf(part) === index);
}

function pickFirstAddressValue(
  address: ReverseGeocodeResponse["address"],
  keys: readonly string[],
) {
  if (!address) {
    return null;
  }

  for (const key of keys) {
    const value = cleanLabelPart(address[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function pickDisplayNameLabel(displayName: string | undefined) {
  if (!displayName) {
    return null;
  }

  const tokens = displayName
    .split(",")
    .map((token) => cleanLabelPart(token))
    .filter((token): token is string => Boolean(token))
    .filter((token) => !IGNORED_DISPLAY_TOKENS.includes(token));

  if (tokens.length === 0) {
    return null;
  }

  const cityLike = tokens.find((token) => /(시|군)$/.test(token));
  const localLike =
    tokens.find((token) => /(동|읍|면|리|가)$/.test(token) && token !== cityLike) ??
    tokens.find((token) => /(구)$/.test(token) && token !== cityLike);

  const joined = dedupeJoinedParts([cityLike, localLike]).join(" ").trim();
  if (joined) {
    return joined;
  }

  return tokens.slice(0, 2).join(" ").trim() || null;
}

function normalizeReverseGeocodedLabel(payload: ReverseGeocodeResponse) {
  const city = pickFirstAddressValue(payload.address, CITY_KEYS);
  const local = pickFirstAddressValue(payload.address, LOCAL_KEYS);
  const district = cleanLabelPart(payload.address?.state_district);

  const cityAndLocal = dedupeJoinedParts([city, local]).join(" ").trim();
  if (cityAndLocal) {
    return cityAndLocal;
  }

  const districtAndLocal = dedupeJoinedParts([district, local]).join(" ").trim();
  if (districtAndLocal) {
    return districtAndLocal;
  }

  const fallbackAddress = dedupeJoinedParts([local, city, district]).join(" ").trim();
  if (fallbackAddress) {
    return fallbackAddress;
  }

  return pickDisplayNameLabel(payload.display_name);
}

function getCoordinateCacheKey(point: GeoPoint) {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

async function fetchReverseGeocodedLabel(point: GeoPoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const search = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      "accept-language": "ko-KR,ko,en",
      lat: point.latitude.toString(),
      lon: point.longitude.toString(),
      zoom: "16",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${search.toString()}`,
      {
        headers: {
          "User-Agent": "TriplogueStudio/1.0 (Sweetbook demo)",
        },
        signal: controller.signal,
        cache: "force-cache",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ReverseGeocodeResponse;
    const normalizedLabel = normalizeReverseGeocodedLabel(payload);

    return isMeaningfulLocationLabel(normalizedLabel) ? normalizedLabel : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveLocationLabelFromCoordinates(point: GeoPoint) {
  const cacheKey = getCoordinateCacheKey(point);
  const cached = reverseGeocodeCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = fetchReverseGeocodedLabel(point);
  reverseGeocodeCache.set(cacheKey, pending);

  return pending;
}

export async function applyResolvedLocationLabels(photos: ImportedPhoto[]) {
  return Promise.all(
    photos.map(async (photo) => {
      if (!photo.coordinates || isMeaningfulLocationLabel(photo.locationLabel)) {
        return photo;
      }

      const locationLabel = await resolveLocationLabelFromCoordinates(photo.coordinates);
      if (!locationLabel) {
        return photo;
      }

      return {
        ...photo,
        locationLabel,
        locationSource: photo.locationSource === "manual" ? "manual" : "exif",
        requiresManualLocationTagging: false,
        groupingReason: `${locationLabel} 위치를 GPS 좌표에서 자동으로 보완했습니다.`,
      } satisfies ImportedPhoto;
    }),
  );
}
