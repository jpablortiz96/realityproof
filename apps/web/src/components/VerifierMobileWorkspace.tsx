/**
 * Verifier Mobile 3.0 — Guided Field Inspection Experience (GATE 2D-B).
 *
 * Designed mobile-first (360px / 390px / 768px / 1440px) using RealityProof
 * Design System v2 primitives. Preserves 100% of backend contracts, file magic-byte
 * validation, SHA-256 anti-replay checks, and strict separation between
 * REAL_SANDBOX_CAPTURE and DEMO_SYNTHETIC / HISTORICAL_SANDBOX_REPLAY funds.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileCheck2,
  FlaskConical,
  ImagePlus,
  PackageCheck,
  RotateCcw,
  ScanBarcode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { EvidenceArtifact, RequiredView } from "@realityproof/shared";
import type { Lang } from "../i18n.js";
import type { TaskSummary } from "../types.js";
import {
  computeVerifierEarningsMetrics,
  displayTitle,
  formatDate,
  formatUsd,
  fundingProvenanceOf,
  humanStatus,
  isLegacyTwoViewContract,
  provenanceCopy,
  relativeTime,
  viewHint,
  viewLabel,
  type Tone,
} from "../presentation.js";
import {
  Button,
  Card,
  DataLabelTag,
  EmptyState,
  EvidenceViewer,
  KeyValue,
  MetricCard,
  PageHeader,
  ProvenanceTag,
  SectionTitle,
  StatusPill,
  TechnicalDetailsDrawer,
  cx,
} from "../design-system/ui.js";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

export type VerifierSubView =
  | "ASSIGNMENTS"
  | "MISSION"
  | "CAPTURE"
  | "SUBMITTED";

type PhotoSlotState =
  | "PENDING"
  | "LOADED_LOCAL"
  | "RECEIVED_BY_SERVER"
  | "VALIDATED";

function iconForView(view: string): LucideIcon {
  switch (view) {
    case "FRONT_PART":
    case "PART_LABEL_STAMP":
      return Box;
    case "SKU_LABEL_CLOSEUP":
    case "SKU_BARCODE_CLOSEUP":
      return ScanBarcode;
    case "PACKAGING_BOX":
    case "FRONT_PACKAGING":
      return PackageCheck;
    default:
      return Camera;
  }
}

function angleInstructionForView(view: string, expectedSku: string, lang: Lang): string {
  switch (view) {
    case "FRONT_PART":
      return tr(
        lang,
        "Place the entire spare part on a clean surface at a 90° front angle. Ensure connectors, body casting, and collar are in sharp focus.",
        "Coloca la pieza completa sobre una superficie limpia en ángulo frontal de 90°. Asegúrate de que el cuerpo, conector y grabado estén bien enfocados."
      );
    case "SKU_LABEL_CLOSEUP":
    case "SKU_BARCODE_CLOSEUP":
      return tr(
        lang,
        `Move 10–15 cm from the label or laser stamp so every character of "${expectedSku}" and the barcode bars are crisp without glare.`,
        `Acércate a 10–15 cm de la etiqueta o grabado láser para que todos los caracteres de "${expectedSku}" y el código de barras se lean sin reflejos.`
      );
    case "PACKAGING_BOX":
    case "FRONT_PACKAGING":
      return tr(
        lang,
        "Frame the outer manufacturer packaging box showing the unbroken security seal and printed box label.",
        "Encuadra la caja exterior del fabricante mostrando el sello de seguridad íntegro y la etiqueta impresa del empaque."
      );
    default:
      return viewHint(view, lang);
  }
}

/** Protected thumbnail loader for Screen A task cards. */
function TaskCardThumbnail({
  task,
  token,
  lang,
}: {
  task: TaskSummary;
  token: string;
  lang: Lang;
}) {
  const firstArt = task.evidence_artifacts[0] ?? null;
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!firstArt) {
      setThumbUrl(null);
      return;
    }
    void fetch(
      `/api/v1/verification-requests/${task.task_id}/evidence/${firstArt.artifact_id}/preview`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then(async (r) =>
        r.ok ? ((await r.json()) as { data_url?: string }).data_url ?? null : null
      )
      .catch(() => null)
      .then((u) => {
        if (!cancelled) setThumbUrl(u);
      });
    return () => {
      cancelled = true;
    };
  }, [task.task_id, firstArt?.artifact_id, token]);

  if (thumbUrl) {
    return (
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-line bg-[#060a14] shrink-0 flex items-center justify-center relative">
        <img
          src={thumbUrl}
          alt={tr(
            lang,
            `Captured photo for ${displayTitle(task.contract.item_title)}`,
            `Foto capturada de ${displayTitle(task.contract.item_title)}`
          )}
          className="w-full h-full object-contain"
        />
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-canvas/90 border border-line text-xs font-mono text-lime">
          {task.evidence_artifacts.length}/{task.contract.required_views.length}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-line bg-surface-2/70 shrink-0 flex flex-col items-center justify-center gap-1.5 text-ink-3"
    >
      <Box className="w-6 h-6 text-blue-ink" />
      <span className="text-xs font-mono text-ink-2">
        0/{task.contract.required_views.length}
      </span>
    </div>
  );
}

export function VerifierMobileWorkspace({
  tasks,
  activeTask,
  onSelectTask,
  verifierToken,
  onRefresh,
  lang,
  initialSubView = "ASSIGNMENTS",
  onSubViewChange,
}: {
  tasks: TaskSummary[];
  activeTask: TaskSummary | null;
  onSelectTask: (taskId: string) => void;
  verifierToken: string;
  onRefresh: () => Promise<void>;
  lang: Lang;
  initialSubView?: VerifierSubView;
  onSubViewChange?: (view: VerifierSubView) => void;
}) {
  const [subView, setSubView] = useState<VerifierSubView>(initialSubView);
  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  const changeSubView = (next: VerifierSubView) => {
    setSubView(next);
    onSubViewChange?.(next);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Local field checklist in Screen B
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    step_lighting: true,
    step_sku_legible: true,
    step_seal_visible: true,
    step_no_pii: true,
  });

  const requiredViews = useMemo<RequiredView[]>(
    () => (activeTask?.contract.required_views ?? []) as RequiredView[],
    [activeTask?.contract.required_views]
  );

  const uploadedViews = useMemo(
    () => new Set((activeTask?.evidence_artifacts ?? []).map((a) => a.view_type)),
    [activeTask?.evidence_artifacts]
  );

  const missingRequiredViews = useMemo(
    () => requiredViews.filter((v) => !uploadedViews.has(v)),
    [requiredViews, uploadedViews]
  );

  const duplicateViews =
    activeTask?.evidence_completeness?.duplicate_declared_views ?? [];
  const completedRequiredCount = requiredViews.filter((v) =>
    uploadedViews.has(v)
  ).length;

  // Screen C — Guided Capture state
  const [selectedView, setSelectedView] = useState<RequiredView>(
    missingRequiredViews[0] ?? requiredViews[0] ?? "FRONT_PART"
  );
  const [declaredSku, setDeclaredSku] = useState<string>(
    activeTask?.contract.expected_sku ?? "FICTO-KX20-040"
  );
  const [verifierNotes, setVerifierNotes] = useState<string>(
    "Physical inspection at warehouse counter: printed SKU characters and packaging seal clearly visible."
  );
  const [consentGranted, setConsentGranted] = useState<boolean>(true);
  const [noPiiConfirmed, setNoPiiConfirmed] = useState<boolean>(true);

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<
    "image/png" | "image/jpeg" | "image/webp"
  >("image/png");
  const [previewBytes, setPreviewBytes] = useState<number>(0);
  const [previewSourceLabel, setPreviewSourceLabel] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastAcceptedArtifact, setLastAcceptedArtifact] =
    useState<EvidenceArtifact | null>(null);

  // Sync selectedView to first missing view when task or artifacts change
  useEffect(() => {
    const reqViews = (activeTask?.contract.required_views ?? []) as RequiredView[];
    const uploaded = new Set(
      (activeTask?.evidence_artifacts ?? []).map((a) => a.view_type)
    );
    const nextMissing = reqViews.find((v) => !uploaded.has(v));
    if (nextMissing) {
      setSelectedView(nextMissing);
    } else if (reqViews[0]) {
      setSelectedView(reqViews[0]);
    }
    if (activeTask?.contract.expected_sku) {
      setDeclaredSku(activeTask.contract.expected_sku);
    }
    setLastAcceptedArtifact(null);
  }, [
    activeTask?.task_id,
    activeTask?.evidence_artifacts.length,
    activeTask?.contract.expected_sku,
    activeTask?.contract.required_views,
  ]);

  const earningsMetrics = useMemo(
    () => computeVerifierEarningsMetrics(tasks),
    [tasks]
  );

  const operatorRequestedMoreEvidence =
    activeTask?.reviewer_decision?.decision === "REQUEST_MORE_EVIDENCE" &&
    activeTask.status === "ASSIGNED";

  function getSlotState(view: RequiredView): {
    state: PhotoSlotState;
    label: string;
    tone: Tone;
    artifact: TaskSummary["evidence_artifacts"][number] | null;
  } {
    const art =
      (activeTask?.evidence_artifacts ?? []).find((a) => a.view_type === view) ??
      null;
    if (art) {
      const isValidatedByReviewOrAi =
        activeTask?.status === "PROOF_PASSPORT_ISSUED" ||
        activeTask?.status === "VERIFIED" ||
        (activeTask?.ai_analysis?.matches_expected === "MATCH" &&
          (activeTask?.ai_analysis?.safety_flags.length ?? 0) === 0);
      if (isValidatedByReviewOrAi) {
        return {
          state: "VALIDATED",
          label: tr(lang, "Validated", "Validada"),
          tone: "success",
          artifact: art,
        };
      }
      return {
        state: "RECEIVED_BY_SERVER",
        label: tr(lang, "Received by server", "Recibida por servidor"),
        tone: "info",
        artifact: art,
      };
    }
    if (selectedView === view && Boolean(previewDataUrl)) {
      return {
        state: "LOADED_LOCAL",
        label: tr(lang, "Loaded · ready to send", "Cargada · lista para enviar"),
        tone: "progress",
        artifact: null,
      };
    }
    return {
      state: "PENDING",
      label: tr(lang, "Pending capture", "Pendiente de captura"),
      tone: "warning",
      artifact: null,
    };
  }

  function getRemunerationDisplay(task: TaskSummary) {
    const prov = fundingProvenanceOf(task);
    const shareUsd = task.contract.max_verification_budget * 0.8;

    if (prov === "REAL_SANDBOX_CAPTURE") {
      const isPaidOut =
        task.payout_result?.itemTransactionStatus?.toUpperCase() === "SUCCESS";
      const isUnreceived = Boolean(task.payout_result) && !isPaidOut;
      const isEligible =
        task.status === "PAYOUT_ELIGIBLE" ||
        task.status === "PROOF_PASSPORT_ISSUED";
      return {
        amountLabel: `${formatUsd(shareUsd, lang)} USD`,
        subLabel: tr(
          lang,
          `80% of ${formatUsd(task.contract.max_verification_budget, lang)} Sandbox capture`,
          `80% de la captura Sandbox de ${formatUsd(task.contract.max_verification_budget, lang)}`
        ),
        disbursementLabel: isPaidOut
          ? tr(lang, "Received in Sandbox", "Recibido en Sandbox")
          : isUnreceived
            ? tr(
                lang,
                `Payout ${task.payout_result?.itemTransactionStatus ?? "pending"} · not received`,
                `Payout ${task.payout_result?.itemTransactionStatus ?? "pendiente"} · no recibido`
              )
          : isEligible
            ? tr(lang, "Payout eligible · awaiting release", "Elegible para cobro · pendiente de liberación")
            : tr(lang, "Funded in Sandbox · complete inspection", "Financiada en Sandbox · completa la inspección"),
        tone: (isUnreceived
          ? "warning"
          : isPaidOut || isEligible
            ? "success"
            : "info") as Tone,
        isRealSandbox: true,
      };
    }

    if (prov === "DEMO_SYNTHETIC") {
      return {
        amountLabel: tr(lang, "$0.00 real · DEMO", "$0.00 real · DEMO"),
        subLabel: tr(
          lang,
          `Simulated ${formatUsd(shareUsd, lang)} fixture (non-spendable)`,
          `Fixture simulado de ${formatUsd(shareUsd, lang)} (no cobrable)`
        ),
        disbursementLabel: tr(
          lang,
          "Demo funding · no real payout",
          "Financiación demo · sin cobro real"
        ),
        tone: "warning" as Tone,
        isRealSandbox: false,
      };
    }

    if (prov === "HISTORICAL_SANDBOX_REPLAY") {
      return {
        amountLabel: "$0.00 USD",
        subLabel: tr(
          lang,
          "Historical replay owned by another request",
          "Replay histórico perteneciente a otra solicitud"
        ),
        disbursementLabel: tr(
          lang,
          "Non-spendable replay · unfunded",
          "Replay no cobrable · sin financiar"
        ),
        tone: "warning" as Tone,
        isRealSandbox: false,
      };
    }

    return {
      amountLabel: "$0.00 USD",
      subLabel: tr(
        lang,
        `Planned fee: ${formatUsd(shareUsd, lang)} once buyer pays`,
        `Remuneración prevista: ${formatUsd(shareUsd, lang)} cuando pague el comprador`
      ),
      disbursementLabel: tr(
        lang,
        "Unfunded · waiting for buyer payment",
        "Sin financiar · esperando pago del comprador"
      ),
      tone: "neutral" as Tone,
      isRealSandbox: false,
    };
  }

  async function handleStartOrOpenVerification(task: TaskSummary) {
    setFeedback(null);
    setValidationError(null);
    onSelectTask(task.task_id);
    setDeclaredSku(task.contract.expected_sku);

    if (task.status === "FUNDED") {
      setIsBusy(true);
      try {
        const res = await fetch(
          `/api/v1/verification-requests/${task.task_id}/assign`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${verifierToken}`,
            },
          }
        );
        const body = await res.json();
        if (!res.ok) {
          throw new Error(
            body.message || body.error || "Failed to accept verification task"
          );
        }
        await onRefresh();
        changeSubView("MISSION");
        setFeedback({
          type: "success",
          text: tr(
            lang,
            `Verification accepted. Review the ${task.contract.required_views.length} required photos below.`,
            `Verificación aceptada. Revisa las ${task.contract.required_views.length} fotografías obligatorias a continuación.`
          ),
        });
      } catch (err) {
        setFeedback({ type: "error", text: (err as Error).message });
      } finally {
        setIsBusy(false);
      }
      return;
    }

    changeSubView("MISSION");
  }

  async function handleLoadSyntheticFixture(
    variant: "MATCH" | "MISMATCH" | "ADVERSARIAL"
  ) {
    if (!activeTask) return;
    setValidationError(null);
    setLastAcceptedArtifact(null);
    setIsBusy(true);
    try {
      const res = await fetch(
        `/api/v1/demo/capture-fixture?variant=${variant}&task_id=${encodeURIComponent(activeTask.task_id)}`
      );
      if (!res.ok) {
        throw new Error("Could not load synthetic capture fixture");
      }
      const data = (await res.json()) as {
        variant: string;
        mime_type: "image/png";
        size_bytes: number;
        data_url: string;
      };
      setPreviewDataUrl(data.data_url);
      setPreviewMime(data.mime_type);
      setPreviewBytes(data.size_bytes);
      setPreviewSourceLabel(`DEMO_SYNTHETIC_FIXTURE (${variant})`);
      if (variant === "MISMATCH") {
        setDeclaredSku("FICTO-KX20-999");
      } else {
        setDeclaredSku(activeTask.contract.expected_sku);
      }
    } catch (err) {
      setValidationError((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    setLastAcceptedArtifact(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setValidationError(
        tr(
          lang,
          `Invalid file format (${file.type || "unknown"}). Only JPEG, PNG, or WebP are supported.`,
          `Formato no válido (${file.type || "desconocido"}). Solo se aceptan imágenes JPEG, PNG o WebP.`
        )
      );
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setValidationError(
        tr(
          lang,
          `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed size is 5.00 MB.`,
          `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(2)} MB). El límite máximo es 5.00 MB.`
        )
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPreviewDataUrl(reader.result);
        setPreviewMime(file.type as "image/jpeg" | "image/png" | "image/webp");
        setPreviewBytes(file.size);
        setPreviewSourceLabel(`CAMERA_OR_FILE_UPLOAD (${file.name})`);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRetakePhoto() {
    setPreviewDataUrl(null);
    setPreviewBytes(0);
    setPreviewSourceLabel("");
    setValidationError(null);
    setLastAcceptedArtifact(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmitCapturedEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTask) return;
    setValidationError(null);
    setFeedback(null);

    if (!declaredSku.trim()) {
      setValidationError(
        tr(
          lang,
          "Enter the SKU read from the physical part or label before sending.",
          "Indica el SKU leído en la pieza o etiqueta antes de enviar."
        )
      );
      return;
    }

    if (!consentGranted || !noPiiConfirmed) {
      setValidationError(
        tr(
          lang,
          "Confirm both inspection consent and the absence of personal data (no faces, IDs, or cards).",
          "Confirma el consentimiento de inspección y la ausencia de datos personales (sin rostros, identificaciones ni tarjetas)."
        )
      );
      return;
    }

    setIsBusy(true);
    try {
      let base64ToUpload = previewDataUrl;
      let mimeToUpload = previewMime;

      if (!base64ToUpload) {
        const fixRes = await fetch(
          `/api/v1/demo/capture-fixture?variant=MATCH&task_id=${encodeURIComponent(activeTask.task_id)}`
        );
        const fixData = (await fixRes.json()) as {
          data_url: string;
          mime_type: "image/png";
          size_bytes: number;
        };
        base64ToUpload = fixData.data_url;
        mimeToUpload = fixData.mime_type;
        setPreviewDataUrl(fixData.data_url);
        setPreviewBytes(fixData.size_bytes);
        setPreviewSourceLabel("DEMO_SYNTHETIC_FIXTURE (MATCH)");
      }

      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/evidence`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${verifierToken}`,
          },
          body: JSON.stringify({
            view_type: selectedView,
            file_base64: base64ToUpload,
            declared_mime_type: mimeToUpload,
            captured_at_declared: new Date().toISOString(),
            verifier_declared_sku: declaredSku.trim(),
            verifier_notes: verifierNotes.trim(),
            consent_granted: consentGranted,
            no_prohibited_data_confirmed: noPiiConfirmed,
          }),
        }
      );

      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.message || body.error || "Evidence upload rejected"
        );
      }

      const accepted = body.artifact as EvidenceArtifact;
      setLastAcceptedArtifact(accepted);
      setPreviewDataUrl(null);
      setPreviewBytes(0);
      setPreviewSourceLabel("");

      await onRefresh();

      const updatedTask = body.task as TaskSummary | undefined;
      const remainingMissing =
        updatedTask?.evidence_completeness?.missing_views ?? [];

      setFeedback({
        type: "success",
        text:
          remainingMissing.length > 0
            ? tr(
                lang,
                `Photo "${viewLabel(selectedView, lang)}" received by server. Next pending view: ${viewLabel(remainingMissing[0]!, lang)}.`,
                `Fotografía "${viewLabel(selectedView, lang)}" recibida por el servidor. Siguiente vista pendiente: ${viewLabel(remainingMissing[0]!, lang)}.`
              )
            : tr(
                lang,
                `All required photos received by server! Reviewing submission status.`,
                `¡Todas las fotografías obligatorias fueron recibidas por el servidor! Revisando el estado del envío.`
              ),
      });

      if (remainingMissing.length === 0) {
        changeSubView("SUBMITTED");
      } else {
        setSelectedView(remainingMissing[0] as RequiredView);
      }
    } catch (err) {
      setValidationError((err as Error).message);
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRunGeminiFromVerifier() {
    if (!activeTask) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/analyze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${verifierToken}`,
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
          `Gemini pixel inspection completed (${body.analysis?.matches_expected}). Awaiting Human Operator final decision.`,
          `Inspección de píxeles de Gemini completada (${body.analysis?.matches_expected}). Esperando decisión final del Operador humano.`
        ),
      });
    } catch (err) {
      await onRefresh();
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  }

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

  const canUploadToActiveTask =
    activeTask !== null &&
    (activeTask.status === "ASSIGNED" ||
      activeTask.status === "SUBMITTED" ||
      activeTask.status === "AI_ANALYZED" ||
      activeTask.status === "AI_BLOCKED");

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow={tr(
          lang,
          "Field Verifier Mobile · Guided Inspection",
          "Verificador Móvil de Campo · Inspección Guiada"
        )}
        title={
          subView === "ASSIGNMENTS"
            ? tr(lang, "My verification tasks", "Mis tareas de verificación")
            : subView === "MISSION"
              ? tr(lang, "Active mission briefing", "Misión de verificación activa")
              : subView === "CAPTURE"
                ? tr(lang, "Guided photo capture", "Captura fotográfica guiada")
                : tr(lang, "Submission & review status", "Resultado del envío y estado")
        }
        subtitle={
          subView === "ASSIGNMENTS"
            ? tr(
                lang,
                "Accept a funded inspection, capture the required angles, and track your Sandbox test remuneration.",
                "Acepta una inspección financiada, captura los ángulos requeridos y consulta tu remuneración de prueba en Sandbox."
              )
            : activeTask
              ? `${displayTitle(activeTask.contract.item_title)} · SKU ${activeTask.contract.expected_sku}`
              : undefined
        }
        meta={
          activeTask ? (
            <>
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
            </>
          ) : undefined
        }
      />

      {/* Guided 4-Screen Stepper Bar */}
      <nav
        aria-label={tr(lang, "Verifier workflow steps", "Pasos del verificador")}
        className="bg-surface border border-line rounded-[var(--radius-card)] p-2.5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              {
                id: "ASSIGNMENTS" as const,
                step: "1",
                label: tr(lang, "Tasks", "Tareas"),
                sub: tr(lang, `${tasks.length} total`, `${tasks.length} en lista`),
                icon: ClipboardList,
              },
              {
                id: "MISSION" as const,
                step: "2",
                label: tr(lang, "Mission", "Misión"),
                sub: activeTask
                  ? `${completedRequiredCount}/${requiredViews.length} ${tr(lang, "photos", "fotos")}`
                  : tr(lang, "Select task", "Elige tarea"),
                icon: FileCheck2,
              },
              {
                id: "CAPTURE" as const,
                step: "3",
                label: tr(lang, "Capture", "Captura"),
                sub: viewLabel(selectedView, lang),
                icon: Camera,
              },
              {
                id: "SUBMITTED" as const,
                step: "4",
                label: tr(lang, "Status", "Estado"),
                sub:
                  missingRequiredViews.length === 0
                    ? tr(lang, "Complete", "Completo")
                    : tr(
                        lang,
                        `${missingRequiredViews.length} pending`,
                        `${missingRequiredViews.length} pend.`
                      ),
                icon: CheckCircle2,
              },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const isSelected = subView === tab.id;
            return (
              <button
                key={tab.id}
                aria-current={isSelected ? "step" : undefined}
                type="button"
                onClick={() => changeSubView(tab.id)}
                className={cx(
                  "flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition-colors min-h-[48px]",
                  isSelected
                    ? "bg-surface-2 border-2 border-lime text-ink shadow-sm"
                    : "bg-canvas/60 hover:bg-surface-2/60 border border-line text-ink-2"
                )}
              >
                <span
                  className={cx(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                    isSelected
                      ? "bg-lime text-lime-ink"
                      : "bg-surface-2 text-ink-3"
                  )}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-ink leading-tight">
                    {tab.step}. {tab.label}
                  </span>
                  <span className="block text-xs text-ink-3 leading-tight mt-0.5">
                    {tab.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Inline Status / Feedback Banner */}
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cx(
            "p-4 rounded-xl border text-sm flex flex-wrap items-center justify-between gap-3",
            feedback.type === "success"
              ? "bg-ok/10 border-ok/40 text-ink"
              : feedback.type === "error"
                ? "bg-danger/10 border-danger/40 text-ink"
                : "bg-blue/10 border-blue/40 text-ink"
          )}
        >
          <span className="flex-1 min-w-0">{feedback.text}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFeedback(null)}
          >
            {tr(lang, "Dismiss", "Cerrar")}
          </Button>
        </div>
      )}

      {/* Operator Request More Evidence Alert */}
      {operatorRequestedMoreEvidence && activeTask?.reviewer_decision && (
        <Card
          as="section"
          role="alert"
          className="p-5 border-2 border-warn/60 bg-warn/[0.07] space-y-3"
        >
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-warn/15 border border-warn/40 text-warn flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base font-semibold text-ink">
                {tr(
                  lang,
                  "Operator requested additional photo evidence",
                  "El operador solicitó evidencia fotográfica adicional"
                )}
              </h2>
              <p className="text-sm text-ink-2">
                <strong className="text-ink">
                  {tr(lang, "Reason:", "Motivo:")}
                </strong>{" "}
                {activeTask.reviewer_decision.rationale}
              </p>
              {missingRequiredViews.length > 0 && (
                <p className="text-[13px] text-warn font-medium">
                  {tr(lang, "Pending views:", "Vistas pendientes:")}{" "}
                  {missingRequiredViews
                    .map((v) => viewLabel(v, lang))
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              icon={Camera}
              onClick={() => changeSubView("CAPTURE")}
            >
              {tr(
                lang,
                "Capture requested photo now",
                "Capturar foto solicitada ahora"
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ================================================================== */}
      {/* SCREEN A — MY TASKS (MIS TAREAS)                                   */}
      {/* ================================================================== */}
      {subView === "ASSIGNMENTS" && (
        <section
          aria-label={tr(lang, "My Verification Tasks", "Mis Tareas de Verificación")}
          className="space-y-6"
        >
          {/* Concise Remuneration & Queue Summary (never adds DEMO_SYNTHETIC to real earnings) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label={tr(lang, "Available & active tasks", "Tareas disponibles y activas")}
              value={earningsMetrics.availableMissions + earningsMetrics.activeAssigned}
              hint={tr(
                lang,
                `${earningsMetrics.availableMissions} ready to accept · ${earningsMetrics.activeAssigned} in progress`,
                `${earningsMetrics.availableMissions} listas para aceptar · ${earningsMetrics.activeAssigned} en curso`
              )}
              icon={ClipboardList}
              emphasis
            />
            <MetricCard
              label={tr(lang, "Sandbox payouts received", "Payouts Sandbox recibidos")}
              value={formatUsd(earningsMetrics.realSandboxReceivedUsd, lang)}
              hint={tr(
                lang,
                `${formatUsd(earningsMetrics.realSandboxUnclaimedUsd, lang)} unclaimed, not received · ${formatUsd(earningsMetrics.realSandboxEligibleUsd, lang)} eligible. Test money from ${earningsMetrics.realSandboxTaskCount} REAL_SANDBOX_CAPTURE contract(s); demos excluded.`,
                `${formatUsd(earningsMetrics.realSandboxUnclaimedUsd, lang)} sin reclamar, no recibidos · ${formatUsd(earningsMetrics.realSandboxEligibleUsd, lang)} elegibles. Dinero de prueba de ${earningsMetrics.realSandboxTaskCount} contrato(s) REAL_SANDBOX_CAPTURE; excluye demos.`
              )}
              icon={Wallet}
            />
            <MetricCard
              label={tr(lang, "Completed inspections", "Inspecciones completadas")}
              value={earningsMetrics.completedInspections}
              hint={
                earningsMetrics.demoTaskCount > 0
                  ? tr(
                      lang,
                      `${earningsMetrics.demoTaskCount} demo task(s) (${formatUsd(earningsMetrics.demoSimulatedUsd, lang)} simulated · $0 real)`,
                      `${earningsMetrics.demoTaskCount} tarea(s) demo (${formatUsd(earningsMetrics.demoSimulatedUsd, lang)} simulados · $0 real)`
                    )
                  : tr(
                      lang,
                      "Verified with issued Proof Passport",
                      "Verificadas con Proof Passport emitido"
                    )
              }
              icon={CheckCircle2}
            />
          </div>

          <SectionTitle
            title={tr(lang, "Assigned & available verifications", "Verificaciones asignadas y disponibles")}
            subtitle={tr(
              lang,
              "Each card shows the product, deadline, required photos, and the exact difference between expected remuneration and real disbursement state.",
              "Cada tarjeta muestra el producto, fecha límite, fotos requeridas y la diferencia exacta entre remuneración prevista y estado real de desembolso."
            )}
          />

          {tasks.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardList}
                title={tr(lang, "No verification tasks yet", "Aún no hay tareas de verificación")}
                description={tr(
                  lang,
                  "When a buyer funds a verification request, it will appear here ready for field capture.",
                  "Cuando un comprador financie una solicitud de verificación, aparecerá aquí lista para captura en campo."
                )}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const isCurrent = task.task_id === activeTask?.task_id;
                const st = humanStatus(task, lang);
                const rem = getRemunerationDisplay(task);
                const prov = fundingProvenanceOf(task);
                const reqViews = task.contract.required_views;
                const upSet = new Set(
                  task.evidence_artifacts.map((a) => a.view_type)
                );
                const missingViews = reqViews.filter((v) => !upSet.has(v));
                const canStart =
                  task.status === "FUNDED" ||
                  task.status === "ASSIGNED" ||
                  task.status === "SUBMITTED" ||
                  task.status === "AI_ANALYZED" ||
                  task.status === "AI_BLOCKED";

                return (
                  <Card
                    as="article"
                    key={task.task_id}
                    className={cx(
                      "p-5 space-y-4 transition-colors",
                      isCurrent && "border-lime/70"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <TaskCardThumbnail
                        task={task}
                        token={verifierToken}
                        lang={lang}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill
                              label={st.label}
                              tone={st.tone}
                              code={task.status}
                              size="sm"
                            />
                            <DataLabelTag label={task.contract.synthetic_label} />
                          </div>
                          <span className="text-xs text-ink-3 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-ink" aria-hidden="true" />
                            <span>
                              {tr(lang, "Due", "Límite")}:{" "}
                              <strong className="text-ink-2">
                                {formatDate(task.contract.deadline_at, lang)}
                              </strong>{" "}
                              ({relativeTime(task.contract.deadline_at, lang)})
                            </span>
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base sm:text-lg font-semibold text-ink leading-snug">
                            {displayTitle(task.contract.item_title)}
                          </h3>
                          <p className="text-sm text-ink-2 mt-0.5">
                            {tr(
                              lang,
                              `Inspect at ${task.contract.seller_reference} · Verify SKU `,
                              `Inspeccionar en ${task.contract.seller_reference} · Comprobar SKU `
                            )}
                            <code className="font-mono font-semibold text-lime">
                              {task.contract.expected_sku}
                            </code>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Expected Remuneration vs Real Disbursement Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-canvas/70 border border-line p-3.5">
                      <div>
                        <span className="text-xs text-ink-3 block">
                          {tr(
                            lang,
                            "Expected verifier remuneration (80%)",
                            "Remuneración prevista del verificador (80%)"
                          )}
                        </span>
                        <div className="text-base font-semibold text-ink tabular mt-0.5">
                          {rem.amountLabel}
                        </div>
                        <span className="text-xs text-ink-3 block mt-0.5">
                          {rem.subLabel}
                        </span>
                      </div>
                      <div className="flex flex-col justify-between items-start sm:items-end">
                        <span className="text-xs text-ink-3">
                          {tr(
                            lang,
                            "Real disbursement & funding state",
                            "Estado real de desembolso y fondos"
                          )}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusPill
                            label={rem.disbursementLabel}
                            tone={rem.tone}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Required Photos Summary Chips */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-ink-3 font-medium mr-1">
                          {tr(lang, "Required photos:", "Fotos requeridas:")}
                        </span>
                        {reqViews.map((v) => {
                          const done = upSet.has(v);
                          return (
                            <span
                              key={v}
                              className={cx(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium",
                                done
                                  ? "bg-ok/10 border-ok/35 text-ok"
                                  : "bg-surface-2 border-line text-ink-2"
                              )}
                            >
                              {done ? (
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                <Camera className="w-3.5 h-3.5 text-ink-3" aria-hidden="true" />
                              )}
                              <span>{viewLabel(v, lang)}</span>
                            </span>
                          );
                        })}
                      </div>
                      <span className="text-ink-3 font-mono">
                        {reqViews.length - missingViews.length}/{reqViews.length}{" "}
                        {tr(lang, "received", "recibidas")}
                      </span>
                    </div>

                    {/* Primary CTA ("Comenzar verificación") + Technical Details Drawer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-line">
                      <span className="text-xs text-ink-3">
                        {canStart
                          ? missingViews.length > 0
                            ? tr(
                                lang,
                                `Next: capture ${viewLabel(missingViews[0]!, lang)}`,
                                `Siguiente: capturar ${viewLabel(missingViews[0]!, lang)}`
                              )
                            : tr(
                                lang,
                                "All required views uploaded · check status",
                                "Todas las vistas subidas · revisar estado"
                              )
                          : task.proof_passport
                            ? tr(
                                lang,
                                "Inspection completed & Proof Passport issued",
                                "Inspección completada y Proof Passport emitido"
                              )
                            : tr(
                                lang,
                                "Waiting for buyer payment before starting field capture",
                                "Esperando el pago del comprador antes de iniciar captura"
                              )}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {canStart ? (
                          <Button
                            variant="primary"
                            iconRight={ArrowRight}
                            loading={isBusy && isCurrent}
                            onClick={() => void handleStartOrOpenVerification(task)}
                          >
                            {tr(lang, "Start verification", "Comenzar verificación")}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            iconRight={ArrowRight}
                            onClick={() => {
                              onSelectTask(task.task_id);
                              changeSubView(
                                task.proof_passport ? "SUBMITTED" : "MISSION"
                              );
                            }}
                          >
                            {task.proof_passport
                              ? tr(lang, "View submission result", "Ver resultado de envío")
                              : tr(lang, "Preview mission details", "Ver detalles de misión")}
                          </Button>
                        )}
                      </div>
                    </div>

                    <TechnicalDetailsDrawer
                      summary={tr(
                        lang,
                        "Technical identifiers & funding provenance",
                        "Identificadores técnicos y procedencia financiera"
                      )}
                      hint={task.task_id}
                    >
                      <dl className="divide-y divide-line">
                        <KeyValue
                          label={tr(lang, "Task ID", "ID de tarea")}
                          value={task.task_id}
                          mono
                          copy
                        />
                        <KeyValue
                          label={tr(lang, "Backend status code", "Código de estado")}
                          value={task.status}
                          mono
                        />
                        <KeyValue
                          label={tr(lang, "Funding provenance", "Procedencia de fondos")}
                          value={`${prov} — ${provenanceCopy(prov, lang).explain}`}
                          mono
                        />
                        <KeyValue
                          label={tr(lang, "PayPal Order ID", "ID de Orden PayPal")}
                          value={task.paypal_order?.orderId ?? "NONE"}
                          mono
                          copy={Boolean(task.paypal_order?.orderId)}
                        />
                        <KeyValue
                          label={tr(lang, "PayPal Capture ID", "ID de Captura PayPal")}
                          value={task.paypal_order?.captureId ?? "UNCAPTURED"}
                          mono
                          copy={Boolean(task.paypal_order?.captureId)}
                        />
                        <KeyValue
                          label={tr(lang, "Required view codes", "Códigos de vistas requeridas")}
                          value={reqViews.join(", ")}
                          mono
                        />
                      </dl>
                    </TechnicalDetailsDrawer>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ================================================================== */}
      {/* SCREEN B — ACTIVE MISSION (MISIÓN ACTIVA)                          */}
      {/* ================================================================== */}
      {subView === "MISSION" && activeTask && (
        <section
          aria-label={tr(
            lang,
            "Active Verification Mission",
            "Misión de Verificación Activa"
          )}
          className="space-y-6"
        >
          {/* Product Briefing & Target SKU Card */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-ink-3 uppercase tracking-wider">
                  {tr(lang, "Product to verify", "Producto a verificar")}
                </span>
                <h2 className="text-xl font-semibold text-ink">
                  {displayTitle(activeTask.contract.item_title)}
                </h2>
                <p className="text-sm text-ink-2">
                  {tr(lang, "Location:", "Ubicación:")}{" "}
                  <strong className="text-ink">
                    {activeTask.contract.seller_reference}
                  </strong>
                </p>
              </div>

              <div className="rounded-xl bg-canvas border border-lime/40 px-4 py-3 text-left sm:text-right">
                <span className="text-xs text-ink-3 block">
                  {tr(lang, "Expected SKU on part", "SKU esperado en la pieza")}
                </span>
                <code className="text-lg font-mono font-bold text-lime">
                  {activeTask.contract.expected_sku}
                </code>
              </div>
            </div>

            {/* Verification Progress Bar */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">
                  {tr(
                    lang,
                    `Photo verification progress (${completedRequiredCount} of ${requiredViews.length} mandatory photos received)`,
                    `Progreso de verificación fotográfica (${completedRequiredCount} de ${requiredViews.length} fotos obligatorias recibidas)`
                  )}
                </span>
                <span className="text-xs font-mono text-ink-2">
                  {Math.round(
                    (completedRequiredCount / Math.max(requiredViews.length, 1)) *
                      100
                  )}
                  %
                </span>
              </div>
              <div
                className="h-2.5 rounded-full bg-surface-3 overflow-hidden"
                role="progressbar"
                aria-valuenow={completedRequiredCount}
                aria-valuemin={0}
                aria-valuemax={requiredViews.length}
                aria-label={tr(
                  lang,
                  "Mandatory photo progress",
                  "Progreso de fotos obligatorias"
                )}
              >
                <div
                  className="h-full bg-lime transition-[width] duration-300"
                  style={{
                    width: `${
                      (completedRequiredCount /
                        Math.max(requiredViews.length, 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Historical 2-View Compatibility Banner (when inspecting historical contracts) */}
            {isLegacyTwoViewContract(requiredViews) && (
              <div className="rounded-xl border border-blue/40 bg-blue/10 p-3.5 text-[13px] text-ink-2 flex items-start gap-2.5">
                <ShieldCheck
                  className="w-4 h-4 text-blue-ink shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  {tr(
                    lang,
                    `Historical Contract Compatibility: This request (${activeTask.task_id}) was issued under the original 2-view specification (${requiredViews.join(", ")}). Its original contract is preserved without silent modification. New canonical requests require 3 views (FRONT_PART, SKU_LABEL_CLOSEUP, PACKAGING_BOX).`,
                    `Compatibilidad de contrato histórico: Esta solicitud (${activeTask.task_id}) fue emitida bajo la especificación original de 2 vistas (${requiredViews.join(", ")}). Se preserva su contrato original sin modificaciones silenciosas. Los nuevos contratos canónicos exigen 3 vistas (FRONT_PART, SKU_LABEL_CLOSEUP, PACKAGING_BOX).`
                  )}
                </span>
              </div>
            )}

            {/* Mandatory Visual Photo Slots (3 Canonical Slots or Historical Contract Slots) */}
            <div className="space-y-3">
              <SectionTitle
                title={tr(
                  lang,
                  `Required photograph slots (${requiredViews.length})`,
                  `Ranuras de fotografías obligatorias (${requiredViews.length})`
                )}
                subtitle={tr(
                  lang,
                  "Each slot tracks its real state: Pending → Loaded on device → Received by server → Validated. Simply labeling a photo does not make it valid.",
                  "Cada ranura muestra su estado real: Pendiente → Cargada → Recibida por servidor → Validada. Etiquetar una imagen no la da por válida automáticamente."
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {requiredViews.map((view, idx) => {
                  const slot = getSlotState(view);
                  const ViewIcon = iconForView(view);
                  const isCurrentTarget = selectedView === view;

                  return (
                    <Card
                      key={view}
                      as="article"
                      className={cx(
                        "p-4 flex flex-col justify-between gap-4 border transition-colors",
                        slot.state === "VALIDATED" ||
                          slot.state === "RECEIVED_BY_SERVER"
                          ? "border-ok/45 bg-ok/[0.04]"
                          : isCurrentTarget
                            ? "border-lime/70 bg-surface-2/60"
                            : "border-line bg-canvas/60"
                      )}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-lime shrink-0">
                            <ViewIcon className="w-5 h-5" aria-hidden="true" />
                          </span>
                          <StatusPill
                            label={slot.label}
                            tone={slot.tone}
                            code={slot.state}
                            size="sm"
                          />
                        </div>

                        <div>
                          <span className="text-xs font-mono text-ink-3 block">
                            {tr(lang, `Photo ${idx + 1}`, `Fotografía ${idx + 1}`)} ·{" "}
                            {view}
                          </span>
                          <h3 className="text-base font-semibold text-ink mt-0.5">
                            {viewLabel(view, lang)}
                          </h3>
                          <p className="text-[13px] text-ink-2 mt-1 leading-snug">
                            {angleInstructionForView(
                              view,
                              activeTask.contract.expected_sku,
                              lang
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
                        {slot.artifact ? (
                          <span className="text-xs text-ok font-mono truncate">
                            ✓ SHA-256 {slot.artifact.sha256_hex.slice(0, 10)}…
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">
                            {tr(lang, "JPEG, PNG or WebP ≤ 5 MB", "JPEG, PNG o WebP ≤ 5 MB")}
                          </span>
                        )}
                        <Button
                          variant={
                            slot.artifact
                              ? "secondary"
                              : isCurrentTarget
                                ? "primary"
                                : "subtle"
                          }
                          size="sm"
                          icon={Camera}
                          onClick={() => {
                            setSelectedView(view);
                            changeSubView("CAPTURE");
                          }}
                        >
                          {slot.artifact
                            ? tr(lang, "Inspect / Replace", "Ver / Otra toma")
                            : tr(lang, "Capture", "Capturar")}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Summarized Instructions & Field Quality Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-canvas/70 border border-line p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-ink">
                  {tr(
                    lang,
                    "Summarized inspection instructions",
                    "Instrucciones resumidas de inspección"
                  )}
                </h3>
                <ul className="space-y-1.5 text-sm text-ink-2">
                  {activeTask.contract.expected_attributes.map((attr, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check
                        className="w-4 h-4 text-lime shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{attr}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-3 pt-2 border-t border-line">
                  {tr(
                    lang,
                    "Anti-spoofing rule: Uploading the same photo twice or mislabeling an angle will not satisfy missing contract views.",
                    "Regla antifraude: Subir la misma foto dos veces o etiquetar mal un ángulo no satisface las vistas faltantes del contrato."
                  )}
                </p>
              </div>

              <fieldset className="rounded-xl bg-canvas/70 border border-line p-4 space-y-2">
                <legend className="text-sm font-semibold text-ink px-1">
                  {tr(
                    lang,
                    "Quick field preparation checklist",
                    "Lista rápida antes de fotografiar"
                  )}
                </legend>
                {[
                  {
                    id: "step_lighting",
                    text: tr(
                      lang,
                      "Good lighting without glare over the printed SKU.",
                      "Buena iluminación sin reflejos sobre el SKU impreso."
                    ),
                  },
                  {
                    id: "step_sku_legible",
                    text: tr(
                      lang,
                      `Target SKU (${activeTask.contract.expected_sku}) readable in pixels.`,
                      `SKU objetivo (${activeTask.contract.expected_sku}) legible en píxeles.`
                    ),
                  },
                  {
                    id: "step_seal_visible",
                    text: tr(
                      lang,
                      "Manufacturer box and security seal included in frame.",
                      "Caja del fabricante y sello de seguridad visibles."
                    ),
                  },
                  {
                    id: "step_no_pii",
                    text: tr(
                      lang,
                      "No faces, IDs, payment cards, or private addresses in frame.",
                      "Sin rostros, identificaciones, tarjetas ni direcciones privadas."
                    ),
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 text-sm text-ink-2 cursor-pointer min-h-[36px] py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checkedSteps[item.id])}
                      onChange={(e) =>
                        setCheckedSteps((prev) => ({
                          ...prev,
                          [item.id]: e.target.checked,
                        }))
                      }
                      className="mt-1 w-4 h-4 accent-[#C6FF62]"
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
              </fieldset>
            </div>

            {/* Clear Next Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
              <Button
                variant="ghost"
                icon={ArrowLeft}
                onClick={() => changeSubView("ASSIGNMENTS")}
              >
                {tr(lang, "Back to my tasks", "Volver a mis tareas")}
              </Button>

              {activeTask.status === "FUNDED" ? (
                <Button
                  variant="primary"
                  iconRight={ArrowRight}
                  loading={isBusy}
                  onClick={() => void handleStartOrOpenVerification(activeTask)}
                >
                  {tr(
                    lang,
                    "Accept mission & start capture",
                    "Aceptar misión e iniciar captura"
                  )}
                </Button>
              ) : missingRequiredViews.length > 0 ? (
                <Button
                  variant="primary"
                  icon={Camera}
                  iconRight={ArrowRight}
                  onClick={() => {
                    setSelectedView(missingRequiredViews[0]!);
                    changeSubView("CAPTURE");
                  }}
                >
                  {tr(
                    lang,
                    `Capture next photo: ${viewLabel(missingRequiredViews[0]!, lang)}`,
                    `Capturar siguiente foto: ${viewLabel(missingRequiredViews[0]!, lang)}`
                  )}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  iconRight={ArrowRight}
                  onClick={() => changeSubView("SUBMITTED")}
                >
                  {tr(
                    lang,
                    "View submission result & AI status",
                    "Ver resultado del envío y análisis IA"
                  )}
                </Button>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* ================================================================== */}
      {/* SCREEN C — GUIDED CAPTURE (CAPTURA GUIADA PASO A PASO)             */}
      {/* ================================================================== */}
      {subView === "CAPTURE" && activeTask && (
        <section
          aria-label={tr(lang, "Guided Photo Capture", "Captura Fotográfica Guiada")}
          className="space-y-6"
        >
          {/* Slot Switcher Pills */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">
                {tr(
                  lang,
                  "Select required photograph slot:",
                  "Selecciona la ranura fotográfica requerida:"
                )}
              </span>
              <span className="text-xs font-mono text-ink-3">
                {completedRequiredCount}/{requiredViews.length}{" "}
                {tr(lang, "received by server", "recibidas por el servidor")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {requiredViews.map((v, idx) => {
                const slot = getSlotState(v);
                const active = selectedView === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setSelectedView(v);
                      setValidationError(null);
                      setLastAcceptedArtifact(null);
                    }}
                    className={cx(
                      "flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-colors min-h-[48px]",
                      active
                        ? "bg-surface-2 border-2 border-lime text-ink"
                        : "bg-canvas/60 border-line text-ink-2 hover:bg-surface-2/50"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-mono text-ink-3">
                        {idx + 1}. {v}
                      </span>
                      <span className="block text-sm font-semibold text-ink truncate">
                        {viewLabel(v, lang)}
                      </span>
                    </span>
                    <StatusPill
                      label={slot.label}
                      tone={slot.tone}
                      size="sm"
                    />
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Server Receipt Confirmation Card (Step 7 & 8 after upload) */}
          {lastAcceptedArtifact && (
            <Card
              as="section"
              role="status"
              aria-live="polite"
              className="p-5 border-2 border-ok/60 bg-ok/[0.06] space-y-4"
            >
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-ok/15 border border-ok/40 text-ok flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-base font-semibold text-ink">
                    {tr(
                      lang,
                      `Server receipt confirmed: ${viewLabel(lastAcceptedArtifact.view_type, lang)}`,
                      `Recepción confirmada por el servidor: ${viewLabel(lastAcceptedArtifact.view_type, lang)}`
                    )}
                  </h3>
                  <p className="text-sm text-ink-2">
                    {tr(
                      lang,
                      `Format ${lastAcceptedArtifact.mime_type} (${lastAcceptedArtifact.size_bytes} bytes) · SHA-256 sealed: ${lastAcceptedArtifact.sha256_hex.slice(0, 16)}…`,
                      `Formato ${lastAcceptedArtifact.mime_type} (${lastAcceptedArtifact.size_bytes} bytes) · Sello SHA-256: ${lastAcceptedArtifact.sha256_hex.slice(0, 16)}…`
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2.5">
                {missingRequiredViews.length > 0 ? (
                  <Button
                    variant="primary"
                    icon={Camera}
                    iconRight={ArrowRight}
                    onClick={() => {
                      setSelectedView(missingRequiredViews[0]!);
                      setLastAcceptedArtifact(null);
                    }}
                  >
                    {tr(
                      lang,
                      `Continue to next pending view: ${viewLabel(missingRequiredViews[0]!, lang)}`,
                      `Avanzar a la siguiente vista pendiente: ${viewLabel(missingRequiredViews[0]!, lang)}`
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    iconRight={ArrowRight}
                    onClick={() => changeSubView("SUBMITTED")}
                  >
                    {tr(
                      lang,
                      "All required views uploaded · View results",
                      "Todas las vistas subidas · Ver resultado de envío"
                    )}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Step-by-Step Guided Form */}
          <form onSubmit={handleSubmitCapturedEvidence} className="space-y-5">
            {/* Step 1: What photo is needed */}
            <Card className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase text-lime font-semibold">
                    {tr(
                      lang,
                      "Step 1 · Required camera angle",
                      "Paso 1 · Fotografía que se necesita"
                    )}
                  </span>
                  <h3 className="text-lg font-semibold text-ink">
                    {viewLabel(selectedView, lang)}
                  </h3>
                  <p className="text-sm text-ink-2 leading-relaxed">
                    {angleInstructionForView(
                      selectedView,
                      activeTask.contract.expected_sku,
                      lang
                    )}
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-canvas border border-line text-xs font-mono text-lime shrink-0">
                  SKU: {activeTask.contract.expected_sku}
                </span>
              </div>
            </Card>

            {/* Step 2 & 3: Camera/File Selector + Preview + Retake + Local Validations */}
            <Card className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-blue-ink font-semibold">
                  {tr(
                    lang,
                    "Step 2 · Open camera or choose image file",
                    "Paso 2 · Abrir cámara o elegir archivo de imagen"
                  )}
                </span>
                <p className="text-sm text-ink-2">
                  {tr(
                    lang,
                    "Supports JPEG, PNG, and WebP up to 5.00 MB. No GPS location, contacts, or intrusive device permissions are requested.",
                    "Soporta JPEG, PNG y WebP hasta 5.00 MB. No solicita ubicación GPS, contactos ni permisos excesivos del dispositivo."
                  )}
                </p>
              </div>

              <div>
                <label
                  htmlFor="mobile-camera-input"
                  className="block text-sm font-medium text-ink mb-1.5"
                >
                  {tr(
                    lang,
                    "Camera capture or file upload (JPEG / PNG / WebP ≤ 5 MB)",
                    "Captura con cámara o subida de archivo (JPEG / PNG / WebP ≤ 5 MB)"
                  )}
                </label>
                <input
                  ref={fileInputRef}
                  id="mobile-camera-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleFileInputChange}
                  className="w-full rounded-xl bg-canvas border border-line-strong px-3.5 py-2.5 text-sm text-ink-2 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-lime file:text-lime-ink file:font-semibold min-h-[48px]"
                />
              </div>

              {/* Demo Synthetic Fixtures inside a clearly separated secondary box */}
              <div className="rounded-xl border border-prov-demo/40 bg-prov-demo/[0.06] p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-prov-demo">
                  <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {tr(
                      lang,
                      "DEMO TEST FIXTURES (For desktop / automated testing without a physical camera)",
                      "FIXTURES DE PRUEBA DEMO (Para evaluación en desktop / sin cámara física)"
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ImagePlus}
                    disabled={isBusy}
                    onClick={() => void handleLoadSyntheticFixture("MATCH")}
                  >
                    {tr(
                      lang,
                      "Load matching SKU fixture",
                      "Cargar fixture SKU coincidente"
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleLoadSyntheticFixture("MISMATCH")}
                  >
                    {tr(
                      lang,
                      "Load wrong SKU fixture (FICTO-KX20-999)",
                      "Cargar fixture SKU erróneo (FICTO-KX20-999)"
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() =>
                      void handleLoadSyntheticFixture("ADVERSARIAL")
                    }
                  >
                    {tr(
                      lang,
                      "Load adversarial prompt-injection fixture",
                      "Cargar fixture de ataque prompt injection"
                    )}
                  </Button>
                </div>
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-danger/10 border border-danger/40 text-sm text-danger flex items-start gap-2.5"
                >
                  <AlertTriangle
                    className="w-4 h-4 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Step 3: Pre-Submission Preview, Retake & Local Validation */}
              {previewDataUrl && (
                <div className="rounded-xl bg-canvas border border-line p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono uppercase text-lime font-semibold block">
                        {tr(
                          lang,
                          "Step 3 · Preview & local validation passed",
                          "Paso 3 · Previsualización y validación local superada"
                        )}
                      </span>
                      <span className="text-xs text-ink-3 font-mono">
                        {previewSourceLabel} · {previewMime} · {previewBytes}{" "}
                        bytes
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={handleRetakePhoto}
                    >
                      {tr(lang, "Retake photo", "Repetir imagen")}
                    </Button>
                  </div>

                  <div className="rounded-xl bg-[#060a14] border border-line p-3 flex justify-center">
                    <img
                      src={previewDataUrl}
                      alt={tr(
                        lang,
                        `Preview for ${viewLabel(selectedView, lang)}`,
                        `Previsualización de ${viewLabel(selectedView, lang)}`
                      )}
                      className="max-h-56 w-auto object-contain rounded"
                    />
                  </div>

                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-ok">
                    <li className="flex items-center gap-1.5 bg-ok/10 border border-ok/30 rounded-lg px-2.5 py-1.5">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {tr(lang, "Format valid", "Formato válido")} ({previewMime})
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5 bg-ok/10 border border-ok/30 rounded-lg px-2.5 py-1.5">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {tr(lang, "Size within 5 MB limit", "Tamaño dentro del límite de 5 MB")}
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5 bg-ok/10 border border-ok/30 rounded-lg px-2.5 py-1.5">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {tr(lang, "Ready for SHA-256 seal", "Lista para sellado SHA-256")}
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </Card>

            {/* Verifier Declared SKU, Notes & Mandatory Privacy Checkboxes */}
            <Card className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="capture-declared-sku"
                    className="block text-sm font-medium text-ink mb-1"
                  >
                    {tr(
                      lang,
                      "SKU read on the physical part",
                      "SKU leído en la pieza física"
                    )}
                  </label>
                  <input
                    id="capture-declared-sku"
                    type="text"
                    value={declaredSku}
                    onChange={(e) => setDeclaredSku(e.target.value)}
                    required
                    className="w-full rounded-xl bg-canvas border border-line-strong px-3.5 py-2.5 text-sm font-mono text-lime min-h-[48px]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="capture-verifier-notes"
                    className="block text-sm font-medium text-ink mb-1"
                  >
                    {tr(
                      lang,
                      "Field observation notes (separated from AI pixels)",
                      "Notas de observación en campo (separadas de píxeles IA)"
                    )}
                  </label>
                  <input
                    id="capture-verifier-notes"
                    type="text"
                    value={verifierNotes}
                    onChange={(e) => setVerifierNotes(e.target.value)}
                    className="w-full rounded-xl bg-canvas border border-line-strong px-3.5 py-2.5 text-sm text-ink min-h-[48px]"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-canvas/70 border border-line p-4 space-y-2.5 text-sm text-ink-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(e) => setConsentGranted(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#C6FF62]"
                  />
                  <span>
                    {tr(
                      lang,
                      "I consent to submitting this inspection photograph for server-side Gemini multimodal analysis and human operator review.",
                      "Doy mi consentimiento para enviar esta fotografía al análisis multimodal de Gemini en servidor y a la revisión del operador humano."
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noPiiConfirmed}
                    onChange={(e) => setNoPiiConfirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#C6FF62]"
                  />
                  <span>
                    {tr(
                      lang,
                      "I confirm the image contains NO prohibited personal data (no faces, government IDs, payment cards, or private addresses).",
                      "Confirmo que la imagen NO contiene datos personales prohibidos (sin rostros, identificaciones, tarjetas ni direcciones privadas)."
                    )}
                  </span>
                </label>
              </div>

              {/* Single Primary Action per Step (Sticky-friendly on mobile) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
                <Button
                  variant="ghost"
                  icon={ArrowLeft}
                  onClick={() => changeSubView("MISSION")}
                >
                  {tr(lang, "Back to mission", "Volver a la misión")}
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon={Upload}
                  loading={isBusy}
                  disabled={!canUploadToActiveTask}
                >
                  {tr(
                    lang,
                    `Send "${viewLabel(selectedView, lang)}" to server`,
                    `Enviar "${viewLabel(selectedView, lang)}" al servidor`
                  )}
                </Button>
              </div>
              {!canUploadToActiveTask && (
                <p className="text-xs text-warn">
                  {tr(
                    lang,
                    `Task is currently in ${activeTask.status}. Accept a funded task first to upload photos.`,
                    `La tarea está actualmente en ${activeTask.status}. Acepta primero una tarea financiada para subir fotografías.`
                  )}
                </p>
              )}
            </Card>
          </form>
        </section>
      )}

      {/* ================================================================== */}
      {/* SCREEN D — SUBMISSION RESULT & STATUS (RESULTADO DE ENVÍO)         */}
      {/* ================================================================== */}
      {subView === "SUBMITTED" && activeTask && (
        <section
          aria-label={tr(
            lang,
            "Submission Result and Review Status",
            "Resultado de Envío y Estado de Revisión"
          )}
          className="space-y-6"
        >
          {/* Epistemic Distinction Banner: "Image analyzed" !== "Product verified" */}
          <Card className="p-4 sm:p-5 border-blue/40 bg-blue/[0.06] flex items-start gap-3">
            <ShieldAlert
              className="w-5 h-5 text-blue-ink shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-sm text-ink-2 space-y-1">
              <strong className="text-ink block">
                {tr(
                  lang,
                  "Important distinction: Uploaded or AI-analyzed photos do not mean the product is verified yet",
                  "Distinción clave: Una imagen subida o analizada por IA no equivale todavía a un producto verificado"
                )}
              </strong>
              <p className="text-[13px] text-ink-2">
                {tr(
                  lang,
                  "Gemini inspects pixels to assist the review, but only an authenticated human operator can approve the evidence contract and issue the Proof Passport.",
                  "Gemini inspecciona los píxeles como apoyo, pero solo un operador humano autenticado puede aprobar el contrato de evidencia y emitir el Proof Passport."
                )}
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 cols: Delivered Photos & Missing Views */}
            <div className="lg:col-span-6 space-y-5">
              <Card className="p-5 space-y-4">
                <SectionTitle
                  title={tr(lang, "Delivered photographs", "Fotografías entregadas")}
                  subtitle={tr(
                    lang,
                    `${completedRequiredCount} of ${requiredViews.length} mandatory views received by the server.`,
                    `${completedRequiredCount} de ${requiredViews.length} vistas obligatorias recibidas por el servidor.`
                  )}
                />

                <EvidenceViewer
                  taskId={activeTask.task_id}
                  items={evidenceViewerItems}
                  token={verifierToken}
                  lang={lang}
                  emptyLabel={tr(
                    lang,
                    "No photographs have been uploaded for this mission yet.",
                    "Todavía no se ha enviado ninguna fotografía para esta misión."
                  )}
                />

                {/* Per-View Delivery & Validation Status */}
                <div className="space-y-2 pt-2">
                  {requiredViews.map((v) => {
                    const slot = getSlotState(v);
                    return (
                      <div
                        key={v}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-canvas/70 border border-line text-sm"
                      >
                        <div>
                          <span className="font-semibold text-ink block">
                            {viewLabel(v, lang)}
                          </span>
                          <span className="text-xs font-mono text-ink-3">
                            {v}
                          </span>
                        </div>
                        <StatusPill
                          label={slot.label}
                          tone={slot.tone}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>

                {duplicateViews.length > 0 && (
                  <div className="p-3 rounded-xl bg-warn/10 border border-warn/40 text-xs text-warn">
                    {tr(
                      lang,
                      `Duplicate angle uploaded (${duplicateViews.join(", ")}). Duplicate angles do not satisfy missing required views.`,
                      `Ángulo duplicado subido (${duplicateViews.join(", ")}). Las fotos duplicadas no cubren vistas obligatorias faltantes.`
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* Right 6 cols: Gemini Analysis Result + Human Review Status + Next Action */}
            <div className="lg:col-span-6 space-y-5">
              {/* Missing Views Alert Card */}
              {missingRequiredViews.length > 0 && (
                <Card className="p-5 border-2 border-warn/60 bg-warn/[0.06] space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="w-5 h-5 text-warn shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-ink">
                        {tr(
                          lang,
                          `Missing ${missingRequiredViews.length} mandatory photo(s)`,
                          `Faltan ${missingRequiredViews.length} fotografía(s) obligatoria(s)`
                        )}
                      </h3>
                      <p className="text-sm text-ink-2">
                        {tr(
                          lang,
                          "Capture the remaining required views so the human operator can complete the review without exceptions:",
                          "Captura las vistas obligatorias pendientes para que el operador humano pueda revisar sin excepciones:"
                        )}{" "}
                        <strong className="text-ink">
                          {missingRequiredViews
                            .map((v) => viewLabel(v, lang))
                            .join(" · ")}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    icon={Camera}
                    onClick={() => {
                      setSelectedView(missingRequiredViews[0]!);
                      changeSubView("CAPTURE");
                    }}
                  >
                    {tr(
                      lang,
                      `Capture ${viewLabel(missingRequiredViews[0]!, lang)}`,
                      `Capturar ${viewLabel(missingRequiredViews[0]!, lang)}`
                    )}
                  </Button>
                </Card>
              )}

              {/* Gemini Multimodal Inspection Card */}
              <Card className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="w-5 h-5 text-lime"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-semibold text-ink">
                      {tr(
                        lang,
                        "Gemini AI pixel analysis (advisory)",
                        "Análisis de píxeles con Gemini IA (orientativo)"
                      )}
                    </h3>
                  </div>
                  {activeTask.ai_analysis && (
                    <StatusPill
                      label={
                        activeTask.ai_analysis.matches_expected === "MATCH"
                          ? tr(lang, "SKU match observed", "Coincidencia de SKU observada")
                          : activeTask.ai_analysis.matches_expected === "MISMATCH"
                            ? tr(lang, "SKU discrepancy", "Discrepancia de SKU")
                            : tr(lang, "Insufficient evidence", "Evidencia insuficiente")
                      }
                      tone={
                        activeTask.ai_analysis.matches_expected === "MATCH"
                          ? "info"
                          : activeTask.ai_analysis.matches_expected === "MISMATCH"
                            ? "danger"
                            : "warning"
                      }
                      size="sm"
                    />
                  )}
                </div>

                {activeTask.ai_analysis ? (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-canvas/70 border border-line p-3.5">
                      <div>
                        <span className="text-xs text-ink-3 block">
                          {tr(lang, "Expected SKU", "SKU esperado")}
                        </span>
                        <code className="font-mono font-semibold text-ink">
                          {activeTask.contract.expected_sku}
                        </code>
                      </div>
                      <div>
                        <span className="text-xs text-ink-3 block">
                          {tr(lang, "SKU read by Gemini", "SKU leído por Gemini")}
                        </span>
                        <code className="font-mono font-semibold text-lime">
                          {activeTask.ai_analysis.observed_sku ??
                            tr(lang, "Unreadable", "Ilegible")}
                        </code>
                      </div>
                    </div>
                    <ul className="space-y-1.5 text-ink-2">
                      {activeTask.ai_analysis.visible_evidence.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Eye
                            className="w-4 h-4 text-blue-ink shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{obs}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : activeTask.evidence_artifacts.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-2">
                      {tr(
                        lang,
                        "Photos are stored on the server. You can run Gemini pixel analysis now to check SKU legibility before operator review.",
                        "Las fotos están almacenadas en el servidor. Puedes ejecutar ahora el análisis de píxeles de Gemini para comprobar la legibilidad del SKU."
                      )}
                    </p>
                    <Button
                      variant="secondary"
                      icon={Sparkles}
                      loading={isBusy}
                      onClick={() => void handleRunGeminiFromVerifier()}
                    >
                      {tr(
                        lang,
                        "Run Gemini pixel analysis",
                        "Ejecutar análisis de imagen con Gemini"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-3">
                    {tr(
                      lang,
                      "Upload at least one photograph to run Gemini pixel analysis.",
                      "Sube al menos una fotografía para ejecutar el análisis de píxeles de Gemini."
                    )}
                  </p>
                )}
              </Card>

              {/* Human Review Status Card */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck
                      className="w-5 h-5 text-blue-ink"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-semibold text-ink">
                      {tr(
                        lang,
                        "Human operator review status",
                        "Estado de revisión del operador humano"
                      )}
                    </h3>
                  </div>
                  <StatusPill
                    label={humanStatus(activeTask, lang).label}
                    tone={humanStatus(activeTask, lang).tone}
                    code={activeTask.status}
                    size="sm"
                  />
                </div>

                <p className="text-sm text-ink-2">
                  {activeTask.reviewer_decision
                    ? `${activeTask.reviewer_decision.decision} — ${activeTask.reviewer_decision.rationale}`
                    : tr(
                        lang,
                        "Pending human operator decision in the Operator Decision Desk.",
                        "Pendiente de decisión del operador humano en la Consola de Operador."
                      )}
                </p>

                {/* Next Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
                  <Button
                    variant="ghost"
                    icon={ArrowLeft}
                    onClick={() => changeSubView("ASSIGNMENTS")}
                  >
                    {tr(lang, "Back to my tasks", "Volver a mis tareas")}
                  </Button>

                  <Button
                    variant={
                      missingRequiredViews.length > 0 ? "primary" : "secondary"
                    }
                    icon={Camera}
                    onClick={() => {
                      if (missingRequiredViews[0]) {
                        setSelectedView(missingRequiredViews[0]);
                      }
                      changeSubView("CAPTURE");
                    }}
                  >
                    {missingRequiredViews.length > 0
                      ? tr(
                          lang,
                          "Capture missing photo",
                          "Capturar foto faltante"
                        )
                      : tr(
                          lang,
                          "Upload additional photo",
                          "Subir fotografía adicional"
                        )}
                  </Button>
                </div>
              </Card>

              {/* Technical Drawer */}
              <TechnicalDetailsDrawer
                summary={tr(
                  lang,
                  "Cryptographic SHA-256 digests & server receipt details",
                  "Huellas criptográficas SHA-256 y detalles de recepción"
                )}
                hint={`${activeTask.evidence_artifacts.length} artifact(s)`}
              >
                <dl className="divide-y divide-line">
                  {activeTask.evidence_artifacts.map((art) => (
                    <React.Fragment key={art.artifact_id}>
                      <KeyValue
                        label={`${art.view_type} (${art.artifact_id})`}
                        value={`SHA-256: ${art.sha256_hex}`}
                        mono
                        copy
                      />
                      <KeyValue
                        label={tr(lang, "Provenance & size", "Procedencia y tamaño")}
                        value={`${art.artifact_provenance} · ${art.mime_type} · ${art.size_bytes} bytes`}
                        mono
                      />
                    </React.Fragment>
                  ))}
                </dl>
              </TechnicalDetailsDrawer>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
