# Public demo security report

**Date:** 2026-11-05. **Scope:** the `demo` container with `PUBLIC_DEMO_MODE=true`, plus the code paths behind it. This is a self-assessment with automated checks, not an independent penetration test.

Reproduce the black-box checks against any running demo:

```bash
node scripts/public-demo-security-check.mjs http://localhost:8080
```

Results on the final build, run from a clean clone of the public snapshot on 2026-11-06: [`evidence/gate4d/final/public-demo-security-check.json`](../../evidence/gate4d/final/public-demo-security-check.json).

## How the demo is isolated

| Layer | Control |
|---|---|
| Server hook | Runs before any route and denies by default. Only `POST /api/v1/economics/voi` and `POST /api/v1/ai/studio-agent-turn` accept writes. |
| Credentials | The Compose `demo` service never receives PayPal credentials, so it couldn't charge anyone even if the hook failed. |
| State | In memory, reseeded on start. Nothing a visitor does persists. |
| Published tokens | Role tokens are public in this mode, and exposed on purpose so the role switcher works. They grant reads only, because every write is denied regardless of token. |
| Container | Non-root user, read-only filesystem, all capabilities dropped, `no-new-privileges`, 1 GB memory limit. |

## Results by requirement

| Requirement | Result | Evidence |
|---|---|---|
| No financial writes | **PASS** | Order, capture, synthetic funding, replay, reuse, assign, evidence, analyze, review and webhook all return 403 with the operator token. Unit tests confirm PayPal is never called. |
| No route tricks | **PASS** | Trailing slash, double slash, `..` segments, case changes, a query string naming an allowed path, a method-override header, and PUT, PATCH and DELETE had no effect. |
| No writes through role or token tampering | **PASS** | A forged token returns 401. Role claims in a header or query parameter return 400. Roles come only from the server's token check. |
| No access across accounts | **PASS** | The external agent token sees none of the requester's tasks, and direct access by ID returns 404. |
| No private image exposure | **PASS** | Evidence previews without a token, or with a forged signed link, return 401. Attempts to fetch `.env`, the state file, evidence JSON, compiled server code and traversal paths get only the web app page. |
| No personal data | **PASS** | No email address or payer field in the tasks, analytics, audit or capabilities responses. The server stopped storing PayPal's raw order payload. Visitor prompts are hidden from the public audit list. |
| No credentials exposed | **PASS** | No Google or PayPal key pattern in API responses or the browser bundle. Git history and working tree contain neither the PayPal nor the Gemini credential. |
| No double counting | **PASS** | One capture and 14.00 USD in the summary. Tests cover the one-capture, one-contract rule. |
| Unclaimed payout not shown as received | **PASS** | Received 0.00, unclaimed 11.20. |
| Gemini spend bounded | **PASS** | 30 agent requests a minute per client, confirmed by a burst test. Daily budget, unit tested. Analysis is unavailable in the demo. |
| Errors reveal no internals | **PASS** | A unit test forces an internal failure and gets a generic 500. Request logs record only the method and path. |
| Browser hardening | **PASS** | Content Security Policy with no script exceptions, no CSP violations during a browser session, framing denied, `nosniff`. |

## Agent

The Studio agent is reachable in the demo, so it was tested directly, including with live Gemini during the GATE 4A acceptance run.

- It has no tool that reaches a payment, decision or stored record. The server filters the tools it is offered and discards any other tool a model returns.
- Direct injection is refused by the server before reaching the model. Paraphrased attempts to pay, approve, mix money, claim authenticity or reveal secrets were refused by the model in the live run. In those cases the guarantee is still that no such tool exists.
- Model refusals can quote guardrail wording from the conversation. Only `meta.guardrail_triggered` means the server blocked a request.

## Known limits and residual risk

| Risk | Level | Note |
|---|---|---|
| Fixed public role tokens | Low in demo mode | There are no accounts. The `full` service binds to localhost only and must not be published. |
| Agent text can be wrong or misleading | Medium | The model can misstate data, and prompts can influence wording. It can't take any action. Everything is labeled as a demo. |
| Cost abuse of the Gemini key | Low | Bounded by per-client and daily limits. A distributed abuser could use up the daily budget, after which the planner answers. Also set a limit with Google. Rate limits rely on `TRUST_PROXY=true` behind Caddy. |
| Denial of service | Medium | Rate limits and memory caps only. A small instance has no DDoS protection beyond what AWS provides by default. |
| `style-src 'unsafe-inline'` | Low | AG Studio injects styles at runtime. Scripts have no such exception. |
| Webhooks | Not applicable in the demo | Denied by the hook. Not tested against live PayPal events in any mode. |
| Third-party dependencies | Not assessed | No dependency vulnerability audit is part of this report. |

## Not tested

- A deployment on a public network. Tests ran locally, including HTTPS with a local certificate.
- An independent penetration test.
- PayPal webhooks with live events.
