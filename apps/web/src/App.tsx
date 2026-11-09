import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Camera,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Eye,
  FilePlus2,
  FolderKanban,
  HelpCircle,
  History,
  LayoutDashboard,
  RefreshCw,
  Scale,
  Wallet,
} from "lucide-react";
import type { Role } from "@realityproof/shared";
import { I18N, type Lang } from "./i18n.js";
import type { SystemCapabilities, TaskSummary } from "./types.js";
import {
  computeRequesterMetrics,
  needsRequesterAction,
  paymentUiState,
  type PaymentUiState,
} from "./presentation.js";
import {
  AppShell,
  type DemoRole,
  type NavItem,
} from "./design-system/shell.js";
import { Toast } from "./design-system/ui.js";
import {
  ActivityPayments,
  MyVerifications,
  RequesterDashboard,
  ResultsList,
  VerificationDetail,
} from "./screens/requester.js";
import {
  NewVerificationWizard,
  type NewVerificationInput,
} from "./screens/NewVerificationWizard.js";
import { ProofPassportView } from "./components/ProofPassportView.js";
import { JudgeDemoWorkspace } from "./components/JudgeDemoWorkspace.js";
import {
  VerifierMobileWorkspace,
  type VerifierSubView,
} from "./components/VerifierMobileWorkspace.js";
import { OperatorDecisionDesk } from "./components/OperatorDecisionDesk.js";
import { IntelligenceStudioWorkspace } from "./features/intelligence-studio/IntelligenceStudioWorkspace.js";

export type { TaskSummary } from "./types.js";

type RequesterNavId =
  | "DASHBOARD"
  | "NEW_VERIFICATION"
  | "MY_VERIFICATIONS"
  | "RESULTS"
  | "ACTIVITY_PAYMENTS"
  | "INTELLIGENCE_STUDIO";

type VerifierNavId = "TASKS" | "ACTIVE_MISSION" | "HISTORY" | "REMUNERATION";
type OperatorNavId =
  | "DECISION_CENTER"
  | "REVIEW_QUEUE"
  | "EVIDENCES"
  | "AUDIT_HISTORY"
  | "INTELLIGENCE_STUDIO";
type JudgeNavId = "TOUR" | "SANDBOX_PROOF" | "INTELLIGENCE_STUDIO";

