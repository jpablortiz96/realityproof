import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AgStudioAiModule,
  type AgAiHarness,
  type AgAiChatSession,
  type AgDataSourcesDefinition,
  type AgPanelConfig,
  type AgReportState,
  type SimpleData,
} from "ag-studio";
import {
  AgStudio,
  AgStudioProvider,
  type AgStudioRef,
} from "ag-studio-react";
import {
  CANONICAL_DEMO_QUERIES,
  createRealityProofAiHarness,
} from "./agent/studioGeminiAdapter";
import { realityProofStudioTheme } from "./theme";
import type {
  IntelligenceStudioSummary,
  StudioAgentTurnResponse,
  StudioQuickFilterPreset,
  VerificationIntelligenceRow,
} from "./types";
import {
  realityProofStudioWidgets,
  updateStudioBridgeSnapshot,
} from "./widgets/customWidgets";

export interface IntelligenceStudioWorkspaceProps {
  apiBaseUrl: string;
  authToken: string;
  actorRole: "OPERATOR" | "REQUESTER" | "JUDGE";
  locale: "en" | "es";
  refreshTrigger?: number;
  onOpenVerificationCase: (taskId: string) => void;
  onOpenProofPassport: (proofId: string, taskId: string) => void;
}

const STUDIO_PANELS = {
  edit: {
    left: ["ai"],
    right: ["filters", "edit", "data"],
  },
} satisfies AgPanelConfig;

