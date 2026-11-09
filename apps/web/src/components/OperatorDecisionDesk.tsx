import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Cpu,
  Eye,
  FileWarning,
  Filter,
  Layers,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { RequiredView } from "@realityproof/shared";
import type { Lang } from "../i18n.js";
import type { TaskSummary } from "../types.js";
import {
  Button,
  Card,
  DataLabelTag,
  EmptyState,
  EvidenceViewer,
  InsightPanel,
  KeyValue,
  PageHeader,
  ProvenanceTag,
  StatusPill,
  TechnicalDetailsDrawer,
  Toast,
} from "../design-system/ui.js";
import {
  computeOperatorPriority,
  displayTitle,
  formatDate,
  formatUsd,
  fundingProvenanceOf,
  humanStatus,
  isLegacyTwoViewContract,
  viewCompleteness,
  viewLabel,
} from "../presentation.js";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

const PRIO_RANK: Record<"HIGH" | "MEDIUM" | "BLOCKED" | "LOW", number> = {
  HIGH: 0,
  MEDIUM: 1,
  BLOCKED: 2,
  LOW: 3,
};

export type OperatorQueueFilter =
  | "ALL"
  | "PENDING_DECISION"
  | "NEEDS_MORE_EVIDENCE"
  | "COMPLETED";

export type MobileOperatorStep =
  | "SELECT_CASE"
  | "REVIEW_EVIDENCE"
  | "CONSULT_AI"
  | "DECIDE";

export type PendingConfirmationAction = {
  decision:
    | "APPROVE"
    | "REJECT"
    | "REQUEST_MORE_EVIDENCE"
    | "APPROVE_WITH_EXCEPTION";
  label: string;
  consequence: string;
  tone: "success" | "warning" | "danger";
};

interface Props {
  tasks: TaskSummary[];
  activeTask: TaskSummary | null;
  onSelectTask: (id: string) => void;
  operatorToken: string;
  onRefresh: () => Promise<void>;
  onOpenPassport: () => void;
  lang: Lang;
  activeNavId?: string;
}

