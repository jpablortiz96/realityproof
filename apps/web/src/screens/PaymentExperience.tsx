/**
 * Payment Experience 2.0 — Verification Funding via PayPal Sandbox (Orders v2).
 * Same endpoints, same guards as GATE 2C: create (idempotent) → buyer approval in
 * PayPal → capture (blocked server-side without approval) → remote verification.
 * Demo/replay controls are visually and semantically separated.
 */
import React from "react";
import {
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  History,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { Lang } from "../i18n.js";
import type { TaskSummary } from "../types.js";
import {
  formatUsd,
  fundingProvenanceOf,
  type PaymentUiState,
  type Phase,
} from "../presentation.js";
import {
  Button,
  Card,
  KeyValue,
  LinkButton,
  PaymentSummary,
  ProgressTimeline,
  TechnicalDetailsDrawer,
  cx,
} from "../design-system/ui.js";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

export function PaymentExperience({
  task,
  state,
  lang,
  isLoading,
  onCreateOrder,
  onVerifyRemote,
  onCapture,
  onSimulateDemo,
  onReplayHistorical,
  onTestGuard,
}: {
  task: TaskSummary;
  state: PaymentUiState;
  lang: Lang;
  isLoading: boolean;
  onCreateOrder: () => void;
  onVerifyRemote: () => void;
  onCapture: () => void;
  onSimulateDemo: () => void;
  onReplayHistorical: () => void;
  onTestGuard: () => void;
}) {
  const provenance = fundingProvenanceOf(task);
  const amount = formatUsd(task.contract.max_verification_budget, lang);
  const isDemoFunded = provenance === "DEMO_SYNTHETIC";
  const isRealCaptured = provenance === "REAL_SANDBOX_CAPTURE" && state === "COMPLETED";
  const settled = isDemoFunded || isRealCaptured;

  const stepRank: Record<PaymentUiState, number> = {
    NOT_CREATED: 0,
    CREATED: 1,
    APPROVAL_REQUIRED: 1,
    APPROVED: 2,
    COMPLETED: 4,
    FAILED: 0,
  };
  const r = isDemoFunded ? 4 : stepRank[state];
  const stepLabels = [
    tr(lang, "Order", "Orden"),
    tr(lang, "Your approval", "Tu aprobación"),
    tr(lang, "Capture", "Captura"),
    tr(lang, "Confirmed", "Confirmado"),
  ];
  const phases: Phase[] = stepLabels.map((label, i) => ({
    id: `pay-${i}`,
    label,
    state: i < r ? "done" : i === r ? (state === "FAILED" ? "blocked" : "current") : "upcoming",
  }));

  const status = (() => {
    if (isRealCaptured) return { label: tr(lang, "Payment confirmed", "Pago confirmado"), tone: "success" as const };
    if (isDemoFunded) return { label: tr(lang, "Demo funding · no real money", "Financiación demo · sin dinero real"), tone: "info" as const };
    if (state === "FAILED") return { label: tr(lang, "Payment failed", "Pago fallido"), tone: "danger" as const };
    if (state === "APPROVED") return { label: tr(lang, "Approved · ready to capture", "Aprobado · listo para capturar"), tone: "info" as const };
    if (state === "CREATED" || state === "APPROVAL_REQUIRED")
      return { label: tr(lang, "Awaiting your approval", "Esperando tu aprobación"), tone: "warning" as const };
    return { label: tr(lang, "Not paid yet", "Aún no pagado"), tone: "warning" as const };
  })();

  const approveUrl = task.paypal_order?.approveUrl ?? null;

  return (
    <div className="space-y-4">
      <Card as="section" aria-labelledby="payment-title" className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-9 h-9 rounded-lg bg-surface-2 border border-line flex items-center justify-center">
            <Wallet className="w-4 h-4 text-ink-2" aria-hidden="true" />
          </span>
          <div>
            <h2 id="payment-title" className="text-lg font-semibold text-ink tracking-tight">
              {tr(lang, "Verification payment", "Pago de la verificación")}
            </h2>
            <p className="text-[13px] text-ink-3">PayPal Sandbox · Orders v2</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Summary + status */}
          <div className="space-y-6">
            <PaymentSummary amountUsd={amount} provenance={provenance} lang={lang} statusLabel={status.label} statusTone={status.tone} />
            <ProgressTimeline phases={phases} label={tr(lang, "Payment progress", "Progreso del pago")} />
          </div>

          {/* Action required */}
          <div className="rounded-xl border border-line bg-canvas/50 p-5 flex flex-col gap-4">
            <h3 className="text-[15px] font-semibold text-ink">
              {settled ? tr(lang, "Financial confirmation", "Confirmación financiera") : tr(lang, "Action required", "Acción requerida")}
            </h3>

            {isRealCaptured && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-ok shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm text-ink font-medium">
                    {tr(lang, `${amount} captured in PayPal Sandbox and verified remotely.`, `${amount} capturados en PayPal Sandbox y verificados remotamente.`)}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    {tr(lang, "This capture belongs exclusively to this request (1-to-1).", "Esta captura pertenece exclusivamente a esta solicitud (1 a 1).")}
                  </p>
                </div>
              </div>
            )}

            {isDemoFunded && (
              <div className="flex items-start gap-3">
                <FlaskConical className="w-6 h-6 text-prov-demo shrink-0" aria-hidden="true" />
                <p className="text-sm text-ink-2">
                  {tr(
                    lang,
                    "This request was funded with a labelled DEMO_SYNTHETIC fixture. No money moved and no verifier payout can be generated from it.",
                    "Esta solicitud se financió con un fixture DEMO_SYNTHETIC etiquetado. No se movió dinero y no puede generar pagos al verificador."
                  )}
                </p>
              </div>
            )}

            {!settled && state === "NOT_CREATED" && (
              <>
                <p className="text-sm text-ink-2">
                  {tr(
                    lang,
                    "We'll create a PayPal Sandbox order. You'll approve it in PayPal, then confirm it here. Nothing is captured without your approval.",
                    "Crearemos una orden en PayPal Sandbox. La aprobarás en PayPal y luego la confirmarás aquí. Nada se captura sin tu aprobación."
                  )}
                </p>
                <Button variant="primary" size="lg" icon={Wallet} loading={isLoading} disabled={isLoading} onClick={onCreateOrder} className="w-full">
                  {tr(lang, `Pay ${amount} with PayPal Sandbox`, `Pagar ${amount} con PayPal Sandbox`)}
                </Button>
              </>
            )}

            {!settled && state === "FAILED" && (
              <>
                <p className="text-sm text-danger">
                  {tr(lang, "PayPal Sandbox rejected the order or capture. You can try creating the order again.", "PayPal Sandbox rechazó la orden o la captura. Puedes intentar crear la orden de nuevo.")}
                </p>
                <Button variant="primary" icon={RefreshCw} loading={isLoading} disabled={isLoading} onClick={onCreateOrder} className="w-full">
                  {tr(lang, "Try again", "Intentar de nuevo")}
                </Button>
              </>
            )}

            {!settled && (state === "CREATED" || state === "APPROVAL_REQUIRED" || state === "APPROVED") && (
              <ol className="space-y-3">
                <li className="space-y-2">
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">1.</span>{" "}
                    {tr(lang, "Approve the order with your PayPal Sandbox buyer account.", "Aprueba la orden con tu cuenta compradora de PayPal Sandbox.")}
                  </p>
                  {approveUrl ? (
                    <LinkButton
                      href={approveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant={state === "APPROVED" ? "secondary" : "primary"}
                      iconRight={ExternalLink}
                      className="w-full"
                    >
                      {tr(lang, "Open PayPal to approve", "Abrir PayPal para aprobar")}
                    </LinkButton>
                  ) : (
                    <p className="text-[13px] text-ink-3">{tr(lang, "Approval link unavailable.", "Enlace de aprobación no disponible.")}</p>
                  )}
                </li>
                <li className="space-y-2">
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">2.</span>{" "}
                    {tr(lang, "After approving, confirm the payment here.", "Después de aprobar, confirma el pago aquí.")}
                  </p>
                  <Button
                    variant={state === "APPROVED" ? "primary" : "secondary"}
                    icon={ShieldCheck}
                    loading={isLoading}
                    disabled={isLoading}
                    onClick={onCapture}
                    className="w-full"
                  >
                    {tr(lang, "I approved · confirm payment", "Ya aprobé · confirmar pago")}
                  </Button>
                </li>
                <li>
                  <Button variant="ghost" size="sm" icon={RefreshCw} disabled={isLoading} onClick={onVerifyRemote} className="w-full">
                    {tr(lang, "Check status in PayPal (read-only)", "Consultar estado en PayPal (solo lectura)")}
                  </Button>
                </li>
              </ol>
            )}

            <p className="flex items-start gap-2 text-[13px] text-ink-3 border-t border-line pt-3 mt-auto">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {tr(
                lang,
                "RealityProof never captures an order unless the buyer approved it in PayPal, and never pays verifiers automatically.",
                "RealityProof nunca captura una orden sin aprobación del comprador en PayPal y nunca paga automáticamente a los verificadores."
              )}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <TechnicalDetailsDrawer
            summary={tr(lang, "Payment details", "Detalles del pago")}
            hint={tr(lang, "PayPal identifiers and funding allocation record", "Identificadores PayPal y registro de asignación de fondos")}
          >
            <dl>
              <KeyValue label={tr(lang, "Funding provenance", "Procedencia de fondos")} value={provenance} mono />
              <KeyValue label="PayPal Order ID" value={task.paypal_order?.orderId ?? "NOT_CREATED"} mono copy={Boolean(task.paypal_order)} />
              <KeyValue label="PayPal Capture ID" value={task.paypal_order?.captureId ?? "—"} mono copy={Boolean(task.paypal_order?.captureId)} />
              <KeyValue label={tr(lang, "PayPal order status", "Estado de la orden PayPal")} value={task.paypal_order?.status ?? "—"} mono />
              <KeyValue label={tr(lang, "UI payment state", "Estado de pago (UI)")} value={state} mono />
              <KeyValue label={tr(lang, "Request status (backend)", "Estado de la solicitud (backend)")} value={task.status} mono />
              <KeyValue label={tr(lang, "Original capture owner", "Propietario original de la captura")} value={task.funding_allocation?.original_task_id ?? "—"} mono />
              <KeyValue
                label="is_payout_eligible_funding"
                value={String(task.funding_allocation?.is_payout_eligible_funding ?? false)}
                mono
              />
              <KeyValue
                label="creates_available_balance"
                value={String(task.funding_allocation?.creates_available_balance ?? false)}
                mono
              />
            </dl>
            {task.funding_allocation?.provenance_explanation && (
              <p className="text-[13px] text-ink-3">{task.funding_allocation.provenance_explanation}</p>
            )}
          </TechnicalDetailsDrawer>
        </div>
      </Card>

      {!settled && (
        <Card as="section" aria-labelledby="demo-options-title" className="p-5 sm:p-6 border-prov-demo/30">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-prov-demo/40 bg-prov-demo/10 text-prov-demo px-2 py-0.5 text-xs font-mono font-semibold">
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
              DEMO
            </span>
            <h3 id="demo-options-title" className="text-[15px] font-semibold text-ink">
              {tr(lang, "Demo options · no real money", "Opciones de demostración · sin dinero real")}
            </h3>
          </div>
          <p className="text-[13px] text-ink-3 mb-4 max-w-3xl">
            {tr(
              lang,
              "For evaluating the flow without a new Sandbox charge. These never fund a request with real Sandbox money and never create payout rights.",
              "Para evaluar el flujo sin un nuevo cobro en Sandbox. Nunca financian una solicitud con dinero real de Sandbox ni generan derechos de pago."
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DemoOption
              icon={FlaskConical}
              title={tr(lang, "Simulate DEMO funding", "Simular financiación DEMO")}
              body={tr(lang, "Marks the request funded with a DEMO_SYNTHETIC fixture so the mission can continue.", "Marca la solicitud como financiada con un fixture DEMO_SYNTHETIC para continuar la misión.")}
              onClick={onSimulateDemo}
              disabled={isLoading}
              tone="demo"
            />
            <DemoOption
              icon={History}
              title={tr(lang, "Attach historical replay (does not fund)", "Adjuntar replay histórico (no financia)")}
              body={tr(lang, "Links the canonical Sandbox capture read-only. The request stays unfunded.", "Vincula la captura canónica de Sandbox en solo lectura. La solicitud sigue sin financiar.")}
              onClick={onReplayHistorical}
              disabled={isLoading}
              tone="replay"
            />
            <DemoOption
              icon={ShieldAlert}
              title={tr(lang, "Test 1-to-1 capture guard", "Probar protección 1 a 1")}
              body={tr(lang, "Tries to reuse capture 0TL320715J3450828. The server must reject it.", "Intenta reutilizar la captura 0TL320715J3450828. El servidor debe rechazarlo.")}
              onClick={onTestGuard}
              disabled={isLoading}
              tone="guard"
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function DemoOption({
  icon: Icon,
  title,
  body,
  onClick,
  disabled,
  tone,
}: {
  icon: typeof FlaskConical;
  title: string;
  body: string;
  onClick: () => void;
  disabled: boolean;
  tone: "demo" | "replay" | "guard";
}) {
  const color = tone === "demo" ? "text-prov-demo" : tone === "replay" ? "text-prov-replay" : "text-danger";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left rounded-xl border border-line bg-canvas/50 hover:bg-surface-2 hover:border-line-strong p-4 transition-colors disabled:opacity-50 min-h-[44px]"
    >
      <span className={cx("flex items-center gap-2 text-sm font-semibold", color)}>
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="text-ink">{title}</span>
      </span>
      <span className="block text-[13px] text-ink-3 mt-1.5 leading-snug">{body}</span>
    </button>
  );
}

