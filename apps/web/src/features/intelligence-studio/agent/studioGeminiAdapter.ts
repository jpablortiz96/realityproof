import {
  createAiHarness,
  directLlmRunner,
  type AgAiEvent,
  type AgAiHarness,
  type AgAiHarnessSetup,
  type AgAiOutputItem,
  type AgLlmAdapter,
  type AgLlmExecuteTurnOptions,
  type AgLlmRequest,
  type AgLlmResponse,
  type AgLlmResponseHandler,
  type AgStudioApi,
} from "ag-studio";
import type {
  StudioAgentTurnResponse,
  StudioQuickFilterPreset,
} from "../types";

export type EvidenceChartPreset =
  | "COST_VS_EXPECTED_LOSS"
  | "NET_BENEFIT_BY_CASE"
  | "COST_BY_FUNDING_PROVENANCE";

const CHART_PRESETS: Record<
  EvidenceChartPreset,
  {
    type: string;
    titleEs: string;
    titleEn: string;
    category: string;
    values: string[];
  }
> = {
  COST_VS_EXPECTED_LOSS: {
    type: "column-chart-grouped",
    titleEs: "Agente · Coste de verificación vs. pérdida esperada (USD)",
    titleEn: "Agent · Verification cost vs. expected loss (USD)",
    category: "verifications.task_id",
    values: [
      "verifications.verification_cost_usd",
      "verifications.expected_loss_without_verification_usd",
    ],
  },
  NET_BENEFIT_BY_CASE: {
    type: "column-chart-grouped",
    titleEs: "Agente · Beneficio neto esperado por caso (USD)",
    titleEn: "Agent · Expected net benefit by case (USD)",
    category: "verifications.task_id",
    values: ["verifications.expected_net_benefit_usd"],
  },
  COST_BY_FUNDING_PROVENANCE: {
    type: "column-chart-grouped",
    titleEs: "Agente · Coste de verificación por procedencia (USD)",
    titleEn: "Agent · Verification cost by funding provenance (USD)",
    category: "verifications.funding_provenance",
    values: ["verifications.verification_cost_usd"],
  },
};

// Lead turns for one request, then each specialist's own run.
const CHART_ROW_SPAN = 18;
const LEAD_MAX_TURNS = 8;
const SPECIALIST_MAX_TURNS = 7;

export interface CanonicalDemoQuery {
  id: "A" | "B" | "C" | "D" | "E";
  code: string;
  labelEs: string;
  labelEn: string;
  promptEs: string;
  promptEn: string;
}

export const CANONICAL_DEMO_QUERIES: readonly CanonicalDemoQuery[] = [
  {
    id: "A",
    code: "QUERY_A_NEEDS_EVIDENCE",
    labelEs: "Consulta A · Necesitan evidencia",
    labelEn: "Query A · Still need evidence",
    promptEs: "Muéstrame las verificaciones que todavía necesitan evidencia.",
    promptEn: "Show me the verifications that still need evidence.",
  },
  {
    id: "B",
    code: "QUERY_B_HIGHEST_LOSS",
    labelEs: "Consulta B · Mayor pérdida potencial",
    labelEn: "Query B · Highest potential loss",
    promptEs: "¿Cuáles tienen mayor pérdida potencial estimada?",
    promptEn: "Which verifications have the highest estimated potential loss?",
  },
  {
    id: "C",
    code: "QUERY_C_PROVENANCE_SEPARATION",
    labelEs: "Consulta C · PayPal Sandbox real vs. Demo sintético",
    labelEn: "Query C · Real PayPal Sandbox vs. Synthetic demo",
    promptEs:
      "Distingue las verificaciones financiadas mediante una captura real de PayPal Sandbox de las demostraciones sintéticas.",
    promptEn:
      "Separate verifications funded by a real PayPal Sandbox capture from the synthetic demos.",
  },
  {
    id: "D",
    code: "QUERY_D_VOI_DASHBOARD",
    labelEs: "Consulta D · Dashboard Coste vs. Pérdida esperada",
    labelEn: "Query D · Cost vs. Expected loss dashboard",
    promptEs:
      "Construye un dashboard para comparar coste de verificación y pérdida esperada.",
    promptEn: "Build a dashboard to compare verification cost and expected loss.",
  },
  {
    id: "E",
    code: "QUERY_E_OPEN_PENDING_HUMAN",
    labelEs: "Consulta E · Abrir caso pendiente de revisión humana",
    labelEn: "Query E · Open case pending human review",
    promptEs: "Abre el caso cuya revisión humana está pendiente.",
    promptEn: "Open the case whose human review is pending.",
  },
] as const;

