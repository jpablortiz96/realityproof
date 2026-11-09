import crypto from "node:crypto";
import { FunctionCallingConfigMode, GoogleGenAI, type Content, type Part } from "@google/genai";
import type { AppConfig } from "../../config.js";

export interface StudioLlmInputItem {
  type: string;
  role?: string;
  content?: unknown;
  callId?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

export interface StudioLlmTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export type StudioLlmToolChoice = "auto" | "none" | "required" | { name: string };

export interface StudioLlmTurn {
  text: string;
  toolCalls: Array<{ callId: string; name: string; arguments: string }>;
  modelId: string;
}

// Gemini 3 rejects replayed function calls without their thought signature. The AG Studio
// conversation does not carry it, so it stays here, keyed by call id, for the follow-up turn.
const MAX_REMEMBERED_SIGNATURES = 2_000;
// Google's documented placeholder for function calls that have no recorded signature.
const SKIP_SIGNATURE_VALIDATION = "skip_thought_signature_validator";
const ATTEMPT_TIMEOUT_MS = 20_000;
const TURN_DEADLINE_MS = 45_000;
const MIN_CALL_SPACING_MS = 1_000;
const BACKOFF_BASE_MS = 600;
const MAX_RATE_LIMIT_WAIT_MS = 15_000;

// A per-minute 429 names its retry delay; a spent daily quota asks for longer than this and is not waited on.
function rateLimitWaitMs(message: string): number | null {
  if (!/RESOURCE_EXHAUSTED|"code":\s*429/.test(message)) return null;
  const match = /retry(?:Delay"?:\s*"|\s+in\s+)(\d+(?:\.\d+)?)s/i.exec(message);
  const waitMs = match?.[1] ? Math.ceil(Number(match[1]) * 1000) : null;
  return waitMs !== null && waitMs <= MAX_RATE_LIMIT_WAIT_MS ? waitMs : null;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: unknown) =>
      typeof part === "object" &&
      part !== null &&
      typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : ""
    )
    .filter(Boolean)
    .join("\n");
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export class GeminiStudioAgentLlm {
  private readonly signatures = new Map<string, string>();
  // Calls run one at a time and spaced out: an agent run is a burst, and per-minute quotas
  // and overload errors are what stop it.
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;

  constructor(private readonly config: AppConfig["gemini"]) {}

  private toContents(input: StudioLlmInputItem[]): Content[] {
    const contents: Content[] = [];
    const namesByCallId = new Map<string, string>();
    const push = (role: "user" | "model", part: Part) => {
      const last = contents[contents.length - 1];
      if (last?.role === role) {
        last.parts?.push(part);
      } else {
        contents.push({ role, parts: [part] });
      }
    };

    for (const item of input) {
      if (item.type === "message") {
        const text = textOf(item.content);
        if (text) push(item.role === "assistant" ? "model" : "user", { text });
      } else if (item.type === "function_call" && item.name) {
        if (item.callId) namesByCallId.set(item.callId, item.name);
        push("model", {
          functionCall: { name: item.name, args: parseArgs(item.arguments) },
          thoughtSignature:
            (item.callId && this.signatures.get(item.callId)) ||
            SKIP_SIGNATURE_VALIDATION,
        });
      } else if (item.type === "function_call_output") {
        push("user", {
          functionResponse: {
            name:
              (item.callId && namesByCallId.get(item.callId)) ||
              item.name ||
              "tool",
            response: { result: item.output ?? "" },
          },
        });
      }
    }
    // Gemini only answers a conversation that ends on the user's side; sub-agents can end on the model's.
    if (contents[contents.length - 1]?.role === "model") {
      contents.push({ role: "user", parts: [{ text: "Continue." }] });
    }
    return contents;
  }

  runTurn(params: Parameters<GeminiStudioAgentLlm["attemptTurn"]>[0]): Promise<StudioLlmTurn> {
    const run = this.queue.then(async () => {
      const wait = this.lastCallAt + MIN_CALL_SPACING_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        return await this.attemptTurn(params);
      } finally {
        this.lastCallAt = Date.now();
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async attemptTurn(params: {
    systemInstruction: string;
    input: StudioLlmInputItem[];
    tools: StudioLlmTool[];
    toolChoice?: StudioLlmToolChoice;
    jsonSchema?: Record<string, unknown>;
  }): Promise<StudioLlmTurn> {
    const ai = new GoogleGenAI({ apiKey: this.config.apiKey });
    const useTools = params.tools.length > 0 && params.toolChoice !== "none";
    const models = [
      this.config.model,
      this.config.fallbackModel,
      "gemini-3.5-flash",
    ].filter((m, i, all) => Boolean(m) && all.indexOf(m) === i);

    let lastError: Error | null = null;
    const attempts = [...models, ...models.slice(0, 1)];
    const deadline = Date.now() + TURN_DEADLINE_MS;
    for (const [attempt, model] of attempts.entries()) {
      if (Date.now() >= deadline) break;
      try {
        const response = await ai.models.generateContent({
          model,
          contents: this.toContents(params.input),
          config: {
            systemInstruction: params.systemInstruction,
            temperature: 0.1,
            httpOptions: {
              timeout: Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()),
            },
            ...(useTools
              ? {
                  tools: [
                    {
                      functionDeclarations: params.tools.map((tool) => ({
                        name: tool.name,
                        description: tool.description ?? "",
                        parametersJsonSchema: tool.parameters ?? {
                          type: "object",
                          properties: {},
                        },
                      })),
                    },
                  ],
                  toolConfig: {
                    functionCallingConfig: {
                      // The harness forces a named tool to close a sub-agent run (complete_task).
                      ...(typeof params.toolChoice === "object"
                        ? {
                            mode: FunctionCallingConfigMode.ANY,
                            allowedFunctionNames: [params.toolChoice.name],
                          }
                        : {
                            mode:
                              params.toolChoice === "required"
                                ? FunctionCallingConfigMode.ANY
                                : FunctionCallingConfigMode.AUTO,
                          }),
                    },
                  },
                }
              : params.jsonSchema
                ? {
                    responseMimeType: "application/json",
                    responseJsonSchema: params.jsonSchema,
                  }
                : {}),
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const toolCalls: StudioLlmTurn["toolCalls"] = [];
        const textParts: string[] = [];
        for (const part of parts) {
          if (part.functionCall?.name) {
            const callId = `call_${crypto.randomBytes(6).toString("hex")}`;
            if (part.thoughtSignature) {
              this.signatures.set(callId, part.thoughtSignature);
              if (this.signatures.size > MAX_REMEMBERED_SIGNATURES) {
                const oldest = this.signatures.keys().next().value;
                if (oldest) this.signatures.delete(oldest);
              }
            }
            toolCalls.push({
              callId,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            });
          } else if (part.text && !part.thought) {
            textParts.push(part.text);
          }
        }

        if (toolCalls.length === 0 && textParts.length === 0) {
          throw new Error(`Empty response from ${model}`);
        }
        return { text: textParts.join("").trim(), toolCalls, modelId: model };
      } catch (err) {
        lastError = err as Error;
        // The quota is shared by the key, so the other models would fail the same way.
        const backoffMs = BACKOFF_BASE_MS * 2 ** attempt + Math.random() * 300;
        const waitMs = rateLimitWaitMs(lastError.message) ?? backoffMs;
        if (
          attempt < attempts.length - 1 &&
          Date.now() + waitMs < deadline
        ) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }
    throw new Error(
      `All Studio agent models failed (${models.join(", ")}): ${(lastError?.message ?? "unknown").slice(0, 200)}`
    );
  }
}
