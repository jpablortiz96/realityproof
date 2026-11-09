export type Lang = "en" | "es";

export const I18N = {
  en: {
    skipToContent: "Skip to main workspace",
    tagline:
      "Evidence-as-a-Service for AI Agents & High-Risk Physical Commerce — Verify before you pay",
    epistemicBanner:
      "TRANSPARENCY & PROVENANCE: Tasks are explicitly labeled as SANDBOX_LIVE_TEST (real PayPal Sandbox + real Gemini API execution) or DEMO_SYNTHETIC (labeled synthetic test fixture). SHA-256 hashes, pixel observations, and human review provide tamper-evident traceability—not an absolute guarantee of physical truth.",
    navRequester: "1. Requester Workspace",
    navPassport: "2. Proof Passport & Reality Lens",
    navJudgeDemo: "3. Judge Demo (<90s Tour)",
    navVerifier: "4. Verifier Mobile",
    navOperator: "5. Human Decision Desk",

    // Requester sub-navigation
    subOverview: "A. Overview",
    subNewVerification: "B. New Verification",
    subVoi: "C. Value of Information",
    subPayment: "D. Verification Funding",
    subTracking: "E. Live Tracking",

    // Overview
    overviewTitle: "Active Physical Verification Portfolio",
    overviewSubtitle:
      "Monitor contract states, PayPal Sandbox verification funding, expected risk savings, and pending decisions across all requests.",
    metricTotalRequests: "Active Requests",
    metricVerifiedPassports: "Issued Proof Passports",
    metricTotalEscrow: "Verified PayPal Captures",
    metricAvgSavings: "Net Risk Reduction (VoI)",
    pendingActionTitle: "Pending Action / Next Deterministic Step",
    selectTaskBtn: "Inspect Request",
    openPassportBtn: "Open Proof Passport",
    goToPaymentBtn: "Configure Verification Funding",

    // New Verification
    createContractTitle: "Define Physical Verification Contract (v0)",
    createContractSubtitle:
      "Specify the physical item, expected SKU, required photographic views,verifier instructions, and maximum authorized verification fee.",
    itemTitleLabel: "Item Description & Part Title",
    sellerRefLabel: "Seller / Warehouse Location Reference",
    expectedSkuLabel: "Expected Manufacturer SKU",
    partPriceLabel: "Part Purchase Price (USD)",
    downtimeCostLabel: "Return / Downtime Loss if Wrong (USD)",
    mismatchProbLabel: "Assumed Mismatch / Defect Risk (0.01 – 0.99)",
    verificationBudgetLabel: "Max Authorized Verification Fee (USD)",
    requiredViewsLabel: "Required Photographic Views (Select at least 1)",
    verifierInstructionsLabel: "Acceptance Rules & Instructions for Verifier",
    createBtn: "Create Verification Contract",
    abstainBtn: "Abstain from Verification (Economically Unjustified)",
    abstainRecordedMsg:
      "Abstention recorded: Verification fee exceeds expected unverified loss. RealityProof recommends proceeding or renegotiating without purchasing physical verification.",

    // Value of Information
    voiTitle: "Value of Information (VoI) Decision Engine",
    voiSubtitle:
      "Quantify whether paying for physical verification is economically rational before creating a PayPal Sandbox order.",
    voiTotalLoss: "Total Loss if Wrong Item Shipped",
    voiExpectedLoss: "Expected Unverified Loss (Price + Downtime × Risk)",
    voiFee: "Authorized Verification Cost",
    voiNetSavings: "Net Expected Value of Verification",
    voiBreakEven: "Break-Even Mismatch Probability",
    voiAssumptionsTitle: "Explicit Epistemic & Economic Assumptions",

    // Payment
    paymentTitle: "PayPal Sandbox Verification Funding (Orders v2)",
    paymentSubtitle:
      "Funds are never marked completed until verified remotely via GET /v2/checkout/orders/{id}. Unapproved captures are deterministically blocked.",
    fundPayPalBtn: "1. Create PayPal Sandbox Order v2",
    approveInSandboxBtn: "2. Open PayPal Sandbox Buyer Approval",
    verifyRemoteOrderBtn: "Verify Remote PayPal Status (Read-Only)",
    capturePayPalBtn: "3. Capture Approved PayPal Order",
    reuseSandboxCaptureBtn: "Reuse Verified Sandbox Capture (0TL320715J3450828 — No Duplicate Charge)",
    neverAutoCaptureNotice:
      "Deterministic Guardrail: RealityProof never captures an order unless the buyer has approved it in PayPal Sandbox Checkout.",

    // Tracking
    trackingTitle: "Deterministic 9-Stage Financial & Operational Sequence",
    trackingSubtitle:
      "Every state transition requires cryptographic or remote API proof. No state skipping or premature payouts are permitted.",
    auditTimelineTitle: "Persistent Server Audit Trail",

    // Proof Passport
    passportTitle: "Proof Passport v0 — Verifiable Physical Evidence Dossier",
    passportSubtitle:
      "Structured record combining PayPal Sandbox financial trace, SHA-256 evidence hashes, Gemini multimodal observations, and human review.",
    realityLensTitle: "Reality Lens — Visual & Epistemic Evidence Inspector",
    realityLensSubtitle:
      "Directly compare what was requested against what Gemini observed in pixels, what the human verifier declared, and what remains unverifiable.",
    expectedVsObserved: "Expected SKU vs. Observed SKU in Pixels",
    geminiObservationsTitle: "Gemini Multimodal Pixel Observations",
    verifierClaimsTitle: "Human Verifier Declarations (Separated from Pixels)",
    unverifiableClaimsTitle: "Unverifiable Claims & Physical Unknowns",
    uncertaintyWarningsTitle: "Epistemic Limitations & Uncertainty Notes",
    additionalEvidenceTitle: "Additional Evidence Recommended",
    evidenceTimelineTitle: "Chronological Evidence & Verification Timeline",
    financialTraceTitle: "Verified PayPal Sandbox Financial Trace",
    proofIntegrityTitle: "Cryptographic Proof Integrity & Claim Boundaries",
    exportShareTitle: "Secure Share, Live Token Verification & Dossier Export",
    verifySignedUrlBtn: "Verify Signed Read URL Live",
    copySignedUrlBtn: "Copy Signed Read URL",
    exportJsonBtn: "Download JSON Proof Passport",
    printDossierBtn: "Export / Print Readable Dossier",

    // Judge Demo
    judgeTitle: "PayPal AI Hackathon 2026 — 90-Second Judge Walkthrough",
    judgeSubtitle:
      "Explore the real live PayPal Sandbox + Gemini 3.5 Flash Lite execution (task_live_sbx_1793222660264) or test adversarial & mismatch scenarios without needing external credentials.",
  },
  es: {
    skipToContent: "Saltar al espacio de trabajo principal",
    tagline:
      "Evidence-as-a-Service para Agentes IA y Comercio Físico de Alto Riesgo — Verifica antes de pagar",
    epistemicBanner:
      "TRANSPARENCIA Y PROCEDENCIA: Las tareas se etiquetan explícitamente como SANDBOX_LIVE_TEST (ejecución real en PayPal Sandbox + Gemini API) o DEMO_SYNTHETIC (fixture sintético de demostración). Los hashes SHA-256, observaciones visuales y revisión humana aportan trazabilidad verificable, no garantía absoluta de verdad física.",
    navRequester: "1. Espacio del Solicitante",
    navPassport: "2. Proof Passport y Reality Lens",
    navJudgeDemo: "3. Demo para Jueces (<90s)",
    navVerifier: "4. Verificador Móvil",
    navOperator: "5. Mesa de Decisión Humana",

    // Requester sub-navigation
    subOverview: "A. Resumen General",
    subNewVerification: "B. Nueva Verificación",
    subVoi: "C. Valor de Información",
    subPayment: "D. Financiación PayPal",
    subTracking: "E. Seguimiento en Vivo",

    // Overview
    overviewTitle: "Portafolio de Verificaciones Físicas Activas",
    overviewSubtitle:
      "Supervisa estados de contratos, financiación en PayPal Sandbox, ahorro esperado por reducción de riesgo y decisiones pendientes.",
    metricTotalRequests: "Solicitudes Activas",
    metricVerifiedPassports: "Proof Passports Emitidos",
    metricTotalEscrow: "Capturas PayPal Verificadas",
    metricAvgSavings: "Reducción Neta de Riesgo (VoI)",
    pendingActionTitle: "Acción Pendiente / Próximo Paso Determinista",
    selectTaskBtn: "Inspeccionar Solicitud",
    openPassportBtn: "Abrir Proof Passport",
    goToPaymentBtn: "Configurar Financiación PayPal",

    // New Verification
    createContractTitle: "Definir Contrato de Verificación Física (v0)",
    createContractSubtitle:
      "Especifica el artículo físico, SKU esperado, vistas fotográficas requeridas, instrucciones para el verificador y presupuesto máximo autorizado.",
    itemTitleLabel: "Descripción y Título del Repuesto",
    sellerRefLabel: "Referencia del Vendedor / Almacén",
    expectedSkuLabel: "SKU Esperado del Fabricante",
    partPriceLabel: "Precio de Compra del Repuesto (USD)",
    downtimeCostLabel: "Pérdida por Devolución o Parada si es Incorrecto (USD)",
    mismatchProbLabel: "Riesgo Asumido de Error o Defecto (0.01 – 0.99)",
    verificationBudgetLabel: "Coste Máximo Autorizado de Verificación (USD)",
    requiredViewsLabel: "Vistas Fotográficas Necesarias (Selecciona al menos 1)",
    verifierInstructionsLabel:
      "Reglas de Aceptación e Instrucciones para el Verificador",
    createBtn: "Crear Contrato de Verificación",
    abstainBtn: "Abstenerse de Contratar (Sin Justificación Económica)",
    abstainRecordedMsg:
      "Abstención registrada: El coste de verificar supera la pérdida esperada sin verificar. RealityProof recomienda no contratar la verificación en este escenario.",

    // Value of Information
    voiTitle: "Motor de Decisión de Valor de la Información (VoI)",
    voiSubtitle:
      "Evalúa si pagar por la verificación física tiene justificación económica antes de crear una orden en PayPal Sandbox.",
    voiTotalLoss: "Pérdida Total si se Envía el Artículo Incorrecto",
    voiExpectedLoss: "Pérdida Esperada sin Verificar (Precio + Parada × Riesgo)",
    voiFee: "Coste Autorizado de Verificación",
    voiNetSavings: "Valor Neto Esperado de Verificar",
    voiBreakEven: "Probabilidad Umbral de Equilibrio (Break-Even)",
    voiAssumptionsTitle: "Supuestos Económicos y Epistémicos Explícitos",

    // Payment
    paymentTitle: "Financiación de Verificación en PayPal Sandbox (Orders v2)",
    paymentSubtitle:
      "Ningún pago se muestra como completado antes de verificarlo remotamente mediante GET /v2/checkout/orders/{id}. Las capturas sin aprobación se bloquean determinísticamente.",
    fundPayPalBtn: "1. Crear Orden en PayPal Sandbox v2",
    approveInSandboxBtn: "2. Abrir Aprobación del Comprador en PayPal Sandbox",
    verifyRemoteOrderBtn: "Consultar Estado Remoto en PayPal (Solo Lectura)",
    capturePayPalBtn: "3. Capturar Orden Aprobada en PayPal",
    reuseSandboxCaptureBtn: "Reutilizar Captura Sandbox Verificada (0TL320715J3450828 — Sin Cobro Duplicado)",
    neverAutoCaptureNotice:
      "Control Determinista: RealityProof nunca captura una orden sin aprobación previa del comprador en PayPal Sandbox.",

    // Tracking
    trackingTitle: "Secuencia Financiera y Operativa Determinista de 9 Estados",
    trackingSubtitle:
      "Cada transición exige evidencia criptográfica o confirmación remota de la API. No se permiten saltos de estado ni desembolsos prematuros.",
    auditTimelineTitle: "Pista de Auditoría Persistente del Servidor",

    // Proof Passport
    passportTitle: "Proof Passport v0 — Dossier Verificable de Evidencia Física",
    passportSubtitle:
      "Registro estructurado que vincula traza financiera de PayPal Sandbox, hashes SHA-256, observaciones multimodales de Gemini y revisión humana.",
    realityLensTitle: "Reality Lens — Inspector Visual y Epistémico de Evidencia",
    realityLensSubtitle:
      "Compara directamente lo solicitado frente a lo observado por Gemini en píxeles, lo declarado por el verificador y lo no comprobable.",
    expectedVsObserved: "SKU Esperado vs. SKU Observado en Píxeles",
    geminiObservationsTitle: "Observaciones Visuales de Gemini en Píxeles",
    verifierClaimsTitle:
      "Declaraciones del Verificador Humano (Separadas de Píxeles)",
    unverifiableClaimsTitle: "Afirmaciones No Comprobables e Incógnitas Físicas",
    uncertaintyWarningsTitle: "Limitaciones Epistémicas y Advertencias de Incertidumbre",
    additionalEvidenceTitle: "Evidencia Adicional Necesaria",
    evidenceTimelineTitle: "Línea de Tiempo Cronológica de la Evidencia",
    financialTraceTitle: "Traza Financiera Confirmada en PayPal Sandbox",
    proofIntegrityTitle: "Integridad de la Prueba y Límites de Certificación",
    exportShareTitle:
      "Compartir con Permisos Seguros, Verificación de Token y Exportación",
    verifySignedUrlBtn: "Verificar URL Firmada en Vivo",
    copySignedUrlBtn: "Copiar URL de Lectura Firmada",
    exportJsonBtn: "Descargar Proof Passport (JSON)",
    printDossierBtn: "Exportar / Imprimir Dossier Legible",

    // Judge Demo
    judgeTitle: "PayPal AI Hackathon 2026 — Recorrido para Jueces (<90 Segundos)",
    judgeSubtitle:
      "Recorre la ejecución real completada en PayPal Sandbox + Gemini 3.5 Flash Lite (task_live_sbx_1793222660264) o inspecciona escenarios de SKU diferente e inyección de prompts sin requerir claves externas.",
  },
} as const;

