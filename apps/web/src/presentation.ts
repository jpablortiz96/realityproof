/**
 * Human-language presentation layer for RealityProof task state.
 *
 * IMPORTANT: this module only *describes* backend state. It never mutates it,
 * never infers funding that the backend did not record, and never upgrades a
 * trust level. Original backend codes stay available in technical drawers.
 */
import type { FundingProvenance, TaskStatus } from "@realityproof/shared";
import type { Lang } from "./i18n.js";
import type { TaskSummary } from "./types.js";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "progress";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

/* -------------------------------------------------------------------------- */
/* Funding provenance                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors the GATE 2C rule already used by the previous UI: explicit
 * funding_allocation wins; legacy records with a capture id are treated as the
 * canonical real Sandbox capture; everything else is UNFUNDED.
 */
export function fundingProvenanceOf(task: TaskSummary): FundingProvenance {
  if (task.funding_allocation?.funding_provenance) {
    return task.funding_allocation.funding_provenance;
  }
  return task.paypal_order?.captureId ? "REAL_SANDBOX_CAPTURE" : "UNFUNDED";
}

export function provenanceCopy(p: FundingProvenance, lang: Lang) {
  switch (p) {
    case "REAL_SANDBOX_CAPTURE":
      return {
        label: tr(lang, "PayPal Sandbox payment", "Pago PayPal Sandbox"),
        short: tr(lang, "Sandbox · real capture", "Sandbox · captura real"),
        explain: tr(
          lang,
          "Captured in PayPal Sandbox after buyer approval and verified remotely. Sandbox money is test money, not a production charge.",
          "Capturado en PayPal Sandbox tras la aprobación del comprador y verificado remotamente. Es dinero de prueba, no un cobro en producción."
        ),
      };
    case "HISTORICAL_SANDBOX_REPLAY":
      return {
        label: tr(lang, "Historical replay", "Replay histórico"),
        short: tr(lang, "Replay · does not fund", "Replay · no financia"),
        explain: tr(
          lang,
          "Read-only reference to a capture owned by another request. It does not fund this request and creates no payout rights.",
          "Referencia de solo lectura a una captura de otra solicitud. No financia esta solicitud ni genera derechos de pago."
        ),
      };
    case "DEMO_SYNTHETIC":
      return {
        label: tr(lang, "Demo funding", "Financiación demo"),
        short: tr(lang, "DEMO · no real funds", "DEMO · sin fondos reales"),
        explain: tr(
          lang,
          "Synthetic demo fixture. No money moved, no balance created and no payout eligibility.",
          "Fixture sintético de demostración. No se movió dinero, no crea saldo ni elegibilidad de pago."
        ),
      };
    default:
      return {
        label: tr(lang, "Not funded", "Sin financiar"),
        short: tr(lang, "Not funded", "Sin financiar"),
        explain: tr(
          lang,
          "No verification payment has been confirmed for this request yet.",
          "Todavía no se ha confirmado ningún pago de verificación para esta solicitud."
        ),
      };
  }
}

/** True only for a genuinely funded request (real Sandbox capture or labelled demo fixture). */
export function isFunded(task: TaskSummary): boolean {
  const p = fundingProvenanceOf(task);
  return (p === "REAL_SANDBOX_CAPTURE" || p === "DEMO_SYNTHETIC") && rank(task.status) >= rank("FUNDED");
}

/* -------------------------------------------------------------------------- */
/* Status ranking & classification                                             */
/* -------------------------------------------------------------------------- */

const ORDER: TaskStatus[] = [
  "DRAFT",
  "EVIDENCE_CONTRACT_DEFINED",
  "FUNDING_PENDING",
  "BLOCKED_BUYER_APPROVAL",
  "PAYMENT_FAILED",
  "FUNDED",
  "ASSIGNED",
  "SUBMITTED",
  "AI_PROCESSING",
  "AI_BLOCKED",
  "AI_ANALYZED",
  "HUMAN_REVIEWED",
  "INCONCLUSIVE",
  "REJECTED",
  "VERIFIED",
  "PROOF_PASSPORT_ISSUED",
  "PAYOUT_ELIGIBLE",
  "PAYOUT_REQUESTED",
  "PAYOUT_PENDING",
  "PAYOUTS_BLOCKED",
  "PAYOUT_SUCCESS",
  "PAYOUT_CONFIRMED",
  "EXPIRED",
];

