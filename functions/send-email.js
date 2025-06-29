export async function onRequest({ request }) {
  return new Response(JSON.stringify({
    method: request.method,
    url: request.url,
    working: true
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
