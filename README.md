# Oath

Static citizenship oath form deployed with Cloudflare Pages. The form posts to
`/send-email`, and the Pages Function sends the submission by SMTP.

## SMTP configuration

The deployed Pages Function needs these environment variables:

| Name | Required | Notes |
| --- | --- | --- |
| `SMTP_HOST` | Yes | SMTP server hostname. |
| `SMTP_FROM_EMAIL` | Yes | Sender address used in `MAIL FROM` and the email header. |
| `SMTP_TO_EMAIL` | Yes | Recipient for oath submissions. |
| `SMTP_PORT` | No | Defaults to `25`, `465` when `SMTP_SECURE_TRANSPORT=on`, and `587` when `SMTP_SECURE_TRANSPORT=starttls`. |
| `SMTP_SECURE_TRANSPORT` | No | One of `off`, `on`, or `starttls`. Defaults to `off`. |
| `SMTP_HELO_DOMAIN` | No | Domain sent in `EHLO`. Defaults to `localhost`. |
| `SMTP_USERNAME` | No | SMTP auth username. Set with `SMTP_PASSWORD`. |
| `SMTP_PASSWORD` | No | SMTP auth password. Store this as a Cloudflare secret. |

The non-secret production SMTP values are stored in `wrangler.toml`:

```toml
[vars]
SMTP_HOST = "mail.niabar.org"
SMTP_PORT = "25"
SMTP_SECURE_TRANSPORT = "starttls"
SMTP_HELO_DOMAIN = "oath.niabar.org"
SMTP_FROM_EMAIL = "oath@niabar.org"
SMTP_TO_EMAIL = "gov@niabar.org"
```

For local development with Wrangler, put non-committed values in `.dev.vars`.
For production, configure the same names in Cloudflare Workers & Pages under
Variables and Secrets, or add non-sensitive values to `wrangler.toml` if this
repository's Wrangler configuration is the source of truth for the Pages
project.

Example `.dev.vars`:

```sh
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE_TRANSPORT=starttls
SMTP_HELO_DOMAIN=oath.example.com
SMTP_FROM_EMAIL=oath@example.com
SMTP_TO_EMAIL=recipient@example.com
SMTP_USERNAME=oath@example.com
SMTP_PASSWORD=replace-with-provider-password
```

Run locally with:

```sh
/home/jonah/.nvm/versions/node/v25.8.1/bin/npx wrangler pages dev public
```
