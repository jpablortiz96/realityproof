# Security

RealityProof is a hackathon prototype that runs only against PayPal Sandbox. It uses test money and fixed demo role tokens, and it has no user accounts. Do not use it with real payments, real personal data or real evidence photos.

## Reporting a problem

Please report vulnerabilities privately through GitHub's "Report a vulnerability" option on this repository rather than opening a public issue. Do not include real credentials in a report.

## Security model

The controls and how they were tested are described in the [public demo security report](docs/release/PUBLIC_DEMO_SECURITY_REPORT.md) and [architecture](docs/ARCHITECTURE.md).

## Known limits

- One fixed token per role. Role separation is demonstrated, but there are no individual identities.
- The published default tokens and secret exist for local development. In production the API refuses the published secret, and accepts published tokens only in the read-only public demo.
- State is a single JSON file, which suits one instance.
- PayPal webhooks are implemented with signature verification, but none is registered, so they are untested against live events. The demo confirms payment state by querying PayPal.
- Automated scans are not a security audit, and axe checks are not WCAG certification.
