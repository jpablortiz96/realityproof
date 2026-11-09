/**
 * Proof Passport 2.0 — 4-Level Visual & Epistemic Result Dossier.
 *
 * Level 1: Primary Outcome (Product, Main Photo, Documentary Review Outcome,
 *          Evidence Contract State, Key Limitations, Review Date, Next Step).
 *          Never claims "Authentic Product"; explicitly distinguishes documentary
 *          review from physical laboratory certification.
 * Level 2: Visual Evidence Gallery & Epistemic Separation (Expected vs Detected SKU,
 *          Completed vs Missing Mandatory Views, Gemini Image Observations vs
 *          Human Verifier Declarations).
 * Level 3: Expandable Trust & Audit Drawer ("Ver detalles de confianza y trazabilidad")
 *          preserving 100% of SHA-256 digests, Order/Capture IDs, 5-Component
 *          Provenance Matrix, Trust Classifications, Decision Log, and Claim Scope.
 * Level 4: Share, Export & Live Integrity Verification.
 */
import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileCheck2,
  HelpCircle,
  Hourglass,
  Lock,
  Printer,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { ProofPassportV0 } from "@realityproof/shared";
import { I18N, type Lang } from "../i18n.js";
import {
  displayTitle,
  formatDate,
  formatUsd,
  fundingProvenanceOf,
  passportOutcome,
  viewCompleteness,
  viewLabel,
} from "../presentation.js";
import {
  Button,
  Card,
  DataLabelTag,
  EvidenceViewer,
  InsightPanel,
  KeyValue,
  ProvenanceTag,
  SectionTitle,
  StatusPill,
  TechnicalDetailsDrawer,
  TrustClassification,
  cx,
} from "../design-system/ui.js";
import type { TaskSummary } from "../types.js";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

