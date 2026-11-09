/**
 * Requester experience: Dashboard 2.0, My verifications, Verification detail,
 * Results list and Activity & payments. All numbers are computed from the
 * GET /verification-requests response — nothing is invented.
 */
import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleCheckBig,
  ClipboardCheck,
  FileSearch,
  Hourglass,
  ListChecks,
  Plus,
  ReceiptText,
  ScrollText,
  Wallet,
} from "lucide-react";
import type { Lang } from "../i18n.js";
import type { AuditTrailEvent, TaskSummary } from "../types.js";
import {
  computeRequesterMetrics,
  displayTitle,
  formatDate,
  formatUsd,
  fundingProvenanceOf,
  humanAuditAction,
  humanStatus,
  isActive,
  isCompleted,
  needsRequesterAction,
  passportOutcome,
  relativeTime,
  requesterPhases,
  viewCompleteness,
  viewLabel,
  type PaymentUiState,
} from "../presentation.js";
import {
  ActionCard,
  Button,
  Card,
  DataLabelTag,
  EmptyState,
  KeyValue,
  LoadingSkeleton,
  MetricCard,
  PageHeader,
  ProgressTimeline,
  ProvenanceTag,
  SectionTitle,
  StatusPill,
  TechnicalDetailsDrawer,
  cx,
} from "../design-system/ui.js";
import { FinancialSequenceRail } from "../design-system/components.js";
import { PaymentExperience } from "./PaymentExperience.js";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

function sortRecent(tasks: TaskSummary[]) {
  return [...tasks].sort((a, b) => (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? ""));
}

/* -------------------------------------------------------------------------- */
/* Verification card                                                           */
/* -------------------------------------------------------------------------- */

