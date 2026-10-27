// Never cache clock samples. Browser estimates transit using half the round trip.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('CDN-Cache-Control', 'no-store');
  response.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  const unixMs = Date.now();
  response.status(200).json({ unixMs, iso: new Date(unixMs).toISOString(), source: 'Vercel server clock' });
}