export interface RealityProofAgentCallbacks {
  getApiBaseUrl: () => string;
  getAuthToken: () => string;
  onApplyPresetFilter: (
    preset: StudioQuickFilterPreset,
    focusedTaskId?: string | null
  ) => void;
  onFocusCase: (taskId: string, navigateToDesk: boolean) => void;
  onOpenPassport: (proofId: string, taskId: string) => void;
  onAgentTurnComplete?: (turn: StudioAgentTurnResponse) => void;
  onHarnessReady?: (harness: AgAiHarness) => void;
  onChartAdded?: (widgetId: string) => void;
}

/**
 * Backend-proxied AgLlmAdapter for AG Studio 3.1.0.
 * Never exposes GEMINI_API_KEY in the browser; routes all turns through
 * POST /api/v1/ai/studio-agent-turn with server-enforced tool allowlisting.
 */
export function createRealityProofGeminiAdapter(
  callbacks: RealityProofAgentCallbacks
): AgLlmAdapter {
  return {
    executeTurn(
      request: AgLlmRequest,
      options?: AgLlmExecuteTurnOptions
    ): AgLlmResponseHandler {
      const responsePromise = (async (): Promise<{
        agResponse: AgLlmResponse;
        rawTurn: StudioAgentTurnResponse;
      }> => {
        const res = await fetch(
          `${callbacks.getApiBaseUrl()}/api/v1/ai/studio-agent-turn`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${callbacks.getAuthToken()}`,
            },
            body: JSON.stringify({
              input: request.input,
              instructions: request.instructions,
              tools: request.tools,
              responseFormat: request.responseFormat,
              toolChoice: request.toolChoice,
              model: request.model,
            }),
            signal: options?.signal,
          }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            (errBody as { message?: string }).message ??
              `Studio Agent turn failed with HTTP ${res.status}`
          );
        }

        const rawTurn = (await res.json()) as StudioAgentTurnResponse;
        callbacks.onAgentTurnComplete?.(rawTurn);

        const mappedOutput: AgAiOutputItem[] = rawTurn.output.map(
          (item, index) => {
            if (item.type === "function_call") {
              return {
                id: `tc_${rawTurn.id}_${index}`,
                kind: "output",
                type: "function_call",
                callId: item.callId,
                name: item.name,
                arguments: item.arguments,
                status: "completed",
              };
            }
            return {
              id: `msg_${rawTurn.id}_${index}`,
              kind: "output",
              type: "message",
              role: "assistant",
              status: "completed",
              content: item.content,
            };
          }
        );

        const agResponse: AgLlmResponse = {
          id: rawTurn.id,
          createdAt: rawTurn.createdAt,
          status: "completed",
          output: mappedOutput,
        };
        return { agResponse, rawTurn };
      })();

      async function* createEventStream(): AsyncIterable<AgAiEvent> {
        const { agResponse } = await responsePromise;
        const ts = Date.now();
        for (const item of agResponse.output) {
          if (item.type === "function_call") {
            yield {
              type: "TOOL_CALL_START",
              toolCallId: item.callId,
              toolCallName: item.name,
              timestamp: ts,
            };
            yield {
              type: "TOOL_CALL_ARGS",
              toolCallId: item.callId,
              delta: item.arguments,
              timestamp: ts,
            };
            yield {
              type: "TOOL_CALL_END",
              toolCallId: item.callId,
              timestamp: ts,
            };
          } else if (item.type === "message") {
            const msgId = `msg_${agResponse.id}`;
            yield {
              type: "TEXT_MESSAGE_START",
              messageId: msgId,
              role: "assistant",
              timestamp: ts,
            };
            for (const part of item.content) {
              if (part.type === "text" && part.text) {
                yield {
                  type: "TEXT_MESSAGE_CONTENT",
                  messageId: msgId,
                  delta: part.text,
                  timestamp: ts,
                };
              }
            }
            yield {
              type: "TEXT_MESSAGE_END",
              messageId: msgId,
              timestamp: ts,
            };
          }
        }
      }

      return {
        stream: createEventStream(),
        complete: responsePromise.then((r) => r.agResponse),
      };
    },
  };
}

export function createRealityProofAiHarness(
  callbacks: RealityProofAgentCallbacks,
  isEs = true
): AgAiHarnessSetup {
  const adapter = createRealityProofGeminiAdapter(callbacks);

  return ({ api }) => {
    const studioApi = api as unknown as AgStudioApi<any>;

    // A real AG Studio widget over the same data source, placed in one call. Repeating a
    // preset updates its chart, so a retried run cannot stack duplicates.
    const addEvidenceChartTool = studioApi.defineAiTool({
      name: "add_evidence_chart",
      description:
        "Adds a ready-made chart to the dashboard from the verification data in one step. Prefer it over delegating whenever one of its presets answers the request.",
      params: (s) =>
        s.object({
          preset: s.enum([
            "COST_VS_EXPECTED_LOSS",
            "NET_BENEFIT_BY_CASE",
            "COST_BY_FUNDING_PROVENANCE",
          ] as const),
        }),
      execute: (args, ctx) => {
        const preset = CHART_PRESETS[args.preset as EvidenceChartPreset];
        const widgetId = `agent_chart_${args.preset.toLowerCase()}`;
        const state = studioApi.getState() as any;
        const pages = (state.pages ?? []).map((page: any) => {
          if (page.id !== state.selectedPageId) return page;
          // New chart goes on top, where the user is looking; the others move down once.
          const previousLayout = page.widgetLayout ?? {};
          const layout = previousLayout[widgetId]
            ? previousLayout
            : Object.fromEntries(
                Object.entries(previousLayout).map(
                  ([id, box]: [string, any]) => [
                    id,
                    { ...box, yTrack: box.yTrack + CHART_ROW_SPAN },
                  ]
                )
              );
          return {
            ...page,
            widgets: {
              ...page.widgets,
              [widgetId]: {
                type: preset.type,
                format: {
                  title: {
                    text: isEs ? preset.titleEs : preset.titleEn,
                    enabled: true,
                  },
                },
                dataMapping: {
                  categoryKey: [{ id: preset.category }],
                  valueKey: preset.values.map((id) => ({
                    id,
                    aggregation: "sum",
                  })),
                },
              },
            },
            widgetLayout: {
              ...layout,
              [widgetId]: previousLayout[widgetId] ?? {
                xTrack: 1,
                yTrack: 1,
                xSpan: 24,
                ySpan: CHART_ROW_SPAN,
              },
            },
          };
        });
        studioApi.setState({ ...state, pages });
        callbacks.onChartAdded?.(widgetId);
        return ctx.success(`Added chart ${widgetId} from authorized rows.`, {
          widget_id: widgetId,
          preset: args.preset,
          read_only: true,
        });
      },
    });

    const filterStudioTool = studioApi.defineAiTool({
      name: "filter_intelligence_studio",
      description:
        "Filters the RealityProof Intelligence Studio canvas by operational or provenance preset without mutating backend records.",
      params: (s) =>
        s.object({
          preset: s.enum([
            "ALL",
            "NEEDS_EVIDENCE",
            "PENDING_HUMAN_REVIEW",
            "REAL_SANDBOX_ONLY",
            "DEMO_SYNTHETIC_ONLY",
            "HIGHEST_POTENTIAL_LOSS",
            "VOI_COMPARISON",
          ] as const),
          taskId: s.string({
            description: "Optional task_id to highlight.",
          }),
          reason: s.string({
            description: "Analytical rationale for applying this filter.",
          }),
        }),
      execute: (args, ctx) => {
        callbacks.onApplyPresetFilter(args.preset, args.taskId || null);
        return ctx.success(
          `Applied preset filter ${args.preset} (read-only).`,
          {
            applied_preset: args.preset,
            focused_task_id: args.taskId || null,
            read_only: true,
          }
        );
      },
    });

    const compareVoiTool = studioApi.defineAiTool({
      name: "compare_voi_economics",
      description:
        "Configures the Intelligence Studio view to compare verification cost (C), subjective risk assumption (p), potential loss (L), expected loss (p*L), and net expected benefit.",
      params: (s) =>
        s.object({
          sortBy: s.string({
            description:
              "Field to sort by (e.g., estimated_loss_if_wrong_usd or expected_net_benefit_usd).",
          }),
          topTaskId: s.string({
            description: "Optional highest-loss task_id to highlight.",
          }),
        }),
      execute: (args, ctx) => {
        const preset: StudioQuickFilterPreset =
          args.sortBy === "estimated_loss_if_wrong_usd"
            ? "HIGHEST_POTENTIAL_LOSS"
            : "VOI_COMPARISON";
        callbacks.onApplyPresetFilter(preset, args.topTaskId || null);
        return ctx.success(`Configured VoI comparison sorted by ${args.sortBy}.`, {
          sorted_by: args.sortBy,
          highlighted_task_id: args.topTaskId || null,
          read_only: true,
        });
      },
    });

    const explainProvenanceTool = studioApi.defineAiTool({
      name: "explain_financial_provenance",
      description:
        "Highlights strict financial provenance separation between REAL_SANDBOX_CAPTURE, DEMO_SYNTHETIC, HISTORICAL_SANDBOX_REPLAY, and UNFUNDED.",
      params: (s) =>
        s.object({
          highlightProvenance: s.string({
            description: "Provenance category to highlight.",
          }),
        }),
      execute: (args, ctx) => {
        const preset: StudioQuickFilterPreset =
          args.highlightProvenance === "REAL_SANDBOX_CAPTURE"
            ? "REAL_SANDBOX_ONLY"
            : args.highlightProvenance === "DEMO_SYNTHETIC"
              ? "DEMO_SYNTHETIC_ONLY"
              : "ALL";
        callbacks.onApplyPresetFilter(preset, null);
        return ctx.success(
          `Highlighted provenance separation (${args.highlightProvenance}).`,
          {
            highlighted_provenance: args.highlightProvenance,
            invariant: "REAL_AND_SYNTHETIC_NEVER_MIXED",
            read_only: true,
          }
        );
      },
    });

    const openVerificationCaseTool = studioApi.defineAiTool({
      name: "open_verification_case",
      description:
        "Focuses or opens a specific verification task in the Decision Trace Explorer or Operator Decision Desk (read-only navigation).",
      params: (s) =>
        s.object({
          taskId: s.string({
            description: "The task_id to focus or open.",
          }),
          navigateToDesk: s.boolean({
            description:
              "If true, navigates directly to Operator Decision Desk; if false, focuses the case inside Intelligence Studio.",
          }),
        }),
      execute: (args, ctx) => {
        callbacks.onFocusCase(args.taskId, Boolean(args.navigateToDesk));
        return ctx.success(`Focused verification case ${args.taskId}.`, {
          opened_task_id: args.taskId,
          navigated_to_decision_desk: Boolean(args.navigateToDesk),
          read_only: true,
        });
      },
    });

    const openProofPassportTool = studioApi.defineAiTool({
      name: "open_proof_passport",
      description:
        "Opens the issued Proof Passport for a verification task (read-only navigation).",
      params: (s) =>
        s.object({
          proofId: s.string({
            description: "The proof_id of the issued Proof Passport.",
          }),
          taskId: s.string({
            description: "The associated task_id.",
          }),
        }),
      execute: (args, ctx) => {
        callbacks.onOpenPassport(args.proofId, args.taskId);
        return ctx.success(`Opened Proof Passport ${args.proofId}.`, {
          opened_proof_id: args.proofId,
          task_id: args.taskId,
          read_only: true,
        });
      },
    });

    const harness = createAiHarness(studioApi, ({ builtIn }) => ({
      primary: "lead",
      promptStarters: CANONICAL_DEMO_QUERIES.map((dq) => ({
        label: isEs ? dq.labelEs : dq.labelEn,
        prompt: isEs ? dq.promptEs : dq.promptEn,
      })),
      // AG's five agents share the backend adapter, so delegation can place and configure
      // widgets. The server enforces the policy; these lines only steer the model.
      agents: Object.values(builtIn).map((definition) =>
        directLlmRunner({
          ...definition,
          adapter,
          maxTurns:
            definition.id === "lead" ? LEAD_MAX_TURNS : SPECIALIST_MAX_TURNS,
          ...(definition.id === "lead"
            ? {
                name: "RealityProof Evidence Intelligence Agent",
                instructions: (ctx: any, agentParams: any) =>
                  [
                    definition.instructions?.(ctx, agentParams) ?? "",
                    "For RealityProof questions prefer filter_intelligence_studio, compare_voi_economics, explain_financial_provenance, open_verification_case and open_proof_passport, and answer directly from the dataset you already have instead of re-reading it. For a chart, use add_evidence_chart whenever a preset fits, then stop. Only for a chart no preset covers: delegate to the page agent (pageId evidence_intelligence_page) to place one widget, then to the widget agent to configure it. The delegate_to type argument is always an object, such as {id: 'page', pageId} or {id: 'widget', pageId, widgetType, widgetId}, never a string. Never remove or move existing widgets unless the user asks.",
                  ].join("\n\n"),
                tools: (ctx: any, agentParams: any) => [
                  // A generated thread title costs a model call per conversation.
                  ...(definition.tools?.(ctx, agentParams) ?? []).filter(
                    (tool: { name: string }) => tool.name !== "rename_thread"
                  ),
                  addEvidenceChartTool,
                  filterStudioTool,
                  compareVoiTool,
                  explainProvenanceTool,
                  openVerificationCaseTool,
                  openProofPassportTool,
                ],
              }
            : {}),
        })
      ),
    }));
    callbacks.onHarnessReady?.(harness);
    return harness;
  };
}