export function VerificationCard({
  task,
  lang,
  onOpen,
  onOpenResult,
}: {
  task: TaskSummary;
  lang: Lang;
  onOpen: () => void;
  onOpenResult: () => void;
}) {
  const hs = humanStatus(task, lang);
  const phases = requesterPhases(task, lang);
  const prov = fundingProvenanceOf(task);
  const action = task.proof_passport
    ? { label: tr(lang, "View result", "Ver resultado"), onClick: onOpenResult, variant: "secondary" as const }
    : needsRequesterAction(task)
      ? { label: tr(lang, "Pay verification", "Pagar verificación"), onClick: onOpen, variant: "secondary" as const }
      : { label: tr(lang, "View details", "Ver detalle"), onClick: onOpen, variant: "ghost" as const };
  return (
    <article className="group rounded-xl border border-line bg-surface hover:border-line-strong transition-colors p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={hs.label} tone={hs.tone} code={hs.code} size="sm" />
            <DataLabelTag label={task.contract.synthetic_label} />
            {prov !== "UNFUNDED" && <ProvenanceTag provenance={prov} lang={lang} showCode={false} />}
          </div>
          <h3 className="text-[15px] font-semibold text-ink leading-snug">
            <button type="button" onClick={onOpen} className="text-left hover:underline underline-offset-4 decoration-ink-3" title={task.contract.item_title}>
              {displayTitle(task.contract.item_title)}
            </button>
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
            <span>
              SKU <span className="font-mono text-ink-2">{task.contract.expected_sku}</span>
            </span>
            <span className="tabular">{formatUsd(task.contract.max_verification_budget, lang)}</span>
            {(task.updated_at || task.created_at) && <span>{relativeTime(task.updated_at ?? task.created_at, lang)}</span>}
          </div>
        </div>
        <div className="sm:w-56 shrink-0 flex flex-col gap-3">
          <ProgressTimeline phases={phases} compact label={tr(lang, "Progress", "Progreso")} />
          <Button variant={action.variant} size="sm" iconRight={ArrowRight} onClick={action.onClick} className="w-full sm:w-auto sm:self-end">
            {action.label}
          </Button>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export function RequesterDashboard({
  tasks,
  loaded,
  lang,
  onNew,
  onOpenTask,
  onOpenResult,
  onSeeAll,
  onOpenActivity,
  onHelp,
}: {
  tasks: TaskSummary[];
  loaded: boolean;
  lang: Lang;
  onNew: () => void;
  onOpenTask: (id: string) => void;
  onOpenResult: (id: string) => void;
  onSeeAll: () => void;
  onOpenActivity: () => void;
  onHelp: () => void;
}) {
  const m = useMemo(() => computeRequesterMetrics(tasks), [tasks]);
  const recent = useMemo(() => sortRecent(tasks).slice(0, 4), [tasks]);
  const actionTasks = tasks.filter(needsRequesterAction);
  const resultTasks = sortRecent(tasks.filter((t) => t.proof_passport)).slice(0, 2);
  const events = useMemo(() => collectEvents(tasks).slice(0, 5), [tasks]);

  return (
    <>
      <PageHeader
        title={tr(lang, "Your verifications", "Tus verificaciones")}
        subtitle={tr(
          lang,
          "Check spare parts in the physical world before paying the seller. Follow each request and open its result.",
          "Comprueba repuestos en el mundo físico antes de pagar al vendedor. Sigue cada solicitud y abre su resultado."
        )}
        actions={
          <>
            <Button variant="ghost" onClick={onHelp} className="hidden sm:inline-flex">
              {tr(lang, "How it works", "Cómo funciona")}
            </Button>
            <Button variant="primary" icon={Plus} onClick={onNew}>
              {tr(lang, "New verification", "Nueva verificación")}
            </Button>
          </>
        }
      />

      {!loaded ? (
        <Card className="p-6">
          <LoadingSkeleton lines={4} label={tr(lang, "Loading verifications", "Cargando verificaciones")} />
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSearch}
            title={tr(lang, "No verifications yet", "Aún no tienes verificaciones")}
            description={tr(lang, "Create your first request to have a part inspected before you pay for it.", "Crea tu primera solicitud para inspeccionar una pieza antes de pagarla.")}
            action={
              <Button variant="primary" icon={Plus} onClick={onNew}>
                {tr(lang, "New verification", "Nueva verificación")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <section aria-label={tr(lang, "Summary", "Resumen")} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-enter">
            <MetricCard icon={Activity} label={tr(lang, "Active requests", "Solicitudes activas")} value={m.active} hint={tr(lang, `of ${m.total} total`, `de ${m.total} en total`)} />
            <MetricCard
              icon={Hourglass}
              label={tr(lang, "Waiting on you", "Pendientes de tu acción")}
              value={m.pendingAction}
              emphasis={m.pendingAction > 0}
              hint={m.pendingAction > 0 ? tr(lang, "Payment needed", "Requieren pago") : tr(lang, "You're all caught up", "Estás al día")}
            />
            <MetricCard icon={CircleCheckBig} label={tr(lang, "Reviews completed", "Revisiones completadas")} value={m.completed} hint={tr(lang, "With a result or final decision", "Con resultado o decisión final")} />
            <MetricCard
              icon={Wallet}
              label={tr(lang, "Confirmed payments", "Pagos confirmados")}
              value={formatUsd(m.realSandboxPayments.totalUsd, lang)}
              hint={
                <>
                  {tr(lang, `${m.realSandboxPayments.count} real Sandbox capture(s)`, `${m.realSandboxPayments.count} captura(s) reales en Sandbox`)}
                  {m.demoFunded > 0 && (
                    <span className="block text-prov-demo">
                      {tr(lang, `+${m.demoFunded} demo, not counted`, `+${m.demoFunded} demo, no suman`)}
                    </span>
                  )}
                </>
              }
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <section className="lg:col-span-8 min-w-0" aria-labelledby="recent-title">
              <SectionTitle
                id="recent-title"
                title={tr(lang, "Recent verifications", "Verificaciones recientes")}
                action={
                  <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={onSeeAll}>
                    {tr(lang, "See all", "Ver todas")}
                  </Button>
                }
              />
              <div className="space-y-3">
                {recent.map((t) => (
                  <VerificationCard key={t.task_id} task={t} lang={lang} onOpen={() => onOpenTask(t.task_id)} onOpenResult={() => onOpenResult(t.task_id)} />
                ))}
              </div>
            </section>

            <aside className="lg:col-span-4 space-y-6 min-w-0">
              <section aria-labelledby="next-title">
                <SectionTitle id="next-title" title={tr(lang, "Next actions", "Próximas acciones")} />
                <div className="space-y-3">
                  {actionTasks.map((t) => (
                    <ActionCard
                      key={t.task_id}
                      icon={Wallet}
                      tone="warning"
                      title={tr(lang, "Pay to start the inspection", "Paga para iniciar la inspección")}
                      description={`${displayTitle(t.contract.item_title)} · ${formatUsd(t.contract.max_verification_budget, lang)}`}
                      cta={tr(lang, "Go to payment", "Ir al pago")}
                      onClick={() => onOpenTask(t.task_id)}
                    />
                  ))}
                  {resultTasks.map((t) => (
                    <ActionCard
                      key={`r-${t.task_id}`}
                      icon={BadgeCheck}
                      tone="success"
                      title={tr(lang, "Result available", "Resultado disponible")}
                      description={displayTitle(t.contract.item_title)}
                      cta={tr(lang, "Open Proof Passport", "Abrir Proof Passport")}
                      onClick={() => onOpenResult(t.task_id)}
                    />
                  ))}
                  {actionTasks.length === 0 && resultTasks.length === 0 && (
                    <Card className="p-4 text-sm text-ink-3">{tr(lang, "Nothing needs your attention right now.", "Nada requiere tu atención ahora mismo.")}</Card>
                  )}
                </div>
              </section>

              <section aria-labelledby="activity-title">
                <SectionTitle
                  id="activity-title"
                  title={tr(lang, "Recent activity", "Actividad reciente")}
                  action={
                    <Button variant="ghost" size="sm" onClick={onOpenActivity}>
                      {tr(lang, "All", "Todo")}
                    </Button>
                  }
                />
                <Card className="p-2">
                  {events.length === 0 ? (
                    <p className="text-sm text-ink-3 p-3">{tr(lang, "No activity yet.", "Sin actividad todavía.")}</p>
                  ) : (
                    <ul>
                      {events.map(({ ev, task }) => (
                        <li key={ev.event_id} className="flex gap-3 px-3 py-2.5">
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-ink shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-sm text-ink">{humanAuditAction(ev.action, lang)}</p>
                            <p className="text-xs text-ink-3 truncate">
                              {displayTitle(task.contract.item_title)} · {relativeTime(ev.created_at, lang)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}

function collectEvents(tasks: TaskSummary[]): Array<{ ev: AuditTrailEvent; task: TaskSummary }> {
  const out: Array<{ ev: AuditTrailEvent; task: TaskSummary }> = [];
  for (const t of tasks) for (const ev of t.audit_trail ?? []) out.push({ ev, task: t });
  return out.sort((a, b) => b.ev.created_at.localeCompare(a.ev.created_at));
}

/* -------------------------------------------------------------------------- */
/* My verifications                                                            */
/* -------------------------------------------------------------------------- */

type Filter = "all" | "action" | "progress" | "done";

export function MyVerifications({
  tasks,
  lang,
  onOpenTask,
  onOpenResult,
  onNew,
}: {
  tasks: TaskSummary[];
  lang: Lang;
  onOpenTask: (id: string) => void;
  onOpenResult: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = {
    all: tasks.length,
    action: tasks.filter(needsRequesterAction).length,
    progress: tasks.filter((t) => isActive(t) && !needsRequesterAction(t)).length,
    done: tasks.filter(isCompleted).length,
  };
  const list = sortRecent(
    tasks.filter((t) =>
      filter === "all" ? true : filter === "action" ? needsRequesterAction(t) : filter === "progress" ? isActive(t) && !needsRequesterAction(t) : isCompleted(t)
    )
  );
  const chips: Array<[Filter, string]> = [
    ["all", tr(lang, "All", "Todas")],
    ["action", tr(lang, "Need your action", "Requieren acción")],
    ["progress", tr(lang, "In progress", "En curso")],
    ["done", tr(lang, "Completed", "Completadas")],
  ];
  return (
    <>
      <PageHeader
        title={tr(lang, "My verifications", "Mis verificaciones")}
        subtitle={tr(lang, "Every request you created, with its real payment and review status.", "Todas tus solicitudes con su estado real de pago y revisión.")}
        actions={
          <Button variant="primary" icon={Plus} onClick={onNew}>
            {tr(lang, "New verification", "Nueva verificación")}
          </Button>
        }
      />
      <div role="group" aria-label={tr(lang, "Filter", "Filtrar")} className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {chips.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cx(
              "shrink-0 inline-flex items-center gap-2 rounded-full border px-4 min-h-[40px] text-sm font-medium transition-colors",
              filter === id ? "bg-ink text-canvas border-ink" : "border-line-strong text-ink-2 hover:text-ink hover:bg-surface-2"
            )}
          >
            {label}
            <span className={cx("tabular text-xs", filter === id ? "text-canvas/70" : "text-ink-3")}>{counts[id]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={ListChecks} title={tr(lang, "Nothing here", "No hay nada aquí")} description={tr(lang, "No requests match this filter.", "Ninguna solicitud coincide con este filtro.")} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <VerificationCard key={t.task_id} task={t} lang={lang} onOpen={() => onOpenTask(t.task_id)} onOpenResult={() => onOpenResult(t.task_id)} />
          ))}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Verification detail                                                         */
/* -------------------------------------------------------------------------- */

export function VerificationDetail({
  task,
  lang,
  paymentState,
  isLoading,
  onBack,
  onOpenResult,
  payment,
}: {
  task: TaskSummary;
  lang: Lang;
  paymentState: PaymentUiState;
  isLoading: boolean;
  onBack: () => void;
  onOpenResult: () => void;
  payment: {
    onCreateOrder: () => void;
    onVerifyRemote: () => void;
    onCapture: () => void;
    onSimulateDemo: () => void;
    onReplayHistorical: () => void;
    onTestGuard: () => void;
  };
}) {
  const hs = humanStatus(task, lang);
  const phases = requesterPhases(task, lang);
  const vc = viewCompleteness(task);
  const outcome = task.proof_passport ? passportOutcome(task.proof_passport, lang) : null;

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-4 min-h-[40px]">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {tr(lang, "My verifications", "Mis verificaciones")}
      </button>
      <PageHeader
        title={displayTitle(task.contract.item_title)}
        subtitle={hs.description}
        meta={
          <>
            <StatusPill label={hs.label} tone={hs.tone} code={hs.code} />
            <DataLabelTag label={task.contract.synthetic_label} />
            <ProvenanceTag provenance={fundingProvenanceOf(task)} lang={lang} />
          </>
        }
        actions={
          task.proof_passport ? (
            <Button variant="primary" icon={BadgeCheck} onClick={onOpenResult}>
              {tr(lang, "Open result", "Abrir resultado")}
            </Button>
          ) : undefined
        }
      />

      <Card className="p-5 sm:p-6 mb-6">
        <ProgressTimeline phases={phases} label={tr(lang, "Request progress", "Progreso de la solicitud")} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {outcome && (
            <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between border-ok/25">
              <div>
                <h2 className="text-lg font-semibold text-ink">{outcome.headline}</h2>
                <p className="text-sm text-ink-3 mt-1">{outcome.sub}</p>
              </div>
              <Button variant="secondary" iconRight={ArrowRight} onClick={onOpenResult}>
                {tr(lang, "View Proof Passport", "Ver Proof Passport")}
              </Button>
            </Card>
          )}

          <PaymentExperience task={task} state={paymentState} lang={lang} isLoading={isLoading} {...payment} />
        </div>

        <aside className="lg:col-span-4 space-y-6 min-w-0">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink mb-3">{tr(lang, "Request summary", "Resumen de la solicitud")}</h2>
            <dl>
              <KeyValue label={tr(lang, "Expected SKU", "SKU esperado")} value={task.contract.expected_sku} mono />
              <KeyValue label={tr(lang, "Location", "Ubicación")} value={task.contract.seller_reference} />
              <KeyValue label={tr(lang, "Deadline", "Fecha límite")} value={formatDate(task.contract.deadline_at, lang, true)} />
              <KeyValue label={tr(lang, "Verification fee", "Tarifa de verificación")} value={formatUsd(task.contract.max_verification_budget, lang)} />
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-ink">{tr(lang, "Required photos", "Fotos obligatorias")}</h2>
              <span className="text-[13px] text-ink-3 tabular">
                {vc.satisfied}/{vc.required.length}
              </span>
            </div>
            <ul className="space-y-2">
              {vc.required.map((view) => {
                const ok = !vc.missing.includes(view);
                return (
                  <li key={view} className="flex items-center gap-2.5 text-sm">
                    {ok ? <ClipboardCheck className="w-4 h-4 text-ok shrink-0" aria-hidden="true" /> : <Hourglass className="w-4 h-4 text-ink-3 shrink-0" aria-hidden="true" />}
                    <span className={ok ? "text-ink" : "text-ink-3"}>{viewLabel(view, lang)}</span>
                    <span className="sr-only">{ok ? tr(lang, "received", "recibida") : tr(lang, "pending", "pendiente")}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink mb-3">{tr(lang, "History", "Historial")}</h2>
            {(task.audit_trail ?? []).length === 0 ? (
              <p className="text-sm text-ink-3">{tr(lang, "No events yet.", "Sin eventos todavía.")}</p>
            ) : (
              <ol className="relative border-l border-line ml-1.5 space-y-4">
                {[...(task.audit_trail ?? [])].reverse().map((ev) => (
                  <li key={ev.event_id} className="pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-surface-3 border border-line-strong" aria-hidden="true" />
                    <p className="text-sm text-ink">{humanAuditAction(ev.action, lang)}</p>
                    <p className="text-xs text-ink-3">{formatDate(ev.created_at, lang, true)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>

      <div className="mt-6">
        <TechnicalDetailsDrawer
          icon={ScrollText}
          summary={tr(lang, "Technical trace", "Traza técnica")}
          hint={tr(lang, "Backend status codes, deterministic financial sequence and raw audit events", "Códigos de estado, secuencia financiera determinista y eventos de auditoría")}
        >
          <dl>
            <KeyValue label="task_id" value={task.task_id} mono copy />
            <KeyValue label="status" value={task.status} mono />
            <KeyValue label="synthetic_label" value={task.contract.synthetic_label} mono />
            <KeyValue label="evidence_completeness.status" value={vc.status ?? "—"} mono />
          </dl>
          <FinancialSequenceRail completedSteps={task.financial_sequence ?? []} />
          <ol className="space-y-2">
            {(task.audit_trail ?? []).map((ev) => (
              <li key={ev.event_id} className="rounded-lg border border-line bg-canvas/50 p-3 text-xs">
                <div className="flex flex-wrap gap-2 font-mono">
                  <span className="text-ink">{ev.action}</span>
                  <span className="text-ink-3">
                    {ev.actor_role} ({ev.actor_id})
                  </span>
                  {ev.from_status && ev.to_status && (
                    <span className="text-ink-2">
                      {ev.from_status} → {ev.to_status}
                    </span>
                  )}
                </div>
                <code className="block mt-1 text-ink-3 break-all">{JSON.stringify(ev.metadata)}</code>
              </li>
            ))}
          </ol>
        </TechnicalDetailsDrawer>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

export function ResultsList({ tasks, lang, onOpenResult, onSeeVerifications }: { tasks: TaskSummary[]; lang: Lang; onOpenResult: (id: string) => void; onSeeVerifications: () => void }) {
  const withPassport = sortRecent(tasks.filter((t) => t.proof_passport));
  return (
    <>
      <PageHeader
        title={tr(lang, "Results & Proof Passports", "Resultados y Proof Passports")}
        subtitle={tr(lang, "What was reviewed, what matched, and what could not be confirmed.", "Qué se revisó, qué coincidió y qué no pudo comprobarse.")}
      />
      {withPassport.length === 0 ? (
        <Card>
          <EmptyState
            icon={BadgeCheck}
            title={tr(lang, "No results yet", "Aún no hay resultados")}
            description={tr(lang, "A Proof Passport appears here after a human operator reviews the evidence.", "Un Proof Passport aparece aquí cuando un operador humano revisa la evidencia.")}
            action={<Button onClick={onSeeVerifications}>{tr(lang, "See my verifications", "Ver mis verificaciones")}</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {withPassport.map((t) => {
            const p = t.proof_passport!;
            const o = passportOutcome(p, lang);
            const vc = viewCompleteness(t);
            return (
              <Card as="article" key={t.task_id} className="p-5 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={o.headline} tone={o.tone} code={`${p.status} · ${o.approval}`} size="sm" />
                  <DataLabelTag label={p.synthetic_label} />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">{displayTitle(t.contract.item_title)}</h2>
                  <p className="text-[13px] text-ink-3 mt-1">{o.sub}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="text-ink-3">{tr(lang, "Photos", "Fotos")}</dt>
                    <dd className="text-ink tabular">
                      {vc.satisfied}/{vc.required.length} {tr(lang, "required", "obligatorias")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">{tr(lang, "Reviewed", "Revisado")}</dt>
                    <dd className="text-ink">{formatDate(p.reviewer_decision.reviewed_at, lang)}</dd>
                  </div>
                </dl>
                <Button variant="secondary" iconRight={ArrowRight} onClick={() => onOpenResult(t.task_id)} className="mt-auto">
                  {tr(lang, "Open Proof Passport", "Abrir Proof Passport")}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity & payments                                                         */
/* -------------------------------------------------------------------------- */

export function ActivityPayments({ tasks, lang, onOpenTask }: { tasks: TaskSummary[]; lang: Lang; onOpenTask: (id: string) => void }) {
  const m = computeRequesterMetrics(tasks);
  const events = collectEvents(tasks).slice(0, 30);
  const ledger = sortRecent(tasks);
  return (
    <>
      <PageHeader
        title={tr(lang, "Activity & payments", "Actividad y pagos")}
        subtitle={tr(lang, "Verification payments by provenance. Demo and replay records never add to real Sandbox totals.", "Pagos de verificación por procedencia. Los registros demo y replay nunca suman a los totales reales de Sandbox.")}
      />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8" aria-label={tr(lang, "Totals", "Totales")}>
        <MetricCard icon={Wallet} emphasis label={tr(lang, "Real Sandbox captures", "Capturas reales en Sandbox")} value={formatUsd(m.realSandboxPayments.totalUsd, lang)} hint={tr(lang, `${m.realSandboxPayments.count} capture(s)`, `${m.realSandboxPayments.count} captura(s)`)} />
        <MetricCard icon={ReceiptText} label={tr(lang, "Demo funded", "Financiadas en demo")} value={m.demoFunded} hint={tr(lang, "No money moved", "Sin movimiento de dinero")} />
        <MetricCard icon={ScrollText} label={tr(lang, "Historical replays", "Replays históricos")} value={m.replayAttached} hint={tr(lang, "Read-only, does not fund", "Solo lectura, no financia")} />
      </section>

      <section aria-labelledby="ledger-title" className="mb-8">
        <SectionTitle id="ledger-title" title={tr(lang, "Verification payments", "Pagos de verificación")} />
        <Card className="divide-y divide-line">
          {ledger.map((t) => {
            const prov = fundingProvenanceOf(t);
            return (
              <div key={t.task_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpenTask(t.task_id)} className="text-sm font-medium text-ink hover:underline underline-offset-4 text-left">
                    {displayTitle(t.contract.item_title)}
                  </button>
                  <p className="text-xs text-ink-3 font-mono mt-0.5 break-all">
                    {t.paypal_order ? `${t.paypal_order.orderId}${t.paypal_order.captureId ? ` · ${t.paypal_order.captureId}` : ""}` : tr(lang, "No PayPal order", "Sin orden PayPal")}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <ProvenanceTag provenance={prov} lang={lang} />
                  <span className={cx("text-sm font-semibold tabular w-20 text-right", prov === "REAL_SANDBOX_CAPTURE" ? "text-ink" : "text-ink-3 line-through decoration-ink-3/60")}>
                    {formatUsd(t.contract.max_verification_budget, lang)}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
        <p className="text-[13px] text-ink-3 mt-2">
          {tr(lang, "Struck-through amounts are not real Sandbox captures and are excluded from totals.", "Los importes tachados no son capturas reales de Sandbox y se excluyen de los totales.")}
        </p>
      </section>

      <section aria-labelledby="events-title">
        <SectionTitle id="events-title" title={tr(lang, "Activity", "Actividad")} />
        <Card className="p-2">
          {events.length === 0 ? (
            <p className="text-sm text-ink-3 p-3">{tr(lang, "No activity yet.", "Sin actividad todavía.")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {events.map(({ ev, task }) => (
                <li key={ev.event_id} className="px-3 py-3">
                  <details>
                    <summary className="cursor-pointer flex items-start justify-between gap-3 min-h-[40px]">
                      <span className="min-w-0">
                        <span className="block text-sm text-ink">{humanAuditAction(ev.action, lang)}</span>
                        <span className="block text-xs text-ink-3 truncate">{displayTitle(task.contract.item_title)}</span>
                      </span>
                      <span className="text-xs text-ink-3 shrink-0">{formatDate(ev.created_at, lang, true)}</span>
                    </summary>
                    <code className="block mt-2 text-xs text-ink-3 break-all font-mono">
                      {ev.action} · {ev.actor_role} ({ev.actor_id}){ev.from_status ? ` · ${ev.from_status} → ${ev.to_status}` : ""} · {JSON.stringify(ev.metadata)}
                    </code>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}