export function rank(status: TaskStatus | string): number {
  const i = ORDER.indexOf(status as TaskStatus);
  return i === -1 ? 0 : i;
}

const REQUESTER_ACTION_STATES = new Set<string>([
  "DRAFT",
  "EVIDENCE_CONTRACT_DEFINED",
  "FUNDING_PENDING",
  "BLOCKED_BUYER_APPROVAL",
  "PAYMENT_FAILED",
]);

const TERMINAL_STATES = new Set<string>(["REJECTED", "INCONCLUSIVE", "EXPIRED"]);

export function isCompleted(task: TaskSummary): boolean {
  return task.proof_passport !== null || TERMINAL_STATES.has(task.status);
}

export function isActive(task: TaskSummary): boolean {
  return !isCompleted(task);
}

export function needsRequesterAction(task: TaskSummary): boolean {
  return REQUESTER_ACTION_STATES.has(task.status);
}

/* -------------------------------------------------------------------------- */
/* Human-language status                                                       */
/* -------------------------------------------------------------------------- */

export interface HumanStatus {
  label: string;
  description: string;
  tone: Tone;
  code: string;
}

export function humanStatus(task: TaskSummary, lang: Lang): HumanStatus {
  const p = fundingProvenanceOf(task);
  const demo = p === "DEMO_SYNTHETIC";
  const s = task.status;
  const mk = (label: string, description: string, tone: Tone): HumanStatus => ({
    label,
    description,
    tone,
    code: s,
  });
  switch (s) {
    case "DRAFT":
      return mk(tr(lang, "Draft", "Borrador"), tr(lang, "Finish defining the request.", "Termina de definir la solicitud."), "neutral");
    case "EVIDENCE_CONTRACT_DEFINED":
      return p === "HISTORICAL_SANDBOX_REPLAY"
        ? mk(
            tr(lang, "Payment pending", "Pendiente de pago"),
            tr(lang, "A historical replay is attached for inspection only. This request is still unfunded.", "Hay un replay histórico adjunto solo para inspección. La solicitud sigue sin financiar."),
            "warning"
          )
        : mk(
            tr(lang, "Payment pending", "Pendiente de pago"),
            tr(lang, "Pay the verification fee to dispatch a verifier.", "Paga la tarifa de verificación para asignar un verificador."),
            "warning"
          );
    case "FUNDING_PENDING":
    case "BLOCKED_BUYER_APPROVAL":
      return mk(
        tr(lang, "Awaiting your PayPal approval", "Esperando tu aprobación en PayPal"),
        tr(lang, "Approve the order in PayPal Sandbox, then confirm the payment here.", "Aprueba la orden en PayPal Sandbox y luego confirma el pago aquí."),
        "warning"
      );
    case "PAYMENT_FAILED":
      return mk(tr(lang, "Payment failed", "Pago fallido"), tr(lang, "PayPal Sandbox rejected the order or capture.", "PayPal Sandbox rechazó la orden o la captura."), "danger");
    case "FUNDED":
      return mk(
        demo ? tr(lang, "Funded (demo) · finding verifier", "Financiada (demo) · buscando verificador") : tr(lang, "Paid · finding verifier", "Pagada · buscando verificador"),
        tr(lang, "A field verifier will accept the mission.", "Un verificador de campo aceptará la misión."),
        "progress"
      );
    case "ASSIGNED":
      return mk(tr(lang, "Verifier assigned", "Verificador asignado"), tr(lang, "The verifier is capturing the required photos.", "El verificador está tomando las fotografías requeridas."), "progress");
    case "SUBMITTED":
      return mk(tr(lang, "Evidence received", "Evidencias recibidas"), tr(lang, "Photos received; analysis comes next.", "Fotos recibidas; a continuación se analizan."), "progress");
    case "AI_PROCESSING":
      return mk(tr(lang, "Analysing evidence", "Analizando evidencias"), tr(lang, "Gemini is inspecting the submitted images.", "Gemini está inspeccionando las imágenes."), "progress");
    case "AI_ANALYZED":
      return mk(tr(lang, "Ready for review", "Listo para revisión"), tr(lang, "A human operator will make the final decision.", "Un operador humano tomará la decisión final."), "info");
    case "AI_BLOCKED":
      return mk(tr(lang, "Manual review needed", "Revisión manual necesaria"), tr(lang, "AI analysis was unavailable; a human will review.", "El análisis de IA no estuvo disponible; revisará una persona."), "warning");
    case "HUMAN_REVIEWED":
      return mk(tr(lang, "Reviewed", "Revisada"), tr(lang, "The decision is being recorded.", "La decisión se está registrando."), "info");
    case "VERIFIED":
      return mk(tr(lang, "Review completed", "Revisión completada"), tr(lang, "Evidence review completed.", "Revisión de evidencia completada."), "success");
    case "PROOF_PASSPORT_ISSUED":
      return mk(tr(lang, "Result available", "Resultado disponible"), tr(lang, "Open the Proof Passport to see what was and wasn't confirmed.", "Abre el Proof Passport para ver qué se confirmó y qué no."), "success");
    case "INCONCLUSIVE":
      return mk(tr(lang, "Inconclusive", "No concluyente"), tr(lang, "Evidence was not sufficient for a decision.", "La evidencia no fue suficiente para decidir."), "warning");
    case "REJECTED":
      return mk(tr(lang, "Rejected", "Rechazada"), tr(lang, "The evidence did not match the contract.", "La evidencia no coincidió con el contrato."), "danger");
    case "EXPIRED":
      return mk(tr(lang, "Expired", "Expirada"), tr(lang, "The deadline passed.", "Venció el plazo."), "neutral");
    default:
      return mk(tr(lang, "Verifier payout in process", "Pago al verificador en proceso"), tr(lang, "See payment details.", "Consulta los detalles del pago."), "info");
  }
}