export function ProofPassportView({
  task,
  requesterToken,
  lang,
  onBack,
  onSelectCanonicalLiveTask,
}: {
  task: TaskSummary;
  requesterToken: string;
  lang: Lang;
  onBack?: () => void;
  onSelectCanonicalLiveTask?: () => void;
}) {
  const t = I18N[lang];
  const passport = task.proof_passport;

  const [liveVerifyResult, setLiveVerifyResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  async function handleVerifySignedUrlLive(p: ProofPassportV0) {
    try {
      const parsed = new URL(p.authorized_read_url);
      const res = await fetch(`${parsed.pathname}${parsed.search}`);
      if (!res.ok) {
        setLiveVerifyResult({
          ok: false,
          message: tr(
            lang,
            `HTTP ${res.status}: Signed token expired or invalid.`,
            `Error HTTP ${res.status}: Token firmado expirado o inválido.`
          ),
        });
        return;
      }
      const verified = (await res.json()) as ProofPassportV0;
      setLiveVerifyResult({
        ok: true,
        message: tr(
          lang,
          `Integrity verified live (HTTP 200): Proof ${verified.proof_id} matches canonical SHA-256 (${verified.manifest_sha256.slice(0, 16)}…).`,
          `Integridad verificada en vivo (HTTP 200): El certificado ${verified.proof_id} coincide con el SHA-256 canónico (${verified.manifest_sha256.slice(0, 16)}…).`
        ),
      });
    } catch (err) {
      setLiveVerifyResult({
        ok: false,
        message: (err as Error).message,
      });
    }
  }

  async function handleCopyShareUrl(p: ProofPassportV0) {
    try {
      await navigator.clipboard?.writeText(p.authorized_read_url);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 1800);
    } catch {
      // Clipboard fallback
    }
  }

  function handleDownloadJson(p: ProofPassportV0) {
    const blob = new Blob([JSON.stringify(p, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.proof_id}_${task.task_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadReadableDossier(p: ProofPassportV0) {
    const htmlContent = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>RealityProof Verification Dossier — ${p.proof_id}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; max-width: 840px; margin: 32px auto; padding: 0 20px; line-height: 1.5; }
    h1, h2 { color: #0B1020; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; }
    .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    code { font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>RealityProof — Proof Passport Dossier (${p.proof_id})</h1>
  <div class="box">
    <p><strong>Task ID:</strong> <code>${p.task_id}</code></p>
    <p><strong>Documentary Review Status:</strong> <code>${p.status}</code> (${p.synthetic_label})</p>
    <p><strong>Approval Classification:</strong> <code>${p.approval_classification ?? "APPROVED_FOR_DEMO"}</code></p>
    <p><strong>Trust Classifications:</strong> <code>${(p.trust_classifications ?? []).join(", ")}</code></p>
    <p><strong>Item Reviewed:</strong> ${task.contract.item_title}</p>
    <p><strong>Expected SKU:</strong> <code>${task.contract.expected_sku}</code> | <strong>Declared SKU:</strong> <code>${p.verifier_claims.declared_sku}</code></p>
    <p><strong>PayPal Sandbox Order / Capture:</strong> <code>${p.funding_order_id ?? "N/A"}</code> / <code>${p.capture_id ?? "N/A"}</code> ($${task.contract.max_verification_budget.toFixed(2)} USD — ${p.funding_provenance ?? "REAL_SANDBOX_CAPTURE"})</p>
    <p><strong>Manifest SHA-256:</strong> <code>${p.manifest_sha256}</code></p>
    <p><strong>Reviewed At:</strong> ${p.reviewer_decision.reviewed_at} | <strong>Valid Until:</strong> ${p.valid_until}</p>
  </div>
  <h2>Visual Observations from Provided Image (${p.model_id ?? "Manual"})</h2>
  <ul>${p.observations.map((o) => `<li>${o}</li>`).join("")}</ul>
  <h2>Human Operator Decision (${p.reviewer_decision.decision})</h2>
  <p>${p.reviewer_decision.rationale}</p>
  <h2>Epistemic Limitations & Unknowns</h2>
  <ul>${[...p.limitations, ...p.unknowns].map((l) => `<li>${l}</li>`).join("")}</ul>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RealityProof_Dossier_${p.proof_id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!passport) {
    return (
      <div className="space-y-4 animate-enter">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {tr(lang, "Back to results", "Volver a resultados")}
          </button>
        )}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-ink flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-lime" aria-hidden="true" />
              {t.passportTitle}
            </h1>
            <StatusPill
              label={tr(lang, "Result not issued yet", "Resultado aún no emitido")}
              tone="warning"
              code={task.status}
            />
          </div>
          <p className="text-[15px] text-ink-2 max-w-2xl">
            {tr(
              lang,
              `Request "${displayTitle(task.contract.item_title)}" (${task.task_id}) is currently in state ${task.status} and does not have a Proof Passport yet.`,
              `La solicitud "${displayTitle(task.contract.item_title)}" (${task.task_id}) se encuentra en estado ${task.status} y todavía no tiene un Proof Passport emitido.`
            )}
          </p>
          {onSelectCanonicalLiveTask && (
            <div className="pt-2">
              <Button variant="primary" icon={BadgeCheck} onClick={onSelectCanonicalLiveTask}>
                {tr(
                  lang,
                  "Open completed PayPal Sandbox Proof Passport",
                  "Abrir Proof Passport real de PayPal Sandbox"
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const outcome = passportOutcome(passport, lang);
  const vc = viewCompleteness(task);
  const isExpired = new Date(passport.valid_until).getTime() < Date.now();
  const observedSku =
    task.ai_analysis?.observed_sku ?? passport.verifier_claims.declared_sku;
  const skuMatchVerdict =
    task.ai_analysis?.matches_expected ??
    (observedSku === task.contract.expected_sku ? "MATCH" : "MISMATCH");

  const trustTags = passport.trust_classifications ?? [
    "RECORD_INTEGRITY_VERIFIED",
    "EVIDENCE_REVIEW_COMPLETED",
    "PHYSICAL_AUTHENTICITY_UNVERIFIED",
    ...(passport.synthetic_label === "DEMO_SYNTHETIC" ? ["DEMO_ONLY"] : []),
  ];

  const compProv = passport.component_provenance;
  const humanEx =
    passport.evidence_completeness?.human_exception ??
    task.human_exception ??
    passport.reviewer_decision.human_exception ??
    null;

  const evidenceItems = task.evidence_artifacts.map((a) => ({
    artifact_id: a.artifact_id,
    view_label: viewLabel(a.view_type, lang),
    view_type: a.view_type,
    provenance: a.artifact_provenance,
    received_at: a.received_at_server,
  }));

  const primaryLimitations = [
    ...passport.limitations.slice(0, 2),
    ...passport.unknowns.slice(0, 1),
  ];

  return (
    <div className="space-y-8 animate-enter">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {tr(lang, "All results", "Todos los resultados")}
        </button>
      )}

      {/* ==================================================================== */}
      {/* LEVEL 1 — PRIMARY RESULT                                             */}
      {/* ==================================================================== */}
      <Card
        as="section"
        aria-labelledby="passport-level1-title"
        className="p-5 sm:p-7 space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={outcome.headline}
                tone={outcome.tone}
                code={`${passport.status} · ${outcome.approval}`}
              />
              <DataLabelTag label={passport.synthetic_label} />
              <ProvenanceTag
                provenance={
                  passport.funding_provenance ?? fundingProvenanceOf(task)
                }
                lang={lang}
                showCode={false}
              />
              <span
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium",
                  !isExpired
                    ? "border-ok/35 bg-ok/10 text-ok"
                    : "border-danger/40 bg-danger/10 text-danger"
                )}
              >
                {!isExpired
                  ? tr(lang, "Active record", "Registro vigente")
                  : tr(lang, "Expired", "Expirado")}
              </span>
            </div>

            <h1
              id="passport-level1-title"
              className="text-2xl sm:text-[28px] font-semibold tracking-tight text-ink leading-tight"
            >
              {displayTitle(task.contract.item_title)}
            </h1>
            <p className="text-[15px] text-ink-2 max-w-3xl">{outcome.sub}</p>
          </div>

          <div className="text-left sm:text-right shrink-0 space-y-1">
            <span className="text-xs text-ink-3 block">
              {tr(lang, "Reviewed on", "Fecha de revisión")}
            </span>
            <span className="text-sm font-medium text-ink block">
              {formatDate(passport.reviewer_decision.reviewed_at, lang, true)}
            </span>
            <code className="text-xs font-mono text-ink-3 block">
              {passport.proof_id}
            </code>
          </div>
        </div>

        {/* Human Exception Alert if present */}
        {humanEx?.granted && (
          <div
            role="note"
            className="rounded-xl border border-warn/45 bg-warn/10 p-4 flex items-start gap-3"
          >
            <AlertTriangle
              className="w-5 h-5 text-warn shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-ink">
                {tr(
                  lang,
                  "Approved with a documented human exception",
                  "Aprobado con una excepción humana documentada"
                )}
              </div>
              <p className="text-ink-2">{humanEx.foundation_rationale}</p>
              <p className="text-xs text-ink-3">
                {tr(lang, "Scope:", "Alcance:")} {humanEx.scope} ·{" "}
                {tr(lang, "Missing views preserved:", "Vistas faltantes preservadas:")}{" "}
                <code className="font-mono">
                  {humanEx.missing_views_waived.join(", ") || "—"}
                </code>
              </p>
            </div>
          </div>
        )}

        {/* Main 2-column Hero: Primary Photo + Documentary Outcome Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <EvidenceViewer
              taskId={task.task_id}
              items={evidenceItems}
              token={requesterToken}
              lang={lang}
              emptyLabel={tr(
                lang,
                "No evidence photographs attached",
                "Sin fotografías de evidencia adjuntas"
              )}
            />
          </div>

          <div className="lg:col-span-7 space-y-4">
            {/* Key facts cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-canvas/50 p-4">
                <span className="text-xs text-ink-3 block">
                  {tr(
                    lang,
                    "Documentary review outcome",
                    "Resultado de la revisión documental"
                  )}
                </span>
                <span className="text-base font-semibold text-ink mt-1 block">
                  {outcome.headline}
                </span>
                <span className="text-xs text-ink-3 mt-1 block">
                  {tr(
                    lang,
                    "Not a physical authenticity certificate",
                    "No equivale a autenticidad física certificada"
                  )}
                </span>
              </div>

              <div className="rounded-xl border border-line bg-canvas/50 p-4">
                <span className="text-xs text-ink-3 block">
                  {tr(
                    lang,
                    "Evidence contract status",
                    "Estado del contrato de evidencias"
                  )}
                </span>
                <span className="text-base font-semibold text-ink mt-1 block tabular">
                  {vc.satisfied}/{vc.required.length}{" "}
                  {tr(
                    lang,
                    "mandatory views completed",
                    "vistas obligatorias completadas"
                  )}
                </span>
                <span className="text-xs text-ink-3 mt-1 block font-mono">
                  {vc.status ?? "COMPLETE"}
                </span>
              </div>
            </div>

            {/* Key Limitations */}
            <div className="rounded-xl border border-line bg-canvas/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <AlertTriangle
                  className="w-4 h-4 text-warn shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {tr(
                    lang,
                    "Key boundaries & limitations",
                    "Limitaciones principales"
                  )}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm text-ink-2">
                {primaryLimitations.map((lim, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span
                      className="mt-2 w-1.5 h-1.5 rounded-full bg-warn shrink-0"
                      aria-hidden="true"
                    />
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Next Step */}
            <div className="rounded-xl border border-lime/35 bg-lime/[0.05] p-4 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-lime block">
                {tr(
                  lang,
                  "Recommended next step",
                  "Próximo paso recomendado"
                )}
              </span>
              <p className="text-sm text-ink font-medium">{outcome.nextStep}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* LEVEL 2 — EVIDENCE & EPISTEMIC SEPARATION                            */}
      {/* ==================================================================== */}
      <section
        aria-labelledby="passport-level2-title"
        className="space-y-4"
      >
        <SectionTitle
          id="passport-level2-title"
          title={tr(
            lang,
            "Reviewed evidence & observations",
            "Evidencias revisadas y observaciones"
          )}
          subtitle={tr(
            lang,
            "Visual observations from Gemini are separated from the human verifier's declarations.",
            "Las observaciones visuales de Gemini se muestran separadas de las declaraciones del verificador humano."
          )}
        />

        {/* SKU & Mandatory Views Checklist Card */}
        <Card className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-line">
            <div>
              <span className="text-xs text-ink-3 block">
                {tr(lang, "Expected SKU", "SKU esperado")}
              </span>
              <code className="text-base font-mono font-semibold text-ink mt-0.5 block">
                {task.contract.expected_sku}
              </code>
            </div>

            <div>
              <span className="text-xs text-ink-3 block">
                {tr(
                  lang,
                  "SKU detected in submitted photo",
                  "SKU detectado en la fotografía"
                )}
              </span>
              <code className="text-base font-mono font-semibold text-lime mt-0.5 block">
                {observedSku ?? tr(lang, "Unreadable", "No legible")}
              </code>
            </div>

            <div>
              <span className="text-xs text-ink-3 block">
                {tr(lang, "Visual SKU comparison", "Comparación visual de SKU")}
              </span>
              <div className="mt-1">
                <StatusPill
                  label={
                    skuMatchVerdict === "MATCH"
                      ? tr(
                          lang,
                          "Matches expected SKU in photo",
                          "Coincide con el SKU esperado en la foto"
                        )
                      : skuMatchVerdict === "MISMATCH"
                        ? tr(lang, "SKU mismatch", "SKU no coincide")
                        : tr(
                            lang,
                            "Insufficient visual evidence",
                            "Evidencia visual insuficiente"
                          )
                  }
                  tone={
                    skuMatchVerdict === "MATCH"
                      ? "success"
                      : skuMatchVerdict === "MISMATCH"
                        ? "danger"
                        : "warning"
                  }
                  code={skuMatchVerdict}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Mandatory Views Completed vs Pending */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink mb-2.5">
                {tr(
                  lang,
                  "Mandatory photographic views",
                  "Vistas fotográficas obligatorias"
                )}
              </h3>
              <ul className="space-y-2">
                {vc.required.map((view) => {
                  const completed = !vc.missing.includes(view);
                  return (
                    <li
                      key={view}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-canvas/40 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 text-ink">
                        {completed ? (
                          <ClipboardCheck
                            className="w-4 h-4 text-ok shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <Hourglass
                            className="w-4 h-4 text-warn shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {viewLabel(view, lang)}
                      </span>
                      <span
                        className={cx(
                          "text-xs font-medium",
                          completed ? "text-ok" : "text-warn"
                        )}
                      >
                        {completed
                          ? tr(lang, "Completed", "Completada")
                          : tr(lang, "Missing", "Pendiente")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2.5">
                {tr(
                  lang,
                  "Human operator decision",
                  "Decisión del operador humano"
                )}
              </h3>
              <div className="rounded-xl border border-line bg-canvas/40 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                    <UserCheck
                      className="w-4 h-4 text-lime"
                      aria-hidden="true"
                    />
                    {passport.reviewer_decision.decision}
                  </span>
                  <code className="text-xs font-mono text-ink-3">
                    {passport.reviewer_decision.reviewer_id}
                  </code>
                </div>
                <p className="text-ink-2">
                  {passport.reviewer_decision.rationale}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Separated Insights: Gemini vs Human Verifier vs Unknowns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <InsightPanel
            icon={Sparkles}
            tone="info"
            title={tr(
              lang,
              "Gemini visual observations",
              "Observaciones visuales de Gemini"
            )}
            source={passport.model_id ?? "Manual"}
            items={passport.observations}
            footnote={tr(
              lang,
              "Evaluated strictly on the submitted image pixels; does not certify physical authenticity.",
              "Evaluado únicamente sobre los píxeles de la imagen enviada; no certifica autenticidad física."
            )}
          />

          <InsightPanel
            icon={FileCheck2}
            tone="neutral"
            title={tr(
              lang,
              "Verifier declarations",
              "Declaraciones del verificador"
            )}
            source={tr(lang, "Human field verifier", "Verificador de campo")}
            items={[
              `${tr(lang, "Declared SKU:", "SKU declarado:")} ${passport.verifier_claims.declared_sku}`,
              passport.verifier_claims.notes,
            ]}
            footnote={passport.verifier_claims.separation_notice}
          />

          <InsightPanel
            icon={HelpCircle}
            tone="warning"
            title={tr(
              lang,
              "What could not be verified",
              "Lo que no pudo comprobarse"
            )}
            items={[
              ...(task.ai_analysis?.unverifiable_claims ?? []),
              ...passport.unknowns,
            ]}
            footnote={tr(
              lang,
              "Physical attributes that cannot be proven from a photograph alone.",
              "Atributos físicos que no pueden demostrarse únicamente con una fotografía."
            )}
          />
        </div>
      </section>

      {/* ==================================================================== */}
      {/* LEVEL 3 — EXPANDABLE TRUST & TRACEABILITY DRAWER                     */}
      {/* ==================================================================== */}
      <TechnicalDetailsDrawer
        icon={ShieldCheck}
        summary={tr(
          lang,
          "View trust & traceability details",
          "Ver detalles de confianza y trazabilidad"
        )}
        hint={tr(
          lang,
          "Payment provenance, SHA-256 hashes, PayPal Order/Capture IDs, 5-component matrix, decision log and claim scope",
          "Procedencia del pago, hashes SHA-256, IDs de orden y captura, matriz de 5 componentes, registro de decisiones y alcance de la firma"
        )}
      >
        <div className="space-y-6 pt-2">
          {/* Trust Classifications */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">
              {tr(
                lang,
                "Trust classifications",
                "Clasificaciones de confianza"
              )}
            </h3>
            <TrustClassification tags={trustTags} lang={lang} />
          </div>

          {/* 5-Component Provenance Matrix */}
          {compProv && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-3">
                {tr(
                  lang,
                  "5-component provenance matrix",
                  "Matriz de procedencia por componente (5 capas)"
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="rounded-xl border border-line bg-canvas/50 p-3.5 space-y-1 min-w-0">
                  <span className="text-ink-3 font-medium block">
                    1. Payment
                  </span>
                  <code className="text-lime font-mono font-semibold block break-words">
                    {compProv.payment}
                  </code>
                </div>
                <div className="rounded-xl border border-line bg-canvas/50 p-3.5 space-y-1 min-w-0">
                  <span className="text-ink-3 font-medium block">
                    2. Photograph
                  </span>
                  <code className="text-blue-ink font-mono font-semibold block break-words">
                    {compProv.photograph}
                  </code>
                </div>
                <div className="rounded-xl border border-line bg-canvas/50 p-3.5 space-y-1 min-w-0">
                  <span className="text-ink-3 font-medium block">
                    3. AI Analysis
                  </span>
                  <code className="text-ink font-mono font-semibold block break-words">
                    {compProv.ai_analysis}
                  </code>
                </div>
                <div className="rounded-xl border border-line bg-canvas/50 p-3.5 space-y-1 min-w-0">
                  <span className="text-ink-3 font-medium block">
                    4. Human Decision
                  </span>
                  <code className="text-lime font-mono font-semibold block break-words">
                    {compProv.human_decision}
                  </code>
                </div>
                <div className="rounded-xl border border-line bg-canvas/50 p-3.5 space-y-1 min-w-0 sm:col-span-2 lg:col-span-1">
                  <span className="text-ink-3 font-medium block">
                    5. Document
                  </span>
                  <code className="text-blue-ink font-mono font-semibold block break-words">
                    {compProv.document}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Financial, Cryptographic & Scope Key-Values */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <h4 className="text-sm font-semibold text-ink mb-2">
                {tr(
                  lang,
                  "Payment & record identifiers",
                  "Identificadores de pago y registro"
                )}
              </h4>
              <dl>
                <KeyValue
                  label={tr(lang, "Proof ID", "ID del certificado")}
                  value={passport.proof_id}
                  mono
                  copy
                />
                <KeyValue
                  label={tr(lang, "Task ID", "ID de la solicitud")}
                  value={passport.task_id}
                  mono
                  copy
                />
                <KeyValue
                  label={tr(
                    lang,
                    "Funding provenance",
                    "Procedencia del pago"
                  )}
                  value={
                    passport.funding_provenance ?? "REAL_SANDBOX_CAPTURE"
                  }
                  mono
                />
                <KeyValue
                  label="PayPal Order ID"
                  value={passport.funding_order_id ?? "N/A"}
                  mono
                  copy
                />
                <KeyValue
                  label="PayPal Capture ID"
                  value={passport.capture_id ?? "N/A"}
                  mono
                  copy
                />
                <KeyValue
                  label={tr(lang, "Verification fee", "Tarifa de verificación")}
                  value={formatUsd(
                    task.contract.max_verification_budget,
                    lang
                  )}
                />
                <KeyValue
                  label={tr(lang, "Valid until", "Vigente hasta")}
                  value={formatDate(passport.valid_until, lang, true)}
                />
              </dl>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <h4 className="text-sm font-semibold text-ink mb-2">
                {tr(
                  lang,
                  "Cryptographic hashes & signature scope",
                  "Hashes SHA-256 y alcance de la firma"
                )}
              </h4>
              <dl>
                <KeyValue
                  label="Manifest SHA-256"
                  value={passport.manifest_sha256}
                  mono
                  copy
                />
                {passport.evidence_hashes.map((eh) => (
                  <KeyValue
                    key={eh.artifact_id}
                    label={`${eh.view_type} (${eh.artifact_id})`}
                    value={eh.sha256_hex}
                    mono
                    copy
                  />
                ))}
                <KeyValue
                  label={tr(lang, "Reviewed by", "Revisado por")}
                  value={`${passport.reviewer_decision.reviewer_id} (${passport.reviewer_decision.decision})`}
                  mono
                />
                <KeyValue
                  label={tr(lang, "Claim scope", "Alcance de la firma")}
                  value={passport.scope_of_claim}
                />
              </dl>
            </div>
          </div>

          {/* Technical Limitations List */}
          <div className="rounded-xl border border-line bg-canvas/40 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-ink">
              {tr(
                lang,
                "Complete technical limitations",
                "Limitaciones técnicas completas"
              )}
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-ink-2">
              {passport.limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      </TechnicalDetailsDrawer>

      {/* ==================================================================== */}
      {/* LEVEL 4 — SHARE, EXPORT & VERIFY INTEGRITY                           */}
      {/* ==================================================================== */}
      <Card
        as="section"
        aria-labelledby="passport-level4-title"
        className="p-5 sm:p-6 space-y-4 no-print"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="passport-level4-title"
              className="text-base font-semibold text-ink flex items-center gap-2"
            >
              <Share2 className="w-4 h-4 text-lime" aria-hidden="true" />
              {tr(
                lang,
                "Share, export & verify integrity",
                "Compartir, exportar y verificar integridad"
              )}
            </h2>
            <p className="text-[13px] text-ink-3 mt-0.5">
              {tr(
                lang,
                "Time-limited HMAC-SHA256 signed URL and exportable verification dossier. Sensitive raw credentials are never exposed.",
                "URL firmada con HMAC-SHA256 y expiración temporal, más exportación de dossier. Nunca se exponen credenciales sensibles."
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={ShieldCheck}
            onClick={() => void handleVerifySignedUrlLive(passport)}
          >
            {tr(lang, "Verify integrity", "Verificar integridad")}
          </Button>

          <Button
            variant="secondary"
            icon={copiedShareUrl ? Check : Copy}
            onClick={() => void handleCopyShareUrl(passport)}
          >
            {copiedShareUrl
              ? tr(lang, "Signed link copied", "Enlace firmado copiado")
              : tr(lang, "Share result (copy signed link)", "Compartir resultado")}
          </Button>

          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => handleDownloadReadableDossier(passport)}
          >
            {tr(lang, "Export document (HTML)", "Exportar documento (HTML)")}
          </Button>

          <Button
            variant="ghost"
            icon={Download}
            onClick={() => handleDownloadJson(passport)}
          >
            {tr(lang, "Export JSON", "Exportar JSON")}
          </Button>
        </div>

        <details className="rounded-xl border border-line bg-canvas/40 px-4 py-3 text-xs">
          <summary className="cursor-pointer font-medium text-ink-2 flex items-center gap-2 min-h-[36px]">
            <Eye className="w-3.5 h-3.5 text-blue-ink" aria-hidden="true" />
            {tr(
              lang,
              "Show time-limited signed read URL (HMAC-SHA256)",
              "Mostrar URL de lectura firmada (HMAC-SHA256)"
            )}
          </summary>
          <code className="block mt-2 font-mono text-ink-2 break-all">
            {passport.authorized_read_url}
          </code>
        </details>

        {liveVerifyResult && (
          <div
            role="status"
            className={cx(
              "rounded-xl border px-4 py-3 text-sm flex items-center gap-2.5",
              liveVerifyResult.ok
                ? "border-ok/40 bg-ok/10 text-ink"
                : "border-danger/40 bg-danger/10 text-ink"
            )}
          >
            <CheckCircle2
              className={cx(
                "w-4 h-4 shrink-0",
                liveVerifyResult.ok ? "text-ok" : "text-danger"
              )}
              aria-hidden="true"
            />
            <span>{liveVerifyResult.message}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
