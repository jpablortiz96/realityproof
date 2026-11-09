/**
 * RealityProof Design System v2 — reusable UI components.
 * Tokens live in index.css (@theme) and tokens.ts. Components here are
 * presentation-only: they never call payment, AI or review endpoints except
 * EvidenceViewer, which reads protected previews with the caller's token.
 */
import React, { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Copy,
  Check,
  FlaskConical,
  History,
  ImageOff,
  Info,
  Loader2,
  ShieldCheck,
  WalletMinimal,
  X,
  XCircle,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import type { FundingProvenance } from "@realityproof/shared";
import type { Lang } from "../i18n.js";
import { provenanceCopy, type Phase, type Tone } from "../presentation.js";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100 select-none";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-lime text-lime-ink hover:bg-lime-hover shadow-[0_8px_24px_-12px_rgba(198,255,98,0.55)]",
  secondary: "bg-surface-2 text-ink border border-line-strong hover:bg-surface-3 hover:border-ink-3/40",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  subtle: "bg-blue/12 text-blue-ink border border-blue/35 hover:bg-blue/20",
  danger: "bg-danger/12 text-danger border border-danger/40 hover:bg-danger/20",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}) {
  const sizes = { sm: "min-h-[40px] px-3.5 text-sm", md: "min-h-[44px] px-4.5 text-sm", lg: "min-h-[52px] px-6 text-[15px]" };
  return (
    <button type="button" className={cx(BTN_BASE, BTN_VARIANT[variant], sizes[size], className)} {...rest}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
      {IconRight && !loading && <IconRight className="w-4 h-4 shrink-0" aria-hidden="true" />}
    </button>
  );
}

