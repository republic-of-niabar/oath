export async function onRequest(context) {
  const { request } = context;
  // DEBUG: echo back method + url
  if (request.url.includes('/api/send-email')) {
    const info = {
      gotMethod: request.method,
      gotURL:    request.url
    };
    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // …restore real logic once confirmed…
}
