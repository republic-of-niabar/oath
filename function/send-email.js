export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '*';

  // common CORS headers for all responses:
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Methods':     'POST, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  // 1) Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS
    });
  }

  // 2) Only allow POST
  if (request.method != 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: CORS_HEADERS
    });
  }

  // 3) Parse JSON
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid JSON' }), {
      status: 400,
      headers: { 
        ...CORS_HEADERS, 
        'Content-Type': 'application/json' 
      }
    });
  }

  const {
    name, dob,
    contactPreference, contactAddress,
    oathType, oathText
  } = data;

  if (!name || !dob || !contactAddress || !oathText) {
    return new Response(JSON.stringify({ message: 'Missing fields' }), {
      status: 400,
      headers: { 
        ...CORS_HEADERS, 
        'Content-Type': 'application/json' 
      }
    });
  }

  // your env vars
  const MAILERSEND_API_KEY    = env.MAILERSEND_API_KEY;
  const MAILERSEND_FROM_EMAIL = env.MAILERSEND_FROM_EMAIL;
  const MAILERSEND_TO_EMAIL   = env.MAILERSEND_TO_EMAIL;

  const mailPayload = {
    from: { email: MAILERSEND_FROM_EMAIL },
    to:   [{ email: MAILERSEND_TO_EMAIL }],
    subject: "🇳🇮 Niabar Citizenship Oath Submission",
    text: `
Name: ${name}
Date of Birth: ${dob}
Contact via: ${contactPreference} (${contactAddress})

Oath (${oathType}):
${oathText}
    `,
    html: `
      <h2>Niabar Citizenship Oath Submission</h2>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>DOB:</strong> ${dob}</li>
        <li><strong>Contact via:</strong> ${contactPreference} (${contactAddress})</li>
        <li><strong>Oath Type:</strong> ${oathType}</li>
      </ul>
      <p>${oathText}</p>
    `
  };

  try {
    const resp = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${MAILERSEND_API_KEY}`
      },
      body: JSON.stringify(mailPayload)
    });

    if (!resp.ok) {
      const errbody = await resp.text();
      return new Response(JSON.stringify({
        message: 'MailerSend error: ' + errbody
      }), {
        status: resp.status,
        headers: { 
          ...CORS_HEADERS, 
          'Content-Type': 'application/json' 
        }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 
        ...CORS_HEADERS, 
        'Content-Type': 'application/json' 
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      message: 'Fetch error: ' + e.message
    }), {
      status: 500,
      headers: { 
        ...CORS_HEADERS, 
        'Content-Type': 'application/json' 
      }
    });
  }
}
