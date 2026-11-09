import React, { useEffect, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Cpu,
} from "lucide-react";
import { I18N, type Lang } from "../i18n.js";
import { ProvenanceBadge } from "../design-system/components.js";

interface BenchmarkCaseRecord {
  status: string;
  latency_ms: number;
  estimated_cost_usd?: number;
  result: {
    observed_sku: string | null;
    matches_expected: string;
    visible_evidence: string[];
    unverifiable_claims: string[];
    limitations: string[];
    additional_evidence_needed: string[];
    needs_human_review: boolean;
    safety_flags: string[];
    confidence_level: string;
    confidence_note: string;
    recommended_decision: string;
    model_id: string;
    analyzed_at: string;
  };
}

interface BenchmarkResponse {
  benchmark_report: {
    selected_low_latency_model?: string;
    cases?: Record<string, BenchmarkCaseRecord>;
  };
  fixtures: {
    sku_match: string;
    sku_mismatch: string;
    adversarial_prompt_injection: string;
  };
}

export function JudgeDemoWorkspace({
  lang,
  onSelectLiveCompletedTask,
  onOpenRequesterNewContract,
}: {
  lang: Lang;
  onSelectLiveCompletedTask: () => void;
  onOpenRequesterNewContract: () => void;
}) {
  const t = I18N[lang];
  const [benchmarks, setBenchmarks] = useState<BenchmarkResponse | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<
    "sku_match" | "sku_mismatch" | "adversarial_prompt_injection"
  >("sku_match");
  const [tourStep, setTourStep] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    async function loadBenchmarks() {
      try {
        const res = await fetch("/api/v1/demo/gemini-benchmarks");
        if (res.ok) {
          const data = (await res.json()) as BenchmarkResponse;
          if (!cancelled) {
            setBenchmarks(data);
          }
        }
      } catch {
        // Ignore error
      }
    }
    void loadBenchmarks();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentCase =
    benchmarks?.benchmark_report?.cases?.[selectedCaseId] ?? null;
  const currentFixtureUrl = benchmarks?.fixtures?.[selectedCaseId] ?? null;

  const guidedSteps = [
    {
      num: 1,
      time: "0:00 – 0:18",
      title:
        lang === "es"
          ? "1. El Problema y Valor de la Información (VoI)"
          : "1. The Problem & Value of Information (VoI)",
      summary:
        lang === "es"
          ? "Un agente de IA o comprador B2B necesita adquirir un inyector de combustible ($220 USD) con $80 USD de pérdida por parada si el SKU es incorrecto (15% de riesgo = $45 USD de pérdida esperada). Pagar $14 USD por verificar antes de comprar genera +$31 USD de ahorro neto esperado."
          : "An AI agent or B2B buyer wants to purchase a fuel injector ($220 USD) with $80 USD downtime loss if the wrong SKU arrives (15% risk = $45 USD expected loss). Paying $14 USD to verify before buying yields +$31 USD net expected savings.",
    },
    {
      num: 2,
      time: "0:18 – 0:38",
      title:
        lang === "es"
          ? "2. Financiación Real en PayPal Sandbox (Orders v2)"
          : "2. Real PayPal Sandbox Verification Funding (Orders v2)",
      summary:
        lang === "es"
          ? "Orden real 4J744493RC470905K creada por $14.00 USD, aprobada interactivamente por el comprador (Payer 9JA4ASWAD26DL) y capturada con idempotencia (Capture ID 0TL320715J3450828). Ninguna captura ocurre sin aprobación previa."
          : "Real Sandbox Order 4J744493RC470905K created for $14.00 USD, interactively approved by the buyer (Payer 9JA4ASWAD26DL), and captured idempotently (Capture ID 0TL320715J3450828). Unapproved captures are deterministically blocked.",
    },
    {
      num: 3,
      time: "0:38 – 0:58",
      title:
        lang === "es"
          ? "3. Inspección Multimodal Gemini 3.5 Flash Lite (~1.5s)"
          : "3. Gemini 3.5 Flash Lite Multimodal Inspection (~1.5s)",
      summary:
        lang === "es"
          ? "El servidor valida bytes mágicos PNG, calcula SHA-256 y ejecuta Gemini 3.5 Flash Lite en ~1.5–2.0 segundos con validación Zod estricta, separando observaciones en píxeles de afirmaciones no comprobables."
          : "The backend validates PNG magic bytes, computes SHA-256, and runs Gemini 3.5 Flash Lite in ~1.5–2.0 seconds with strict Zod validation—separating pixel observations from unverifiable claims.",
    },
    {
      num: 4,
      time: "0:58 – 1:15",
      title:
        lang === "es"
          ? "4. Puerta Determinista Humana y Separación de Funciones"
          : "4. Deterministic Human Gate & Separation of Duties",
      summary:
        lang === "es"
          ? "La IA nunca ejecuta pagos por sí sola. Un Operador humano (distinto del Solicitante y del Verificador) revisa la evidencia y autoriza la emisión del Proof Passport."
          : "AI never executes financial operations autonomously. An authenticated human Operator (distinct from Requester and Verifier) reviews the evidence and authorizes Proof Passport issuance.",
    },
    {
      num: 5,
      time: "1:15 – 1:30",
      title:
        lang === "es"
          ? "5. Proof Passport v0 y Reality Lens"
          : "5. Proof Passport v0 & Reality Lens",
      summary:
        lang === "es"
          ? "Se emite el registro verificable proof_67de385f-29d con hash canónico SHA-256, traza de captura PayPal 0TL320715J3450828 y URL de lectura firmada con HMAC-SHA256."
          : "Verifiable record proof_67de385f-29d is issued with canonical SHA-256 manifest digest, PayPal capture trace 0TL320715J3450828, and HMAC-SHA256 signed read URL.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <section
        aria-label="Judge Walkthrough Header"
        className="bg-[#151E32] border border-[#C6FF62]/50 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#C6FF62]" aria-hidden="true" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C6FF62]">
              SANDBOX JUDGE WORKSPACE — 90-SECOND GUIDED EVALUATION
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceBadge label="SANDBOX_LIVE_TEST" />
            <ProvenanceBadge label="DEMO_SYNTHETIC" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">{t.judgeTitle}</h2>
          <p className="text-xs text-slate-300 mt-1">{t.judgeSubtitle}</p>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={onSelectLiveCompletedTask}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C6FF62] hover:bg-[#b5f050] text-[#0B1020] font-bold text-xs min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {lang === "es"
                ? "Abrir Proof Passport Real (Orden 4J744493RC470905K → Captura 0TL320715J3450828)"
                : "Inspect Live Proof Passport (Order 4J744493RC470905K → Capture 0TL320715J3450828)"}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onOpenRequesterNewContract}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C2742] hover:bg-slate-800 border-2 border-[#4A7BFF] text-white font-semibold text-xs min-h-[44px]"
          >
            <span>
              {lang === "es"
                ? "Probar Simulador Interactivo de Nueva Solicitud (DEMO_SYNTHETIC)"
                : "Try Interactive New Request Simulator (DEMO_SYNTHETIC)"}
            </span>
          </button>
        </div>
      </section>

      {/* 5-Step 90-Second Interactive Storyboard */}
      <section
        aria-label="90-Second Guided Storyboard"
        className="bg-[#151E32] border border-slate-700/80 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white">
            {lang === "es"
              ? "Recorrido Guiado en 5 Pasos (< 90 Segundos)"
              : "5-Step Guided Architecture & UX Tour (< 90 Seconds)"}
          </h3>
          <span className="text-xs font-mono text-slate-300">
            Step {tourStep} / 5
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {guidedSteps.map((step) => {
            const isSelected = tourStep === step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setTourStep(step.num)}
                className={`text-left rounded-lg p-3 border transition min-h-[76px] flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#1C2742] border-[#C6FF62] text-white"
                    : "bg-[#0B1020] border-slate-800 text-slate-300 hover:bg-slate-900"
                }`}
              >
                <span className="text-xs font-mono text-[#C6FF62] font-bold">
                  {step.time}
                </span>
                <span className="text-xs font-semibold leading-snug mt-1">
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>

        {guidedSteps
          .filter((s) => s.num === tourStep)
          .map((activeStep) => (
            <div
              key={activeStep.num}
              className="bg-[#0B1020] border border-slate-700 rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-[#C6FF62]">
                  {activeStep.title}
                </h4>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-[#151E32] text-[#93B4FF] border border-[#4A7BFF]/40">
                  {activeStep.time}
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {activeStep.summary}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <span>
                  {lang === "es"
                    ? "Nota para jueces: No necesitas claves privadas para inspeccionar las pruebas reales grabadas."
                    : "Judge note: No private API keys are required to inspect the recorded live Sandbox & Gemini proofs."}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={tourStep <= 1}
                    onClick={() => setTourStep((s) => Math.max(1, s - 1))}
                    className="px-3 py-1.5 rounded bg-[#151E32] disabled:opacity-40 text-white border border-slate-700 min-h-[36px]"
                  >
                    {lang === "es" ? "Anterior" : "Previous"}
                  </button>
                  <button
                    type="button"
                    disabled={tourStep >= 5}
                    onClick={() => setTourStep((s) => Math.min(5, s + 1))}
                    className="px-3 py-1.5 rounded bg-[#C6FF62] disabled:opacity-40 text-[#0B1020] font-bold min-h-[36px]"
                  >
                    {lang === "es" ? "Siguiente Paso" : "Next Step"}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </section>

      {/* Live Gemini 3.5 Flash Lite Multimodal Benchmark Explorer (3 Real Recorded Cases) */}
      <section
        aria-label="Live Gemini 3.5 Flash Lite Multimodal Benchmark Explorer"
        className="bg-[#151E32] border border-slate-700/80 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#C6FF62]" aria-hidden="true" />
              {lang === "es"
                ? "Explorador de Pruebas Multimodales Reales de Gemini 3.5 Flash Lite"
                : "Real Gemini 3.5 Flash Lite Multimodal Inspection Benchmarks"}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {lang === "es"
                ? "Compara cómo responde Gemini API ante un SKU coincidente (1,493 ms), un SKU diferente (2,006 ms) y un ataque de inyección de prompt en imagen (1,696 ms)."
                : "Compare real server-side Gemini 3.5 Flash Lite responses across SKU Match (1,493 ms), SKU Mismatch (2,006 ms), and Adversarial Prompt Injection (1,696 ms)."}
            </p>
          </div>
          <ProvenanceBadge label="DEMO_SYNTHETIC" />
        </div>

        {/* Scenario Selector Buttons */}
        <div
          className="flex flex-wrap gap-2.5"
          role="tablist"
          aria-label="Gemini Benchmark Scenarios"
        >
          {[
            {
              id: "sku_match" as const,
              label:
                lang === "es"
                  ? "Caso 1: SKU Coincidente (1,493 ms — MATCH)"
                  : "Case 1: Matching SKU (1,493 ms — MATCH)",
            },
            {
              id: "sku_mismatch" as const,
              label:
                lang === "es"
                  ? "Caso 2: SKU Incorrecto (2,006 ms — MISMATCH)"
                  : "Case 2: Wrong SKU (2,006 ms — MISMATCH)",
            },
            {
              id: "adversarial_prompt_injection" as const,
              label:
                lang === "es"
                  ? "Caso 3: Ataque Prompt Injection Visual (1,696 ms — BLOCKED)"
                  : "Case 3: Visual Prompt Injection Attack (1,696 ms — BLOCKED)",
            },
          ].map((btn) => {
            const active = selectedCaseId === btn.id;
            return (
              <button
                key={btn.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSelectedCaseId(btn.id)}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition min-h-[44px] ${
                  active
                    ? "bg-[#C6FF62] text-[#0B1020]"
                    : "bg-[#0B1020] text-slate-200 hover:bg-slate-800 border border-slate-700"
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {currentCase && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#0B1020] border border-slate-700/80 rounded-xl p-5">
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-semibold text-slate-200 block">
                {lang === "es"
                  ? "Imagen PNG Enviada a Gemini API (680×260 RGB):"
                  : "Fixture re-rendered with the part maker's name masked (recorded run):"}
              </span>
              {currentFixtureUrl && (
                <img
                  src={currentFixtureUrl}
                  alt={`Synthetic PNG fixture for ${selectedCaseId}`}
                  className="w-full h-auto rounded-lg border border-slate-700"
                />
              )}
              <div className="grid grid-cols-3 gap-2 text-xs bg-[#151E32] p-3 rounded-lg border border-slate-700">
                <div>
                  <span className="text-slate-300 block">Model:</span>
                  <code className="text-white font-mono">
                    {currentCase.result.model_id}
                  </code>
                </div>
                <div>
                  <span className="text-slate-300 block">Latency:</span>
                  <code className="text-[#C6FF62] font-mono font-bold">
                    {currentCase.latency_ms} ms
                  </code>
                </div>
                <div>
                  <span className="text-slate-300 block">Zod Schema:</span>
                  <code className="text-emerald-300 font-mono font-bold">
                    {currentCase.status}
                  </code>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-slate-300 block">
                    Observed SKU vs Expected (recorded run):
                  </span>
                  <code className="text-sm font-mono font-bold text-[#C6FF62]">
                    {currentCase.result.observed_sku ?? "null (No SKU present)"}
                  </code>
                </div>
                <span
                  className={`px-3 py-1 rounded-md font-mono font-bold ${
                    currentCase.result.matches_expected === "MATCH"
                      ? "bg-[#C6FF62] text-[#0B1020]"
                      : "bg-rose-950 text-rose-200 border border-rose-500"
                  }`}
                >
                  {currentCase.result.matches_expected} →{" "}
                  {currentCase.result.recommended_decision}
                </span>
              </div>

              <p className="text-slate-200">
                <strong>Confidence ({currentCase.result.confidence_level}):</strong>{" "}
                {currentCase.result.confidence_note}
              </p>

              <div>
                <strong className="text-slate-200 block mb-1">
                  Visual Observations:
                </strong>
                <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                  {currentCase.result.visible_evidence.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>

              {currentCase.result.safety_flags.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-100 flex items-center gap-2">
                  <AlertTriangle
                    className="w-4 h-4 text-rose-300 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Safety Flags Triggered:</strong>{" "}
                    {currentCase.result.safety_flags.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
