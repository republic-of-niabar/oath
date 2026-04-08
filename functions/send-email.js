import { connect } from 'cloudflare:sockets';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function formatSubmission({
  name,
  dob,
  contactPreference,
  contactAddress,
  oathType,
  oathText,
}) {
  const subject = 'Niabar Citizenship Oath Submission';

  const lines = [
    `Name: ${name}`,
    `Date of Birth: ${dob}`,
    `Contact via: ${contactPreference} (${contactAddress})`,
    '',
    `Oath (${oathType}):`,
    oathText,
  ];

  return {
    subject,
    body: lines.join('\r\n'),
  };
}

function asSingleLineHeaderValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

async function sendSmtpCommand(writer, command) {
  await writer.write(encoder.encode(`${command}\r\n`));
}

async function readSmtpResponse(reader) {
  let buffered = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error('SMTP connection closed unexpectedly');
    }

    buffered += decoder.decode(value, { stream: true });

    const lines = buffered.split('\r\n');
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      if (line.length < 4) {
        continue;
      }

      const code = Number.parseInt(line.slice(0, 3), 10);
      const continuationMarker = line[3];

      if (!Number.isNaN(code) && continuationMarker === ' ') {
        return { code, line };
      }
    }
  }
}

function assertSmtpCode(response, validCodes) {
  if (!validCodes.includes(response.code)) {
    throw new Error(`SMTP ${response.code}: ${response.line}`);
  }
}

async function sendMailViaSmtp(env, content) {
  const SMTP_HOST = env.SMTP_HOST;
  const SMTP_PORT = Number.parseInt(env.SMTP_PORT ?? '25', 10);
  const SMTP_HELO_DOMAIN = env.SMTP_HELO_DOMAIN || 'localhost';
  const SMTP_FROM_EMAIL = env.SMTP_FROM_EMAIL;
  const SMTP_TO_EMAIL = env.SMTP_TO_EMAIL;
  const SMTP_SECURE_TRANSPORT = env.SMTP_SECURE_TRANSPORT || 'off';

  if (!SMTP_HOST || !SMTP_FROM_EMAIL || !SMTP_TO_EMAIL || Number.isNaN(SMTP_PORT)) {
    throw new Error('Missing or invalid SMTP configuration');
  }

  const socket = connect(
    { hostname: SMTP_HOST, port: SMTP_PORT },
    { secureTransport: SMTP_SECURE_TRANSPORT }
  );

  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();

  try {
    assertSmtpCode(await readSmtpResponse(reader), [220]);

    await sendSmtpCommand(writer, `EHLO ${SMTP_HELO_DOMAIN}`);
    assertSmtpCode(await readSmtpResponse(reader), [250]);

    await sendSmtpCommand(writer, `MAIL FROM:<${SMTP_FROM_EMAIL}>`);
    assertSmtpCode(await readSmtpResponse(reader), [250]);

    await sendSmtpCommand(writer, `RCPT TO:<${SMTP_TO_EMAIL}>`);
    assertSmtpCode(await readSmtpResponse(reader), [250, 251]);

    await sendSmtpCommand(writer, 'DATA');
    assertSmtpCode(await readSmtpResponse(reader), [354]);

    const safeSubject = asSingleLineHeaderValue(content.subject);
    const message = [
      `From: ${SMTP_FROM_EMAIL}`,
      `To: ${SMTP_TO_EMAIL}`,
      `Subject: ${safeSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      content.body.replace(/\n/g, '\r\n'),
      '.',
    ].join('\r\n');

    await writer.write(encoder.encode(message + '\r\n'));
    assertSmtpCode(await readSmtpResponse(reader), [250]);

    await sendSmtpCommand(writer, 'QUIT');
    await readSmtpResponse(reader);
  } finally {
    writer.releaseLock();
    reader.releaseLock();
    await socket.close();
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '*';

  // common CORS headers for all responses:
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  // 1) Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  // 2) Only allow POST
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: CORS_HEADERS,
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
        'Content-Type': 'application/json',
      },
    });
  }

  const { name, dob, contactPreference, contactAddress, oathType, oathText } = data;

  if (!name || !dob || !contactAddress || !oathText) {
    return new Response(JSON.stringify({ message: 'Missing fields' }), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const content = formatSubmission({
      name,
      dob,
      contactPreference,
      contactAddress,
      oathType,
      oathText,
    });

    await sendMailViaSmtp(env, content);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: 'SMTP error: ' + e.message }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
}
