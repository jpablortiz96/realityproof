// Public edition only. vite.config.ts swaps the AG Studio workspace for this component when the web app
// is built with REALITYPROOF_WEB_EDITION=public, so the AG Studio packages are left out of the bundle.
// AG Grid provides the AG Studio licence for PayPal AI Hackathon judging; the full edition with AG Studio
// is served to judges only.

type Props = { locale?: "en" | "es" | string; [key: string]: unknown };

export function IntelligenceStudioWorkspace({ locale }: Props) {
  const es = locale === "es";
  return (
    <section
      data-testid="studio-public-edition-notice"
      className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-700 bg-slate-900/70 p-8 text-slate-200"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
        {es ? "Edición pública" : "Public edition"}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">
        {es ? "Intelligence Studio está en la demo para jueces" : "Intelligence Studio is in the judges' demo"}
      </h2>
      <p className="mt-4 leading-relaxed text-slate-300">
        {es
          ? "Este panel usa AG Studio, un producto comercial de AG Grid Ltd. AG Grid proporciona su licencia para la evaluación de la PayPal AI Hackathon, así que esta edición abierta no lo incluye. Los jueces tienen acceso a la versión completa con el panel y el agente de Gemini."
          : "This dashboard uses AG Studio, a commercial product of AG Grid Ltd. AG Grid provides its licence for PayPal AI Hackathon judging, so this open edition leaves it out. Judges have access to the full edition with the dashboard and the Gemini agent."}
      </p>
      <p className="mt-4 leading-relaxed text-slate-400">
        {es
          ? "Todo lo demás funciona aquí: solicitudes, procedencia de PayPal Sandbox, evidencia sintética, revisión humana y Proof Passports con verificación de integridad."
          : "Everything else works here: requests, PayPal Sandbox provenance, synthetic evidence, human review and Proof Passports with integrity checks."}
      </p>
    </section>
  );
}