/* -------------------------------------------------------------------------- */
/* Requester progress (5 phases)                                               */
/* -------------------------------------------------------------------------- */

export interface Phase {
  id: string;
  label: string;
  state: "done" | "current" | "upcoming" | "blocked";
}

export function requesterPhases(task: TaskSummary, lang: Lang): Phase[] {
  const r = rank(task.status);
  const funded = isFunded(task);
  const evidence = task.evidence_artifacts.length > 0 && r >= rank("SUBMITTED");
  const reviewed = task.reviewer_decision !== null || r >= rank("INCONCLUSIVE");
  const result = task.proof_passport !== null;
  const done = [true, funded, evidence, reviewed, result];
  const labels = [
    tr(lang, "Request", "Solicitud"),
    tr(lang, "Payment", "Pago"),
    tr(lang, "Field inspection", "Inspección"),
    tr(lang, "Review", "Revisión"),
    tr(lang, "Result", "Resultado"),
  ];
  const ids = ["request", "payment", "inspection", "review", "result"];
  const firstOpen = done.findIndex((d) => !d);
  return labels.map((label, i) => ({
    id: ids[i] as string,
    label,
    state: done[i]
      ? "done"
      : i === firstOpen
        ? task.status === "PAYMENT_FAILED" || task.status === "REJECTED"
          ? "blocked"
          : "current"
        : "upcoming",
  }));
}

/* -------------------------------------------------------------------------- */
/* Payment UI state (identical mapping to the GATE 2C stepper)                 */
/* -------------------------------------------------------------------------- */

export type PaymentUiState = "NOT_CREATED" | "CREATED" | "APPROVAL_REQUIRED" | "APPROVED" | "COMPLETED" | "FAILED";

export function paymentUiState(task: TaskSummary, override: PaymentUiState | null): PaymentUiState {
  if (override) return override;
  if (!task.paypal_order) return "NOT_CREATED";
  if (task.status === "PAYMENT_FAILED") return "FAILED";
  if (task.paypal_order.status === "COMPLETED" && task.paypal_order.captureId) return "COMPLETED";
  if (task.status === "BLOCKED_BUYER_APPROVAL") return "APPROVAL_REQUIRED";
  if (task.paypal_order.status === "APPROVED") return "APPROVED";
  return "CREATED";
}

/* -------------------------------------------------------------------------- */
/* Dashboard metrics — computed only from returned data                        */
/* -------------------------------------------------------------------------- */

