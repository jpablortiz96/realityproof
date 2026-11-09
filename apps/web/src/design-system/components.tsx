import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ShieldCheck,
  FlaskConical,
  Lock,
} from "lucide-react";
import type { FinancialSequenceStep, TaskStatus } from "@realityproof/shared";
import type { Lang } from "../i18n.js";

export function ProvenanceBadge({
  label,
}: {
  label: "DEMO_SYNTHETIC" | "SANDBOX_LIVE_TEST";
}) {
  if (label === "SANDBOX_LIVE_TEST") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-950/90 text-emerald-200 border border-emerald-500/50">
        <ShieldCheck className="w-3.5 h-3.5 text-[#C6FF62]" aria-hidden="true" />
        SANDBOX_LIVE_TEST
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-amber-950/90 text-amber-200 border border-amber-500/50">
      <FlaskConical className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
      DEMO_SYNTHETIC
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus | string }) {
  const positiveStates = new Set([
    "FUNDED",
    "AI_ANALYZED",
    "VERIFIED",
    "PROOF_PASSPORT_ISSUED",
    "PAYOUT_ELIGIBLE",
    "PAYOUT_SUCCESS",
    "COMPLETED",
  ]);
  const warningStates = new Set([
    "FUNDING_PENDING",
    "BLOCKED_BUYER_APPROVAL",
    "ASSIGNED",
    "SUBMITTED",
    "AI_PROCESSING",
    "AI_BLOCKED",
    "INCONCLUSIVE",
    "PAYOUT_PENDING",
    "PAYOUT_UNCLAIMED",
    "PAYOUTS_BLOCKED",
  ]);
  const errorStates = new Set(["PAYMENT_FAILED", "REJECTED", "EXPIRED"]);

  if (positiveStates.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#C6FF62]/15 text-[#C6FF62] border border-[#C6FF62]/45">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {status}
      </span>
    );
  }
  if (errorStates.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-950/90 text-rose-200 border border-rose-500/50">
        <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {status}
      </span>
    );
  }
  if (warningStates.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-950/90 text-amber-200 border border-amber-500/50">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#0B1020] text-[#93B4FF] border border-[#4A7BFF]/50">
      {status}
    </span>
  );
}

