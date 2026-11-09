import React, { useEffect, useState, useSyncExternalStore } from "react";
import type { AgWidgetParams } from "ag-studio";
import {
  createWidgets,
  type AgWidgetDefinition,
} from "ag-studio-react";
import type {
  StudioQuickFilterPreset,
  VerificationIntelligenceRow,
} from "../types";

// ============================================================================
// Reactive Bridge for Rich Row Context & Navigation Callbacks inside AG Studio
// ============================================================================
export interface StudioBridgeSnapshot {
  rows: VerificationIntelligenceRow[];
  activePreset: StudioQuickFilterPreset;
  focusedTaskId: string | null;
  locale: "en" | "es";
  onOpenVerificationCase: (taskId: string) => void;
  onOpenProofPassport: (proofId: string, taskId: string) => void;
  onSelectFocusTask: (taskId: string) => void;
}

let currentSnapshot: StudioBridgeSnapshot = {
  rows: [],
  activePreset: "ALL",
  focusedTaskId: null,
  locale: "es",
  onOpenVerificationCase: () => {},
  onOpenProofPassport: () => {},
  onSelectFocusTask: () => {},
};

const listeners = new Set<() => void>();

export function updateStudioBridgeSnapshot(
  partial: Partial<StudioBridgeSnapshot>
): void {
  currentSnapshot = {
    ...currentSnapshot,
    ...partial,
  };
  for (const listener of listeners) {
    listener();
  }
}

export function useStudioBridge(): StudioBridgeSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentSnapshot
  );
}

function filterRowsByPreset(
  rows: VerificationIntelligenceRow[],
  preset: StudioQuickFilterPreset,
  engineTaskIds: Set<string> | null
): VerificationIntelligenceRow[] {
  let list = rows;
  if (engineTaskIds && engineTaskIds.size > 0) {
    const matched = list.filter((r) => engineTaskIds.has(r.task_id));
    if (matched.length > 0) {
      list = matched;
    }
  }
  switch (preset) {
    case "NEEDS_EVIDENCE":
      return list.filter((r) => r.needs_evidence_flag);
    case "PENDING_HUMAN_REVIEW":
      return list.filter((r) => r.pending_human_review_flag);
    case "REAL_SANDBOX_ONLY":
      return list.filter(
        (r) => r.funding_provenance === "REAL_SANDBOX_CAPTURE"
      );
    case "DEMO_SYNTHETIC_ONLY":
      return list.filter((r) => r.funding_provenance === "DEMO_SYNTHETIC");
    case "HIGHEST_POTENTIAL_LOSS":
      return [...list].sort(
        (a, b) =>
          b.estimated_loss_if_wrong_usd - a.estimated_loss_if_wrong_usd
      );
    case "VOI_COMPARISON":
      return [...list].sort(
        (a, b) => b.expected_net_benefit_usd - a.expected_net_benefit_usd
      );
    default:
      return list;
  }
}

/**
 * Queries AG Studio's native data engine via widgetApi.getData()
 * and returns any task_id values currently passing page/cross-filters.
 */
function useAgEngineTaskIds(
  widgetApi: AgWidgetParams["widgetApi"],
  dataMapping: AgWidgetParams["dataMapping"]
): {
  engineTaskIds: Set<string> | null;
  engineRowCount: number;
} {
  const [engineTaskIds, setEngineTaskIds] = useState<Set<string> | null>(null);
  const [engineRowCount, setEngineRowCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    widgetApi.setDisplayState("displayed");
    const rawMapping = dataMapping as Record<string, unknown> | undefined;
    const mappedFields = Array.isArray(rawMapping?.fields)
      ? (rawMapping.fields as any[])
      : [];
    const fetchEngineRows = async () => {
      if (mappedFields.length === 0) return;
      try {
        const response = await widgetApi.getData({
          fields: mappedFields,
        });
        if (!active) return;
        const rows = response.results?.rows ?? [];
        const ids = new Set<string>();
        for (const r of rows) {
          const val = r["task_id"] ?? r["verifications.task_id"];
          if (typeof val === "string") {
            ids.add(val);
          }
        }
        setEngineTaskIds(ids.size > 0 ? ids : null);
        setEngineRowCount(rows.length);
      } catch {
        // Fallback cleanly to bridge snapshot if engine query is initializing
      }
    };

    void fetchEngineRows();
    widgetApi.addEventListener("widgetMounted", () => {
      void fetchEngineRows();
    });
    return () => {
      active = false;
      widgetApi.removeEventListener("widgetMounted");
    };
  }, [widgetApi, dataMapping]);

  return { engineTaskIds, engineRowCount };
}