const tr = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const t = I18N[lang];

  // Contextual role (DEMO role switcher in header/sidebar; server RBAC always enforced)
  const [role, setRole] = useState<DemoRole>("REQUESTER");

  // Contextual navigation state per role
  const [requesterNav, setRequesterNav] = useState<RequesterNavId>("DASHBOARD");
  const [requesterDetailMode, setRequesterDetailMode] = useState<
    "NONE" | "TASK_DETAIL" | "PASSPORT_DETAIL"
  >("NONE");
  const [verifierNav, setVerifierNav] = useState<VerifierNavId>("TASKS");
  const [operatorNav, setOperatorNav] =
    useState<OperatorNavId>("DECISION_CENTER");
  const [judgeNav, setJudgeNav] = useState<JudgeNavId>("TOUR");

  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(
    null
  );
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [remotePaymentStateOverride, setRemotePaymentStateOverride] =
    useState<PaymentUiState | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getTokenForRole = useCallback(
    (r: Role): string => {
      const tokens = capabilities?.demo_tokens_available_for_local_ui;
      if (r === "REQUESTER") {
        return tokens?.requester ?? "rp_req_demo_token_2026";
      }
      if (r === "VERIFIER") {
        return tokens?.verifier ?? "rp_ver_demo_token_2026";
      }
      if (r === "OPERATOR") {
        return tokens?.operator ?? "rp_op_demo_token_2026";
      }
      return tokens?.external_agent ?? "rp_agent_demo_token_2026";
    },
    [capabilities]
  );

  const refreshData = useCallback(async () => {
    try {
      const capRes = await fetch("/api/v1/system/capabilities");
      const capData = (await capRes.json()) as SystemCapabilities;
      setCapabilities(capData);

      // The "View as" switcher is a role simulator sharing one task list, so it reads with the
      // operator scope. The API scopes each role's own token.
      const listToken =
        capData.demo_tokens_available_for_local_ui?.operator ??
        "rp_op_demo_token_2026";
      const tasksRes = await fetch("/api/v1/verification-requests", {
        headers: { Authorization: `Bearer ${listToken}` },
      });
      if (tasksRes.ok) {
        const data = (await tasksRes.json()) as { tasks: TaskSummary[] };
        setTasks(data.tasks);
        if (!selectedTaskId && data.tasks[0]) {
          const liveCompleted =
            data.tasks.find(
              (item) => item.task_id === "task_live_sbx_1793222660264"
            ) ?? data.tasks[0];
          setSelectedTaskId(liveCompleted.task_id);
        }
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Failed to connect to API server: ${(err as Error).message}`,
      });
    } finally {
      setLoaded(true);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const activeTask =
    tasks.find((task) => task.task_id === selectedTaskId) ?? tasks[0] ?? null;

  const derivedPayPalState = useMemo<PaymentUiState>(
    () =>
      activeTask
        ? paymentUiState(activeTask, remotePaymentStateOverride)
        : "NOT_CREATED",
    [activeTask, remotePaymentStateOverride]
  );

  const metrics = useMemo(() => computeRequesterMetrics(tasks), [tasks]);

  /* ------------------------------------------------------------------------ */
  /* API Handlers (preserving 100% of GATE 2C financial & security contracts) */
  /* ------------------------------------------------------------------------ */

  async function handleCreateFromWizard(input: NewVerificationInput) {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const now = Date.now();
      const res = await fetch("/api/v1/verification-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
        },
        body: JSON.stringify({
          contract: {
            item_title: input.itemTitle.trim(),
            seller_reference: input.sellerRef.trim() || "Warehouse #14",
            expected_sku: input.expectedSku.trim(),
            expected_attributes: [
              `Visible SKU ${input.expectedSku.trim()}`,
              "Unbroken factory packaging seal",
            ],
            required_views: input.requiredViews,
            deadline_at: new Date(now + 24 * 3600_000).toISOString(),
            expires_at: new Date(now + 72 * 3600_000).toISOString(),
            max_verification_budget: input.verificationFee,
            currency: "USD",
            acceptance_rules: [
              input.instructions.trim() ||
                `Closeup photo must clearly show ${input.expectedSku.trim()}`,
            ],
            prohibited_data: ["FACES", "GOVERNMENT_ID", "PAYMENT_CARDS"],
            proof_schema_version: "0.1.0",
            review_required: true,
            synthetic_label: "DEMO_SYNTHETIC",
          },
          voi: {
            part_purchase_price_usd: input.partPrice,
            estimated_return_or_downtime_cost_usd: input.downtimeCost,
            assumed_mismatch_probability: input.mismatchProb,
            verification_fee_usd: input.verificationFee,
            assumption_source_label: "DEMO_SYNTHETIC_SCENARIO",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || "Failed to create task");
      }
      await refreshData();
      setSelectedTaskId(body.task_id);
      setRemotePaymentStateOverride(null);
      setRequesterNav("MY_VERIFICATIONS");
      setRequesterDetailMode("TASK_DETAIL");
      setStatusMessage({
        type: "success",
        text: tr(
          lang,
          `Verification request ${body.task_id} created. Review the verification payment below.`,
          `Solicitud de verificación ${body.task_id} creada. Revisa el pago de la verificación a continuación.`
        ),
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePayPalOrder() {
    if (!activeTask) return;
    setIsLoading(true);
    setStatusMessage(null);
    setRemotePaymentStateOverride(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/funding/create-order`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error);
      }
      await refreshData();
      setStatusMessage({
        type: "success",
        text: tr(
          lang,
          `PayPal Sandbox order created (${body.paypal_order.orderId}). Approve it in PayPal Sandbox, then confirm payment.`,
          `Orden PayPal Sandbox creada (${body.paypal_order.orderId}). Apruébala en PayPal Sandbox y luego confirma el pago.`
        ),
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyRemotePayPalOrder() {
    if (!activeTask?.paypal_order) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/funding/order-status`,
        {
          headers: {
            Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error);
      }
      setRemotePaymentStateOverride(
        body.mapped_payment_state as PaymentUiState
      );
      await refreshData();
      setStatusMessage({
        type:
          body.mapped_payment_state === "COMPLETED" ||
          body.mapped_payment_state === "APPROVED"
            ? "success"
            : "warning",
        text: tr(
          lang,
          `PayPal Sandbox status: order ${body.order_id} is ${body.remote_status} (${body.mapped_payment_state}).`,
          `Estado en PayPal Sandbox: la orden ${body.order_id} está en ${body.remote_status} (${body.mapped_payment_state}).`
        ),
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCapturePayPalOrder() {
    if (!activeTask?.paypal_order) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/funding/capture-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
          },
          body: JSON.stringify({
            order_id: activeTask.paypal_order.orderId,
          }),
        }
      );
      const body = await res.json();
      await refreshData();
      if (res.status === 409) {
        setRemotePaymentStateOverride("APPROVAL_REQUIRED");
        setStatusMessage({
          type: "warning",
          text: `${body.error}: ${body.message}`,
        });
        return;
      }
      if (!res.ok) {
        setRemotePaymentStateOverride("FAILED");
        throw new Error(body.message || body.error);
      }
      setRemotePaymentStateOverride("COMPLETED");
      setStatusMessage({
        type: "success",
        text: tr(
          lang,
          `PayPal payment captured and verified (${body.paypal_order.captureId}).`,
          `Pago PayPal capturado y verificado (${body.paypal_order.captureId}).`
        ),
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSimulateDemoFunding() {
    if (!activeTask) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/funding/simulate-demo-funding`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error);
      }
      await refreshData();
      setRemotePaymentStateOverride("COMPLETED");
      setStatusMessage({
        type: "success",
        text: tr(
          lang,
          `Assigned DEMO_SYNTHETIC funding fixture (${body.paypal_order?.captureId}). Non-spendable with zero payout eligibility.`,
          `Financiación DEMO_SYNTHETIC asignada (${body.paypal_order?.captureId}). Sin saldo real ni elegibilidad de pago.`
        ),
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReplayHistoricalSandbox() {
    if (!activeTask) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/funding/replay-historical-sandbox`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error);
      }
      await refreshData();
      const origOwner =
        body.funding_allocation?.original_task_id ??
        "task_live_sbx_1793222660264";
      const currentStatus =
        body.task?.status ?? "EVIDENCE_CONTRACT_DEFINED";
      setStatusMessage({
        type: "warning",
        text: tr(
          lang,
          `Attached HISTORICAL_SANDBOX_REPLAY reference (owned by ${origOwner}). Request stays ${currentStatus} (unfunded) with zero payout rights.`,
          `Referencia HISTORICAL_SANDBOX_REPLAY vinculada (pertenece a ${origOwner}). La solicitud permanece en ${currentStatus} (sin financiar) y sin derechos de cobro.`
        ),
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReuseVerifiedSandboxCapture() {
    if (!activeTask) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/v1/verification-requests/${activeTask.task_id}/funding/reuse-verified-sandbox`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getTokenForRole("REQUESTER")}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(`${body.error}: ${body.message}`);
      }
      await refreshData();
      setRemotePaymentStateOverride("COMPLETED");
      setStatusMessage({
        type: "success",
        text: `Canonical capture 0TL320715J3450828 verified for owner task ${activeTask.task_id}.`,
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Contextual Navigation Configuration per Role (FASE 1)                    */
  /* ------------------------------------------------------------------------ */

  const roleLabels: Record<DemoRole, string> = {
    REQUESTER: tr(lang, "Requester", "Solicitante"),
    VERIFIER: tr(lang, "Verifier", "Verificador"),
    OPERATOR: tr(lang, "Operator", "Operador"),
    JUDGE: tr(lang, "Judge Demo", "Demo Jueces"),
  };

  const navItems = useMemo<NavItem[]>(() => {
    if (role === "REQUESTER") {
      return [
        {
          id: "DASHBOARD",
          label: tr(lang, "Dashboard", "Dashboard"),
          shortLabel: tr(lang, "Home", "Inicio"),
          icon: LayoutDashboard,
        },
        {
          id: "NEW_VERIFICATION",
          label: tr(lang, "New verification", "Nueva verificación"),
          shortLabel: tr(lang, "New", "Nueva"),
          icon: FilePlus2,
        },
        {
          id: "MY_VERIFICATIONS",
          label: tr(lang, "My verifications", "Mis verificaciones"),
          shortLabel: tr(lang, "Requests", "Solicitudes"),
          icon: FolderKanban,
          badge: metrics.pendingAction > 0 ? metrics.pendingAction : undefined,
        },
        {
          id: "RESULTS",
          label: tr(lang, "Results & Proof Passports", "Resultados y Proof Passports"),
          shortLabel: tr(lang, "Results", "Resultados"),
          icon: BadgeCheck,
        },
        {
          id: "ACTIVITY_PAYMENTS",
          label: tr(lang, "Activity & payments", "Actividad y pagos"),
          shortLabel: tr(lang, "Payments", "Pagos"),
          icon: Wallet,
        },
        {
          id: "INTELLIGENCE_STUDIO",
          label: tr(lang, "Intelligence Studio", "Intelligence Studio"),
          shortLabel: tr(lang, "Studio", "Studio"),
          icon: BarChart3,
        },
      ];
    }
    if (role === "VERIFIER") {
      return [
        {
          id: "TASKS",
          label: tr(lang, "My tasks", "Mis tareas"),
          shortLabel: tr(lang, "Tasks", "Tareas"),
          icon: ClipboardList,
        },
        {
          id: "ACTIVE_MISSION",
          label: tr(lang, "Active verification", "Verificación en curso"),
          shortLabel: tr(lang, "Mission", "Misión"),
          icon: Camera,
        },
        {
          id: "HISTORY",
          label: tr(lang, "History", "Historial"),
          shortLabel: tr(lang, "History", "Historial"),
          icon: History,
        },
        {
          id: "REMUNERATION",
          label: tr(lang, "Earnings & states", "Remuneraciones"),
          shortLabel: tr(lang, "Earnings", "Pagos"),
          icon: Wallet,
        },
      ];
    }
    if (role === "OPERATOR") {
      return [
        {
          id: "DECISION_CENTER",
          label: tr(lang, "Decision center", "Centro de decisiones"),
          shortLabel: tr(lang, "Decisions", "Decisiones"),
          icon: Scale,
        },
        {
          id: "REVIEW_QUEUE",
          label: tr(lang, "Review queue", "Cola de revisión"),
          shortLabel: tr(lang, "Queue", "Cola"),
          icon: ClipboardCheck,
        },
        {
          id: "EVIDENCES",
          label: tr(lang, "Evidences", "Evidencias"),
          shortLabel: tr(lang, "Evidences", "Evidencias"),
          icon: Eye,
        },
        {
          id: "AUDIT_HISTORY",
          label: tr(lang, "Audit history", "Historial de auditoría"),
          shortLabel: tr(lang, "Audit", "Auditoría"),
          icon: Activity,
        },
        {
          id: "INTELLIGENCE_STUDIO",
          label: tr(lang, "Intelligence Studio", "Intelligence Studio"),
          shortLabel: tr(lang, "Studio", "Studio"),
          icon: BarChart3,
        },
      ];
    }
    return [
      {
        id: "TOUR",
        label: tr(lang, "Guided demo", "Experiencia guiada"),
        shortLabel: tr(lang, "Demo", "Demo"),
        icon: Compass,
      },
      {
        id: "SANDBOX_PROOF",
        label: tr(lang, "Verified Sandbox Proof", "Prueba real Sandbox"),
        shortLabel: tr(lang, "Proof", "Prueba"),
        icon: BadgeCheck,
      },
      {
        id: "INTELLIGENCE_STUDIO",
        label: tr(lang, "Intelligence Studio", "Intelligence Studio"),
        shortLabel: tr(lang, "Studio", "Studio"),
        icon: BarChart3,
      },
    ];
  }, [role, lang, metrics.pendingAction]);

  const activeNavId =
    role === "REQUESTER"
      ? requesterNav
      : role === "VERIFIER"
        ? verifierNav
        : role === "OPERATOR"
          ? operatorNav
          : judgeNav;

  function handleNavigate(id: string) {
    if (role === "REQUESTER") {
      setRequesterDetailMode("NONE");
      setRequesterNav(id as RequesterNavId);
      return;
    }
    if (role === "VERIFIER") {
      setVerifierNav(id as VerifierNavId);
      return;
    }
    if (role === "OPERATOR") {
      setOperatorNav(id as OperatorNavId);
      return;
    }
    if (id === "SANDBOX_PROOF") {
      const liveTask = tasks.find(
        (item) => item.task_id === "task_live_sbx_1793222660264"
      );
      if (liveTask) setSelectedTaskId(liveTask.task_id);
      setRole("REQUESTER");
      setRequesterNav("RESULTS");
      setRequesterDetailMode("PASSPORT_DETAIL");
      return;
    }
    setJudgeNav(id as JudgeNavId);
  }

  function openTaskInRequester(taskId: string) {
    setSelectedTaskId(taskId);
    setRemotePaymentStateOverride(null);
    setRole("REQUESTER");
    setRequesterNav("MY_VERIFICATIONS");
    setRequesterDetailMode("TASK_DETAIL");
  }

  function openResultInRequester(taskId: string) {
    setSelectedTaskId(taskId);
    setRemotePaymentStateOverride(null);
    setRole("REQUESTER");
    setRequesterNav("RESULTS");
    setRequesterDetailMode("PASSPORT_DETAIL");
  }

  const verifierInitialSubView: VerifierSubView =
    verifierNav === "TASKS"
      ? "ASSIGNMENTS"
      : verifierNav === "ACTIVE_MISSION"
        ? "MISSION"
        : verifierNav === "REMUNERATION"
          ? "ASSIGNMENTS"
          : "SUBMITTED";

  const topbarActions = (
    <>
      {metrics.pendingAction > 0 && role === "REQUESTER" && (
        <button
          type="button"
          onClick={() => {
            const firstPending = tasks.find(needsRequesterAction);
            if (firstPending) {
              openTaskInRequester(firstPending.task_id);
            }
          }}
          className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg text-xs font-medium bg-warn/12 text-warn border border-warn/35 hover:bg-warn/20"
        >
          <Bell className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {metrics.pendingAction}{" "}
            {tr(lang, "pending", "pendiente(s)")}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={() => void refreshData()}
        className="hidden sm:flex w-10 h-10 rounded-lg border border-line text-ink-2 hover:text-ink hover:bg-surface-2 items-center justify-center"
        aria-label={tr(
          lang,
          "Refresh verification requests",
          "Actualizar solicitudes de verificación"
        )}
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          setRole("JUDGE");
          setJudgeNav("TOUR");
        }}
        className="hidden sm:flex w-10 h-10 rounded-lg border border-line text-ink-2 hover:text-ink hover:bg-surface-2 items-center justify-center"
        aria-label={tr(
          lang,
          "Open guided help & demo",
          "Abrir ayuda y demostración guiada"
        )}
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
      </button>
    </>
  );

  return (
    <AppShell
      role={role}
      onRoleChange={(nextRole) => {
        setRole(nextRole);
        setRequesterDetailMode("NONE");
      }}
      roleLabels={roleLabels}
      nav={navItems}
      activeNav={activeNavId}
      onNavigate={handleNavigate}
      lang={lang}
      onToggleLang={() => setLang((prev) => (prev === "en" ? "es" : "en"))}
      integrations={
        capabilities
          ? {
              paypalReady:
                capabilities.paypal.orders_v2_status === "CONFIGURED_READY",
              geminiReady:
                capabilities.gemini_ai.status === "CONFIGURED_READY",
              geminiModel: capabilities.gemini_ai.primary_model,
            }
          : null
      }
      topbarActions={topbarActions}
      skipLabel={t.skipToContent}
      navLabel={tr(lang, "Contextual navigation", "Navegación contextual")}
    >
      {/* Live status feedback toast */}
      <div aria-live="polite" className="mb-5 empty:mb-0 no-print">
        {capabilities?.public_demo_mode && (
          <div
            role="status"
            data-testid="public-demo-banner"
            className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-100"
          >
            {lang === "es"
              ? "Demo pública de solo lectura: datos sintéticos y un registro histórico de PayPal Sandbox. Pagos, evidencias y decisiones están desactivados en el servidor."
              : "Read-only public demo: synthetic data and one historical PayPal Sandbox record. Payments, evidence uploads and decisions are disabled on the server."}
          </div>
        )}
        {capabilities?.third_party_brands_masked && (
          <p
            data-testid="brand-mask-note"
            className="mb-4 text-xs text-slate-400"
          >
            {lang === "es"
              ? "El nombre del fabricante de la pieza está oculto en el registro histórico de Sandbox. El registro almacenado y sus hashes no cambian. FictoParts es una marca ficticia."
              : "The part maker's name is masked in the historical Sandbox record. The stored record and its hashes are unchanged. FictoParts is a fictional brand."}
          </p>
        )}
        {statusMessage && (
          <Toast
            type={statusMessage.type}
            text={statusMessage.text}
            onClose={() => setStatusMessage(null)}
            closeLabel={tr(lang, "Dismiss", "Cerrar")}
          />
        )}
      </div>

      {/* ================================================================== */}
      {/* ROLE 1: REQUESTER EXPERIENCE                                       */}
      {/* ================================================================== */}
      {role === "REQUESTER" && (
        <>
          {requesterDetailMode === "PASSPORT_DETAIL" && activeTask ? (
            <ProofPassportView
              task={activeTask}
              requesterToken={getTokenForRole("REQUESTER")}
              lang={lang}
              onBack={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("RESULTS");
              }}
              onSelectCanonicalLiveTask={() => {
                const liveTask = tasks.find(
                  (item) => item.task_id === "task_live_sbx_1793222660264"
                );
                if (liveTask) {
                  setSelectedTaskId(liveTask.task_id);
                }
              }}
            />
          ) : requesterDetailMode === "TASK_DETAIL" && activeTask ? (
            <VerificationDetail
              task={activeTask}
              lang={lang}
              paymentState={derivedPayPalState}
              isLoading={isLoading}
              onBack={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("MY_VERIFICATIONS");
              }}
              onOpenResult={() => setRequesterDetailMode("PASSPORT_DETAIL")}
              payment={{
                onCreateOrder: () => void handleCreatePayPalOrder(),
                onVerifyRemote: () => void handleVerifyRemotePayPalOrder(),
                onCapture: () => void handleCapturePayPalOrder(),
                onSimulateDemo: () => void handleSimulateDemoFunding(),
                onReplayHistorical: () => void handleReplayHistoricalSandbox(),
                onTestGuard: () => void handleReuseVerifiedSandboxCapture(),
              }}
            />
          ) : requesterNav === "NEW_VERIFICATION" ? (
            <NewVerificationWizard
              lang={lang}
              isLoading={isLoading}
              onSubmit={(input) => void handleCreateFromWizard(input)}
              onAbstain={(msg) =>
                setStatusMessage({ type: "info", text: msg })
              }
              onCancel={() => setRequesterNav("DASHBOARD")}
            />
          ) : requesterNav === "MY_VERIFICATIONS" ? (
            <MyVerifications
              tasks={tasks}
              lang={lang}
              onOpenTask={openTaskInRequester}
              onOpenResult={openResultInRequester}
              onNew={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("NEW_VERIFICATION");
              }}
            />
          ) : requesterNav === "RESULTS" ? (
            <ResultsList
              tasks={tasks}
              lang={lang}
              onOpenResult={openResultInRequester}
              onSeeVerifications={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("MY_VERIFICATIONS");
              }}
            />
          ) : requesterNav === "ACTIVITY_PAYMENTS" ? (
            <ActivityPayments
              tasks={tasks}
              lang={lang}
              onOpenTask={openTaskInRequester}
            />
          ) : requesterNav === "INTELLIGENCE_STUDIO" ? (
            <IntelligenceStudioWorkspace
              apiBaseUrl=""
              authToken={getTokenForRole("REQUESTER")}
              actorRole="REQUESTER"
              locale={lang}
              refreshTrigger={tasks.length}
              onOpenVerificationCase={(taskId) => {
                setSelectedTaskId(taskId);
                setRemotePaymentStateOverride(null);
                setRole("OPERATOR");
                setOperatorNav("DECISION_CENTER");
              }}
              onOpenProofPassport={(_proofId, taskId) => {
                openResultInRequester(taskId);
              }}
            />
          ) : (
            <RequesterDashboard
              tasks={tasks}
              loaded={loaded}
              lang={lang}
              onNew={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("NEW_VERIFICATION");
              }}
              onOpenTask={openTaskInRequester}
              onOpenResult={openResultInRequester}
              onSeeAll={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("MY_VERIFICATIONS");
              }}
              onOpenActivity={() => {
                setRequesterDetailMode("NONE");
                setRequesterNav("ACTIVITY_PAYMENTS");
              }}
              onHelp={() => {
                setRole("JUDGE");
                setJudgeNav("TOUR");
              }}
            />
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* ROLE 2: VERIFIER EXPERIENCE (Ready for GATE 2D-B)                  */}
      {/* ================================================================== */}
      {role === "VERIFIER" && (
        <VerifierMobileWorkspace
          tasks={tasks}
          activeTask={activeTask}
          onSelectTask={(id) => {
            setSelectedTaskId(id);
            setRemotePaymentStateOverride(null);
          }}
          verifierToken={getTokenForRole("VERIFIER")}
          onRefresh={refreshData}
          lang={lang}
          initialSubView={verifierInitialSubView}
        />
      )}

      {/* ================================================================== */}
      {/* ROLE 3: OPERATOR EXPERIENCE (Ready for GATE 2D-B & GATE 3 Studio)  */}
      {/* ================================================================== */}
      {role === "OPERATOR" && (
        <>
          {operatorNav === "INTELLIGENCE_STUDIO" ? (
            <IntelligenceStudioWorkspace
              apiBaseUrl=""
              authToken={getTokenForRole("OPERATOR")}
              actorRole="OPERATOR"
              locale={lang}
              refreshTrigger={tasks.length}
              onOpenVerificationCase={(taskId) => {
                setSelectedTaskId(taskId);
                setRemotePaymentStateOverride(null);
                setOperatorNav("DECISION_CENTER");
              }}
              onOpenProofPassport={(_proofId, taskId) => {
                openResultInRequester(taskId);
              }}
            />
          ) : (
            <OperatorDecisionDesk
              tasks={tasks}
              activeTask={activeTask}
              onSelectTask={(id) => {
                setSelectedTaskId(id);
                setRemotePaymentStateOverride(null);
              }}
              operatorToken={getTokenForRole("OPERATOR")}
              onRefresh={refreshData}
              onOpenPassport={() => {
                if (activeTask) {
                  openResultInRequester(activeTask.task_id);
                }
              }}
              lang={lang}
              activeNavId={operatorNav}
            />
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* ROLE 4: JUDGE DEMO EXPERIENCE                                      */}
      {/* ================================================================== */}
      {role === "JUDGE" && (
        <>
          {judgeNav === "INTELLIGENCE_STUDIO" ? (
            <IntelligenceStudioWorkspace
              apiBaseUrl=""
              authToken={getTokenForRole("OPERATOR")}
              actorRole="JUDGE"
              locale={lang}
              refreshTrigger={tasks.length}
              onOpenVerificationCase={(taskId) => {
                setSelectedTaskId(taskId);
                setRemotePaymentStateOverride(null);
                setRole("OPERATOR");
                setOperatorNav("DECISION_CENTER");
              }}
              onOpenProofPassport={(_proofId, taskId) => {
                openResultInRequester(taskId);
              }}
            />
          ) : (
            <JudgeDemoWorkspace
              lang={lang}
              onSelectLiveCompletedTask={() => {
                const liveTask = tasks.find(
                  (item) => item.task_id === "task_live_sbx_1793222660264"
                );
                if (liveTask) {
                  openResultInRequester(liveTask.task_id);
                }
              }}
              onOpenRequesterNewContract={() => {
                setRole("REQUESTER");
                setRequesterDetailMode("NONE");
                setRequesterNav("NEW_VERIFICATION");
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
