/**
 * New verification — 4-step guided wizard.
 * Produces exactly the same POST /api/v1/verification-requests payload as the
 * GATE 2C form (contract + VoI). No payment happens in this screen.
 */
import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Ban, Check, CheckCircle2, FlaskConical } from "lucide-react";
import { computeValueOfInformation, type RequiredView } from "@realityproof/shared";
import type { Lang } from "../i18n.js";
import { formatUsd, viewHint, viewLabel } from "../presentation.js";
import { Button, Card, DataLabelTag, cx } from "../design-system/ui.js";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

const ALL_VIEWS: RequiredView[] = [
  "FRONT_PART",
  "SKU_LABEL_CLOSEUP",
  "PACKAGING_BOX",
  "CONNECTOR_DETAIL",
];

export interface NewVerificationInput {
  itemTitle: string;
  sellerRef: string;
  expectedSku: string;
  requiredViews: RequiredView[];
  instructions: string;
  partPrice: number;
  downtimeCost: number;
  mismatchProb: number;
  verificationFee: number;
}

const inputCls =
  "w-full rounded-[var(--radius-control)] bg-canvas border border-line-strong px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 min-h-[48px] focus:border-blue transition-colors";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function NewVerificationWizard({
  lang,
  isLoading,
  onSubmit,
  onAbstain,
  onCancel,
}: {
  lang: Lang;
  isLoading: boolean;
  onSubmit: (input: NewVerificationInput) => void;
  onAbstain: (msg: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [v, setV] = useState<NewVerificationInput>({
    itemTitle: "[DEMO_SYNTHETIC] FictoParts KX-20 Fuel Injector — SKU FICTO-KX20-040",
    sellerRef: "Guadalajara Distribution Hub #14",
    expectedSku: "FICTO-KX20-040",
    requiredViews: ["FRONT_PART", "SKU_LABEL_CLOSEUP", "PACKAGING_BOX"],
    instructions: "Photograph printed SKU characters clearly; verify OEM box seal is unbroken.",
    partPrice: 220,
    downtimeCost: 80,
    mismatchProb: 0.15,
    verificationFee: 14,
  });
  const set = <K extends keyof NewVerificationInput>(k: K, val: NewVerificationInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const voi = useMemo(
    () =>
      computeValueOfInformation({
        part_purchase_price_usd: v.partPrice > 0 ? v.partPrice : 1,
        estimated_return_or_downtime_cost_usd: v.downtimeCost >= 0 ? v.downtimeCost : 0,
        assumed_mismatch_probability: v.mismatchProb >= 0.01 && v.mismatchProb <= 0.99 ? v.mismatchProb : 0.15,
        verification_fee_usd: v.verificationFee > 0 ? v.verificationFee : 1,
        assumption_source_label: "DEMO_SYNTHETIC_SCENARIO",
      }),
    [v.partPrice, v.downtimeCost, v.mismatchProb, v.verificationFee]
  );

  const steps = [
    tr(lang, "What to verify", "Qué verificar"),
    tr(lang, "Evidence needed", "Evidencias"),
    tr(lang, "Cost & risk", "Coste y riesgo"),
    tr(lang, "Review", "Confirmar"),
  ];

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (v.itemTitle.trim().length < 3) e.itemTitle = tr(lang, "Describe the item in at least 3 characters.", "Describe el artículo con al menos 3 caracteres.");
      if (v.expectedSku.trim().length < 2) e.expectedSku = tr(lang, "Enter the expected manufacturer SKU.", "Introduce el SKU esperado del fabricante.");
    }
    if (s === 1 && v.requiredViews.length === 0) e.requiredViews = tr(lang, "Choose at least one photo.", "Elige al menos una fotografía.");
    if (s === 2) {
      if (v.partPrice <= 0) e.partPrice = tr(lang, "Price must be greater than 0.", "El precio debe ser mayor que 0.");
      if (v.verificationFee <= 0 || v.verificationFee > 500) e.verificationFee = tr(lang, "Fee must be between $1 and $500.", "La tarifa debe estar entre $1 y $500.");
      if (v.downtimeCost < 0) e.downtimeCost = tr(lang, "Cannot be negative.", "No puede ser negativo.");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => {
    if (validate(step)) setStep((s) => Math.min(3, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const recommendVerify = voi.recommendation === "VERIFY_BEFORE_PAYMENT";
  const maxBar = Math.max(voi.expected_loss_without_verification_usd, voi.verification_fee_usd, 1);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Stepper */}
      <nav aria-label={tr(lang, "Wizard progress", "Progreso del asistente")} className="mb-6">
        <p className="sm:hidden text-[13px] text-ink-3 mb-2">
          {tr(lang, `Step ${step + 1} of 4`, `Paso ${step + 1} de 4`)} · <span className="text-ink font-medium">{steps[step]}</span>
        </p>
        <div className="sm:hidden h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-lime transition-[width] duration-300" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
        <ol className="hidden sm:flex items-center gap-2">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2 flex-1 min-w-0" aria-current={i === step ? "step" : undefined}>
              <span
                className={cx(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2",
                  i < step && "bg-lime border-lime text-lime-ink",
                  i === step && "border-blue text-blue-ink",
                  i > step && "border-surface-3 text-ink-3"
                )}
              >
                {i < step ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cx("text-[13px] truncate", i === step ? "text-ink font-medium" : "text-ink-3")}>{label}</span>
              {i < steps.length - 1 && <span className="flex-1 h-px bg-line-strong min-w-[12px]" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </nav>

      <Card as="section" className="p-5 sm:p-8 animate-enter" key={step} aria-labelledby="wizard-step-title">
        {step === 0 && (
          <div className="space-y-5">
            <StepHead
              title={tr(lang, "What do you want to verify?", "¿Qué quieres verificar?")}
              body={tr(lang, "Describe the physical part and the exact SKU the seller promised.", "Describe la pieza física y el SKU exacto que prometió el vendedor.")}
            />
            <Field id="item-title" label={tr(lang, "Item", "Artículo")} error={errors.itemTitle}>
              <input
                id="item-title"
                className={inputCls}
                value={v.itemTitle}
                onChange={(e) => set("itemTitle", e.target.value)}
                aria-invalid={Boolean(errors.itemTitle)}
                aria-describedby={errors.itemTitle ? "item-title-err" : undefined}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field id="expected-sku" label={tr(lang, "Expected SKU", "SKU esperado")} hint={tr(lang, "As printed by the manufacturer.", "Tal como lo imprime el fabricante.")} error={errors.expectedSku}>
                <input
                  id="expected-sku"
                  className={cx(inputCls, "font-mono")}
                  value={v.expectedSku}
                  onChange={(e) => set("expectedSku", e.target.value)}
                  aria-invalid={Boolean(errors.expectedSku)}
                  aria-describedby={errors.expectedSku ? "expected-sku-err" : "expected-sku-hint"}
                />
              </Field>
              <Field id="seller-ref" label={tr(lang, "Seller or warehouse", "Vendedor o almacén")} hint={tr(lang, "Where the verifier will inspect it.", "Dónde lo inspeccionará el verificador.")}>
                <input id="seller-ref" className={inputCls} value={v.sellerRef} onChange={(e) => set("sellerRef", e.target.value)} aria-describedby="seller-ref-hint" />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <StepHead
              title={tr(lang, "What evidence do you need?", "¿Qué evidencias necesitas?")}
              body={tr(lang, "Each selected photo becomes mandatory. A review can't be approved while any is missing.", "Cada foto seleccionada será obligatoria. No se puede aprobar la revisión mientras falte alguna.")}
            />
            <fieldset>
              <legend className="sr-only">{tr(lang, "Required photos", "Fotografías obligatorias")}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_VIEWS.map((view) => {
                  const checked = v.requiredViews.includes(view);
                  return (
                    <label
                      key={view}
                      className={cx(
                        "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors min-h-[72px]",
                        checked ? "border-lime/60 bg-lime/[0.05]" : "border-line bg-canvas/40 hover:border-line-strong"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 w-5 h-5 accent-[#C6FF62] shrink-0"
                        checked={checked}
                        onChange={() =>
                          set("requiredViews", checked ? v.requiredViews.filter((x) => x !== view) : [...v.requiredViews, view])
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{viewLabel(view, lang)}</span>
                        <span className="block text-[13px] text-ink-3 mt-0.5">{viewHint(view, lang)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.requiredViews && <p className="text-[13px] text-danger mt-2">{errors.requiredViews}</p>}
            </fieldset>
            <Field id="verifier-instructions" label={tr(lang, "Instructions for the verifier", "Instrucciones para el verificador")}>
              <textarea
                id="verifier-instructions"
                rows={3}
                className={cx(inputCls, "min-h-[96px] resize-y")}
                value={v.instructions}
                onChange={(e) => set("instructions", e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <StepHead
              title={tr(lang, "How much does it cost, and what risk does it avoid?", "¿Cuánto cuesta y qué riesgo evitas?")}
              body={tr(lang, "Compare the verification fee with what a wrong part could cost you.", "Compara la tarifa de verificación con lo que te costaría una pieza equivocada.")}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field id="verif-fee" label={tr(lang, "Verification fee (USD)", "Tarifa de verificación (USD)")} hint={tr(lang, "Paid via PayPal Sandbox in the next step.", "Se paga con PayPal Sandbox en el siguiente paso.")} error={errors.verificationFee}>
                <input id="verif-fee" type="number" min={1} max={500} step={0.5} className={cx(inputCls, "tabular")} value={v.verificationFee} onChange={(e) => set("verificationFee", Number(e.target.value))} aria-invalid={Boolean(errors.verificationFee)} />
              </Field>
              <Field id="part-price" label={tr(lang, "Part price (USD)", "Precio de la pieza (USD)")} hint={tr(lang, "What you'd pay the seller. Not charged here.", "Lo que pagarías al vendedor. No se cobra aquí.")} error={errors.partPrice}>
                <input id="part-price" type="number" min={1} step={1} className={cx(inputCls, "tabular")} value={v.partPrice} onChange={(e) => set("partPrice", Number(e.target.value))} aria-invalid={Boolean(errors.partPrice)} />
              </Field>
              <Field id="downtime-cost" label={tr(lang, "Return or downtime cost if wrong (USD)", "Coste de devolución o parada si es incorrecta (USD)")} error={errors.downtimeCost}>
                <input id="downtime-cost" type="number" min={0} step={1} className={cx(inputCls, "tabular")} value={v.downtimeCost} onChange={(e) => set("downtimeCost", Number(e.target.value))} />
              </Field>
              <div className="space-y-1.5">
                <label htmlFor="mismatch-prob" className="flex justify-between text-sm font-medium text-ink">
                  <span>{tr(lang, "Estimated risk of a wrong part", "Riesgo estimado de pieza incorrecta")}</span>
                  <span className="tabular text-ink-2">{Math.round(v.mismatchProb * 100)}%</span>
                </label>
                <input id="mismatch-prob" type="range" min={0.01} max={0.6} step={0.01} value={v.mismatchProb} onChange={(e) => set("mismatchProb", Number(e.target.value))} className="w-full accent-[#C6FF62] min-h-[48px]" />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/50 p-5 space-y-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-ink">{tr(lang, "Is it worth verifying?", "¿Vale la pena verificar?")}</h3>
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium",
                    recommendVerify ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/10 text-warn"
                  )}
                  title={voi.recommendation}
                >
                  {recommendVerify ? tr(lang, "Recommended: verify first", "Recomendado: verificar antes") : tr(lang, "Verification may not pay off", "Verificar podría no compensar")}
                </span>
              </div>
              <Bar label={tr(lang, "Verification fee", "Tarifa de verificación")} value={formatUsd(voi.verification_fee_usd, lang)} pct={(voi.verification_fee_usd / maxBar) * 100} color="bg-blue" />
              <Bar label={tr(lang, "Expected loss without verifying", "Pérdida esperada sin verificar")} value={formatUsd(voi.expected_loss_without_verification_usd, lang)} pct={(voi.expected_loss_without_verification_usd / maxBar) * 100} color="bg-warn" />
              <p className="text-[13px] text-ink-3">
                {tr(lang, "Net expected value: ", "Valor neto esperado: ")}
                <span className={cx("font-semibold tabular", voi.net_expected_savings_usd >= 0 ? "text-ok" : "text-danger")}>
                  {voi.net_expected_savings_usd >= 0 ? "+" : ""}
                  {formatUsd(voi.net_expected_savings_usd, lang)}
                </span>
                {" · "}
                {tr(lang, "Estimates based on your inputs (DEMO_SYNTHETIC_SCENARIO), not market data.", "Estimaciones según tus datos (DEMO_SYNTHETIC_SCENARIO), no datos de mercado.")}
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <StepHead
              title={tr(lang, "Review and confirm", "Revisa y confirma")}
              body={tr(lang, "Nothing is charged when you create the request. You'll pay the verification fee in the next screen.", "No se cobra nada al crear la solicitud. Pagarás la tarifa de verificación en la siguiente pantalla.")}
            />
            <ul className="divide-y divide-line rounded-xl border border-line bg-canvas/40">
              <ReviewRow label={tr(lang, "Item", "Artículo")} value={v.itemTitle} onEdit={() => setStep(0)} lang={lang} />
              <ReviewRow label={tr(lang, "Expected SKU", "SKU esperado")} value={v.expectedSku} mono onEdit={() => setStep(0)} lang={lang} />
              <ReviewRow label={tr(lang, "Location", "Ubicación")} value={v.sellerRef || "—"} onEdit={() => setStep(0)} lang={lang} />
              <ReviewRow label={tr(lang, "Required photos", "Fotos obligatorias")} value={v.requiredViews.map((x) => viewLabel(x, lang)).join(" · ")} onEdit={() => setStep(1)} lang={lang} />
            </ul>
            <div className="rounded-xl border border-lime/30 bg-lime/[0.04] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[13px] text-ink-2">{tr(lang, "Verification fee (next step)", "Tarifa de verificación (siguiente paso)")}</div>
                <div className="text-3xl font-semibold tracking-tight text-ink tabular mt-1">{formatUsd(v.verificationFee, lang)}</div>
                <div className="text-[13px] text-ink-3 mt-1">
                  {tr(lang, "PayPal Sandbox · test money · separate from the part price", "PayPal Sandbox · dinero de prueba · independiente del precio de la pieza")}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-3">
                <FlaskConical className="w-4 h-4 text-prov-demo" aria-hidden="true" />
                {tr(lang, "Created as", "Se creará como")} <DataLabelTag label="DEMO_SYNTHETIC" />
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-8 pt-6 border-t border-line">
          <div className="flex gap-2">
            {step === 0 ? (
              <Button variant="ghost" onClick={onCancel}>
                {tr(lang, "Cancel", "Cancelar")}
              </Button>
            ) : (
              <Button variant="ghost" icon={ArrowLeft} onClick={back}>
                {tr(lang, "Back", "Atrás")}
              </Button>
            )}
            {step === 2 && !recommendVerify && (
              <Button
                variant="secondary"
                icon={Ban}
                onClick={() =>
                  onAbstain(
                    tr(
                      lang,
                      `Abstention recorded locally: verification fee exceeds the expected loss (net ${formatUsd(voi.net_expected_savings_usd, lang)}). No request was created.`,
                      `Abstención registrada localmente: la tarifa supera la pérdida esperada (neto ${formatUsd(voi.net_expected_savings_usd, lang)}). No se creó ninguna solicitud.`
                    )
                  )
                }
              >
                {tr(lang, "Don't verify", "No verificar")}
              </Button>
            )}
          </div>
          {step < 3 ? (
            <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={next}>
              {tr(lang, "Continue", "Continuar")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              icon={CheckCircle2}
              loading={isLoading}
              disabled={isLoading}
              onClick={() => {
                if (validate(0) && validate(1) && validate(2)) onSubmit(v);
              }}
            >
              {tr(lang, "Create request & continue to payment", "Crear solicitud y continuar al pago")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function StepHead({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1.5">
      <h2 id="wizard-step-title" className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="text-[15px] text-ink-2">{body}</p>
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1.5">
        <span className="text-ink-2">{label}</span>
        <span className="text-ink font-semibold tabular">{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
        <div className={cx("h-full rounded-full transition-[width] duration-300", color)} style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono, onEdit, lang }: { label: string; value: string; mono?: boolean; onEdit: () => void; lang: Lang }) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <span className="block text-[13px] text-ink-3">{label}</span>
        <span className={cx("block text-sm text-ink mt-0.5 break-words", mono && "font-mono")}>{value}</span>
      </div>
      <button type="button" onClick={onEdit} className="text-[13px] font-medium text-blue-ink hover:text-ink min-h-[40px] px-2 shrink-0" aria-label={`${lang === "es" ? "Editar" : "Edit"} — ${label}`}>
        {lang === "es" ? "Editar" : "Edit"}
      </button>
    </li>
  );
}

