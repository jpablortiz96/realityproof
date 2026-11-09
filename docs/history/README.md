# Historical reports — not current documentation

These files were written during earlier development gates. They are kept unedited as a record of how the project evolved. **They are not a description of what RealityProof does today, and several of their claims are wrong.** For the current state, read the [README](../../README.md) and [Feature status](../FEATURE_STATUS.md).

A release audit on 2026-11-05, done by the same project team rather than an independent party, checked them against the code and live PayPal Sandbox records.

## Known errors

| Claim in these reports | What the audit found |
|---|---|
| Payout batch `PQ2Z9K78X5R2C`, 11.20 USD | **This batch does not exist.** PayPal Sandbox returns 404 for it. |
| A payout of 11.20 USD was disbursed or is `PAYOUT_ELIGIBLE` | The only real batch is `VNMEQ8SMKZLUQ`. Batch status `SUCCESS`, item `DUU2P4Q7F3DRW` status `UNCLAIMED`. It was created by a connectivity probe 56 minutes **before** the capture. The verifier did not receive these test funds. |
| The Studio agent answers queries A–E with Gemini and framework tools | At that point it was a keyword router with no model. The chat panel could not be opened, and the server stripped every real AG Studio tool. It was connected to Gemini in GATE 4A. |
| Canonical queries about a Sony A7 IV and a MacBook Pro, with their prices and "VoI multiples" | Those cases, and fields such as `asset_title`, `category`, `ai_authenticity_score` and `trust_tier`, never existed in the code. The seeded cases are synthetic spare parts. |
| Guardrail codes such as `PROMPT_INJECTION_FINANCIAL_MUTATION_BLOCKED` | Not the codes in the code. |
| `REQUESTER` analytics are scoped to their own tasks; a `JUDGE` server role exists | Scoping was not implemented until GATE 4A. There is no `JUDGE` server role. |
| Capture `0TL320715J3450828` funded a commercial-grade passport | The capture is real Sandbox money, but the photo was a labeled synthetic fixture and one view was waived by a human exception. The passport is `APPROVED_FOR_DEMO`. |
| The model is `gemini-2.5-flash` or `gemini-4-argon` | The effective model is `gemini-3.5-flash-lite`. |
| PostgreSQL stores the data; "SQLite/JSON" | The running API uses one JSON file plus images on disk. The PostgreSQL schema is unused. |
| `demo_queries_verified: 5/5` | That check only tested that a response had more than 20 characters. |

The usability report declares its own status correctly: `EXTERNAL_VALIDATION_PENDING`. No study with external participants has taken place.

## Layout

- `reports/`: gate reports and planning prompts from GATE 1 to GATE 3.
- `gate0/`: the original architecture decision record, threat model and requirements matrices.

The public release omits those folders and the older screenshots and QA output, because they contain the errors above. They are kept in the project's internal repository.
