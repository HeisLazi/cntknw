# Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities, credentials, tokens, private user data, or exploit details in a public issue.

Report security concerns privately to the repository owner through the contact information on the [HeisLazi profile](https://github.com/HeisLazi). Include affected versions, reproduction steps, likely impact, and any safe supporting evidence.

## Supported versions

These projects are under active development. Only the latest default-branch revision and explicitly published releases are considered for security fixes.

## Security expectations

- Never commit secrets. Use environment variables and maintain a safe `.env.example`.
- Treat uploaded documents, media, prompts, model output, and external API responses as untrusted input.
- Minimize collection and retention of personal or sensitive content.
- Keep privileged operations server-side and enforce authorization at the data boundary.
- Review dependency updates and run the documented verification gate before merging.
- Require explicit human approval for authentication, authorization, privacy, retention, payment, analytics, licensing, or destructive-data changes.
