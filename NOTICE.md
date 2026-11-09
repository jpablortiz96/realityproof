# Notices and third-party licenses

## This project

The code in this repository is released under the [MIT License](LICENSE).

## AG Studio is not open source

This project depends on these packages, which are **commercial software** of AG Grid Ltd and are **not** covered by this repository's MIT License:

- `ag-studio` 3.1.0
- `ag-studio-react` 3.1.0
- `ag-grid-enterprise` 36.3.0
- `ag-charts-enterprise` 14.3.0

They are declared as npm dependencies and are not included in this repository. No licence key is included either. Their use is governed by the [AG Grid End User Licence Agreement](https://www.ag-grid.com/eula/).

AG Grid's documentation says AG Studio can be tested locally without a licence, in which case it shows a watermark and console warnings. Deploying it publicly or in production needs a licence or AG Grid's permission. Anyone reusing this project must obtain their own rights to these packages.

A key, if you have one, goes in the `VITE_AG_STUDIO_LICENSE_KEY` variable. Vite embeds it in the browser bundle, so it is not secret.

## Other dependencies

An inventory on 2026-11-05 (`pnpm licenses list`) found the remaining packages under MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, OFL-1.1 (fonts), CC-BY-4.0 (`caniuse-lite` data) and MPL-2.0 (`axe-core` and `@axe-core/playwright` for testing, and `lightningcss` at build time).

## Names and data

PayPal, Google Gemini, AG Grid, AG Studio and AWS are trademarks of their owners. This project is not endorsed by them.

"FictoParts" and the `FICTO-` part numbers in the demo are fictional. Any resemblance to a real company is unintended. The historical Sandbox record and some test data name a real manufacturer's part number as sample text; the interface masks it, and it implies no relationship with or endorsement by that company. All demo images are generated, labeled fixtures rather than photographs of products, and they say nothing about any real product, seller or manufacturer.