export function CopyableCode({
  label,
  value,
  truncate = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback
    }
  }

  const displayed =
    truncate && value.length > 28
      ? `${value.slice(0, 14)}…${value.slice(-10)}`
      : value;

  return (
    <div className="bg-[#0B1020] border border-slate-700/80 rounded-lg p-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-xs font-medium text-slate-300 block">
          {label}
        </span>
        <code
          className="text-xs font-mono font-semibold text-[#C6FF62] break-all"
          title={value}
        >
          {displayed}
        </code>
      </div>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] px-2.5 py-1.5 rounded-md bg-[#151E32] hover:bg-slate-800 border border-slate-600 text-xs text-slate-100 shrink-0"
        aria-label={`Copy ${label}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-[#C6FF62]" aria-hidden="true" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export type PayPalUiPaymentState =
  | "NOT_CREATED"
  | "CREATED"
  | "APPROVAL_REQUIRED"
  | "APPROVED"
  | "COMPLETED"
  | "FAILED";

export function PayPalPaymentStepper({
  currentState,
  orderId,
  captureId,
  lang,
}: {
  currentState: PayPalUiPaymentState;
  orderId: string | null;
  captureId: string | null;
  lang: Lang;
}) {
  const steps: Array<{
    id: PayPalUiPaymentState;
    title: string;
    desc: string;
  }> = [
    {
      id: "CREATED",
      title: "1. CREATED",
      desc:
        lang === "es"
          ? "Orden v2 creada en PayPal Sandbox"
          : "Orders v2 created in PayPal Sandbox",
    },
    {
      id: "APPROVAL_REQUIRED",
      title: "2. APPROVAL_REQUIRED",
      desc:
        lang === "es"
          ? "Esperando aprobación del comprador"
          : "Awaiting buyer approval in Sandbox",
    },
    {
      id: "APPROVED",
      title: "3. APPROVED",
      desc:
        lang === "es"
          ? "Aprobado por comprador; listo para captura"
          : "Buyer approved; ready for single capture",
    },
    {
      id: "COMPLETED",
      title: "4. COMPLETED",
      desc:
        lang === "es"
          ? "Capturado y verificado remotamente"
          : "Captured & verified remotely in PayPal",
    },
  ];

  const rank: Record<PayPalUiPaymentState, number> = {
    NOT_CREATED: 0,
    CREATED: 1,
    APPROVAL_REQUIRED: 2,
    APPROVED: 3,
    COMPLETED: 4,
    FAILED: -1,
  };
  const currentRank = rank[currentState] ?? 0;

  return (
    <div className="space-y-3" role="region" aria-label="PayPal Checkout State Progression">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = currentRank > stepNum || currentState === "COMPLETED";
          const isCurrent =
            currentRank === stepNum && currentState !== "COMPLETED";
          return (
            <div
              key={step.id}
              className={`rounded-lg p-3 border transition ${
                isDone
                  ? "bg-emerald-950/60 border-[#C6FF62]/60 text-slate-100"
                  : isCurrent
                    ? "bg-[#1C2742] border-[#4A7BFF] text-white"
                    : "bg-[#0B1020] border-slate-800 text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-mono font-bold text-[#C6FF62]">
                  {step.title}
                </span>
                {isDone && (
                  <CheckCircle2
                    className="w-4 h-4 text-[#C6FF62] shrink-0"
                    aria-hidden="true"
                  />
                )}
                {isCurrent && (
                  <Clock
                    className="w-4 h-4 text-[#93B4FF] shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">{step.desc}</p>
            </div>
          );
        })}
      </div>

      {currentState === "FAILED" && (
        <div className="rounded-lg bg-rose-950/80 border border-rose-500/60 p-3 flex items-center gap-2 text-xs text-rose-100">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
          <span>
            <strong>5. FAILED:</strong>{" "}
            {lang === "es"
              ? "La operación de pago o captura fue rechazada por PayPal Sandbox."
              : "PayPal Sandbox rejected the order or capture request."}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 bg-[#0B1020] border border-slate-800 rounded-lg px-3.5 py-2.5">
        <span>
          <strong>PayPal Order ID:</strong>{" "}
          <code className="text-white font-mono">
            {orderId ?? "NOT_CREATED"}
          </code>
        </span>
        <span>
          <strong>Capture ID:</strong>{" "}
          <code className="text-[#C6FF62] font-mono">
            {captureId ?? "AWAITING_APPROVAL_AND_CAPTURE"}
          </code>
        </span>
        <span>
          <strong>State:</strong>{" "}
          <code className="text-[#93B4FF] font-mono">{currentState}</code>
        </span>
      </div>
    </div>
  );
}

const ALL_FINANCIAL_STEPS: FinancialSequenceStep[] = [
  "ORDER_CREATED",
  "BUYER_APPROVED",
  "CAPTURE_COMPLETED",
  "EVIDENCE_SUBMITTED",
  "AI_ANALYZED",
  "HUMAN_APPROVED",
  "PAYOUT_ELIGIBLE",
  "PAYOUT_REQUESTED",
  "PAYOUT_SUCCESS",
];

export function FinancialSequenceRail({
  completedSteps,
}: {
  completedSteps: FinancialSequenceStep[];
}) {
  const completedSet = new Set(completedSteps);
  return (
    <ol
      className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      aria-label="Deterministic Financial Sequence"
    >
      {ALL_FINANCIAL_STEPS.map((step, index) => {
        const isDone = completedSet.has(step);
        return (
          <li
            key={step}
            className={`rounded-lg p-3 border flex items-center justify-between gap-2 text-xs ${
              isDone
                ? "bg-[#0B1020] border-[#C6FF62]/50 text-white"
                : "bg-[#0B1020]/60 border-slate-800 text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                  isDone
                    ? "bg-[#C6FF62] text-[#0B1020]"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {index + 1}
              </span>
              <span className="font-mono font-semibold truncate">{step}</span>
            </div>
            {isDone ? (
              <CheckCircle2
                className="w-4 h-4 text-[#C6FF62] shrink-0"
                aria-label="Completed"
              />
            ) : (
              <Lock
                className="w-3.5 h-3.5 text-slate-400 shrink-0"
                aria-label="Locked until prerequisites complete"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function VoIVisualComparisonBar({
  verificationFeeUsd,
  expectedUnverifiedLossUsd,
  totalLossIfWrongUsd,
  netSavingsUsd,
  recommendation,
  lang,
}: {
  verificationFeeUsd: number;
  expectedUnverifiedLossUsd: number;
  totalLossIfWrongUsd: number;
  netSavingsUsd: number;
  recommendation: string;
  lang: Lang;
}) {
  const maxRef = Math.max(
    totalLossIfWrongUsd,
    expectedUnverifiedLossUsd,
    verificationFeeUsd,
    1
  );
  const feePct = Math.min(100, Math.max(4, (verificationFeeUsd / maxRef) * 100));
  const expLossPct = Math.min(
    100,
    Math.max(4, (expectedUnverifiedLossUsd / maxRef) * 100)
  );
  const breakEvenProb =
    totalLossIfWrongUsd > 0
      ? ((verificationFeeUsd / totalLossIfWrongUsd) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="bg-[#0B1020] border border-slate-700/80 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {lang === "es"
              ? "Comparativa Económica: Coste de Verificar vs. Pérdida Esperada"
              : "Economic Comparison: Verification Cost vs. Expected Unverified Loss"}
          </h4>
          <p className="text-xs text-slate-300 mt-0.5">
            {lang === "es"
              ? `Umbral de equilibrio (Break-Even): basta un ${breakEvenProb}% de riesgo de error para amortizar la verificación.`
              : `Break-even risk threshold: a ${breakEvenProb}% mismatch probability justifies the verification fee.`}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-md text-xs font-mono font-bold ${
            recommendation === "VERIFY_BEFORE_PAYMENT"
              ? "bg-[#C6FF62] text-[#0B1020]"
              : recommendation === "ABSTAIN_VERIFICATION_TOO_EXPENSIVE"
                ? "bg-rose-950 text-rose-200 border border-rose-500/60"
                : "bg-amber-950 text-amber-200 border border-amber-500/60"
          }`}
        >
          {recommendation}
        </span>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-slate-200 font-medium">
              {lang === "es"
                ? "Coste de Verificación (PayPal Escrow)"
                : "Verification Cost (PayPal Escrow)"}
            </span>
            <span className="font-mono font-bold text-[#93B4FF]">
              ${verificationFeeUsd.toFixed(2)} USD
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4A7BFF] rounded-full"
              style={{ width: `${feePct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-slate-200 font-medium">
              {lang === "es"
                ? "Pérdida Esperada sin Verificar"
                : "Expected Loss Without Verification"}
            </span>
            <span className="font-mono font-bold text-amber-300">
              ${expectedUnverifiedLossUsd.toFixed(2)} USD
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full"
              style={{ width: `${expLossPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
        <div className="bg-[#151E32] p-3 rounded-lg border border-slate-700/70">
          <span className="text-slate-300 block">
            {lang === "es" ? "Exposición Total si Falla:" : "Total Exposure if Wrong:"}
          </span>
          <span className="text-base font-mono font-bold text-white">
            ${totalLossIfWrongUsd.toFixed(2)} USD
          </span>
        </div>
        <div className="bg-[#151E32] p-3 rounded-lg border border-slate-700/70">
          <span className="text-slate-300 block">
            {lang === "es" ? "Ahorro Neto Esperado:" : "Net Expected Savings:"}
          </span>
          <span
            className={`text-base font-mono font-bold ${
              netSavingsUsd >= 0 ? "text-[#C6FF62]" : "text-rose-300"
            }`}
          >
            {netSavingsUsd >= 0 ? "+" : ""}${netSavingsUsd.toFixed(2)} USD
          </span>
        </div>
        <div className="bg-[#151E32] p-3 rounded-lg border border-slate-700/70">
          <span className="text-slate-300 block">
            {lang === "es" ? "Umbral Break-Even:" : "Break-Even Risk:"}
          </span>
          <span className="text-base font-mono font-bold text-[#93B4FF]">
            {breakEvenProb}%
          </span>
        </div>
      </div>
    </div>
  );
}

