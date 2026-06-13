import { connect } from 'cloudflare:sockets';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VALID_SECURE_TRANSPORTS = new Set(['off', 'on', 'starttls']);

class SmtpConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SmtpConfigError';
  }
}

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

function asOptionalString(value) {
  const stringValue = String(value ?? '').trim();
  return stringValue || undefined;
}

function encodeBase64(value) {
  const bytes = encoder.encode(String(value));
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function dotStuffBody(body) {
  return body
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

function defaultSmtpPort(secureTransport) {
  if (secureTransport === 'on') {
    return 465;
  }

  if (secureTransport === 'starttls') {
    return 587;
  }

  return 25;
}

function getSmtpConfig(env) {
  const secureTransport = asOptionalString(env.SMTP_SECURE_TRANSPORT) || 'off';
  const portValue = env.SMTP_PORT ?? defaultSmtpPort(secureTransport);
  const port = Number(portValue);
  const config = {
    host: asOptionalString(env.SMTP_HOST),
    port,
    heloDomain: asOptionalString(env.SMTP_HELO_DOMAIN) || 'localhost',
    fromEmail: asOptionalString(env.SMTP_FROM_EMAIL),
    toEmail: asOptionalString(env.SMTP_TO_EMAIL),
    secureTransport,
    username: asOptionalString(env.SMTP_USERNAME),
    password: asOptionalString(env.SMTP_PASSWORD),
  };

  const problems = [];

  if (!config.host) problems.push('SMTP_HOST is required');
  if (!config.fromEmail) problems.push('SMTP_FROM_EMAIL is required');
  if (!config.toEmail) problems.push('SMTP_TO_EMAIL is required');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('SMTP_PORT must be an integer from 1 to 65535');
  }
  if (!VALID_SECURE_TRANSPORTS.has(secureTransport)) {
    problems.push('SMTP_SECURE_TRANSPORT must be one of: off, on, starttls');
  }
  if ((config.username && !config.password) || (!config.username && config.password)) {
    problems.push('SMTP_USERNAME and SMTP_PASSWORD must be set together');
  }

  if (problems.length > 0) {
    throw new SmtpConfigError(problems.join('; '));
  }

  return config;
}

async function sendSmtpCommand(writer, command) {
  await writer.write(encoder.encode(`${command}\r\n`));
}

function releaseLock(lock) {
  try {
    lock.releaseLock();
  } catch {
    // The lock may already have been released during a STARTTLS upgrade.
  }
}

async function readSmtpResponse(reader) {
  let buffered = '';
  const responseLines = [];

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

      if (!Number.isNaN(code) && (continuationMarker === '-' || continuationMarker === ' ')) {
        responseLines.push(line);
      }

      if (!Number.isNaN(code) && continuationMarker === ' ') {
        return { code, line, lines: responseLines };
      }
    }
  }
}

function assertSmtpCode(response, validCodes) {
  if (!validCodes.includes(response.code)) {
    throw new Error(`SMTP ${response.code}: ${response.line}`);
  }
}

async function authenticateSmtp(writer, reader, username, password) {
  if (!username || !password) {
    return;
  }

  const credentials = encodeBase64(`\0${username}\0${password}`);

  await sendSmtpCommand(writer, `AUTH PLAIN ${credentials}`);
  assertSmtpCode(await readSmtpResponse(reader), [235]);
}

async function sendMailViaSmtp(env, content) {
  const smtpConfig = getSmtpConfig(env);

  let socket = connect(
    { hostname: smtpConfig.host, port: smtpConfig.port },
    { secureTransport: smtpConfig.secureTransport }
  );

  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();

  try {
    assertSmtpCode(await readSmtpResponse(reader), [220]);

    await sendSmtpCommand(writer, `EHLO ${smtpConfig.heloDomain}`);
    assertSmtpCode(await readSmtpResponse(reader), [250]);

    if (smtpConfig.secureTransport === 'starttls') {
      await sendSmtpCommand(writer, 'STARTTLS');
      assertSmtpCode(await readSmtpResponse(reader), [220]);

      releaseLock(writer);
      releaseLock(reader);
      socket = socket.startTls();
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();

      await sendSmtpCommand(writer, `EHLO ${smtpConfig.heloDomain}`);
      assertSmtpCode(await readSmtpResponse(reader), [250]);
    }

    await authenticateSmtp(writer, reader, smtpConfig.username, smtpConfig.password);

    await sendSmtpCommand(writer, `MAIL FROM:<${smtpConfig.fromEmail}>`);
    assertSmtpCode(await readSmtpResponse(reader), [250]);

    await sendSmtpCommand(writer, `RCPT TO:<${smtpConfig.toEmail}>`);
    assertSmtpCode(await readSmtpResponse(reader), [250, 251]);

    await sendSmtpCommand(writer, 'DATA');
    assertSmtpCode(await readSmtpResponse(reader), [354]);

    const safeSubject = asSingleLineHeaderValue(content.subject);
    const message = [
      `From: ${smtpConfig.fromEmail}`,
      `To: ${smtpConfig.toEmail}`,
      `Subject: ${safeSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      dotStuffBody(content.body),
      '.',
    ].join('\r\n');

    await writer.write(encoder.encode(message + '\r\n'));
    assertSmtpCode(await readSmtpResponse(reader), [250]);

    await sendSmtpCommand(writer, 'QUIT');
    await readSmtpResponse(reader);
  } finally {
    releaseLock(writer);
    releaseLock(reader);
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
    console.error(e);

    const message =
      e instanceof SmtpConfigError
        ? 'Submission service is not configured. Check SMTP settings.'
        : 'SMTP error: ' + e.message;

    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
}
