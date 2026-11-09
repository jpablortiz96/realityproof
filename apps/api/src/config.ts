import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  webOrigin: string;
  publicApiBaseUrl: string;
  databaseUrl: string | undefined;
  stateFilePath: string;
  exposeDemoTokensInCapabilities: boolean;
  publicDemoMode: boolean;
  trustProxy: boolean;
  studioAgentDailyTurnLimit: number;
  analysisDailyLimit: number;
  webDistDir: string | undefined;
  maskThirdPartyBrands: boolean;
  authTokenSecret: string;
  tokens: {
    requester: string;
    verifier: string;
    operator: string;
    externalAgent: string;
  };
  paypal: {
    mode: "sandbox";
    apiBaseUrl: string;
    clientId: string;
    clientSecret: string;
    webhookId: string;
    sandboxVerifierEmail: string;
  };
  gemini: {
    apiKey: string;
    model: string;
    fallbackModel: string;
  };
  storage: {
    privateDir: string;
    maxUploadBytes: number;
    retentionHours: number;
  };
}

const DEFAULT_AUTH_TOKEN_SECRET = "dev-only-change-me-in-production-32-chars-min";
const DEFAULT_DEMO_TOKENS = {
  requester: "rp_req_demo_token_2026",
  verifier: "rp_ver_demo_token_2026",
  operator: "rp_op_demo_token_2026",
  externalAgent: "rp_agent_demo_token_2026",
};

const ALLOWED_SANDBOX_PAYPAL_HOSTS = new Set([
  "https://api-m.sandbox.paypal.com",
  "https://api.sandbox.paypal.com",
]);

export function loadConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  const env = { ...process.env, ...overrides };

  const rawPayPalMode = (env.PAYPAL_MODE ?? "sandbox").toLowerCase().trim();
  if (rawPayPalMode !== "sandbox") {
    throw new Error(
      `SECURITY GUARDRAIL VIOLATION: PAYPAL_MODE must be strictly 'sandbox'. Received '${rawPayPalMode}'. Live financial operations are forbidden.`
    );
  }

  const rawPayPalBaseUrl = (
    env.PAYPAL_API_BASE_URL ?? "https://api-m.sandbox.paypal.com"
  )
    .trim()
    .replace(/\/+$/, "");

  if (!ALLOWED_SANDBOX_PAYPAL_HOSTS.has(rawPayPalBaseUrl)) {
    throw new Error(
      `SECURITY GUARDRAIL VIOLATION: PAYPAL_API_BASE_URL must point strictly to an official PayPal Sandbox host (${Array.from(ALLOWED_SANDBOX_PAYPAL_HOSTS).join(", ")}). Received '${rawPayPalBaseUrl}'.`
    );
  }

  const defaultStorageDir =
    env.PRIVATE_STORAGE_DIR ??
    path.resolve(__dirname, "../../../storage/private-evidence");

  const nodeEnv = env.NODE_ENV ?? "development";
  const publicDemoMode = env.PUBLIC_DEMO_MODE === "true";
  const authTokenSecret = env.AUTH_TOKEN_SECRET ?? DEFAULT_AUTH_TOKEN_SECRET;
  const tokens = {
    requester: env.DEMO_REQUESTER_TOKEN ?? DEFAULT_DEMO_TOKENS.requester,
    verifier: env.DEMO_VERIFIER_TOKEN ?? DEFAULT_DEMO_TOKENS.verifier,
    operator: env.DEMO_OPERATOR_TOKEN ?? DEFAULT_DEMO_TOKENS.operator,
    externalAgent: env.DEMO_EXTERNAL_AGENT_TOKEN ?? DEFAULT_DEMO_TOKENS.externalAgent,
  };

  // Fail closed: published defaults must never protect a production deployment.
  // PUBLIC_DEMO_MODE may keep public role tokens because every write is denied server-side.
  if (nodeEnv === "production") {
    if (authTokenSecret === DEFAULT_AUTH_TOKEN_SECRET || authTokenSecret.length < 32) {
      throw new Error(
        "SECURITY GUARDRAIL VIOLATION: AUTH_TOKEN_SECRET must be a private value of at least 32 characters in production."
      );
    }
    const usesPublicToken = (
      Object.keys(DEFAULT_DEMO_TOKENS) as Array<keyof typeof DEFAULT_DEMO_TOKENS>
    ).some((role) => tokens[role] === DEFAULT_DEMO_TOKENS[role]);
    if (usesPublicToken && !publicDemoMode) {
      throw new Error(
        "SECURITY GUARDRAIL VIOLATION: Published demo role tokens are only allowed in production with PUBLIC_DEMO_MODE=true."
      );
    }
  }

  return {
    nodeEnv,
    port: Number(env.PORT ?? 4000),
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:5173",
    publicApiBaseUrl: env.PUBLIC_API_BASE_URL ?? "http://localhost:4000",
    databaseUrl: env.DATABASE_URL,
    stateFilePath:
      env.STATE_FILE_PATH ??
      path.join(defaultStorageDir, "realityproof-state.json"),
    exposeDemoTokensInCapabilities:
      env.EXPOSE_DEMO_TOKENS === "true" || publicDemoMode,
    publicDemoMode,
    trustProxy: env.TRUST_PROXY === "true",
    studioAgentDailyTurnLimit: Number(env.STUDIO_AGENT_DAILY_TURN_LIMIT ?? 500),
    analysisDailyLimit: Number(env.GEMINI_ANALYSIS_DAILY_LIMIT ?? 100),
    webDistDir: env.WEB_DIST_DIR || undefined,
    maskThirdPartyBrands:
      env.MASK_THIRD_PARTY_BRANDS !== undefined
        ? env.MASK_THIRD_PARTY_BRANDS === "true"
        : nodeEnv !== "test",
    authTokenSecret,
    tokens,
    paypal: {
      mode: "sandbox",
      apiBaseUrl: rawPayPalBaseUrl,
      clientId: (env.PAYPAL_CLIENT_ID ?? "").trim(),
      clientSecret: (env.PAYPAL_CLIENT_SECRET ?? "").trim(),
      webhookId: (env.PAYPAL_WEBHOOK_ID ?? "").trim(),
      sandboxVerifierEmail:
        env.PAYPAL_SANDBOX_VERIFIER_EMAIL ?? "sb-verifier@personal.example.com",
    },
    gemini: {
      apiKey: (env.GEMINI_API_KEY ?? "").trim(),
      model:
        env.GEMINI_MODEL && env.GEMINI_MODEL !== "gemini-4-argon"
          ? env.GEMINI_MODEL
          : "gemini-3.5-flash-lite",
      fallbackModel:
        env.GEMINI_FALLBACK_MODEL &&
        env.GEMINI_FALLBACK_MODEL !== "gemini-2.5-flash"
          ? env.GEMINI_FALLBACK_MODEL
          : "gemini-3.8-flash",
    },
    storage: {
      privateDir: defaultStorageDir,
      maxUploadBytes: Number(env.MAX_UPLOAD_BYTES ?? 5242880),
      retentionHours: Number(env.EVIDENCE_RETENTION_HOURS ?? 72),
    },
  };
}

