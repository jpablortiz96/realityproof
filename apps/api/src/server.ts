import { buildApp } from "./app.js";
import { seedInitialDemoTask } from "./seed.js";

async function start() {
  const { app, config, proofs, audit, paypal } = await buildApp();
  seedInitialDemoTask(proofs, audit, paypal);

  const shutdown = () => {
    void app.close().finally(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(
      `[RealityProof API] Listening on http://localhost:${config.port} (PayPal Mode: ${config.paypal.mode}, Public demo: ${config.publicDemoMode})`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

