# Feature status

Status of each feature as of 2026-11-05, based on the code and on tests that were run. Measurements are in [`evidence/`](../evidence/).

**Complete** means it works and was tested. **Partial** means it works with stated limits. **Not implemented** means it does not exist, even if an old report says it does.

## Complete

| Feature | How it was checked |
|---|---|
| Evidence contract with versioned required views (2-view legacy, 3-view current) | Automated tests |
| Value of Information calculator | Automated tests |
| PayPal Sandbox Orders v2: create, approve, capture, confirm with `GET` | One real run on 2026-10-28; re-read from PayPal on 2026-11-05, `COMPLETED`, 14.00 USD |
| One capture funds only one contract | Automated tests |
| Evidence upload checks: magic bytes, size, SHA-256, duplicates, cross-task replay, view completeness | Automated tests |
| Gemini multimodal analysis with structured, non-binding output | Live on 2026-11-05 with `gemini-3.5-flash-lite`, on synthetic images |
| Human decision: approve, reject, request more evidence, documented exception, separation of duties | Automated and browser tests |
| Proof Passport with hashes, provenance, limitations and a signed read link | Automated and browser tests |
| Four custom AG Studio widgets on real backend rows | Browser, inside the AG Studio canvas |
| Read-only Studio agent: filter, compare, explain provenance, focus a case, add a preset chart | Live Gemini: 25 of 25 attempts, see below |
| Agent fallback with no model, labeled in the interface | Browser, without a key |
| `PUBLIC_DEMO_MODE` denying all writes on the server | 50 black-box checks against the container |
| Role and task-level authorization | Automated tests and black-box checks |
| Container image, Compose, HTTPS proxy, health checks | Built and run locally; HTTPS tested with a local certificate |
| Persistence, backup and restore | Tested with real containers, including a simulated data loss |

## Partial

| Feature | Limit |
|---|---|
| Free-form charts designed by the model | **Experimental.** It placed a widget in 4 of 5 attempts, using 9 to 14 model calls and about a minute, and every attempt needed a fallback step. Whether the result matched the request was not graded. |
| PayPal Payouts v1 | The code gate and read-only status lookup work. The only real batch, `VNMEQ8SMKZLUQ`, shows item status `UNCLAIMED`: the verifier did not receive the test funds. It was created by a connectivity probe before the capture, so it is a historical anomaly and not an example of the normal flow. |
| PayPal webhooks | Signature verification is implemented and tested with mocks. No webhook is registered, so it was never exercised against live events. |
| Real field evidence | The workflow accepts camera photos, but every demo image is a labeled synthetic fixture. **No physical inspection has been performed.** |
| Roles | One fixed token per role. There are no user accounts. |
| Storage | One JSON file, suited to a single instance. |
| Accessibility | Automated axe checks show no critical or serious issues on the screens covered. Manual keyboard and screen reader testing has not been done, and this is not WCAG certification. |
| Agent API for external software | REST endpoints with a role token. An agent can create a request and a Sandbox order, and a human must approve the payment in PayPal. |

## Not implemented

- Verifier identity checks or a verifier network
- Physical authenticity certification of any kind
- Live (non-Sandbox) PayPal. Startup refuses it.
- Escrow or any regulated money handling
- A PostgreSQL runtime. The schema in `apps/api/src/db/` is unused.
- An SDK or MCP server
- AWS deployment. A plan exists in the [runbook](../DEPLOYMENT_RUNBOOK.md), but nothing has been deployed.
- A study with external users. Status: `EXTERNAL_VALIDATION_PENDING`.

## Agent reliability measurements

Measured on 2026-11-05 in a real browser with live Gemini on a free-tier key. Each attempt used a fresh page. Success means the requested change appeared on the dashboard. The answer text was not graded.

| Request | Success | Model calls per run | Median time |
|---|---|---|---|
| Query D: cost vs. expected loss chart | 10 of 10 | 2 | 5.5 s |
| Query A: still need evidence | 5 of 5 | 2 | 6.8 s |
| Query C: real Sandbox vs. synthetic | 5 of 5 | 2 | 4.9 s |
| Query E: case pending human review | 5 of 5 | 2 | 6.1 s |
| Free-form chart (experimental) | 4 of 5 | 9 to 14 | 65 s |

This is a small sample on one day, so it shows the design works and does not establish a reliability rate. Data: [`agent-reliability.json`](../evidence/gate4b/agent-reliability.json).