export interface RequesterMetrics {
  total: number;
  active: number;
  pendingAction: number;
  completed: number;
  /** Only REAL_SANDBOX_CAPTURE with a capture id and COMPLETED order. */
  realSandboxPayments: { count: number; totalUsd: number };
  demoFunded: number;
  replayAttached: number;
}

export function computeRequesterMetrics(tasks: TaskSummary[]): RequesterMetrics {
  let realCount = 0;
  let realTotal = 0;
  let demo = 0;
  let replay = 0;
  for (const t of tasks) {
    const p = fundingProvenanceOf(t);
    if (p === "REAL_SANDBOX_CAPTURE" && t.paypal_order?.status === "COMPLETED" && t.paypal_order.captureId) {
      realCount += 1;
      const amt = Number(t.paypal_order.amountUsd);
      realTotal += Number.isFinite(amt) ? amt : 0;
    } else if (p === "DEMO_SYNTHETIC") {
      demo += 1;
    } else if (p === "HISTORICAL_SANDBOX_REPLAY") {
      replay += 1;
    }
  }
  return {
    total: tasks.length,
    active: tasks.filter(isActive).length,
    pendingAction: tasks.filter(needsRequesterAction).length,
    completed: tasks.filter(isCompleted).length,
    realSandboxPayments: { count: realCount, totalUsd: Math.round(realTotal * 100) / 100 },
    demoFunded: demo,
    replayAttached: replay,
  };
}

/* -------------------------------------------------------------------------- */
/* Proof Passport outcome — never claims physical authenticity                 */
/* -------------------------------------------------------------------------- */

export interface PassportOutcome {
  headline: string;
  sub: string;
  tone: Tone;
  nextStep: string;
  approval: string;
}

export function passportOutcome(
  passport: { status: string; approval_classification?: string; synthetic_label: string },
  lang: Lang
): PassportOutcome {
  const approval =
    passport.approval_classification ??
    (passport.synthetic_label === "DEMO_SYNTHETIC" ? "APPROVED_FOR_DEMO" : "COMMERCIAL_EVIDENCE_REVIEWED");
  const physical = tr(
    lang,
    "Physical authenticity is not certified by a photo review.",
    "Una revisión fotográfica no certifica la autenticidad física."
  );
  if (passport.status === "REJECTED" || approval === "REJECTED") {
    return {
      headline: tr(lang, "Evidence rejected", "Evidencia rechazada"),
      sub: tr(lang, "The submitted evidence did not satisfy the contract.", "La evidencia enviada no cumplió el contrato."),
      tone: "danger",
      nextStep: tr(lang, "Do not pay the seller based on this evidence. Ask for clarification or request a new verification.", "No pagues al vendedor con base en esta evidencia. Pide aclaraciones o solicita una nueva verificación."),
      approval,
    };
  }
  if (passport.status === "INCONCLUSIVE" || approval === "INCONCLUSIVE") {
    return {
      headline: tr(lang, "Inconclusive result", "Resultado no concluyente"),
      sub: tr(lang, "The evidence was not sufficient to decide.", "La evidencia no fue suficiente para decidir."),
      tone: "warning",
      nextStep: tr(lang, "Request additional evidence before deciding.", "Solicita evidencia adicional antes de decidir."),
      approval,
    };
  }
  if (approval === "APPROVED_WITH_HUMAN_EXCEPTION") {
    return {
      headline: tr(lang, "Review completed with a human exception", "Revisión completada con excepción humana"),
      sub: `${tr(lang, "Some required views were waived by an operator.", "Un operador eximió algunas vistas obligatorias.")} ${physical}`,
      tone: "warning",
      nextStep: tr(lang, "Read the documented exception and consider requesting the missing views.", "Lee la excepción documentada y considera solicitar las vistas faltantes."),
      approval,
    };
  }
  if (approval === "APPROVED_FOR_DEMO") {
    return {
      headline: tr(lang, "Evidence review completed · demo only", "Revisión de evidencia completada · solo demo"),
      sub: `${tr(lang, "Built from synthetic fixtures or demo funding.", "Generada con fixtures o financiación sintética.")} ${physical}`,
      tone: "info",
      nextStep: tr(lang, "Demo result: do not use it for real commercial decisions.", "Resultado de demostración: no lo uses para decisiones comerciales reales."),
      approval,
    };
  }
  return {
    headline: tr(lang, "Evidence review completed", "Revisión de evidencia completada"),
    sub: `${tr(lang, "The submitted photos were reviewed against the contract.", "Las fotografías enviadas se revisaron frente al contrato.")} ${physical}`,
    tone: "success",
    nextStep: tr(lang, "Use this result as documentary support before paying the seller. For critical parts, inspect the item again on arrival.", "Usa este resultado como apoyo documental antes de pagar al vendedor. Para piezas críticas, vuelve a inspeccionar la pieza al recibirla."),
    approval,
  };
}

