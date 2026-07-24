import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const originLat = searchParams.get('originLat');
  const originLng = searchParams.get('originLng');
  const destLat = searchParams.get('destLat');
  const destLng = searchParams.get('destLng');

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&departure_time=now&language=ja&key=${apiKey}`;
    
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();

    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = data.rows[0].elements[0];
      // Prefer duration_in_traffic if available, else standard duration
      const durationSeconds = element.duration_in_traffic?.value || element.duration?.value || 0;
      const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
      const distanceMeters = element.distance?.value || 0;

      return NextResponse.json({
        durationMinutes,
        durationText: element.duration_in_traffic?.text || element.duration?.text || `${durationMinutes}分`,
        distanceMeters,
        distanceText: element.distance?.text || '',
        status: 'OK'
      });
    }

    return NextResponse.json({ 
      error: 'Route not found or API error', 
      apiStatus: data.status,
      elementStatus: data.rows?.[0]?.elements?.[0]?.status 
    }, { status: 404 });
  } catch (error: any) {
    console.error('Error fetching Distance Matrix:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