// ============================================================================
// CUSTOM WIDGET 1: Value of Information Explorer ('voi-explorer')
// ============================================================================
const VoiExplorerComponent: React.FC<AgWidgetParams> = ({
  widgetApi,
  dataMapping,
}) => {
  const bridge = useStudioBridge();
  const { engineTaskIds } = useAgEngineTaskIds(widgetApi, dataMapping);
  const visibleRows = filterRowsByPreset(
    bridge.rows,
    bridge.activePreset,
    engineTaskIds
  );
  const isEs = bridge.locale === "es";

  return (
    <div
      data-testid="custom-widget-voi-explorer"
      tabIndex={0}
      role="region"
      aria-label="Value of Information Explorer"
      className="flex h-full flex-col gap-2.5 overflow-y-auto pr-1 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-lime-300">
            VoI = (p × L) − C
          </span>
          <p className="mt-1 text-xs text-slate-300">
            {isEs
              ? "Supuesto subjetivo de riesgo (nunca probabilidad empírica calibrada)."
              : "Subjective risk assumption (never an empirically calibrated probability)."}
          </p>
        </div>
        <span className="rounded bg-slate-800/90 px-2 py-1 font-mono text-[11px] text-slate-300">
          {visibleRows.length} {isEs ? "casos" : "cases"}
        </span>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <strong>Insufficient Information:</strong>{" "}
          {isEs
            ? "No hay filas con datos de coste y pérdida para el filtro activo."
            : "No rows with cost and potential loss data match the active filter."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {visibleRows.map((row) => {
            const hasSufficientData =
              row.verification_cost_usd > 0 &&
              row.estimated_loss_if_wrong_usd > 0;
            const isFocused = bridge.focusedTaskId === row.task_id;
            return (
              <div
                key={row.task_id}
                onClick={() => bridge.onSelectFocusTask(row.task_id)}
                className={`cursor-pointer rounded-lg border p-2.5 transition ${
                  isFocused
                    ? "border-lime-400 bg-slate-800/90"
                    : "border-slate-700/70 bg-slate-900/75 hover:border-slate-500"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-mono text-xs font-semibold text-lime-300">
                    {row.task_id}
                  </span>
                  {!hasSufficientData ? (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                      Insufficient Information
                    </span>
                  ) : row.voi_recommendation === "PROCEED_WITH_VERIFICATION" ? (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      {isEs
                        ? "PROCEDER CON VERIFICACIÓN"
                        : "PROCEED WITH VERIFICATION"}
                    </span>
                  ) : (
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                      {isEs
                        ? "NO VERIFICAR (COSTE > PÉRDIDA ESPERADA)"
                        : "ABSTAIN (COST > EXPECTED LOSS)"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-300">
                  {row.item_title}
                </p>
                <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-1.5 text-[11px]">
                  <div className="rounded bg-slate-950/70 px-2 py-1">
                    <span className="block text-slate-300">
                      {isEs ? "Coste (C)" : "Cost (C)"}
                    </span>
                    <span className="font-mono font-semibold text-slate-100">
                      US${row.verification_cost_usd.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950/70 px-2 py-1">
                    <span className="block text-slate-300">
                      {isEs ? "Supuesto p (subjetivo)" : "Assumed p (subj.)"}
                    </span>
                    <span className="font-mono font-semibold text-amber-300">
                      {(row.subjective_defect_risk_assumption * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="rounded bg-slate-950/70 px-2 py-1">
                    <span className="block text-slate-300">
                      {isEs ? "Pérdida si falla (L)" : "Potential Loss (L)"}
                    </span>
                    <span className="font-mono font-semibold text-slate-100">
                      US${row.estimated_loss_if_wrong_usd.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950/70 px-2 py-1">
                    <span className="block text-slate-300">
                      {isEs ? "Pérdida esp. (p×L)" : "Expected Loss (p×L)"}
                    </span>
                    <span className="font-mono font-semibold text-blue-300">
                      US${row.expected_loss_without_verification_usd.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950/70 px-2 py-1">
                    <span className="block text-slate-300">
                      {isEs ? "Ahorro neto (VoI)" : "Net Benefit (VoI)"}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        row.expected_net_benefit_usd >= 0
                          ? "text-lime-300"
                          : "text-rose-300"
                      }`}
                    >
                      {row.expected_net_benefit_usd >= 0 ? "+" : ""}US$
                      {row.expected_net_benefit_usd.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CUSTOM WIDGET 2: Evidence Coverage Explorer ('evidence-coverage-explorer')
// ============================================================================
const EvidenceCoverageComponent: React.FC<AgWidgetParams> = ({
  widgetApi,
  dataMapping,
}) => {
  const bridge = useStudioBridge();
  const { engineTaskIds } = useAgEngineTaskIds(widgetApi, dataMapping);
  const visibleRows = filterRowsByPreset(
    bridge.rows,
    bridge.activePreset,
    engineTaskIds
  );
  const isEs = bridge.locale === "es";

  return (
    <div
      data-testid="custom-widget-evidence-coverage"
      tabIndex={0}
      role="region"
      aria-label="Evidence Coverage Explorer"
      className="flex h-full flex-col gap-2.5 overflow-y-auto pr-1 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-2 text-xs">
        <span className="text-slate-300">
          {isEs
            ? "Distingue recepción técnica de archivos (SHA-256) vs. validación del contenido físico."
            : "Distinguishes technical file receipt (SHA-256) from physical content validation."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {visibleRows.map((row) => (
          <div
            key={row.task_id}
            className="rounded-lg border border-slate-700/70 bg-slate-900/75 p-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-mono text-xs font-semibold text-slate-100">
                {row.task_id}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    row.missing_views_count === 0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {row.received_views_count}/{row.required_views_count}{" "}
                  {isEs ? "vistas" : "views"}
                </span>
                {row.duplicate_views_count > 0 && (
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                    {isEs ? "Ángulo duplicado" : "Duplicate angle"}:{" "}
                    {row.duplicate_views_csv}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-1.5 text-[11px] [overflow-wrap:anywhere]">
              <div className="rounded bg-slate-950/70 px-2 py-1.5">
                <span className="block text-slate-300">
                  {isEs ? "Vistas requeridas" : "Required views"}
                </span>
                <span className="font-mono text-slate-200">
                  {row.required_views_csv}
                </span>
              </div>
              <div className="rounded bg-slate-950/70 px-2 py-1.5">
                <span className="block text-slate-300">
                  {isEs ? "Vistas recibidas" : "Received views"}
                </span>
                <span className="font-mono text-emerald-300">
                  {row.received_views_csv}
                </span>
              </div>
              <div className="rounded bg-slate-950/70 px-2 py-1.5">
                <span className="block text-slate-300">
                  {isEs ? "Vistas faltantes" : "Missing views"}
                </span>
                <span
                  className={`font-mono font-semibold ${
                    row.missing_views_count > 0
                      ? "text-amber-300"
                      : "text-slate-300"
                  }`}
                >
                  {row.missing_views_csv}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800 pt-1.5 text-[11px]">
              <span className="text-slate-300">
                <strong>{isEs ? "Archivo técnico:" : "Tech receipt:"}</strong>{" "}
                <code className="text-blue-300">
                  {row.technical_file_receipt_status}
                </code>
              </span>
              <span className="text-slate-300">
                <strong>
                  {isEs ? "Validación física:" : "Physical content:"}
                </strong>{" "}
                <code className="text-lime-300">
                  {row.physical_content_validation_status}
                </code>
              </span>
            </div>

            {row.human_exception_reason && (
              <div className="mt-1.5 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                <strong>
                  {isEs ? "Excepción humana registrada:" : "Human exception:"}
                </strong>{" "}
                {row.human_exception_reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// CUSTOM WIDGET 3: Financial Provenance Chain ('financial-provenance-chain')
// ============================================================================
const FinancialProvenanceComponent: React.FC<AgWidgetParams> = ({
  widgetApi,
  dataMapping,
}) => {
  const bridge = useStudioBridge();
  const { engineTaskIds } = useAgEngineTaskIds(widgetApi, dataMapping);
  const visibleRows = filterRowsByPreset(
    bridge.rows,
    bridge.activePreset,
    engineTaskIds
  );
  const isEs = bridge.locale === "es";

  return (
    <div
      data-testid="custom-widget-financial-provenance"
      tabIndex={0}
      role="region"
      aria-label="Financial Provenance Chain"
      className="flex h-full flex-col gap-2.5 overflow-y-auto pr-1 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-2 text-xs">
        <span className="text-slate-300">
          {isEs
            ? "Cadena de procedencia de solo lectura · Separación estricta REAL_SANDBOX_CAPTURE vs DEMO_SYNTHETIC."
            : "Read-only provenance chain · Strict REAL_SANDBOX_CAPTURE vs DEMO_SYNTHETIC separation."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {visibleRows.map((row) => {
          const isReal = row.funding_provenance === "REAL_SANDBOX_CAPTURE";
          const isDemo = row.funding_provenance === "DEMO_SYNTHETIC";
          const isReplay =
            row.funding_provenance === "HISTORICAL_SANDBOX_REPLAY";

          return (
            <div
              key={row.task_id}
              className={`rounded-lg border p-2.5 ${
                isReal
                  ? "border-emerald-500/40 bg-emerald-950/20"
                  : isDemo
                    ? "border-amber-500/40 bg-amber-950/15"
                    : "border-slate-700/70 bg-slate-900/75"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-mono text-xs font-semibold text-slate-100">
                  {row.task_id}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                      isReal
                        ? "bg-emerald-500/20 text-emerald-300"
                        : isDemo
                          ? "bg-amber-500/20 text-amber-300"
                          : isReplay
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {row.funding_provenance}
                  </span>
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-300">
                    {row.paypal_financial_state}
                  </span>
                </div>
              </div>

              {/* 5-Stage Provenance Chain: Request -> PayPal Order -> Capture -> Human Review -> Payout */}
              <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-1.5 text-[11px]">
                <div className="rounded bg-slate-950/80 px-2 py-1.5">
                  <span className="block text-slate-300">1. Request</span>
                  <span className="font-mono text-slate-200">{row.status}</span>
                </div>
                <div className="rounded bg-slate-950/80 px-2 py-1.5">
                  <span className="block text-slate-300">2. PayPal Order</span>
                  <span className="font-mono text-slate-200">
                    {row.paypal_order_id ?? "NONE"}
                  </span>
                </div>
                <div className="rounded bg-slate-950/80 px-2 py-1.5">
                  <span className="block text-slate-300">3. Capture</span>
                  <span className="font-mono text-slate-200">
                    {row.paypal_capture_id ?? "NONE"}{" "}
                    {isReal
                      ? `(US$${row.real_captured_usd.toFixed(2)} REAL)`
                      : isDemo
                        ? `(US$0.00 REAL / DEMO)`
                        : ""}
                  </span>
                </div>
                <div className="rounded bg-slate-950/80 px-2 py-1.5">
                  <span className="block text-slate-300">4. Human Review</span>
                  <span className="font-mono text-slate-200">
                    {row.human_review_status}
                  </span>
                </div>
                <div className="rounded bg-slate-950/80 px-2 py-1.5">
                  <span className="block text-slate-300">5. Payout State</span>
                  <span className="font-mono text-slate-200">
                    {isReal
                      ? row.payout_batch_id
                        ? `${row.payout_transaction_status} (${row.payout_batch_id})`
                        : `${row.paypal_financial_state} (Est. US$${row.verifier_expected_remuneration_usd.toFixed(2)})`
                      : "NON-PAYABLE DEMO"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// CUSTOM WIDGET 4: Decision Trace Explorer ('decision-trace-explorer')
// ============================================================================
const DecisionTraceComponent: React.FC<AgWidgetParams> = ({
  widgetApi,
  dataMapping,
}) => {
  const bridge = useStudioBridge();
  const { engineTaskIds } = useAgEngineTaskIds(widgetApi, dataMapping);
  const visibleRows = filterRowsByPreset(
    bridge.rows,
    bridge.activePreset,
    engineTaskIds
  );
  const isEs = bridge.locale === "es";

  return (
    <div
      data-testid="custom-widget-decision-trace"
      tabIndex={0}
      role="region"
      aria-label="Decision Trace Explorer"
      className="flex h-full flex-col gap-2.5 overflow-y-auto pr-1 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-2 text-xs">
        <span className="text-slate-300">
          {isEs
            ? "Trazabilidad de decisiones (Gemini + Operador Humano) y acceso directo al caso o Proof Passport."
            : "Decision trace (Gemini + Human Operator) with one-click navigation to Case or Proof Passport."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {visibleRows.map((row) => (
          <div
            key={row.task_id}
            className="rounded-lg border border-slate-700/70 bg-slate-900/75 p-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-semibold text-lime-300">
                  {row.task_id}
                </span>
                <span className="ml-2 text-xs text-slate-300">
                  {row.item_title}
                </span>
              </div>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-200">
                Passport: {row.proof_passport_classification}
              </span>
            </div>

            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
              {row.decision_trace_summary}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid={`studio-open-case-${row.task_id}`}
                onClick={() => bridge.onOpenVerificationCase(row.task_id)}
                className="rounded-md border border-blue-400/50 bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/30"
              >
                {isEs
                  ? "Abrir en Operator Decision Desk"
                  : "Open in Operator Decision Desk"}
              </button>
              {row.proof_passport_id && (
                <button
                  type="button"
                  data-testid={`studio-open-passport-${row.task_id}`}
                  onClick={() =>
                    bridge.onOpenProofPassport(
                      row.proof_passport_id!,
                      row.task_id
                    )
                  }
                  className="rounded-md border border-lime-400/50 bg-lime-400/15 px-2.5 py-1 text-xs font-semibold text-lime-200 transition hover:bg-lime-400/25"
                >
                  {isEs ? "Abrir Proof Passport" : "Open Proof Passport"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// AG Studio 3.1.0 Widget Definitions & Catalogue
// ============================================================================

export const voiExplorerWidgetDef: AgWidgetDefinition<"voi-explorer"> = {
  id: "voi-explorer",
  label: "Value of Information Explorer",
  comp: VoiExplorerComponent,
  defaultSize: { width: 12, height: 14 },
  minSize: { width: 6, height: 8 },
  dataMapping: {
    fields: {
      type: "fieldset",
      supportedRoles: ["category", "numeric"],
    },
  },
  form: (params) =>
    params.createDefaults({
      dataMappingItems: [{ key: "fields", label: "VoI Economic Fields" }],
    }),
  ai: {
    label: "Value of Information (VoI) Explorer",
    description:
      "Displays verification cost (C), subjective defect risk assumption (p), potential loss (L), expected loss (p*L), net expected savings, and recommended decision.",
    usage:
      "Use when comparing verification cost against expected loss or evaluating Value of Information across contracts.",
  },
};

export const evidenceCoverageWidgetDef: AgWidgetDefinition<"evidence-coverage-explorer"> =
  {
    id: "evidence-coverage-explorer",
    label: "Evidence Coverage Explorer",
    comp: EvidenceCoverageComponent,
    defaultSize: { width: 12, height: 14 },
    minSize: { width: 6, height: 8 },
    dataMapping: {
      fields: {
        type: "fieldset",
        supportedRoles: ["category", "numeric"],
      },
    },
    form: (params) =>
      params.createDefaults({
        dataMappingItems: [
          { key: "fields", label: "Evidence Coverage Fields" },
        ],
      }),
    ai: {
      label: "Evidence Coverage Explorer",
      description:
        "Displays required photographic views, received views, missing views, duplicate angle warnings, human exceptions, and separates technical file receipt from physical content validation.",
      usage:
        "Use when inspecting which verifications still need evidence or have missing required camera views.",
    },
  };

export const financialProvenanceWidgetDef: AgWidgetDefinition<"financial-provenance-chain"> =
  {
    id: "financial-provenance-chain",
    label: "Financial Provenance Chain",
    comp: FinancialProvenanceComponent,
    defaultSize: { width: 12, height: 14 },
    minSize: { width: 6, height: 8 },
    dataMapping: {
      fields: {
        type: "fieldset",
        supportedRoles: ["category", "numeric"],
      },
    },
    form: (params) =>
      params.createDefaults({
        dataMappingItems: [
          { key: "fields", label: "Financial Provenance Fields" },
        ],
      }),
    ai: {
      label: "Financial Provenance Chain",
      description:
        "Visualizes Request -> PayPal Order -> Capture -> Human Review -> Payout with strict separation between REAL_SANDBOX_CAPTURE and DEMO_SYNTHETIC.",
      usage:
        "Use when distinguishing real PayPal Sandbox captures from synthetic demo transactions.",
    },
  };

export const decisionTraceWidgetDef: AgWidgetDefinition<"decision-trace-explorer"> =
  {
    id: "decision-trace-explorer",
    label: "Decision Trace Explorer",
    comp: DecisionTraceComponent,
    defaultSize: { width: 12, height: 14 },
    minSize: { width: 6, height: 8 },
    dataMapping: {
      fields: {
        type: "fieldset",
        supportedRoles: ["category", "numeric"],
      },
    },
    form: (params) =>
      params.createDefaults({
        dataMappingItems: [{ key: "fields", label: "Decision Trace Fields" }],
      }),
    ai: {
      label: "Decision Trace Explorer",
      description:
        "Displays Gemini multimodal status, human operator decision rationale, and direct links to open the verification case or issued Proof Passport.",
      usage:
        "Use when opening a case pending human review or inspecting issued Proof Passports.",
    },
  };

export const realityProofStudioWidgets = createWidgets<any>({
  additionalTypes: [
    voiExplorerWidgetDef,
    evidenceCoverageWidgetDef,
    financialProvenanceWidgetDef,
    decisionTraceWidgetDef,
  ],
});
