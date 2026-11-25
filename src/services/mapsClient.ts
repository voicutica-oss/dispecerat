export interface MapsPlaceLink {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets: string[];
}

export interface MapsGroundingResult {
  text: string;
  places: MapsPlaceLink[];
}

export async function getBrowserLatLng(): Promise<
  { latitude: number; longitude: number } | undefined
> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return undefined;
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), 2500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        window.clearTimeout(timer);
        resolve(undefined);
      },
      { enableHighAccuracy: false, timeout: 2200, maximumAge: 300000 }
    );
  });
}

export async function queryMapsGrounding(params: {
  query?: string;
  destination?: string;
  country?: string;
  useGeolocation?: boolean;
}): Promise<MapsGroundingResult> {
  const latLng = params.useGeolocation ? await getBrowserLatLng() : undefined;

  const response = await fetch('/api/maps/grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: params.query,
      destination: params.destination,
      country: params.country,
      latLng,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<MapsGroundingResult> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data?.error || `Eroare la interogarea Google Maps (HTTP ${response.status}).`
    );
  }

  return {
    text: typeof data.text === 'string' ? data.text : '',
    places: Array.isArray(data.places) ? data.places : [],
  };
}