/** Strips a leading "[LABEL] " prefix for display only; the label stays visible as a tag. */
export function displayTitle(title: string): string {
  return title.replace(/^\s*\[[A-Z0-9_]+\]\s*/, "");
}

/* -------------------------------------------------------------------------- */
/* Evidence views                                                              */
/* -------------------------------------------------------------------------- */

export function viewLabel(view: string, lang: Lang): string {
  switch (view) {
    case "FRONT_PART":
      return tr(lang, "Front of part", "Frente de la pieza");
    case "SKU_LABEL_CLOSEUP":
      return tr(lang, "SKU label close-up", "Primer plano de etiqueta SKU");
    case "PACKAGING_BOX":
      return tr(lang, "Packaging box & seal", "Caja y sello de empaque");
    case "FRONT_PACKAGING":
      return tr(lang, "Front of packaging", "Frente del empaque");
    case "SKU_BARCODE_CLOSEUP":
      return tr(lang, "SKU / barcode close-up", "Primer plano del SKU / código");
    case "PART_LABEL_STAMP":
      return tr(lang, "Part label or stamp", "Etiqueta o grabado de la pieza");
    case "CONNECTOR_DETAIL":
      return tr(lang, "Connector detail", "Detalle del conector");
    default:
      return view;
  }
}

export function viewHint(view: string, lang: Lang): string {
  switch (view) {
    case "FRONT_PART":
      return tr(
        lang,
        "Full physical spare part centered in frame with clear lighting.",
        "Pieza física completa centrada en el encuadre con buena iluminación."
      );
    case "SKU_LABEL_CLOSEUP":
      return tr(
        lang,
        "Macro close-up where every character of the SKU and barcode is sharp and legible.",
        "Acercamiento nítido donde cada carácter del SKU y código de barras sea legible."
      );
    case "PACKAGING_BOX":
      return tr(
        lang,
        "Outer manufacturer box showing the unbroken security seal and label.",
        "Caja exterior del fabricante mostrando el sello de seguridad íntegro y la etiqueta."
      );
    case "FRONT_PACKAGING":
      return tr(lang, "Whole box, brand and seal visible.", "Caja completa, marca y sello visibles.");
    case "SKU_BARCODE_CLOSEUP":
      return tr(lang, "Printed SKU characters must be legible.", "Los caracteres del SKU deben ser legibles.");
    case "PART_LABEL_STAMP":
      return tr(lang, "Label or laser stamp on the part itself.", "Etiqueta o grabado láser en la pieza.");
    case "CONNECTOR_DETAIL":
      return tr(lang, "Pins and housing in focus.", "Pines y carcasa enfocados.");
    default:
      return "";
  }
}