export function OperatorDecisionDesk({
  tasks,
  activeTask,
  onSelectTask,
  operatorToken,
  onRefresh,
  onOpenPassport,
  lang,
  activeNavId,
}: Props) {
  const [queueFilter, setQueueFilter] = useState<OperatorQueueFilter>("ALL");
  const [mobileStep, setMobileStep] =
    useState<MobileOperatorStep>("SELECT_CASE");

  // Decision inputs
  const [operatorNotes, setOperatorNotes] = useState<string>("");
  const [showExceptionForm, setShowExceptionForm] = useState<boolean>(false);
  const [exceptionReason, setExceptionReason] = useState<string>("");
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmationAction | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "info" | "success" | "warning" | "error";
    text: string;
  } | null>(null);

  // Sync sidebar navigation on mobile/tablet
  useEffect(() => {
    if (activeNavId === "REVIEW_QUEUE") {
      setMobileStep("SELECT_CASE");
    } else if (activeNavId === "EVIDENCES") {
      setMobileStep("REVIEW_EVIDENCE");
    } else if (activeNavId === "AUDIT_HISTORY") {
      setMobileStep("CONSULT_AI");
    } else if (activeNavId === "DECISION_CENTER") {
      setMobileStep(activeTask ? "REVIEW_EVIDENCE" : "SELECT_CASE");
    }
  }, [activeNavId, activeTask]);

  useEffect(() => {
    setPendingConfirm(null);
  }, [activeTask?.task_id]);

  /* ------------------------------------------------------------------------ */
  /* Queue Priority & Filtering                                               */
  /* ------------------------------------------------------------------------ */

  const prioritizedTasks = useMemo(() => {
    return [...tasks]
      .map((task) => ({
        task,
        priority: computeOperatorPriority(task, lang),
      }))
      .sort((a, b) => PRIO_RANK[a.priority.level] - PRIO_RANK[b.priority.level]);
  }, [tasks, lang]);

  const pendingDecisionCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.status === "AI_ANALYZED" ||
            t.status === "AI_BLOCKED" ||
            t.status === "SUBMITTED") &&
          (!t.reviewer_decision ||
            t.reviewer_decision.decision === "REQUEST_MORE_EVIDENCE")
      ).length,
    [tasks]
  );

  const filteredQueue = useMemo(() => {
    return prioritizedTasks.filter(({ task }) => {
      if (queueFilter === "PENDING_DECISION") {
        return (
          task.status === "AI_ANALYZED" ||
          task.status === "AI_BLOCKED" ||
          task.status === "SUBMITTED"
        );
      }
      if (queueFilter === "NEEDS_MORE_EVIDENCE") {
        const comp = viewCompleteness(task);
        return (
          comp.missing.length > 0 ||
          task.reviewer_decision?.decision === "REQUEST_MORE_EVIDENCE"
        );
      }
      if (queueFilter === "COMPLETED") {
        return (
          task.status === "VERIFIED" ||
          task.status === "REJECTED" ||
          task.status === "PROOF_PASSPORT_ISSUED" ||
          Boolean(task.proof_passport)
        );
      }
      return true;
    });
  }, [prioritizedTasks, queueFilter]);

  /* ------------------------------------------------------------------------ */
  /* Active Task Completeness & Smart Comparison Metrics                      */
  /* ------------------------------------------------------------------------ */

  const requiredViews = useMemo<RequiredView[]>(
    () =>
      (activeTask?.contract.required_views ?? [
        "FRONT_PART",
        "SKU_LABEL_CLOSEUP",
        "PACKAGING_BOX",
      ]) as RequiredView[],
    [activeTask]
  );

  const isLegacyContract = useMemo(
    () => isLegacyTwoViewContract(requiredViews),
    [requiredViews]
  );

  const completenessInfo = useMemo(
    () => (activeTask ? viewCompleteness(activeTask) : null),
    [activeTask]
  );

  const deliveredViews = useMemo<RequiredView[]>(
    () => (completenessInfo?.submitted ?? []) as RequiredView[],
    [completenessInfo]
  );

  const missingViews = useMemo<RequiredView[]>(
    () => (completenessInfo?.missing ?? []) as RequiredView[],
    [completenessInfo]
  );

  const duplicateViews = useMemo<RequiredView[]>(() => {
    if (!activeTask) return [];
    return (activeTask.evidence_completeness?.duplicate_declared_views ??
      []) as RequiredView[];
  }, [activeTask]);

  const isEvidenceComplete = missingViews.length === 0;

  const evidenceViewerItems = useMemo(
    () =>
      (activeTask?.evidence_artifacts ?? []).map((a) => ({
        artifact_id: a.artifact_id,
        view_label: viewLabel(a.view_type, lang),
        view_type: a.view_type,
        provenance: a.artifact_provenance,
        received_at: a.received_at_server,
      })),
    [activeTask?.evidence_artifacts, lang]
  );

  const verifierDeclaredSku = useMemo(() => {
    const firstWithSku = activeTask?.evidence_artifacts.find(
      (a) => a.verifier_declared_sku
    );
    return firstWithSku?.verifier_declared_sku ?? null;
  }, [activeTask]);

  const verifierNotesItems = useMemo(() => {
    if (!activeTask) return [];
    const items: string[] = [];
    if (verifierDeclaredSku) {
      items.push(
        `${tr(lang, "Declared SKU:", "SKU declarado:")} ${verifierDeclaredSku}`
      );
    }
    for (const a of activeTask.evidence_artifacts) {
      if (a.verifier_notes && a.verifier_notes.trim().length > 0) {
        items.push(`[${viewLabel(a.view_type, lang)}] ${a.verifier_notes}`);
      }
    }
    return items;
  }, [activeTask, verifierDeclaredSku, lang]);

  /* ------------------------------------------------------------------------ */
  /* Real Backend Actions: Gemini Inspection & Human Decision Gate            */
  /* ------------------------------------------------------------------------ */

  async function handleRunGeminiAnalysis() {
    if (!activeTask) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/analyze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${operatorToken}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || "Gemini analysis failed");
      }
      await onRefresh();
      setFeedback({
        type: "success",
        text: tr(
          lang,
          `Gemini multimodal inspection completed: SKU ${body.analysis?.observed_sku ?? "N/A"} (${body.analysis?.matches_expected}). Review advisory notes before deciding.`,
          `Inspección multimodal de Gemini completada: SKU ${body.analysis?.observed_sku ?? "N/A"} (${body.analysis?.matches_expected}). Revisa las observaciones antes de decidir.`
        ),
      });
    } catch (err) {
      await onRefresh();
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  }

  function requestDecisionConfirmation(
    decision:
      | "APPROVE"
      | "REJECT"
      | "REQUEST_MORE_EVIDENCE"
      | "APPROVE_WITH_EXCEPTION"
  ) {
    setFeedback(null);

    if (operatorNotes.trim().length < 5) {
      setFeedback({
        type: "error",
        text: tr(
          lang,
          "Please write an audit justification (at least 5 characters) before continuing.",
          "Por favor escribe una justificación de auditoría (mínimo 5 caracteres) antes de continuar."
        ),
      });
      return;
    }

    if (decision === "APPROVE" && !isEvidenceComplete) {
      setFeedback({
        type: "error",
        text: tr(
          lang,
          `Standard approval is blocked because ${missingViews.length} required view(s) are missing (${missingViews.map((v) => viewLabel(v, lang)).join(", ")}). Request additional evidence or use a documented exception.`,
          `La aprobación estándar está bloqueada porque faltan ${missingViews.length} vista(s) obligatoria(s) (${missingViews.map((v) => viewLabel(v, lang)).join(", ")}). Solicita evidencia adicional o usa una excepción documentada.`
        ),
      });
      return;
    }

    if (
      decision === "APPROVE_WITH_EXCEPTION" &&
      exceptionReason.trim().length < 10
    ) {
      setFeedback({
        type: "error",
        text: tr(
          lang,
          "Documented exception requires an explicit exception reason of at least 10 characters.",
          "La excepción documentada requiere un motivo explícito de al menos 10 caracteres."
        ),
      });
      return;
    }

    const metaMap: Record<
      typeof decision,
      {
        label: string;
        consequence: string;
        tone: "success" | "warning" | "danger";
      }
    > = {
      REQUEST_MORE_EVIDENCE: {
        label: tr(
          lang,
          "Request additional photographic evidence",
          "Solicitar evidencia fotográfica adicional"
        ),
        consequence: tr(
          lang,
          "No Proof Passport will be issued yet. The field verifier will see your rationale and upload the missing or clearer views.",
          "Aún no se emitirá el Proof Passport. El verificador de campo verá tu motivo y subirá las vistas faltantes o más nítidas."
        ),
        tone: "warning",
      },
      APPROVE: {
        label: tr(
          lang,
          "Approve physical verification & issue Proof Passport",
          "Aprobar verificación física y emitir Proof Passport"
        ),
        consequence: tr(
          lang,
          "This records a binding VERIFIED verdict, issues the cryptographically signed Proof Passport, and updates payout eligibility according to funding provenance.",
          "Registra un veredicto vinculante VERIFIED, emite el Proof Passport firmado criptográficamente y actualiza la elegibilidad de pago según la procedencia de fondos."
        ),
        tone: "success",
      },
      APPROVE_WITH_EXCEPTION: {
        label: tr(
          lang,
          "Approve with documented human exception",
          "Aprobar con excepción humana documentada"
        ),
        consequence: tr(
          lang,
          "Issues the Proof Passport while permanently recording on the certificate that required views were incomplete and approved under an explicit human exception.",
          "Emite el Proof Passport dejando constancia permanente en el certificado de que faltaban vistas obligatorias y se aprobó bajo excepción humana explícita."
        ),
        tone: "warning",
      },
      REJECT: {
        label: tr(
          lang,
          "Reject verification evidence",
          "Rechazar evidencia de verificación"
        ),
        consequence: tr(
          lang,
          "This permanently marks the verification as REJECTED, blocks Proof Passport issuance, and blocks verifier payout.",
          "Marca la verificación como REJECTED, bloquea la emisión del Proof Passport y bloquea el desembolso al verificador."
        ),
        tone: "danger",
      },
    };

    setPendingConfirm({
      decision,
      ...metaMap[decision],
    });
  }

  async function executeConfirmedDecision() {
    if (!activeTask || !pendingConfirm) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const apiDecision =
        pendingConfirm.decision === "APPROVE_WITH_EXCEPTION"
          ? "APPROVE"
          : pendingConfirm.decision;

      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${operatorToken}`,
          },
          body: JSON.stringify({
            decision: apiDecision,
            rationale: operatorNotes.trim(),
            attempt_sandbox_payout: false,
            allow_simulated_payout_dry_run: false,
            human_exception:
              pendingConfirm.decision === "APPROVE_WITH_EXCEPTION"
                ? {
                    granted: true,
                    foundation_rationale: exceptionReason.trim(),
                    scope: "Approved limited to submitted angles",
                    limitations: [
                      "Missing mandatory views waived under documented human exception",
                    ],
                  }
                : null,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || "Decision failed");
      }

      const executedDecision = pendingConfirm.decision;
      setPendingConfirm(null);
      setShowExceptionForm(false);
      await onRefresh();

      setFeedback({
        type: executedDecision === "REJECT" ? "warning" : "success",
        text:
          executedDecision === "REQUEST_MORE_EVIDENCE"
            ? tr(
                lang,
                "Additional evidence requested. The field verifier has been notified with your rationale.",
                "Evidencia adicional solicitada. El verificador de campo ha sido notificado con tu justificación."
              )
            : executedDecision === "APPROVE" ||
                executedDecision === "APPROVE_WITH_EXCEPTION"
              ? tr(
                  lang,
                  `Decision ${executedDecision} recorded. Proof Passport ${body.proof_passport?.proof_id ?? ""} issued.`,
                  `Decisión ${executedDecision} registrada. Proof Passport ${body.proof_passport?.proof_id ?? ""} emitido.`
                )
              : tr(
                  lang,
                  "Verification rejected and audit trail sealed.",
                  "Verificación rechazada y registro de auditoría sellado."
                ),
      });
    } catch (err) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  }

  const ai = activeTask?.ai_analysis ?? null;
  const currentPriority = activeTask
    ? computeOperatorPriority(activeTask, lang)
    : null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow={tr(
          lang,
          "Human Operator Decision Desk · Visual Intelligence",
          "Centro de Decisión del Operador · Inteligencia Visual"
        )}
        title={tr(
          lang,
          "Evidence Inspection & Decision Center",
          "Inspección de Evidencia y Centro de Decisión"
        )}
        subtitle={tr(
          lang,
          "Compare the buyer's contract against the submitted photos and Gemini's non-binding analysis. Every approval or rejection requires a human justification.",
          "Compara el contrato del comprador con las fotos enviadas y el análisis consultivo de Gemini. Toda aprobación o rechazo exige justificación humana."
        )}
        meta={
          <>
            <StatusPill
              label={tr(
                lang,
                `${pendingDecisionCount} pending review`,
                `${pendingDecisionCount} pendiente(s) de revisión`
              )}
              tone={pendingDecisionCount > 0 ? "warning" : "success"}
            />
            {activeTask && currentPriority && (
              <StatusPill
                label={`${tr(lang, "Priority", "Prioridad")}: ${currentPriority.label}`}
                tone={currentPriority.tone}
              />
            )}
          </>
        }
        actions={
          activeTask?.proof_passport ? (
            <Button
              variant="primary"
              icon={BadgeCheck}
              onClick={onOpenPassport}
            >
              {tr(lang, "Open Proof Passport", "Abrir Proof Passport")}
            </Button>
          ) : undefined
        }
      />

      {/* Feedback Banner */}
      {feedback && (
        <Toast
          type={feedback.type}
          text={feedback.text}
          onClose={() => setFeedback(null)}
          closeLabel={tr(lang, "Dismiss", "Cerrar")}
        />
      )}

      {/* ================================================================== */}
      {/* MOBILE / TABLET (<1024px) GUIDED 4-STEP SEQUENCE BAR               */}
      {/* ================================================================== */}
      <nav
        aria-label={tr(
          lang,
          "Mobile operator guided sequence",
          "Secuencia guiada del operador móvil"
        )}
        className="lg:hidden bg-surface border border-line rounded-[var(--radius-card)] p-2.5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              {
                id: "SELECT_CASE" as MobileOperatorStep,
                step: "1",
                label: tr(lang, "Select case", "Elegir caso"),
                badge: pendingDecisionCount,
              },
              {
                id: "REVIEW_EVIDENCE" as MobileOperatorStep,
                step: "2",
                label: tr(lang, "Evidence", "Evidencia"),
                badge: activeTask?.evidence_artifacts.length ?? 0,
              },
              {
                id: "CONSULT_AI" as MobileOperatorStep,
                step: "3",
                label: tr(lang, "Consult AI", "Consultar IA"),
              },
              {
                id: "DECIDE" as MobileOperatorStep,
                step: "4",
                label: tr(lang, "Decide", "Decidir"),
              },
            ] as const
          ).map((item) => {
            const isActive = mobileStep === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMobileStep(item.id)}
                aria-current={isActive ? "step" : undefined}
                className={`min-h-[44px] px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-1.5 transition-colors border ${
                  isActive
                    ? "bg-accent/12 border-accent/40 text-ink font-semibold"
                    : "bg-bg-elevated/50 border-transparent text-ink-2 hover:text-ink hover:bg-surface-2"
                  }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-accent text-accent-ink"
                        : "bg-surface-2 text-ink-3"
                    }`}
                  >
                    {item.step}
                  </span>
                  <span className="text-xs leading-tight">{item.label}</span>
                </div>
                {"badge" in item && item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-surface-2 text-ink-2 shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ================================================================== */}
      {/* DESKTOP 3-COLUMN WORKSPACE (lg:grid-cols-12)                       */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ---------------------------------------------------------------- */}
        {/* LEFT COLUMN (lg:col-span-3) — WORK QUEUE                         */}
        {/* ---------------------------------------------------------------- */}
        <aside
          aria-label={tr(
            lang,
            "Verification work queue",
            "Cola de trabajo de verificaciones"
          )}
          className={`lg:col-span-3 space-y-4 ${
            mobileStep === "SELECT_CASE" ? "block" : "hidden lg:block"
          }`}
        >
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">
                  {tr(lang, "Review Queue", "Cola de Revisión")}
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warn/15 text-warn border border-warn/35">
                {pendingDecisionCount}{" "}
                {tr(lang, "pending", "pendiente(s)")}
              </span>
            </div>

            {/* Filter Pills */}
            <div
              role="group"
              aria-label={tr(
                lang,
                "Filter review queue",
                "Filtrar cola de revisión"
              )}
              className="grid grid-cols-2 gap-1.5"
            >
              {(
                [
                  {
                    id: "ALL" as OperatorQueueFilter,
                    label: tr(lang, "All cases", "Todos"),
                  },
                  {
                    id: "PENDING_DECISION" as OperatorQueueFilter,
                    label: tr(lang, "Ready to decide", "Por decidir"),
                  },
                  {
                    id: "NEEDS_MORE_EVIDENCE" as OperatorQueueFilter,
                    label: tr(lang, "Missing views", "Faltan vistas"),
                  },
                  {
                    id: "COMPLETED" as OperatorQueueFilter,
                    label: tr(lang, "Decided", "Cerrados"),
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQueueFilter(f.id)}
                  aria-pressed={queueFilter === f.id}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border text-center ${
                    queueFilter === f.id
                      ? "bg-accent text-accent-ink border-accent font-semibold"
                      : "bg-bg-elevated border-line text-ink-2 hover:text-ink hover:bg-surface-2"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Queue Items */}
            {filteredQueue.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-3">
                {tr(
                  lang,
                  "No cases match the active filter.",
                  "Ningún caso coincide con el filtro activo."
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
                {filteredQueue.map(({ task, priority }) => {
                  const isSelected = activeTask?.task_id === task.task_id;
                  const st = humanStatus(task, lang);
                  const comp = viewCompleteness(task);
                  const reqCount = comp.required.length;
                  const delivCount = comp.submitted.length;

                  return (
                    <div
                      key={task.task_id}
                      className={`rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? "bg-surface-2 border-accent ring-1 ring-accent/40"
                          : "bg-bg-elevated/60 border-line hover:border-line-strong"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTask(task.task_id);
                          setMobileStep("REVIEW_EVIDENCE");
                        }}
                        className="w-full text-left space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <StatusPill
                            label={priority.label}
                            tone={priority.tone}
                            size="sm"
                          />
                          <StatusPill
                            label={st.label}
                            tone={st.tone}
                            size="sm"
                          />
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-ink leading-snug">
                            {displayTitle(task.contract.item_title)}
                          </div>
                          <div className="text-xs text-ink-2 mt-0.5">
                            {tr(lang, "Target SKU:", "SKU esperado:")}{" "}
                            <span className="font-mono text-ink font-semibold">
                              {task.contract.expected_sku}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-ink-3 leading-relaxed">
                          {priority.reason}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/60 text-xs">
                          <span
                            className={`font-medium ${
                              delivCount >= reqCount && reqCount > 0
                                ? "text-ok"
                                : "text-warn"
                            }`}
                          >
                            {tr(lang, "Photos:", "Fotos:")} {delivCount}/
                            {reqCount}
                          </span>
                          <ProvenanceTag
                            provenance={fundingProvenanceOf(task)}
                            lang={lang}
                            showCode={false}
                          />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* CENTER COLUMN (lg:col-span-5) — EVIDENCE & SMART COMPARISON      */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-label={tr(
            lang,
            "Photographic evidence & SKU comparison",
            "Evidencia fotográfica y comparación de SKU"
          )}
          className={`lg:col-span-5 space-y-5 ${
            mobileStep === "REVIEW_EVIDENCE" ? "block" : "hidden lg:block"
          }`}
        >
          {!activeTask ? (
            <EmptyState
              icon={Eye}
              title={tr(
                lang,
                "Select a verification case from the queue",
                "Selecciona un caso de la cola de trabajo"
              )}
              description={tr(
                lang,
                "Choose a case on the left to inspect its photographic angles, compare SKUs, and record a decision.",
                "Elige un caso en la cola para inspeccionar sus ángulos fotográficos, comparar SKUs y registrar una decisión."
              )}
            />
          ) : (
            <>
              {/* Case Header & Target SKU Summary */}
              <Card className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={humanStatus(activeTask, lang).label}
                      tone={humanStatus(activeTask, lang).tone}
                      code={activeTask.status}
                    />
                    <DataLabelTag label={activeTask.contract.synthetic_label} />
                    <ProvenanceTag
                      provenance={fundingProvenanceOf(activeTask)}
                      lang={lang}
                      showCode={false}
                    />
                  </div>
                  <span className="text-xs text-ink-3">
                    {formatDate(activeTask.updated_at, lang, true)}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      {displayTitle(activeTask.contract.item_title)}
                    </h2>
                    <p className="text-xs text-ink-2 mt-0.5">
                      {activeTask.contract.seller_reference} ·{" "}
                      {formatUsd(
                        activeTask.contract.max_verification_budget,
                        lang
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-bg-elevated border border-line px-3.5 py-2 shrink-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                      {tr(
                        lang,
                        "Expected Contract SKU",
                        "SKU Esperado en Contrato"
                      )}
                    </div>
                    <div className="text-base font-mono font-bold text-accent mt-0.5">
                      {activeTask.contract.expected_sku}
                    </div>
                  </div>
                </div>

                {isLegacyContract && (
                  <div className="rounded-lg bg-info/10 border border-info/30 px-3 py-2 text-xs text-ink-2">
                    <span className="font-semibold text-info">
                      {tr(
                        lang,
                        "Historical 2-View Contract Preserved:",
                        "Contrato Histórico de 2 Vistas Preservado:"
                      )}
                    </span>{" "}
                    {tr(
                      lang,
                      "This historical Sandbox verification was issued under the v0 2-angle contract (FRONT_PACKAGING, SKU_BARCODE_CLOSEUP) and is evaluated against its original signed contract.",
                      "Esta verificación histórica en Sandbox fue emitida bajo el contrato v0 de 2 ángulos (FRONT_PACKAGING, SKU_BARCODE_CLOSEUP) y se evalúa según su contrato original."
                    )}
                  </div>
                )}
              </Card>

              {/* Main Evidence Viewer (Photo, Angle Gallery, Zoom) */}
              <EvidenceViewer
                taskId={activeTask.task_id}
                items={evidenceViewerItems}
                token={operatorToken}
                lang={lang}
                emptyLabel={tr(
                  lang,
                  "No photos received for this verification yet.",
                  "Aún no se han recibido fotografías para esta verificación."
                )}
              />

              {/* Required vs Available vs Missing vs Duplicate Views Breakdown */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Layers
                      className="w-4 h-4 text-accent"
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-semibold text-ink">
                      {tr(
                        lang,
                        "Contract Photographic Views Audit",
                        "Auditoría de Vistas Fotográficas del Contrato"
                      )}
                    </h3>
                  </div>
                  <StatusPill
                    label={
                      isEvidenceComplete
                        ? tr(
                            lang,
                            `Complete (${deliveredViews.length}/${requiredViews.length} views)`,
                            `Completa (${deliveredViews.length}/${requiredViews.length} vistas)`
                          )
                        : tr(
                            lang,
                            `Incomplete (${missingViews.length} missing)`,
                            `Incompleta (faltan ${missingViews.length})`
                          )
                    }
                    tone={isEvidenceComplete ? "success" : "warning"}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {requiredViews.map((view) => {
                    const isDelivered = deliveredViews.includes(view);
                    const isDup = duplicateViews.includes(view);

                    return (
                      <div
                        key={view}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 ${
                          isDelivered
                            ? "bg-ok/8 border-ok/30"
                            : "bg-warn/8 border-warn/35"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-ink">
                            {viewLabel(view, lang)}
                          </span>
                          {isDelivered ? (
                            <CheckCircle2
                              className="w-4 h-4 text-ok shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <AlertTriangle
                              className="w-4 h-4 text-warn shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span
                            className={
                              isDelivered
                                ? "text-ok font-medium"
                                : "text-warn font-medium"
                            }
                          >
                            {isDelivered
                              ? tr(lang, "Available", "Disponible")
                              : tr(lang, "Missing", "Faltante")}
                          </span>
                          {isDup && (
                            <span className="px-1.5 py-0.5 rounded bg-info/15 text-info text-xs">
                              {tr(lang, "Duplicate", "Duplicada")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {missingViews.length > 0 && (
                  <div className="rounded-lg bg-warn/10 border border-warn/35 p-3 text-xs text-ink-2">
                    <span className="font-semibold text-warn">
                      {tr(
                        lang,
                        "Missing required views:",
                        "Vistas obligatorias faltantes:"
                      )}
                    </span>{" "}
                    {missingViews.map((v) => viewLabel(v, lang)).join(", ")}.{" "}
                    {tr(
                      lang,
                      "Standard approval is disabled until all required angles are received.",
                      "La aprobación estándar está deshabilitada hasta recibir todos los ángulos requeridos."
                    )}
                  </div>
                )}
              </Card>

              {/* GATE 3: SMART 3-WAY SKU & EVIDENCE COMPARISON MATRIX */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Scale
                      className="w-4 h-4 text-brand-2"
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-semibold text-ink">
                      {tr(
                        lang,
                        "Smart 3-Way SKU & Evidence Comparison",
                        "Comparación Inteligente Tripartita de SKU y Evidencia"
                      )}
                    </h3>
                  </div>
                  {ai && (
                    <StatusPill
                      label={
                        ai.matches_expected === "MATCH"
                          ? tr(
                              lang,
                              "Pixel SKU Match",
                              "Coincidencia SKU en Píxeles"
                            )
                          : ai.matches_expected === "MISMATCH"
                            ? tr(lang, "SKU Discrepancy", "Discrepancia de SKU")
                            : tr(
                                lang,
                                "Insufficient Evidence",
                                "Evidencia Insuficiente"
                              )
                      }
                      tone={
                        ai.matches_expected === "MATCH"
                          ? "success"
                          : ai.matches_expected === "MISMATCH"
                            ? "danger"
                            : "warning"
                      }
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* 1. Contract Expected SKU */}
                  <div className="rounded-xl bg-bg-elevated border border-line p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                        {tr(
                          lang,
                          "1. Contract Expected",
                          "1. Esperado (Contrato)"
                        )}
                      </div>
                      <div className="text-xs text-ink-3 mt-0.5">
                        {tr(
                          lang,
                          "Authoritative buyer target",
                          "Referencia contractual del comprador"
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-ink shrink-0">
                      {activeTask.contract.expected_sku}
                    </div>
                  </div>

                  {/* 2. Gemini Observed SKU from Pixels */}
                  <div
                    className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      !ai
                        ? "bg-bg-elevated border-line"
                        : ai.matches_expected === "MATCH"
                          ? "bg-ok/10 border-ok/35"
                          : ai.matches_expected === "MISMATCH"
                            ? "bg-danger/10 border-danger/35"
                            : "bg-warn/10 border-warn/35"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                        {tr(
                          lang,
                          "2. Gemini Observed (Pixels)",
                          "2. Observado por Gemini"
                        )}
                      </div>
                      <div className="text-xs text-ink-2 mt-0.5">
                        {ai
                          ? `${ai.matches_expected} · ${ai.confidence_level ?? "QUALITATIVE"}`
                          : tr(
                              lang,
                              "Run Gemini inspection to extract",
                              "Ejecuta Gemini para extraer"
                            )}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-ink shrink-0">
                      {ai
                        ? (ai.observed_sku ??
                          tr(lang, "Not legible", "No legible"))
                        : tr(lang, "Not analyzed", "Sin analizar")}
                    </div>
                  </div>

                  {/* 3. Verifier Declared SKU (Unverified Claim) */}
                  <div className="rounded-xl bg-bg-elevated border border-line p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                        {tr(
                          lang,
                          "3. Verifier Declared",
                          "3. Declarado por Verificador"
                        )}
                      </div>
                      <div className="text-xs text-warn mt-0.5">
                        {tr(
                          lang,
                          "Unverified human text claim",
                          "Declaración humana no verificada"
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-semibold text-ink-2 shrink-0">
                      {verifierDeclaredSku ??
                        tr(lang, "None declared", "No declarado")}
                    </div>
                  </div>
                </div>

                {/* Grounding & No-Fabrication Guarantee */}
                <p className="text-xs text-ink-3 leading-relaxed border-t border-line pt-3">
                  {tr(
                    lang,
                    "Grounded comparison: No synthetic bounding boxes or fabricated numeric confidence percentages are displayed. Evaluation is strictly derived from contract fields, uploaded image bytes, and qualitative Gemini observations.",
                    "Comparación fundamentada: No se muestran bounding boxes sintéticos ni porcentajes numéricos inventados. La evaluación proviene estrictamente del contrato, los bytes de imagen subidos y las observaciones cualitativas de Gemini."
                  )}
                </p>

                {/* Mobile Step Forward Button */}
                <div className="lg:hidden flex justify-between items-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ArrowLeft}
                    onClick={() => setMobileStep("SELECT_CASE")}
                  >
                    {tr(lang, "Back to queue", "Volver a la cola")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    iconRight={ArrowRight}
                    onClick={() => setMobileStep("CONSULT_AI")}
                  >
                    {tr(lang, "Next: Consult AI", "Siguiente: Consultar IA")}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT COLUMN (lg:col-span-4) — AI INSIGHTS & HUMAN DECISION GATE */}
        {/* ---------------------------------------------------------------- */}
        <aside
          aria-label={tr(
            lang,
            "AI analysis & human decision gate",
            "Análisis de IA y gate de decisión humana"
          )}
          className={`lg:col-span-4 space-y-5 ${
            mobileStep === "CONSULT_AI" || mobileStep === "DECIDE"
              ? "block"
              : "hidden lg:block"
          }`}
        >
          {activeTask && (
            <>
              {/* AI Consultation Panel */}
              <div
                className={`space-y-4 ${
                  mobileStep === "DECIDE" ? "hidden lg:block" : "block"
                }`}
              >
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-accent" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-ink">
                        {tr(
                          lang,
                          "Gemini Multimodal Advisory",
                          "Análisis Consultivo Gemini Multimodal"
                        )}
                      </h3>
                    </div>
                    <Button
                      variant={ai ? "secondary" : "primary"}
                      size="sm"
                      icon={Sparkles}
                      loading={isBusy}
                      disabled={activeTask.evidence_artifacts.length === 0}
                      onClick={() => void handleRunGeminiAnalysis()}
                    >
                      {ai
                        ? tr(lang, "Re-run Gemini", "Re-ejecutar Gemini")
                        : tr(
                            lang,
                            "Run Gemini Inspection",
                            "Ejecutar Inspección Gemini"
                          )}
                    </Button>
                  </div>

                  {!ai ? (
                    <div className="rounded-xl bg-bg-elevated border border-line p-4 space-y-2">
                      <div className="text-xs font-semibold text-ink">
                        {activeTask.status === "AI_BLOCKED"
                          ? tr(
                              lang,
                              "AI Inspection Blocked — Manual Review Enabled",
                              "Inspección IA Bloqueada — Revisión Manual Habilitada"
                            )
                          : tr(
                              lang,
                              "Gemini inspection has not been run yet",
                              "Aún no se ha ejecutado la inspección de Gemini"
                            )}
                      </div>
                      <p className="text-xs text-ink-2 leading-relaxed">
                        {activeTask.ai_blocked_reason
                          ? tr(
                              lang,
                              "Gemini automatic analysis is temporarily unavailable. You can proceed directly with manual human visual inspection of the photos.",
                              "El análisis automático de Gemini no está disponible temporalmente. Puedes proceder directamente con la inspección visual humana de las fotografías."
                            )
                          : tr(
                              lang,
                              "Run Gemini 2.5 Flash to extract SKU text from the uploaded photo bytes, or proceed directly with manual human inspection.",
                              "Ejecuta Gemini 2.5 Flash para extraer el SKU desde los píxeles de las fotos subidas, o procede directamente con la inspección manual humana."
                            )}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {/* Non-binding Recommendation & Suggested Next Action */}
                      <div className="rounded-xl bg-bg-elevated border border-line p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                            {tr(
                              lang,
                              "Non-Binding AI Recommendation",
                              "Recomendación IA No Vinculante"
                            )}
                          </span>
                          <StatusPill
                            label={
                              ai.recommended_decision ?? ai.matches_expected
                            }
                            tone={
                              ai.matches_expected === "MATCH"
                                ? "success"
                                : ai.matches_expected === "MISMATCH"
                                  ? "danger"
                                  : "warning"
                            }
                          />
                        </div>
                        <p className="text-xs text-ink font-medium leading-relaxed">
                          {tr(
                            lang,
                            "Suggested next action:",
                            "Siguiente acción sugerida:"
                          )}{" "}
                          <span className="text-ink-2 font-normal">
                            {!isEvidenceComplete
                              ? tr(
                                  lang,
                                  `Request additional evidence from the verifier for the ${missingViews.length} missing view(s) (${missingViews.map((v) => viewLabel(v, lang)).join(", ")}).`,
                                  `Solicitar evidencia adicional al verificador para la(s) ${missingViews.length} vista(s) faltante(s) (${missingViews.map((v) => viewLabel(v, lang)).join(", ")}).`
                                )
                              : ai.matches_expected === "MATCH"
                                ? tr(
                                    lang,
                                    "Verify visual clarity across all angles and approve with human rationale.",
                                    "Verificar la nitidez visual en todos los ángulos y aprobar con justificación humana."
                                  )
                                : tr(
                                    lang,
                                    "Inspect the SKU discrepancy closely and reject or request clearer evidence.",
                                    "Inspeccionar detenidamente la discrepancia de SKU y rechazar o pedir evidencia más clara."
                                  )}
                          </span>
                        </p>
                      </div>

                      {/* Visual Observations from Pixels */}
                      <InsightPanel
                        icon={Eye}
                        title={tr(
                          lang,
                          "Visual Observations (Inspected Pixels)",
                          "Observaciones Visuales (Píxeles Inspeccionados)"
                        )}
                        source={ai.model_id}
                        items={ai.visible_evidence}
                        tone="info"
                        footnote={ai.confidence_note}
                        empty={tr(
                          lang,
                          "No visual observations reported.",
                          "No se reportaron observaciones visuales."
                        )}
                      />

                      {/* Uncertainties & Limitations */}
                      <InsightPanel
                        icon={AlertTriangle}
                        title={tr(
                          lang,
                          "Uncertainties & Limitations",
                          "Incertidumbres y Limitaciones"
                        )}
                        source={
                          ai.safety_flags.length > 0
                            ? ai.safety_flags.join(", ")
                            : tr(lang, "Advisory", "Consultivo")
                        }
                        items={[
                          ...ai.limitations,
                          ...ai.additional_evidence_needed,
                          ...ai.safety_flags,
                        ]}
                        tone={
                          ai.limitations.length > 0 ||
                          ai.safety_flags.length > 0
                            ? "warning"
                            : "neutral"
                        }
                        empty={tr(
                          lang,
                          "No tampering or legibility flags detected in inspected frames.",
                          "Sin banderas de manipulación o legibilidad en los cuadros inspeccionados."
                        )}
                      />
                    </div>
                  )}

                  {/* Separated Human Verifier Declarations */}
                  <InsightPanel
                    icon={UserCheck}
                    title={tr(
                      lang,
                      "Verifier Human Declarations (Separated from AI)",
                      "Declaraciones Humanas del Verificador (Separadas de IA)"
                    )}
                    source={tr(
                      lang,
                      "Unverified human claim",
                      "Declaración humana"
                    )}
                    items={verifierNotesItems}
                    tone="neutral"
                    empty={tr(
                      lang,
                      "No additional text notes declared by the field verifier.",
                      "El verificador de campo no adjuntó notas de texto adicionales."
                    )}
                  />

                  {/* Mobile step forward to Decision */}
                  <div className="lg:hidden flex justify-between items-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={ArrowLeft}
                      onClick={() => setMobileStep("REVIEW_EVIDENCE")}
                    >
                      {tr(lang, "Back to evidence", "Volver a evidencia")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      iconRight={ArrowRight}
                      onClick={() => setMobileStep("DECIDE")}
                    >
                      {tr(
                        lang,
                        "Proceed to Decision Gate",
                        "Ir al Gate de Decisión"
                      )}
                    </Button>
                  </div>
                </Card>
              </div>

              {/* ============================================================ */}
              {/* DETERMINISTIC HUMAN DECISION GATE                            */}
              {/* ============================================================ */}
              <div
                className={`space-y-4 ${
                  mobileStep === "CONSULT_AI" ? "hidden lg:block" : "block"
                }`}
              >
                <Card className="p-5 space-y-4 border-accent/35">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck
                        className="w-4 h-4 text-accent"
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-semibold text-ink">
                        {tr(
                          lang,
                          "Deterministic Human Decision Gate",
                          "Gate Determinista de Decisión Humana"
                        )}
                      </h3>
                    </div>
                    <StatusPill
                      label={tr(
                        lang,
                        "No Auto-Approval",
                        "Sin Auto-Aprobación"
                      )}
                      tone="info"
                    />
                  </div>

                  <p className="text-xs text-ink-2 leading-relaxed">
                    {tr(
                      lang,
                      "A SKU match never automatically approves a verification. You must verify all required views, provide an explicit audit justification, and confirm your decision.",
                      "Una coincidencia de SKU nunca aprueba automáticamente una verificación. Debes verificar todas las vistas requeridas, escribir una justificación de auditoría y confirmar tu decisión."
                    )}
                  </p>

                  {/* Existing Decision Banner if already decided */}
                  {activeTask.reviewer_decision && (
                    <div className="rounded-xl bg-bg-elevated border border-line p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">
                          {tr(
                            lang,
                            "Latest Recorded Decision",
                            "Última Decisión Registrada"
                          )}
                        </span>
                        <StatusPill
                          label={activeTask.reviewer_decision.decision}
                          tone={
                            activeTask.reviewer_decision.decision === "APPROVE"
                              ? "success"
                              : activeTask.reviewer_decision.decision ===
                                  "REJECT"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </div>
                      <p className="text-xs text-ink-2">
                        {activeTask.reviewer_decision.rationale}
                      </p>
                      {activeTask.reviewer_decision.human_exception
                        ?.foundation_rationale && (
                        <p className="text-xs text-warn">
                          {tr(lang, "Exception reason:", "Motivo de excepción:")}{" "}
                          {
                            activeTask.reviewer_decision.human_exception
                              .foundation_rationale
                          }
                        </p>
                      )}
                    </div>
                  )}

                  {/* Audit Justification Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="operator-audit-rationale"
                      className="block text-xs font-semibold text-ink"
                    >
                      {tr(
                        lang,
                        "Mandatory Audit Justification (min. 5 characters)",
                        "Justificación de Auditoría Obligatoria (mín. 5 caracteres)"
                      )}
                    </label>
                    <textarea
                      id="operator-audit-rationale"
                      rows={3}
                      value={operatorNotes}
                      onChange={(e) => setOperatorNotes(e.target.value)}
                      placeholder={tr(
                        lang,
                        "Describe what you verified in the photos, why additional views are needed, or why the item passes/fails...",
                        "Describe qué verificaste en las fotografías, por qué se requieren vistas adicionales o por qué aprueba/rechaza..."
                      )}
                      className="w-full rounded-xl bg-bg-elevated border border-line px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent"
                    />

                    {/* Quick Rationale Assist Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {!isEvidenceComplete ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOperatorNotes(
                              tr(
                                lang,
                                `Missing required photographic views (${missingViews.map((v) => viewLabel(v, lang)).join(", ")}). Please capture and upload the remaining contract angles.`,
                                `Faltan vistas fotográficas obligatorias (${missingViews.map((v) => viewLabel(v, lang)).join(", ")}). Por favor captura y sube los ángulos restantes del contrato.`
                              )
                            )
                          }
                          className="px-2.5 py-1 rounded-md text-xs bg-warn/12 text-warn border border-warn/30 hover:bg-warn/20 transition-colors"
                        >
                          +{" "}
                          {tr(
                            lang,
                            "Insert missing views request rationale",
                            "Insertar motivo por vistas faltantes"
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setOperatorNotes(
                              tr(
                                lang,
                                `All ${requiredViews.length} contract views verified. Target SKU ${activeTask.contract.expected_sku} is legible on physical label and matches packaging.`,
                                `Las ${requiredViews.length} vistas del contrato fueron verificadas. El SKU ${activeTask.contract.expected_sku} es legible en la etiqueta física y coincide con el empaque.`
                              )
                            )
                          }
                          className="px-2.5 py-1 rounded-md text-xs bg-ok/12 text-ok border border-ok/30 hover:bg-ok/20 transition-colors"
                        >
                          +{" "}
                          {tr(
                            lang,
                            "Insert complete visual verification note",
                            "Insertar nota de verificación visual completa"
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* STEP 2: EXPLICIT CONFIRMATION STEP DIALOG */}
                  {pendingConfirm ? (
                    <div
                      role="region"
                      aria-label={tr(
                        lang,
                        "Confirm operator decision",
                        "Confirmar decisión del operador"
                      )}
                      className="rounded-xl bg-surface-2 border-2 border-accent p-4 space-y-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-accent">
                          {tr(
                            lang,
                            "Confirmation Required Before Execution",
                            "Confirmación Explícita Requerida"
                          )}
                        </span>
                        <StatusPill
                          label={pendingConfirm.decision}
                          tone={pendingConfirm.tone}
                        />
                      </div>

                      <div className="text-sm font-semibold text-ink">
                        {pendingConfirm.label}
                      </div>

                      <p className="text-xs text-ink-2 leading-relaxed">
                        {pendingConfirm.consequence}
                      </p>

                      <div className="rounded-lg bg-bg-elevated border border-line p-2.5 text-xs space-y-1">
                        <div className="text-ink-3 font-medium">
                          {tr(
                            lang,
                            "Audit rationale to seal:",
                            "Justificación a registrar:"
                          )}
                        </div>
                        <div className="text-ink italic">
                          "{operatorNotes.trim()}"
                        </div>
                        {pendingConfirm.decision ===
                          "APPROVE_WITH_EXCEPTION" && (
                          <div className="text-warn pt-1">
                            <span className="font-semibold">
                              {tr(
                                lang,
                                "Exception reason:",
                                "Motivo de excepción:"
                              )}
                            </span>{" "}
                            "{exceptionReason.trim()}"
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => setPendingConfirm(null)}
                        >
                          {tr(lang, "Cancel / Edit", "Cancelar / Editar")}
                        </Button>
                        <Button
                          variant={
                            pendingConfirm.tone === "danger"
                              ? "danger"
                              : "primary"
                          }
                          size="sm"
                          icon={CheckCircle2}
                          loading={isBusy}
                          onClick={() => void executeConfirmedDecision()}
                        >
                          {tr(
                            lang,
                            "Confirm & Record Decision",
                            "Confirmar y Registrar Decisión"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* STEP 1: ACTION BUTTONS (PRIORITIZED BY CONTRACT COMPLETENESS) */
                    <div className="space-y-3">
                      {!isEvidenceComplete ? (
                        <>
                          <div className="rounded-lg bg-warn/10 border border-warn/35 p-3 text-xs text-ink-2">
                            <span className="font-semibold text-warn">
                              {tr(
                                lang,
                                "Incomplete evidence contract:",
                                "Contrato de evidencia incompleto:"
                              )}
                            </span>{" "}
                            {tr(
                              lang,
                              `${missingViews.length} required photo(s) missing. Requesting additional evidence is prioritized as the primary action.`,
                              `Falta(n) ${missingViews.length} fotografía(s) obligatoria(s). Solicitar evidencia adicional se prioriza como acción principal.`
                            )}
                          </div>

                          {/* Primary CTA when views are missing: Request Additional Evidence */}
                          <Button
                            variant="primary"
                            className="w-full"
                            icon={FileWarning}
                            disabled={isBusy}
                            onClick={() =>
                              requestDecisionConfirmation(
                                "REQUEST_MORE_EVIDENCE"
                              )
                            }
                          >
                            {tr(
                              lang,
                              "Request additional evidence",
                              "Solicitar evidencia adicional"
                            )}
                          </Button>

                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              variant="secondary"
                              className="w-full"
                              disabled
                              title={tr(
                                lang,
                                "Standard approval is disabled while required views are missing",
                                "La aprobación estándar está deshabilitada mientras falten vistas obligatorias"
                              )}
                            >
                              {tr(
                                lang,
                                "Approve (Missing views)",
                                "Aprobar (Faltan vistas)"
                              )}
                            </Button>

                            <Button
                              variant="danger"
                              className="w-full"
                              icon={XCircle}
                              disabled={isBusy}
                              onClick={() =>
                                requestDecisionConfirmation("REJECT")
                              }
                            >
                              {tr(
                                lang,
                                "Reject verification",
                                "Rechazar verificación"
                              )}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Primary CTA when all views are delivered: Approve */}
                          <Button
                            variant="primary"
                            className="w-full"
                            icon={ShieldCheck}
                            disabled={isBusy}
                            onClick={() =>
                              requestDecisionConfirmation("APPROVE")
                            }
                          >
                            {tr(
                              lang,
                              "Approve & issue Passport",
                              "Aprobar y emitir Passport"
                            )}
                          </Button>

                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              variant="secondary"
                              className="w-full"
                              icon={FileWarning}
                              disabled={isBusy}
                              onClick={() =>
                                requestDecisionConfirmation(
                                  "REQUEST_MORE_EVIDENCE"
                                )
                              }
                            >
                              {tr(
                                lang,
                                "Request additional evidence",
                                "Solicitar evidencia adicional"
                              )}
                            </Button>

                            <Button
                              variant="danger"
                              className="w-full"
                              icon={XCircle}
                              disabled={isBusy}
                              onClick={() =>
                                requestDecisionConfirmation("REJECT")
                              }
                            >
                              {tr(
                                lang,
                                "Reject verification",
                                "Rechazar verificación"
                              )}
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Authorized Documented Human Exception Section */}
                      <div className="pt-2 border-t border-line">
                        <button
                          type="button"
                          onClick={() =>
                            setShowExceptionForm((prev) => !prev)
                          }
                          className="text-xs font-medium text-ink-3 hover:text-ink underline underline-offset-4"
                        >
                          {showExceptionForm
                            ? tr(
                                lang,
                                "Hide documented human exception",
                                "Ocultar excepción humana documentada"
                              )
                            : tr(
                                lang,
                                "Need to approve with a documented human exception?",
                                "¿Necesitas aprobar con una excepción humana documentada?"
                              )}
                        </button>

                        {showExceptionForm && (
                          <div className="mt-3 rounded-xl bg-warn/8 border border-warn/35 p-3.5 space-y-3">
                            <div className="text-xs font-semibold text-warn">
                              {tr(
                                lang,
                                "Authorized Human Exception (APPROVE_WITH_EXCEPTION)",
                                "Excepción Humana Autorizada (APPROVE_WITH_EXCEPTION)"
                              )}
                            </div>
                            <p className="text-xs text-ink-2 leading-relaxed">
                              {tr(
                                lang,
                                "Use only when physical identity is unambiguously proven despite a missing angle. The Proof Passport will permanently display HUMAN_APPROVED_WITH_EXCEPTION.",
                                "Úsalo solo cuando la identidad física esté probada inequívocamente pese a faltar un ángulo. El Proof Passport mostrará permanentemente HUMAN_APPROVED_WITH_EXCEPTION."
                              )}
                            </p>
                            <div>
                              <label
                                htmlFor="operator-exception-reason"
                                className="block text-xs font-semibold text-ink mb-1"
                              >
                                {tr(
                                  lang,
                                  "Documented Exception Reason (min. 10 characters)",
                                  "Motivo Documentado de Excepción (mín. 10 caracteres)"
                                )}
                              </label>
                              <input
                                id="operator-exception-reason"
                                type="text"
                                value={exceptionReason}
                                onChange={(e) =>
                                  setExceptionReason(e.target.value)
                                }
                                placeholder={tr(
                                  lang,
                                  "e.g., Outer box discarded at warehouse dock; part label & SKU verified on unit",
                                  "ej., Caja exterior descartada en muelle; etiqueta y SKU verificados en la pieza"
                                )}
                                className="w-full min-h-[40px] rounded-lg bg-bg-elevated border border-line px-3 py-1.5 text-xs text-ink"
                              />
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              icon={AlertTriangle}
                              disabled={isBusy}
                              onClick={() =>
                                requestDecisionConfirmation(
                                  "APPROVE_WITH_EXCEPTION"
                                )
                              }
                            >
                              {tr(
                                lang,
                                "Review & Confirm Exception Approval",
                                "Revisar y Confirmar Aprobación con Excepción"
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>

                {/* GATE 3: TECHNICAL DETAILS DRAWER (IDs, Hashes, Provenance, Financial Refs, History) */}
                <TechnicalDetailsDrawer
                  summary={tr(
                    lang,
                    "Cryptographic hashes, IDs, provenance & decision history",
                    "Hashes criptográficos, IDs, procedencia e historial de decisiones"
                  )}
                  hint={activeTask.task_id}
                >
                  <dl className="divide-y divide-line">
                    <KeyValue
                      label={tr(lang, "Task ID", "ID de tarea")}
                      value={activeTask.task_id}
                      mono
                      copy
                    />
                    <KeyValue
                      label={tr(lang, "Backend status", "Estado backend")}
                      value={activeTask.status}
                      mono
                    />
                    <KeyValue
                      label={tr(
                        lang,
                        "Funding provenance",
                        "Procedencia de fondos"
                      )}
                      value={fundingProvenanceOf(activeTask)}
                      mono
                    />
                    <KeyValue
                      label={tr(
                        lang,
                        "PayPal Order / Capture",
                        "Orden / Captura PayPal"
                      )}
                      value={`${activeTask.paypal_order?.orderId ?? "NONE"} / ${activeTask.paypal_order?.captureId ?? "UNCAPTURED"}`}
                      mono
                      copy={Boolean(activeTask.paypal_order?.captureId)}
                    />
                    <KeyValue
                      label={tr(
                        lang,
                        "Payout status",
                        "Estado de desembolso"
                      )}
                      value={
                        activeTask.payout_result
                          ? activeTask.payout_result.explanation
                          : activeTask.funding_allocation
                                ?.is_payout_eligible_funding
                            ? "ELIGIBLE (Real Sandbox Capture)"
                            : "NON-PAYOUT FUNDING (Demo / Unfunded)"
                      }
                      mono
                    />
                    {ai && (
                      <KeyValue
                        label={tr(lang, "AI Model", "Modelo IA")}
                        value={`${ai.model_id} (${ai.analyzed_at})`}
                        mono
                      />
                    )}
                    {activeTask.ai_blocked_reason && (
                      <KeyValue
                        label={tr(
                          lang,
                          "Last AI technical error",
                          "Último error técnico IA"
                        )}
                        value={activeTask.ai_blocked_reason}
                        mono
                      />
                    )}
                    {activeTask.evidence_artifacts.map((art) => (
                      <KeyValue
                        key={art.artifact_id}
                        label={`Artifact ${art.view_type} (${art.artifact_id})`}
                        value={`SHA-256: ${art.sha256_hex} · ${art.artifact_provenance ?? "UPLOAD"}`}
                        mono
                        copy
                      />
                    ))}
                    {(activeTask.decision_history ?? []).map((dec, idx) => (
                      <KeyValue
                        key={`${dec.reviewed_at}-${idx}`}
                        label={`Decision #${idx + 1} (${dec.decision})`}
                        value={`by ${dec.reviewer_id} at ${dec.reviewed_at}: ${dec.rationale}`}
                        mono
                      />
                    ))}
                  </dl>
                </TechnicalDetailsDrawer>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
