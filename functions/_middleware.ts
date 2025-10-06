// Cloudflare Pages Functions middleware
export async function onRequest(context: any) {
  // Add CORS headers for development
  const response = await context.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
}