export function LinkButton({
  variant = "secondary",
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; icon?: LucideIcon; iconRight?: LucideIcon }) {
  return (
    <a className={cx(BTN_BASE, BTN_VARIANT[variant], "min-h-[44px] px-4.5 text-sm", className)} {...rest}>
      {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
      {IconRight && <IconRight className="w-4 h-4 shrink-0" aria-hidden="true" />}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "aside" }) {
  return (
    <Tag className={cx("bg-surface border border-line rounded-[var(--radius-card)] shadow-[var(--shadow-card)] max-w-full overflow-hidden", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ title, subtitle, action, id }: { title: string; subtitle?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status & provenance                                                         */
/* -------------------------------------------------------------------------- */

const TONE_PILL: Record<Tone, string> = {
  neutral: "bg-ink-3/10 text-ink-2 border-ink-3/25",
  info: "bg-blue/12 text-blue-ink border-blue/35",
  progress: "bg-blue/12 text-blue-ink border-blue/35",
  success: "bg-ok/10 text-ok border-ok/35",
  warning: "bg-warn/10 text-warn border-warn/35",
  danger: "bg-danger/10 text-danger border-danger/40",
};

const TONE_ICON: Record<Tone, LucideIcon> = {
  neutral: Circle,
  info: Info,
  progress: CircleDot,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/** Human-language status with the original backend code exposed via title + sr-only text. */
export function StatusPill({ label, tone, code, size = "md" }: { label: string; tone: Tone; code?: string; size?: "sm" | "md" }) {
  const Icon = TONE_ICON[tone];
  return (
    <span
      title={code}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium max-w-full",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-[13px]",
        TONE_PILL[tone]
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {code && <span className="sr-only"> ({code})</span>}
    </span>
  );
}

const PROV_STYLE: Record<FundingProvenance, { cls: string; icon: LucideIcon }> = {
  REAL_SANDBOX_CAPTURE: { cls: "text-prov-real border-prov-real/40 bg-prov-real/10", icon: ShieldCheck },
  HISTORICAL_SANDBOX_REPLAY: { cls: "text-prov-replay border-prov-replay/40 bg-prov-replay/10", icon: History },
  DEMO_SYNTHETIC: { cls: "text-prov-demo border-prov-demo/40 bg-prov-demo/10", icon: FlaskConical },
  UNFUNDED: { cls: "text-prov-none border-prov-none/30 bg-prov-none/10", icon: WalletMinimal },
};

/** Funding provenance tag. Always shows the machine code so it can never be hidden. */
export function ProvenanceTag({ provenance, lang, showCode = true }: { provenance: FundingProvenance; lang: Lang; showCode?: boolean }) {
  const s = PROV_STYLE[provenance];
  const Icon = s.icon;
  const copy = provenanceCopy(provenance, lang);
  return (
    <span title={copy.explain} className={cx("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.cls)}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {showCode ? <span className="font-mono tracking-tight">{provenance}</span> : copy.short}
    </span>
  );
}

/** Data label of the request/contract itself (SANDBOX_LIVE_TEST vs DEMO_SYNTHETIC). Never hidden. */
export function DataLabelTag({ label }: { label: "DEMO_SYNTHETIC" | "SANDBOX_LIVE_TEST" }) {
  const live = label === "SANDBOX_LIVE_TEST";
  const Icon = live ? ShieldCheck : FlaskConical;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-mono font-medium whitespace-nowrap",
        live ? "text-prov-real border-prov-real/40 bg-prov-real/10" : "text-prov-demo border-prov-demo/40 bg-prov-demo/10"
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6 md:mb-8 animate-enter">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <div className="text-[13px] font-medium text-ink-3">{eyebrow}</div>}
        <h1 className="text-2xl md:text-[30px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[15px] text-ink-2 max-w-2xl">{subtitle}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric card                                                                 */
/* -------------------------------------------------------------------------- */

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  emphasis?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className={cx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", emphasis ? "bg-lime/12 text-lime" : "bg-surface-2 text-ink-3")}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
      </div>
      <div className="text-[28px] leading-none font-semibold tracking-tight text-ink tabular">{value}</div>
      {hint && <div className="text-[13px] text-ink-3 leading-snug">{hint}</div>}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress timeline                                                           */
/* -------------------------------------------------------------------------- */

export function ProgressTimeline({ phases, compact, label }: { phases: Phase[]; compact?: boolean; label: string }) {
  const doneCount = phases.filter((p) => p.state === "done").length;
  if (compact) {
    return (
      <div className="space-y-1.5" aria-label={label}>
        <div className="flex gap-1" aria-hidden="true">
          {phases.map((p) => (
            <span
              key={p.id}
              className={cx(
                "h-1.5 flex-1 rounded-full",
                p.state === "done" ? "bg-lime" : p.state === "current" ? "bg-blue" : p.state === "blocked" ? "bg-danger" : "bg-surface-3"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-ink-3">
          <span className="sr-only">{label}: </span>
          {doneCount}/{phases.length} · {phases.find((p) => p.state === "current" || p.state === "blocked")?.label ?? phases[phases.length - 1]?.label}
        </p>
      </div>
    );
  }
  return (
    <ol className="flex items-start w-full" aria-label={label}>
      {phases.map((p, i) => {
        const last = i === phases.length - 1;
        return (
          <li key={p.id} className="flex-1 min-w-0 flex flex-col items-center text-center relative">
            {!last && (
              <span
                aria-hidden="true"
                className={cx("absolute top-[13px] left-1/2 w-full h-0.5", p.state === "done" ? "bg-lime/70" : "bg-surface-3")}
              />
            )}
            <span
              className={cx(
                "relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-semibold",
                p.state === "done" && "bg-lime border-lime text-lime-ink",
                p.state === "current" && "bg-canvas border-blue text-blue-ink",
                p.state === "blocked" && "bg-canvas border-danger text-danger",
                p.state === "upcoming" && "bg-canvas border-surface-3 text-ink-3"
              )}
            >
              {p.state === "done" ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cx("mt-2 text-xs sm:text-[13px] leading-tight px-1", p.state === "upcoming" ? "text-ink-3" : "text-ink-2 font-medium")}>
              {p.label}
            </span>
            <span className="sr-only">
              {p.state === "done" ? "completed" : p.state === "current" ? "in progress" : p.state === "blocked" ? "blocked" : "pending"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Action card                                                                 */
/* -------------------------------------------------------------------------- */

export function ActionCard({
  icon: Icon,
  title,
  description,
  cta,
  onClick,
  tone = "info",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left flex items-start gap-3 p-4 rounded-xl bg-surface-2/60 border border-line hover:border-line-strong hover:bg-surface-2 transition-colors"
    >
      <span className={cx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", TONE_PILL[tone])}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-[13px] text-ink-3 mt-0.5 leading-snug">{description}</span>
        <span className="inline-flex items-center gap-1 mt-2 text-[13px] font-semibold text-blue-ink group-hover:text-ink transition-colors">
          {cta} <span aria-hidden="true">→</span>
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state & skeleton                                                      */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-3">
      <span className="w-12 h-12 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-ink-3">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-3 max-w-sm">{description}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ lines = 3, className, label = "Loading" }: { lines?: number; className?: string; label?: string }) {
  return (
    <div className={cx("space-y-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded-md bg-surface-3 animate-shimmer" style={{ width: `${92 - i * 14}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Insight panel                                                               */
/* -------------------------------------------------------------------------- */

export function InsightPanel({
  icon: Icon,
  title,
  source,
  items,
  tone = "info",
  footnote,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  source?: string;
  items: string[];
  tone?: Tone;
  footnote?: React.ReactNode;
  empty?: string;
}) {
  const accent: Record<Tone, string> = {
    neutral: "text-ink-2",
    info: "text-blue-ink",
    progress: "text-blue-ink",
    success: "text-ok",
    warning: "text-warn",
    danger: "text-danger",
  };
  return (
    <Card className="p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className={cx("flex items-center gap-2 text-[15px] font-semibold", accent[tone])}>
          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="text-ink">{title}</span>
        </h3>
        {source && <span className="text-xs text-ink-3 text-right shrink-0 max-w-[45%] truncate" title={source}>{source}</span>}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-ink-2 leading-relaxed">
              <span aria-hidden="true" className={cx("mt-2 w-1.5 h-1.5 rounded-full shrink-0", tone === "warning" ? "bg-warn" : tone === "success" ? "bg-ok" : "bg-blue-ink")} />
              <span className="min-w-0 break-words">{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">{empty ?? "—"}</p>
      )}
      {footnote && <div className="text-[13px] text-ink-3 border-t border-line pt-3">{footnote}</div>}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment summary                                                             */
/* -------------------------------------------------------------------------- */

export function PaymentSummary({
  amountUsd,
  provenance,
  lang,
  statusLabel,
  statusTone,
}: {
  amountUsd: string;
  provenance: FundingProvenance;
  lang: Lang;
  statusLabel: string;
  statusTone: Tone;
}) {
  const copy = provenanceCopy(provenance, lang);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[13px] text-ink-3">{lang === "es" ? "Servicio de verificación" : "Verification service"}</div>
          <div className="text-[32px] leading-none font-semibold tracking-tight text-ink tabular mt-1">{amountUsd}</div>
        </div>
        <StatusPill label={statusLabel} tone={statusTone} />
      </div>
      <p className="text-[13px] text-ink-3 leading-snug">
        {lang === "es"
          ? "Este importe paga la inspección y revisión de evidencias. No es el pago del producto que deseas comprar."
          : "This amount pays for the inspection and evidence review. It is not payment for the product you want to buy."}
      </p>
      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-canvas/60 p-3">
        <ProvenanceTag provenance={provenance} lang={lang} />
        <span className="text-[13px] text-ink-2 leading-snug">{copy.explain}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Trust classification                                                        */
/* -------------------------------------------------------------------------- */

export const TRUST_TAG_COPY: Record<string, { en: [string, string]; es: [string, string]; tone: Tone }> = {
  RECORD_INTEGRITY_VERIFIED: {
    en: ["Record integrity verified", "The manifest and photo bytes are sealed with server-computed SHA-256 digests."],
    es: ["Integridad del registro verificada", "El manifiesto y los bytes de las fotos están sellados con hashes SHA-256 del servidor."],
    tone: "success",
  },
  EVIDENCE_REVIEW_COMPLETED: {
    en: ["Evidence review completed", "Submitted photos were analysed by Gemini and decided by an authenticated human operator."],
    es: ["Revisión de evidencia completada", "Las fotos enviadas fueron analizadas por Gemini y decididas por un operador humano autenticado."],
    tone: "info",
  },
  PHYSICAL_AUTHENTICITY_UNVERIFIED: {
    en: ["Physical authenticity not certified", "A photo review cannot certify internal condition or rule out a swap after the photo."],
    es: ["Autenticidad física no certificada", "Revisar una foto no certifica el estado interno ni descarta un cambio posterior."],
    tone: "warning",
  },
  INSUFFICIENT_EVIDENCE: {
    en: ["Insufficient evidence", "One or more required views were missing or inconclusive at review time."],
    es: ["Evidencia insuficiente", "Faltaban vistas obligatorias o no fueron concluyentes al revisar."],
    tone: "danger",
  },
  DEMO_ONLY: {
    en: ["Demo only", "Includes synthetic fixtures or demo funding. Not valid for commercial settlement."],
    es: ["Solo demostración", "Incluye fixtures o financiación sintética. No válido para liquidación comercial."],
    tone: "warning",
  },
};

export function TrustClassification({ tags, lang }: { tags: string[]; lang: Lang }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {tags.map((tag) => {
        const def = TRUST_TAG_COPY[tag];
        const tone = def?.tone ?? "neutral";
        const Icon = TONE_ICON[tone];
        const [title, body] = def ? def[lang] : [tag, ""];
        return (
          <li key={tag} className="flex gap-3 rounded-xl border border-line bg-canvas/50 p-3.5">
            <span className={cx("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", TONE_PILL[tone])}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">{title}</div>
              <p className="text-[13px] text-ink-3 leading-snug mt-0.5">{body}</p>
              <code className="text-xs text-ink-3 font-mono mt-1 block break-all">{tag}</code>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Technical details drawer                                                    */
/* -------------------------------------------------------------------------- */

export function TechnicalDetailsDrawer({
  summary,
  hint,
  children,
  defaultOpen,
  icon: Icon = ShieldCheck,
}: {
  summary: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <details className="group rounded-[var(--radius-card)] border border-line bg-surface open:bg-surface max-w-full overflow-hidden" open={defaultOpen}>
      <summary className="cursor-pointer flex items-center justify-between gap-3 px-5 py-4 min-h-[56px] rounded-[var(--radius-card)] hover:bg-surface-2/60 transition-colors">
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-ink-2 shrink-0">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-ink">{summary}</span>
            {hint && <span className="block text-[13px] text-ink-3">{hint}</span>}
          </span>
        </span>
        <ChevronDown className="w-5 h-5 text-ink-3 transition-transform group-open:rotate-180 shrink-0" aria-hidden="true" />
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>
    </details>
  );
}

export function KeyValue({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-line last:border-0">
      <dt className="text-[13px] text-ink-3 shrink-0 max-w-[45%]">{label}</dt>
      <dd className="flex items-start gap-1.5 min-w-0 justify-end text-right">
        <span className={cx("text-[13px] text-ink break-all", mono && "font-mono")}>{value}</span>
        {copy && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="shrink-0 -my-1 w-8 h-8 rounded-md flex items-center justify-center text-ink-3 hover:text-ink hover:bg-surface-2"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-ok" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        )}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Evidence viewer                                                             */
/* -------------------------------------------------------------------------- */

export interface EvidenceItem {
  artifact_id: string;
  view_label: string;
  view_type: string;
  provenance?: string;
  received_at: string;
}

/**
 * Loads protected previews through the authenticated preview endpoint.
 * Images are never exposed by public URL.
 */
export function EvidenceViewer({
  taskId,
  items,
  token,
  lang,
  emptyLabel,
}: {
  taskId: string;
  items: EvidenceItem[];
  token: string;
  lang: Lang;
  emptyLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [zoom, setZoom] = useState(false);
  const titleId = useId();
  const key = items.map((i) => i.artifact_id).join("|");

  useEffect(() => {
    let cancelled = false;
    setActive(0);
    for (const it of items) {
      void fetch(`/api/v1/verification-requests/${taskId}/evidence/${it.artifact_id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => (r.ok ? ((await r.json()) as { data_url: string }).data_url : null))
        .catch(() => null)
        .then((u) => {
          if (!cancelled) setUrls((prev) => ({ ...prev, [it.artifact_id]: u }));
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, key, token]);

  if (items.length === 0) {
    return (
      <div className="aspect-[4/3] rounded-xl border border-dashed border-line-strong bg-canvas/60 flex flex-col items-center justify-center gap-2 text-ink-3 text-sm p-6 text-center">
        <ImageOff className="w-6 h-6" aria-hidden="true" />
        {emptyLabel}
      </div>
    );
  }
  const cur = items[Math.min(active, items.length - 1)] as EvidenceItem;
  const url = urls[cur.artifact_id];
  return (
    <figure className="space-y-3" aria-labelledby={titleId}>
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-line bg-[#060a14] flex items-center justify-center">
        {url === undefined ? (
          <div className="absolute inset-0 bg-surface-2 animate-shimmer" aria-hidden="true" />
        ) : url ? (
          <img
            src={url}
            alt={`${cur.view_label} — ${lang === "es" ? "evidencia enviada" : "submitted evidence"}`}
            className={cx("max-w-full max-h-full object-contain transition-transform duration-200", zoom && "scale-150")}
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <span className="text-sm text-ink-3 flex items-center gap-2">
            <ImageOff className="w-4 h-4" aria-hidden="true" />
            {lang === "es" ? "Vista previa no disponible" : "Preview unavailable"}
          </span>
        )}
        {url && (
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-canvas/85 backdrop-blur border border-line-strong px-3 min-h-[36px] text-xs font-medium text-ink"
            aria-pressed={zoom}
          >
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
            {zoom ? "100%" : "150%"}
          </button>
        )}
      </div>
      <figcaption id={titleId} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink">{cur.view_label}</span>
        {cur.provenance && (
          <span className={cx("text-xs font-mono", cur.provenance === "DEMO_SYNTHETIC_FIXTURE" ? "text-prov-demo" : "text-prov-real")}>
            {cur.provenance}
          </span>
        )}
      </figcaption>
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={lang === "es" ? "Fotografías recibidas" : "Received photos"}>
          {items.map((it, i) => (
            <button
              key={it.artifact_id}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cx(
                "shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 bg-[#060a14] flex items-center justify-center",
                i === active ? "border-lime" : "border-line hover:border-line-strong"
              )}
              aria-label={it.view_label}
            >
              {urls[it.artifact_id] ? (
                <img src={urls[it.artifact_id] as string} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageOff className="w-4 h-4 text-ink-3" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Toast / inline status                                                       */
/* -------------------------------------------------------------------------- */

export function Toast({
  type,
  text,
  onClose,
  closeLabel,
}: {
  type: "info" | "success" | "error" | "warning";
  text: string;
  onClose: () => void;
  closeLabel: string;
}) {
  const tone: Tone = type === "error" ? "danger" : type === "success" ? "success" : type === "warning" ? "warning" : "info";
  const Icon = TONE_ICON[tone];
  return (
    <div role={type === "error" ? "alert" : "status"} className={cx("animate-enter flex items-start gap-3 rounded-xl border px-4 py-3 bg-surface shadow-[var(--shadow-card)]", TONE_PILL[tone])}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-ink flex-1 min-w-0 break-words">{text}</p>
      <button type="button" onClick={onClose} className="shrink-0 -m-1 w-9 h-9 rounded-md flex items-center justify-center text-ink-2 hover:text-ink hover:bg-surface-2" aria-label={closeLabel}>
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