// The default minimum makes the canvas wider than this shell, which hides widgets under the side rails.
const STUDIO_LAYOUT = { minWidth: 480 };
const COMPACT_VIEWPORT_MAX_PX = 1024;
const NATIVE_AGENT_RUN_TIMEOUT_MS = 90_000;
const COMPACT_AGENT_MAX_STEPS = 3;
const COMPACT_AGENT_TOOLS = [
  {
    name: "filter_intelligence_studio",
    description: "Filter the Intelligence Studio by preset without changing stored records.",
    parameters: {
      type: "object",
      properties: {
        preset: {
          type: "string",
          enum: [
            "ALL",
            "NEEDS_EVIDENCE",
            "PENDING_HUMAN_REVIEW",
            "REAL_SANDBOX_ONLY",
            "DEMO_SYNTHETIC_ONLY",
            "HIGHEST_POTENTIAL_LOSS",
            "VOI_COMPARISON",
          ],
        },
        taskId: { type: "string" },
      },
      required: ["preset"],
    },
  },
  {
    name: "compare_voi_economics",
    description: "Sort cases by value-of-information economics and highlight one.",
    parameters: {
      type: "object",
      properties: {
        sortBy: {
          type: "string",
          enum: ["estimated_loss_if_wrong_usd", "expected_net_benefit_usd"],
        },
        topTaskId: { type: "string" },
      },
      required: ["sortBy"],
    },
  },
  {
    name: "explain_financial_provenance",
    description: "Show real Sandbox and synthetic funding side by side.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_verification_case",
    description: "Focus one verification case in the Studio.",
    parameters: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
];

function createInitialStudioReportState(): AgReportState<any> {
  return {
    selectedPageId: "evidence_intelligence_page",
    panels: {
      edit: { collapsed: true },
      data: { collapsed: true },
      filters: { collapsed: true },
      // Below this width the open chat panel would push widgets under the side rails.
      ai: { collapsed: window.innerWidth < 1400, width: 320 },
    },
    pages: [
      {
        id: "evidence_intelligence_page",
        widgets: {
          voi_vs_cost_chart: {
            type: "column-chart-grouped",
            format: {
              title: {
                text: "Verification Cost vs. Expected Loss (p × L) by Contract (USD)",
                enabled: true,
              },
            },
            dataMapping: {
              categoryKey: [{ id: "verifications.task_id" }],
              valueKey: [
                {
                  id: "verifications.verification_cost_usd",
                  aggregation: "sum",
                },
                {
                  id: "verifications.expected_loss_without_verification_usd",
                  aggregation: "sum",
                },
                {
                  id: "verifications.expected_net_benefit_usd",
                  aggregation: "sum",
                },
              ],
            },
          },
          verifications_master_grid: {
            type: "grid",
            format: {
              title: {
                text: "Evidence Intelligence Ledger (Provenance-Separated)",
                enabled: true,
              },
            },
            dataMapping: {
              cols: [
                { id: "verifications.task_id" },
                { id: "verifications.funding_provenance" },
                { id: "verifications.paypal_financial_state" },
                { id: "verifications.status" },
                { id: "verifications.received_views_csv" },
                { id: "verifications.missing_views_csv" },
                { id: "verifications.gemini_status" },
                { id: "verifications.human_review_status" },
                {
                  id: "verifications.verification_cost_usd",
                  aggregation: "sum",
                },
                {
                  id: "verifications.estimated_loss_if_wrong_usd",
                  aggregation: "sum",
                },
                {
                  id: "verifications.expected_net_benefit_usd",
                  aggregation: "sum",
                },
                { id: "verifications.proof_passport_classification" },
              ],
            },
          },
          voi_explorer_widget: {
            type: "voi-explorer",
            format: {
              title: {
                text: "1 · Value of Information (VoI) Explorer",
                enabled: true,
              },
            },
            dataMapping: {
              fields: [
                { id: "verifications.task_id" },
                {
                  id: "verifications.verification_cost_usd",
                  aggregation: "sum",
                },
                {
                  id: "verifications.estimated_loss_if_wrong_usd",
                  aggregation: "sum",
                },
              ],
            },
          },
          evidence_coverage_widget: {
            type: "evidence-coverage-explorer",
            format: {
              title: {
                text: "2 · Evidence Coverage & View Completeness Explorer",
                enabled: true,
              },
            },
            dataMapping: {
              fields: [
                { id: "verifications.task_id" },
                {
                  id: "verifications.required_views_count",
                  aggregation: "sum",
                },
                {
                  id: "verifications.received_views_count",
                  aggregation: "sum",
                },
              ],
            },
          },
          financial_provenance_widget: {
            type: "financial-provenance-chain",
            format: {
              title: {
                text: "3 · Financial Provenance Chain (PayPal Sandbox vs. Demo)",
                enabled: true,
              },
            },
            dataMapping: {
              fields: [
                { id: "verifications.task_id" },
                {
                  id: "verifications.real_captured_usd",
                  aggregation: "sum",
                },
                {
                  id: "verifications.demo_synthetic_non_payable_usd",
                  aggregation: "sum",
                },
              ],
            },
          },
          decision_trace_widget: {
            type: "decision-trace-explorer",
            format: {
              title: {
                text: "4 · Decision Trace & Proof Passport Navigator",
                enabled: true,
              },
            },
            dataMapping: {
              fields: [{ id: "verifications.task_id" }],
            },
          },
        },
        widgetLayout: {
          voi_vs_cost_chart: {
            xTrack: 1,
            yTrack: 1,
            xSpan: 11,
            ySpan: 16,
          },
          verifications_master_grid: {
            xTrack: 12,
            yTrack: 1,
            xSpan: 13,
            ySpan: 16,
          },
          voi_explorer_widget: {
            xTrack: 1,
            yTrack: 17,
            xSpan: 12,
            ySpan: 24,
          },
          evidence_coverage_widget: {
            xTrack: 13,
            yTrack: 17,
            xSpan: 12,
            ySpan: 24,
          },
          financial_provenance_widget: {
            xTrack: 1,
            yTrack: 41,
            xSpan: 12,
            ySpan: 24,
          },
          decision_trace_widget: {
            xTrack: 13,
            yTrack: 41,
            xSpan: 12,
            ySpan: 24,
          },
        },
      },
    ],
  } as unknown as AgReportState<any>;
}

export const IntelligenceStudioWorkspace: React.FC<
  IntelligenceStudioWorkspaceProps
> = ({
  apiBaseUrl,
  authToken,
  actorRole,
  locale,
  refreshTrigger = 0,
  onOpenVerificationCase,
  onOpenProofPassport,
}) => {
  const isEs = locale === "es";
  const studioRef = useRef<AgStudioRef>(null);

  const [rows, setRows] = useState<VerificationIntelligenceRow[]>([]);
  const [summary, setSummary] = useState<IntelligenceStudioSummary | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] =
    useState<StudioQuickFilterPreset>("ALL");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Studio Agent Interactive Query Console State
  const [agentQueryInput, setAgentQueryInput] = useState<string>("");
  const [agentBusy, setAgentBusy] = useState<boolean>(false);
  const [lastAgentTurn, setLastAgentTurn] =
    useState<StudioAgentTurnResponse | null>(null);
  const [agentTranscript, setAgentTranscript] = useState<
    Array<{
      id: string;
      userPrompt: string;
      assistantResponse: string;
      toolCalls: string[];
      matchedQuery: string;
      guardrailTriggered: boolean;
      guardrailCode: string | null;
      degradedMode: boolean;
    }>
  >([]);

  // Responsive viewport tracker (switches cleanly below 1024px to vertical cards to prevent 24-col canvas clipping at 200% zoom & mobile)
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < COMPACT_VIEWPORT_MAX_PX : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setIsCompactViewport(window.innerWidth < COMPACT_VIEWPORT_MAX_PX);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/analytics/intelligence-rows`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            `HTTP ${res.status} loading analytics`
        );
      }
      const data = (await res.json()) as {
        rows: VerificationIntelligenceRow[];
        summary: IntelligenceStudioSummary;
      };
      setRows(data.rows);
      setSummary(data.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, authToken]);

  useEffect(() => {
    void fetchAnalyticsData();
  }, [fetchAnalyticsData, refreshTrigger]);

  // Keep reactive bridge synchronized for all 4 custom widgets inside AG Studio
  useEffect(() => {
    updateStudioBridgeSnapshot({
      rows,
      activePreset,
      focusedTaskId,
      locale,
      onOpenVerificationCase,
      onOpenProofPassport,
      onSelectFocusTask: (taskId: string) => setFocusedTaskId(taskId),
    });
  }, [
    rows,
    activePreset,
    focusedTaskId,
    locale,
    onOpenVerificationCase,
    onOpenProofPassport,
  ]);

  const applyPresetFilter = useCallback(
    (preset: StudioQuickFilterPreset, highlightTaskId?: string | null) => {
      setActivePreset(preset);
      if (highlightTaskId !== undefined) {
        setFocusedTaskId(highlightTaskId);
      }
    },
    []
  );

  const handleFocusCase = useCallback(
    (taskId: string, navigateToDesk: boolean) => {
      setFocusedTaskId(taskId);
      if (navigateToDesk) {
        onOpenVerificationCase(taskId);
      }
    },
    [onOpenVerificationCase]
  );

  const harnessRef = useRef<AgAiHarness | null>(null);
  const nativeTurnsRef = useRef<StudioAgentTurnResponse[]>([]);
  // One conversation per visit, so demo queries appear in the chat panel the user is reading.
  const nativeSessionRef = useRef<AgAiChatSession | null>(null);

  const aiHarness = useMemo(
    () =>
      createRealityProofAiHarness(
        {
          getApiBaseUrl: () => apiBaseUrl,
          getAuthToken: () => authToken,
          onApplyPresetFilter: applyPresetFilter,
          onFocusCase: handleFocusCase,
          onOpenPassport: onOpenProofPassport,
          onAgentTurnComplete: (turn) => {
            setLastAgentTurn(turn);
            nativeTurnsRef.current.push(turn);
          },
          onHarnessReady: (harness) => {
            harnessRef.current = harness;
            nativeSessionRef.current = null;
          },
        },
        isEs
      ),
    [
      apiBaseUrl,
      authToken,
      applyPresetFilter,
      handleFocusCase,
      onOpenProofPassport,
      isEs,
    ]
  );

  const initialReportState = useMemo(() => createInitialStudioReportState(), []);

  // Filtered rows passed to AG Studio's data engine so built-in charts & grids
  // and custom widgets stay 100% synchronized when quick filters or Agent tools run
  const studioEngineRows = useMemo(() => {
    switch (activePreset) {
      case "NEEDS_EVIDENCE":
        return rows.filter((r) => r.needs_evidence_flag);
      case "PENDING_HUMAN_REVIEW":
        return rows.filter((r) => r.pending_human_review_flag);
      case "REAL_SANDBOX_ONLY":
        return rows.filter(
          (r) => r.funding_provenance === "REAL_SANDBOX_CAPTURE"
        );
      case "DEMO_SYNTHETIC_ONLY":
        return rows.filter((r) => r.funding_provenance === "DEMO_SYNTHETIC");
      case "HIGHEST_POTENTIAL_LOSS":
        return [...rows].sort(
          (a, b) =>
            b.estimated_loss_if_wrong_usd - a.estimated_loss_if_wrong_usd
        );
      case "VOI_COMPARISON":
        return [...rows].sort(
          (a, b) => b.expected_net_benefit_usd - a.expected_net_benefit_usd
        );
      default:
        return rows;
    }
  }, [rows, activePreset]);

  const executeStudioAgentQuery = useCallback(
    async (promptText: string, simulateGeminiFailure = false) => {
      const trimmed = promptText.trim();
      if (!trimmed || agentBusy) return;
      setAgentBusy(true);
      try {
        // Desktop: run through AG Studio's own harness so tools act on the live canvas
        // and the conversation appears in its chat panel.
        const harness = harnessRef.current;
        if (harness && !isCompactViewport && !simulateGeminiFailure) {
          nativeTurnsRef.current = [];
          const session =
            nativeSessionRef.current ??
            (await harness.createThread({ agentId: "lead" }));
          nativeSessionRef.current = session;
          const answer = await new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
              session.removeEventListener("changed", onChange);
              session.cancel();
              reject(new Error("Agent run timed out"));
            }, NATIVE_AGENT_RUN_TIMEOUT_MS);
            let started = false;
            const onChange = () => {
              if (session.status === "running") started = true;
              if (!started || session.status === "running") return;
              clearTimeout(timer);
              session.removeEventListener("changed", onChange);
              const lastAssistant = [...session.messages]
                .reverse()
                .find((m) => m.role === "assistant");
              const text = (lastAssistant?.parts ?? [])
                .flatMap((p) => (p.type === "text" ? [p.text] : []))
                .join("\n");
              if (session.status === "error") {
                reject(new Error(text || "Agent run failed"));
              } else {
                resolve(text);
              }
            };
            session.addEventListener("changed", onChange);
            session.sendMessage(trimmed);
          });
          const turns = nativeTurnsRef.current;
          const lastMeta = turns[turns.length - 1]?.meta;
          setAgentTranscript((prev) => [
            {
              id: session.threadId,
              userPrompt: trimmed,
              assistantResponse: answer,
              toolCalls: turns.flatMap((t) =>
                t.output.flatMap((o) =>
                  o.type === "function_call" ? [o.name] : []
                )
              ),
              matchedQuery: lastMeta?.matched_demo_query ?? "CUSTOM",
              guardrailTriggered: turns.some((t) => t.meta.guardrail_triggered),
              guardrailCode:
                turns.find((t) => t.meta.guardrail_code)?.meta.guardrail_code ??
                null,
              degradedMode: turns.some(
                (t) =>
                  t.meta.degraded_mode ||
                  (t.meta.engine === "DETERMINISTIC_GUARDED_PLANNER" &&
                    !t.meta.guardrail_triggered)
              ),
            },
            ...prev.slice(0, 5),
          ]);
          return;
        }

        // Compact viewports have no canvas: same endpoint, with tools applied by this panel.
        const conversation: Array<Record<string, unknown>> = [
          { kind: "input", type: "message", role: "user", content: trimmed },
        ];
        const calledTools: string[] = [];
        let assistantText = "";
        let turn: StudioAgentTurnResponse | null = null;

        for (let step = 0; step < COMPACT_AGENT_MAX_STEPS; step += 1) {
        const res = await fetch(`${apiBaseUrl}/api/v1/ai/studio-agent-turn`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            input: conversation,
            tools: COMPACT_AGENT_TOOLS,
            simulate_gemini_failure: simulateGeminiFailure,
          }),
        });
        if (!res.ok) {
          throw new Error(`Agent turn HTTP ${res.status}`);
        }
        turn = (await res.json()) as StudioAgentTurnResponse;
        setLastAgentTurn(turn);

        for (const item of turn.output) {
          if (item.type === "function_call") {
            calledTools.push(item.name);
            conversation.push({ ...item }, {
              kind: "input",
              type: "function_call_output",
              callId: item.callId,
              output: JSON.stringify({ applied: true, read_only: true }),
              status: "completed",
            });
            try {
              const args = JSON.parse(item.arguments || "{}") as Record<
                string,
                unknown
              >;
              if (item.name === "filter_intelligence_studio") {
                const preset =
                  (args.preset as StudioQuickFilterPreset) || "ALL";
                const taskId =
                  typeof args.taskId === "string" ? args.taskId : null;
                applyPresetFilter(preset, taskId);
              } else if (item.name === "compare_voi_economics") {
                const sortBy = String(args.sortBy || "");
                const topTaskId =
                  typeof args.topTaskId === "string" ? args.topTaskId : null;
                applyPresetFilter(
                  sortBy === "estimated_loss_if_wrong_usd"
                    ? "HIGHEST_POTENTIAL_LOSS"
                    : "VOI_COMPARISON",
                  topTaskId
                );
              } else if (item.name === "explain_financial_provenance") {
                applyPresetFilter("ALL", null);
              } else if (item.name === "open_verification_case") {
                const taskId = String(args.taskId || "");
                if (taskId) {
                  setFocusedTaskId(taskId);
                }
              }
            } catch {
              // ignore malformed tool argument JSON
            }
          } else if (item.type === "message") {
            const parts = item.content
              .map((c) => c.text)
              .filter(Boolean)
              .join("\n");
            if (parts) {
              assistantText = parts;
            }
          }
        }
        if (assistantText) break;
        }

        if (!turn) return;
        const finalTurn = turn;
        setAgentTranscript((prev) => [
          {
            id: finalTurn.id,
            userPrompt: trimmed,
            assistantResponse: assistantText,
            toolCalls: calledTools,
            matchedQuery: finalTurn.meta.matched_demo_query,
            guardrailTriggered: finalTurn.meta.guardrail_triggered,
            guardrailCode: finalTurn.meta.guardrail_code,
            degradedMode:
              finalTurn.meta.degraded_mode ||
              (finalTurn.meta.engine === "DETERMINISTIC_GUARDED_PLANNER" &&
                !finalTurn.meta.guardrail_triggered),
          },
          ...prev.slice(0, 5),
        ]);
      } catch (err) {
        setAgentTranscript((prev) => [
          {
            id: `err_${Date.now()}`,
            userPrompt: trimmed,
            assistantResponse: `Error: ${(err as Error).message}`,
            toolCalls: [],
            matchedQuery: "CUSTOM",
            guardrailTriggered: false,
            guardrailCode: null,
            degradedMode: true,
          },
          ...prev.slice(0, 5),
        ]);
      } finally {
        setAgentBusy(false);
      }
    },
    [apiBaseUrl, authToken, agentBusy, applyPresetFilter, isCompactViewport]
  );

  const licenseKey =
    (
      import.meta as unknown as {
        env?: Record<string, string | undefined>;
      }
    ).env?.VITE_AG_STUDIO_LICENSE_KEY || undefined;

  return (
    <section
      data-testid="intelligence-studio-workspace"
      aria-label={
        isEs
          ? "RealityProof Intelligence Studio — AG Studio 3.0"
          : "RealityProof Intelligence Studio — AG Studio 3.0"
      }
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-3 py-4 sm:px-6"
    >
      {/* ====================================================================
          1. EXECUTIVE HEADER & STRICT FINANCIAL PROVENANCE KPI STRIP
         ==================================================================== */}
      <div className="rounded-xl border border-slate-700/80 bg-[#151E32] p-4 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/15 px-3 py-0.5 text-xs font-bold tracking-wide text-lime-300">
                AG STUDIO 3.0 · AGENTIC EVIDENCE INTELLIGENCE
              </span>
              <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-blue-200">
                READ-ONLY ANALYTICS · ZERO PAYMENT SIDE EFFECTS
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
                Role: {actorRole}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
              {isEs
                ? "RealityProof Intelligence Studio · Centro de Decisiones Económicas Basadas en Evidencia"
                : "RealityProof Intelligence Studio · Evidence-Driven Economic Decision Center"}
            </h1>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              {isEs
                ? "Combina analítica de Valor de la Información (VoI), cobertura de vistas fotográficas, procedencia financiera separada (PayPal Sandbox vs. Demo Sintético) y Studio Agent Framework."
                : "Combines Value of Information (VoI) economics, photographic view coverage, strictly separated financial provenance (PayPal Sandbox vs. Synthetic Demo), and the Studio Agent Framework."}
            </p>
          </div>

          <button
            type="button"
            data-testid="studio-refresh-data-btn"
            onClick={() => void fetchAnalyticsData()}
            className="rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-lime-400/60 hover:text-lime-200"
          >
            {loading
              ? isEs
                ? "Actualizando..."
                : "Refreshing..."
              : isEs
                ? "Actualizar datos en vivo"
                : "Refresh Live Data"}
          </button>
        </div>

        {/* Strictly Separated Financial & Operational KPIs */}
        {summary && (
          <div
            data-testid="studio-provenance-kpi-strip"
            className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div
              data-testid="kpi-real-sandbox-captured"
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  REAL_SANDBOX_CAPTURE
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-200">
                  1-to-1 VERIFIED
                </span>
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-slate-50">
                US${summary.real_sandbox_captured_usd.toFixed(2)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {summary.real_sandbox_captured_count}{" "}
                {isEs
                  ? "captura real (0TL320715J3450828) · Payout sin reclamar: "
                  : "real capture (0TL320715J3450828) · Unclaimed payout: "}
                <strong className="font-mono text-amber-200">
                  US${summary.real_sandbox_payout_pending_or_unclaimed_usd.toFixed(2)}
                </strong>
                {isEs ? " · Recibido: " : " · Received: "}
                <strong className="font-mono text-emerald-300">
                  US${summary.real_sandbox_payout_success_usd.toFixed(2)}
                </strong>
              </p>
            </div>

            <div
              data-testid="kpi-demo-synthetic-separated"
              className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  DEMO_SYNTHETIC (NO PAGABLE)
                </span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                  SEPARATED
                </span>
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-amber-200">
                US${summary.demo_synthetic_non_payable_usd.toFixed(2)}{" "}
                <span className="text-xs font-normal text-amber-200">
                  (US$0.00 real)
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {summary.demo_synthetic_count} demo ·{" "}
                {summary.historical_replay_count} replay ·{" "}
                {summary.unfunded_count} unfunded
              </p>
            </div>

            <div
              data-testid="kpi-needs-evidence"
              className="rounded-lg border border-slate-700 bg-slate-900/80 p-3"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                {isEs ? "NECESITAN EVIDENCIA" : "NEED EVIDENCE"}
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-lime-300">
                {summary.needs_evidence_count}{" "}
                <span className="text-xs font-normal text-slate-300">
                  / {summary.total_tasks}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {isEs
                  ? "Vistas fotográficas obligatorias pendientes"
                  : "Missing required photographic views"}
              </p>
            </div>

            <div
              data-testid="kpi-pending-human-review"
              className="rounded-lg border border-slate-700 bg-slate-900/80 p-3"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                {isEs ? "REVISIÓN HUMANA PENDIENTE" : "PENDING HUMAN REVIEW"}
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-blue-300">
                {summary.pending_human_review_count}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {isEs
                  ? "Analizados por Gemini esperando decisión"
                  : "Gemini-analyzed awaiting human decision"}
              </p>
            </div>

            <div
              data-testid="kpi-passports-breakdown"
              className="rounded-lg border border-slate-700 bg-slate-900/80 p-3"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                PROOF PASSPORTS
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-slate-100">
                {summary.passports_issued_commercial_count +
                  summary.passports_issued_exception_count +
                  summary.passports_issued_demo_count}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {summary.passports_issued_commercial_count} Commercial ·{" "}
                {summary.passports_issued_exception_count} Exception ·{" "}
                {summary.passports_issued_demo_count} Demo
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          2. EVIDENCE INTELLIGENCE AGENT CONSOLE (STUDIO AGENT FRAMEWORK + GEMINI)
         ==================================================================== */}
      <div
        data-testid="studio-agent-console"
        className="rounded-xl border border-slate-700/80 bg-[#151E32] p-4 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-100 sm:text-base">
              {isEs
                ? "Evidence Intelligence Agent · Studio Agent Framework + Backend Gemini Adapter"
                : "Evidence Intelligence Agent · Studio Agent Framework + Backend Gemini Adapter"}
            </h2>
            <p className="text-xs text-slate-300">
              {isEs
                ? "Ejecuta consultas analíticas verificables (A–E) o preguntas libres. Protegido contra inyección de prompts y acciones financieras."
                : "Run verifiable analytical queries (A–E) or free-form questions. Guarded against prompt injection and financial mutations."}{" "}
              {isEs
                ? "Los gráficos libres que el modelo diseña paso a paso son experimentales."
                : "Free-form charts the model designs step by step are experimental."}
            </p>
          </div>
          {lastAgentTurn && (
            <span
              data-testid="studio-agent-engine-badge"
              className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                lastAgentTurn.meta.guardrail_triggered
                  ? "bg-rose-500/20 text-rose-300"
                  : lastAgentTurn.meta.degraded_mode
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-lime-400/15 text-lime-300"
              }`}
            >
              {lastAgentTurn.meta.guardrail_triggered
                ? `GUARDRAIL: ${lastAgentTurn.meta.guardrail_code}`
                : lastAgentTurn.meta.degraded_mode
                  ? "DEGRADED_SAFE_FALLBACK"
                  : `QUERY_${lastAgentTurn.meta.matched_demo_query} · VERIFIED`}
            </span>
          )}
        </div>

        {/* 5 Canonical Demo Query Buttons (A-E) */}
        <div
          data-testid="studio-demo-queries-bar"
          className="mt-3 flex flex-wrap gap-2"
        >
          {CANONICAL_DEMO_QUERIES.map((dq) => (
            <button
              key={dq.id}
              type="button"
              data-testid={`studio-demo-query-${dq.id}`}
              disabled={agentBusy}
              onClick={() => {
                const prompt = isEs ? dq.promptEs : dq.promptEn;
                setAgentQueryInput(prompt);
                void executeStudioAgentQuery(prompt);
              }}
              className="rounded-lg border border-lime-400/35 bg-slate-900/90 px-3 py-1.5 text-left text-xs font-semibold text-slate-100 transition hover:border-lime-400 hover:bg-lime-400/15 hover:text-lime-200 disabled:opacity-50"
            >
              {isEs ? dq.labelEs : dq.labelEn}
            </button>
          ))}
        </div>

        {/* Free-form Query Input + Quick Filter Preset Pills */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executeStudioAgentQuery(agentQueryInput);
          }}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="studio-agent-query-input" className="sr-only">
            {isEs
              ? "Consulta para Evidence Intelligence Agent"
              : "Query for Evidence Intelligence Agent"}
          </label>
          <input
            id="studio-agent-query-input"
            data-testid="studio-agent-query-input"
            type="text"
            value={agentQueryInput}
            onChange={(e) => setAgentQueryInput(e.target.value)}
            placeholder={
              isEs
                ? "Pregunta al Evidence Intelligence Agent (ej. 'Muéstrame las verificaciones que todavía necesitan evidencia')..."
                : "Ask the Evidence Intelligence Agent (e.g. 'Show verifications that still need evidence')..."
            }
            className="flex-1 rounded-lg border border-slate-600 bg-[#0B1020] px-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:border-lime-400 focus:outline-none sm:text-sm"
          />
          <button
            type="submit"
            data-testid="studio-agent-submit-btn"
            disabled={agentBusy || !agentQueryInput.trim()}
            className="rounded-lg bg-[#C6FF62] px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-lime-300 disabled:opacity-50"
          >
            {agentBusy
              ? isEs
                ? "Analizando..."
                : "Analyzing..."
              : isEs
                ? "Ejecutar consulta"
                : "Run Query"}
          </button>
        </form>

        {/* Quick Filter Preset Pills */}
        <div
          data-testid="studio-quick-filter-bar"
          className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-2.5 text-xs"
        >
          <span className="mr-1 font-semibold text-slate-300">
            {isEs ? "Filtro activo en Studio:" : "Active Studio Filter:"}
          </span>
          {(
            [
              { id: "ALL", labelEs: "Todas", labelEn: "All" },
              {
                id: "NEEDS_EVIDENCE",
                labelEs: "Necesitan evidencia",
                labelEn: "Needs Evidence",
              },
              {
                id: "PENDING_HUMAN_REVIEW",
                labelEs: "Revisión humana pendiente",
                labelEn: "Pending Human Review",
              },
              {
                id: "REAL_SANDBOX_ONLY",
                labelEs: "Solo PayPal Sandbox Real",
                labelEn: "Real PayPal Sandbox Only",
              },
              {
                id: "DEMO_SYNTHETIC_ONLY",
                labelEs: "Solo Demo Sintético",
                labelEn: "Synthetic Demo Only",
              },
              {
                id: "HIGHEST_POTENTIAL_LOSS",
                labelEs: "Mayor pérdida potencial",
                labelEn: "Highest Potential Loss",
              },
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              type="button"
              data-testid={`studio-filter-pill-${pill.id}`}
              onClick={() => applyPresetFilter(pill.id, null)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activePreset === pill.id
                  ? "bg-[#C6FF62] text-slate-950"
                  : "bg-slate-800/90 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isEs ? pill.labelEs : pill.labelEn}
            </button>
          ))}
        </div>

        {/* Agent Response Output Card */}
        {agentTranscript[0] && (
          <div
            data-testid="studio-agent-response-card"
            className="mt-3 rounded-lg border border-slate-700 bg-[#0B1020] p-3 text-xs text-slate-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
              <span className="font-semibold text-lime-300">
                {isEs ? "Consulta:" : "Query:"} “{agentTranscript[0].userPrompt}”
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {agentTranscript[0].toolCalls.map((tc, toolIndex) => (
<span
key={`${tc}-${toolIndex}`}
                    className="rounded bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-300"
                  >
                    tool:{tc}()
                  </span>
                ))}
                {agentTranscript[0].guardrailTriggered && (
                  <span
                    data-testid="studio-agent-guardrail-badge"
                    className="rounded bg-rose-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300"
                  >
                    {agentTranscript[0].guardrailCode}
                  </span>
                )}
                {agentTranscript[0].degradedMode && (
                  <span
                    data-testid="studio-agent-degraded-badge"
                    className="rounded bg-amber-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200"
                  >
                    {isEs
                      ? "RESPALDO DETERMINISTA · SIN GEMINI EN VIVO"
                      : "DETERMINISTIC FALLBACK · NOT LIVE GEMINI"}
                  </span>
                )}
              </div>
            </div>
            <div
              data-testid="studio-agent-response-text"
              className="mt-2 whitespace-pre-line leading-relaxed text-slate-200"
            >
              {agentTranscript[0].assistantResponse}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          3. ERROR BANNER IF ANY
         ==================================================================== */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200"
        >
          <strong>
            {isEs ? "Error cargando analítica:" : "Analytics Load Error:"}
          </strong>{" "}
          {error}
        </div>
      )}

      {/* ====================================================================
          4. NATIVE AG STUDIO 3.0 CANVAS (DESKTOP/TABLET >= 640px)
             & RESPONSIVE MOBILE INTELLIGENCE VIEW (< 640px)
         ==================================================================== */}
      {!isCompactViewport ? (
        <div
          data-testid="ag-studio-native-container"
          className="flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-300">
            <span>
              {isEs
                ? "Panel AG Studio 3.1 con 4 widgets propios, sobre los datos de esta API"
                : "AG Studio 3.1 dashboard with 4 custom widgets, on this API's data"}
            </span>
            <span className="font-mono text-[11px] text-slate-300">
              {studioEngineRows.length} {isEs ? "filas activas" : "active rows"}
            </span>
          </div>

          <div
            style={{ height: "980px", width: "100%" }}
            className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#0B1020] shadow-xl"
          >
            {studioEngineRows.length > 0 ? (
              <AgStudioProvider
                modules={[AgStudioAiModule]}
                licenseKey={licenseKey}
              >
                <AgStudio
                  mode="edit"
                  style={{ height: "100%" }}
                  panels={STUDIO_PANELS}
                  layout={STUDIO_LAYOUT}
                  data={
                    {
                      sources: [
                        {
                          id: "verifications",
                          name: "RealityProof Verifications",
                          primaryKeyField: "task_id",
                          data: studioEngineRows as unknown as SimpleData[],
                        },
                      ],
                    } satisfies AgDataSourcesDefinition<any>
                  }
                  theme={realityProofStudioTheme}
                  widgets={realityProofStudioWidgets as any}
                  initialState={initialReportState}
                  ai={aiHarness}
                />
              </AgStudioProvider>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-300">
                {loading
                  ? isEs
                    ? "Cargando motor AG Studio 3.1.0..."
                    : "Loading AG Studio 3.1.0 engine..."
                  : isEs
                    ? "Sin filas para el filtro actual."
                    : "No rows match the current filter."}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Responsive Mobile Mode (< 1024px: tablet, 720px 200% zoom, 390px & 360px) — Prevents AG Studio 24-column canvas horizontal overflow while keeping all 4 custom widgets and queries interactive */
        <div
          data-testid="ag-studio-mobile-responsive-view"
          className="flex flex-col gap-3"
        >
          <div className="rounded-lg border border-blue-400/30 bg-blue-950/25 p-2.5 text-xs text-blue-200">
            <strong>
              {isEs
                ? "Modo compacto / Zoom 200% (< 1024px):"
                : "Compact / 200% Zoom Quick-Query Mode (< 1024px):"}
            </strong>{" "}
            {isEs
              ? "El lienzo de 24 columnas de AG Studio se adapta en pantallas compactas a tarjetas verticales de consulta sin desbordamiento horizontal."
              : "AG Studio's 24-column authoring canvas adapts on compact viewports into vertical query cards with zero horizontal overflow."}
          </div>

          {studioEngineRows.map((row) => (
            <div
              key={row.task_id}
              data-testid={`mobile-intelligence-card-${row.task_id}`}
              className="rounded-xl border border-slate-700/80 bg-[#151E32] p-3 text-xs text-slate-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-mono font-bold text-lime-300">
                  {row.task_id}
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-200">
                  {row.funding_provenance}
                </span>
              </div>
              <p className="mt-1 font-semibold text-slate-100">
                {row.item_title}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded bg-slate-900 p-1.5">
                  <span className="block text-slate-300">
                    {isEs ? "Coste vs. Pérdida esp." : "Cost vs. Exp. Loss"}
                  </span>
                  <span className="font-mono font-semibold text-slate-100">
                    US${row.verification_cost_usd.toFixed(2)} vs US$
                    {row.expected_loss_without_verification_usd.toFixed(2)}
                  </span>
                </div>
                <div className="rounded bg-slate-900 p-1.5">
                  <span className="block text-slate-300">
                    {isEs ? "Ahorro Neto (VoI)" : "Net Benefit (VoI)"}
                  </span>
                  <span className="font-mono font-semibold text-lime-300">
                    +US${row.expected_net_benefit_usd.toFixed(2)}
                  </span>
                </div>
                <div className="rounded bg-slate-900 p-1.5">
                  <span className="block text-slate-300">
                    {isEs ? "Cobertura vistas" : "View Coverage"}
                  </span>
                  <span className="font-mono text-slate-200">
                    {row.received_views_count}/{row.required_views_count} (
                    {row.missing_views_csv})
                  </span>
                </div>
                <div className="rounded bg-slate-900 p-1.5">
                  <span className="block text-slate-300">
                    {isEs ? "Estado PayPal" : "PayPal State"}
                  </span>
                  <span className="font-mono text-blue-300">
                    {row.paypal_financial_state}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenVerificationCase(row.task_id)}
                  className="rounded border border-blue-400/50 bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-200"
                >
                  {isEs ? "Abrir caso" : "Open Case"}
                </button>
                {row.proof_passport_id && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenProofPassport(row.proof_passport_id!, row.task_id)
                    }
                    className="rounded border border-lime-400/50 bg-lime-400/15 px-2.5 py-1 text-xs font-semibold text-lime-200"
                  >
                    Proof Passport
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
