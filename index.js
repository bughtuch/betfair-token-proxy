export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://www.tennistraderai.com',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const { code } = await request.json();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.BETFAIR_CLIENT_ID,
      client_secret: env.BETFAIR_CLIENT_SECRET,
    });

    const response = await fetch('https://identitysso.betfair.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://www.tennistraderai.com'
      }
    });
  }
};