export function isLegacyTwoViewContract(requiredViews: readonly string[]): boolean {
  return (
    requiredViews.length > 0 &&
    requiredViews.every(
      (v) =>
        v === "FRONT_PACKAGING" ||
        v === "SKU_BARCODE_CLOSEUP" ||
        v === "PART_LABEL_STAMP" ||
        v === "CONNECTOR_DETAIL"
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Verifier & Operator metrics (strictly separating real vs synthetic funds)   */
/* -------------------------------------------------------------------------- */

export interface VerifierEarningsMetrics {
  availableMissions: number;
  activeAssigned: number;
  completedInspections: number;
  /** Strictly REAL_SANDBOX_CAPTURE tasks (80% verifier share). Never includes DEMO_SYNTHETIC or replay. */
  realSandboxEligibleUsd: number;
  realSandboxReceivedUsd: number;
  realSandboxUnclaimedUsd: number;
  realSandboxTaskCount: number;
  /** Tracked separately so demo fixtures are never added to real earnings. */
  demoSimulatedUsd: number;
  demoTaskCount: number;
}

export function computeVerifierEarningsMetrics(tasks: TaskSummary[]): VerifierEarningsMetrics {
  let availableMissions = 0;
  let activeAssigned = 0;
  let completedInspections = 0;
  let realSandboxEligibleUsd = 0;
  let realSandboxReceivedUsd = 0;
  let realSandboxUnclaimedUsd = 0;
  let realSandboxTaskCount = 0;
  let demoSimulatedUsd = 0;
  let demoTaskCount = 0;

  for (const t of tasks) {
    const prov = fundingProvenanceOf(t);
    const shareUsd = Math.round(t.contract.max_verification_budget * 0.8 * 100) / 100;

    if (t.status === "FUNDED") {
      availableMissions += 1;
    } else if (
      t.status === "ASSIGNED" ||
      t.status === "SUBMITTED" ||
      t.status === "AI_PROCESSING" ||
      t.status === "AI_ANALYZED" ||
      t.status === "AI_BLOCKED"
    ) {
      activeAssigned += 1;
    } else if (t.proof_passport !== null || t.status === "VERIFIED" || t.status === "PROOF_PASSPORT_ISSUED") {
      completedInspections += 1;
    }

    if (
      prov === "REAL_SANDBOX_CAPTURE" &&
      t.paypal_order?.status === "COMPLETED" &&
      Boolean(t.paypal_order.captureId) &&
      t.funding_allocation?.is_payout_eligible_funding !== false
    ) {
      realSandboxTaskCount += 1;
      // Only a SUCCESS item is money received; a batch status says nothing about its items.
      const itemStatus = t.payout_result?.itemTransactionStatus?.toUpperCase();
      if (itemStatus === "SUCCESS") {
        realSandboxReceivedUsd = Math.round((realSandboxReceivedUsd + shareUsd) * 100) / 100;
      } else if (t.payout_result) {
        realSandboxUnclaimedUsd = Math.round((realSandboxUnclaimedUsd + shareUsd) * 100) / 100;
      } else {
        realSandboxEligibleUsd = Math.round((realSandboxEligibleUsd + shareUsd) * 100) / 100;
      }
    } else if (prov === "DEMO_SYNTHETIC") {
      demoTaskCount += 1;
      demoSimulatedUsd = Math.round((demoSimulatedUsd + shareUsd) * 100) / 100;
    }
  }

  return {
    availableMissions,
    activeAssigned,
    completedInspections,
    realSandboxEligibleUsd,
    realSandboxReceivedUsd,
    realSandboxUnclaimedUsd,
    realSandboxTaskCount,
    demoSimulatedUsd,
    demoTaskCount,
  };
}

export interface OperatorPriorityBadge {
  level: "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  label: string;
  reason: string;
  tone: Tone;
}

/**
 * Justifiable priority calculation for Operator Queue:
 * - HIGH: Funded task with submitted/analyzed evidence waiting on human decision right now.
 * - MEDIUM: Assigned task where operator requested more evidence or verifier is capturing views.
 * - BLOCKED: Unfunded or historical replay (cannot be approved).
 * - LOW: Completed / terminal tasks.
 */
export function computeOperatorPriority(task: TaskSummary, lang: Lang): OperatorPriorityBadge {
  const prov = fundingProvenanceOf(task);
  const funded = isFunded(task);
  const waitingDecision =
    funded &&
    (task.status === "AI_ANALYZED" || task.status === "AI_BLOCKED" || task.status === "SUBMITTED");

  if (waitingDecision) {
    const missingCount =
      task.evidence_completeness?.missing_views.length ??
      task.contract.required_views.filter(
        (v) => !task.evidence_artifacts.some((a) => a.view_type === v)
      ).length;
    return {
      level: "HIGH",
      label: tr(lang, "Needs decision now", "Requiere decisión ahora"),
      reason:
        missingCount > 0
          ? tr(
              lang,
              `Evidence submitted (${missingCount} mandatory view(s) missing)`,
              `Evidencia recibida (faltan ${missingCount} vista(s) obligatoria(s))`
            )
          : tr(
              lang,
              "All mandatory views submitted · ready for final review",
              "Todas las vistas obligatorias recibidas · lista para decisión"
            ),
      tone: missingCount > 0 ? "warning" : "info",
    };
  }

  if (task.status === "ASSIGNED" || task.status === "FUNDED") {
    return {
      level: "MEDIUM",
      label:
        task.reviewer_decision?.decision === "REQUEST_MORE_EVIDENCE"
          ? tr(lang, "Waiting for additional photos", "Esperando fotos adicionales")
          : tr(lang, "Field capture in progress", "Captura de campo en curso"),
      reason: tr(lang, "Assigned to field verifier", "Asignada al verificador de campo"),
      tone: "progress",
    };
  }

  if (!funded && !isCompleted(task)) {
    return {
      level: "BLOCKED",
      label:
        prov === "HISTORICAL_SANDBOX_REPLAY"
          ? tr(lang, "Replay · non-reviewable", "Replay · no revisable")
          : tr(lang, "Awaiting buyer payment", "Esperando pago del comprador"),
      reason: tr(lang, "Cannot issue Proof Passport without verified funding", "No se puede emitir Proof Passport sin pago verificado"),
      tone: "neutral",
    };
  }

  return {
    level: "LOW",
    label: tr(lang, "Decision completed", "Decisión completada"),
    reason: tr(lang, "Proof Passport already issued", "Proof Passport ya emitido"),
    tone: "success",
  };
}

/** Completeness derived from the backend report when present, otherwise from artifacts. */
export function viewCompleteness(task: TaskSummary) {
  const required = task.evidence_completeness?.required_views ?? task.contract.required_views;
  const submitted =
    task.evidence_completeness?.submitted_declared_views ??
    Array.from(new Set(task.evidence_artifacts.map((a) => a.view_type)));
  const missing = task.evidence_completeness?.missing_views ?? required.filter((v) => !submitted.includes(v));
  return {
    required: required as string[],
    submitted: submitted as string[],
    missing: missing as string[],
    satisfied: required.length - missing.length,
    status: task.evidence_completeness?.status ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Audit trail                                                                 */
/* -------------------------------------------------------------------------- */

export function humanAuditAction(action: string, lang: Lang): string {
  const a = action.toUpperCase();
  if (a.includes("CREATE") && a.includes("ORDER")) return tr(lang, "PayPal order created", "Orden PayPal creada");
  if (a.includes("CAPTURE")) return tr(lang, "PayPal payment captured", "Pago PayPal capturado");
  if (a.includes("DEMO") && a.includes("FUND")) return tr(lang, "Demo funding assigned", "Financiación demo asignada");
  if (a.includes("REPLAY")) return tr(lang, "Historical replay attached", "Replay histórico adjuntado");
  if (a.includes("ASSIGN")) return tr(lang, "Verifier accepted the mission", "El verificador aceptó la misión");
  if (a.includes("EVIDENCE") || a.includes("UPLOAD")) return tr(lang, "Photo evidence received", "Evidencia fotográfica recibida");
  if (a.includes("ANALY") || a.includes("GEMINI") || a.includes("AI_")) return tr(lang, "AI analysis recorded", "Análisis de IA registrado");
  if (a.includes("REVIEW") || a.includes("DECISION")) return tr(lang, "Human decision recorded", "Decisión humana registrada");
  if (a.includes("PASSPORT") || a.includes("PROOF")) return tr(lang, "Proof Passport issued", "Proof Passport emitido");
  if (a.includes("PAYOUT")) return tr(lang, "Verifier payout event", "Evento de pago al verificador");
  if (a.includes("CONTRACT") || a.includes("CREATED") || a.includes("REQUEST")) return tr(lang, "Request created", "Solicitud creada");
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDate(iso: string | undefined | null, lang: Lang, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(lang === "es" ? "es-MX" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatUsd(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function relativeTime(iso: string | undefined | null, lang: Lang): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "es" ? "es" : "en", { numeric: "auto" });
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 48) return rtf.format(-hrs, "hour");
  return rtf.format(-Math.round(hrs / 24), "day");
}

