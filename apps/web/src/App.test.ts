import { describe, expect, it } from "vitest";
import { computeValueOfInformation } from "@realityproof/shared";
import { I18N } from "./i18n.js";
import {
  computeOperatorPriority,
  computeRequesterMetrics,
  computeVerifierEarningsMetrics,
  humanStatus,
  passportOutcome,
  viewLabel,
} from "./presentation.js";
import { RP_TOKENS } from "./design-system/tokens.js";
import type { TaskSummary } from "./types.js";

describe("@realityproof/web GATE 2A & GATE 2D-A unit, presentation & i18n suite", () => {
  it("integrates shared VoI calculator in frontend bundle for high-risk part", () => {
    const res = computeValueOfInformation({
      part_purchase_price_usd: 220,
      estimated_return_or_downtime_cost_usd: 80,
      assumed_mismatch_probability: 0.15,
      verification_fee_usd: 14,
      assumption_source_label: "DEMO_SYNTHETIC_SCENARIO",
    });
    expect(res.recommendation).toBe("VERIFY_BEFORE_PAYMENT");
    expect(res.net_expected_savings_usd).toBe(31);
  });

  it("recommends ABSTAIN_VERIFICATION_TOO_EXPENSIVE when fee exceeds expected unverified loss", () => {
    const res = computeValueOfInformation({
      part_purchase_price_usd: 35,
      estimated_return_or_downtime_cost_usd: 10,
      assumed_mismatch_probability: 0.05,
      verification_fee_usd: 14,
      assumption_source_label: "DEMO_SYNTHETIC_SCENARIO",
    });
    expect(res.recommendation).toBe("ABSTAIN_VERIFICATION_TOO_EXPENSIVE");
    expect(res.net_expected_savings_usd).toBeLessThan(0);
  });

  it("maintains 100% key parity between English (en) and Spanish (es) i18n dictionaries", () => {
    const enKeys = Object.keys(I18N.en).sort();
    const esKeys = Object.keys(I18N.es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("never adds DEMO_SYNTHETIC or HISTORICAL_SANDBOX_REPLAY amounts to real PayPal Sandbox payment totals", () => {
    const makeTask = (
      id: string,
      provenance:
        | "REAL_SANDBOX_CAPTURE"
        | "DEMO_SYNTHETIC"
        | "HISTORICAL_SANDBOX_REPLAY"
        | "UNFUNDED"
    ): TaskSummary => ({
      task_id: id,
      status: provenance === "UNFUNDED" ? "EVIDENCE_CONTRACT_DEFINED" : "FUNDED",
      contract: {
        task_id: id,
        item_title: "Bosch EV14 Injector",
        seller_reference: "Warehouse #14",
        expected_sku: "BOSCH-0280158040",
        expected_attributes: [],
        required_views: ["FRONT_PACKAGING", "SKU_BARCODE_CLOSEUP"],
        deadline_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
        max_verification_budget: 14,
        currency: "USD",
        acceptance_rules: [],
        prohibited_data: [],
        synthetic_label:
          provenance === "REAL_SANDBOX_CAPTURE"
            ? "SANDBOX_LIVE_TEST"
            : "DEMO_SYNTHETIC",
      },
      voi: {
        part_purchase_price_usd: 220,
        total_loss_if_wrong_usd: 300,
        assumed_mismatch_probability: 0.15,
        expected_loss_without_verification_usd: 45,
        verification_fee_usd: 14,
        net_expected_savings_usd: 31,
        recommendation: "VERIFY_BEFORE_PAYMENT",
        assumption_source_label: "DEMO_SYNTHETIC_SCENARIO",
        epistemic_disclaimer: "Scenario disclaimer",
      },
      paypal_order:
        provenance === "UNFUNDED"
          ? null
          : {
              orderId: `ORD_${id}`,
              status: "COMPLETED",
              amountUsd: "14.00",
              approveUrl: null,
              captureId: `CAP_${id}`,
            },
      funding_allocation: {
        funding_provenance: provenance,
        original_task_id: id,
        original_order_id: `ORD_${id}`,
        original_capture_id: `CAP_${id}`,
        is_payout_eligible_funding: provenance === "REAL_SANDBOX_CAPTURE",
        creates_available_balance: provenance === "REAL_SANDBOX_CAPTURE",
        provenance_explanation: "Test allocation",
      },
      evidence_artifacts: [],
      ai_analysis: null,
      ai_blocked_reason: null,
      reviewer_decision: null,
      payout_result: null,
      proof_passport: null,
    });

    const metrics = computeRequesterMetrics([
      makeTask("t_real", "REAL_SANDBOX_CAPTURE"),
      makeTask("t_demo", "DEMO_SYNTHETIC"),
      makeTask("t_replay", "HISTORICAL_SANDBOX_REPLAY"),
      makeTask("t_unfunded", "UNFUNDED"),
    ]);

    expect(metrics.realSandboxPayments.count).toBe(1);
    expect(metrics.realSandboxPayments.totalUsd).toBe(14);
    expect(metrics.demoFunded).toBe(1);
    expect(metrics.replayAttached).toBe(1);
  });

  it("translates technical states to human language while preserving original backend codes and never claiming physical authenticity", () => {
    const sampleTask = {
      task_id: "t1",
      status: "PROOF_PASSPORT_ISSUED",
      contract: {
        task_id: "t1",
        item_title: "Bosch EV14",
        seller_reference: "Ref",
        expected_sku: "BOSCH-0280158040",
        expected_attributes: [],
        required_views: ["FRONT_PACKAGING"],
        deadline_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
        max_verification_budget: 14,
        currency: "USD",
        acceptance_rules: [],
        prohibited_data: [],
        synthetic_label: "SANDBOX_LIVE_TEST",
      },
    } as unknown as TaskSummary;

    const esStatus = humanStatus(sampleTask, "es");
    expect(esStatus.label).toBe("Resultado disponible");
    expect(esStatus.code).toBe("PROOF_PASSPORT_ISSUED");

    const outcome = passportOutcome(
      {
        status: "VERIFIED",
        approval_classification: "COMMERCIAL_EVIDENCE_REVIEWED",
        synthetic_label: "SANDBOX_LIVE_TEST",
      },
      "es"
    );
    expect(outcome.headline).toBe("Revisión de evidencia completada");
    expect(outcome.headline.toLowerCase()).not.toContain("auténtico");
    expect(outcome.sub.toLowerCase()).toContain("no certifica la autenticidad física");
    expect(RP_TOKENS.typography.minTextPx).toBeGreaterThanOrEqual(12);
  });

  it("GATE 2D-B: translates canonical 3-view codes and never sums DEMO_SYNTHETIC into Verifier real earnings", () => {
    expect(viewLabel("FRONT_PART", "es")).toBe("Frente de la pieza");
    expect(viewLabel("SKU_LABEL_CLOSEUP", "es")).toBe(
      "Primer plano de etiqueta SKU"
    );
    expect(viewLabel("PACKAGING_BOX", "es")).toBe("Caja y sello de empaque");

    const realSandboxTask = {
      task_id: "t_real_sbx",
      status: "VERIFIED",
      contract: {
        task_id: "t_real_sbx",
        item_title: "Bosch EV14",
        seller_reference: "Warehouse",
        expected_sku: "BOSCH-0280158040",
        expected_attributes: [],
        required_views: ["FRONT_PART", "SKU_LABEL_CLOSEUP", "PACKAGING_BOX"],
        max_verification_budget: 14,
        currency: "USD",
        acceptance_rules: [],
        prohibited_data: [],
        synthetic_label: "SANDBOX_LIVE_TEST",
      },
      paypal_order: {
        orderId: "ORD_REAL",
        status: "COMPLETED",
        amountUsd: "14.00",
        approveUrl: null,
        captureId: "CAP_REAL",
      },
      funding_allocation: {
        funding_provenance: "REAL_SANDBOX_CAPTURE",
        original_task_id: "t_real_sbx",
        original_order_id: "ORD_REAL",
        original_capture_id: "CAP_REAL",
        is_payout_eligible_funding: true,
        creates_available_balance: true,
        provenance_explanation: "Real Sandbox capture",
      },
      evidence_artifacts: [],
      ai_analysis: null,
      reviewer_decision: {
        reviewer_id: "op",
        decision: "APPROVE",
        rationale: "Approved",
        reviewed_at: new Date().toISOString(),
      },
      proof_passport: null,
    } as unknown as TaskSummary;

    const demoTask = {
      ...realSandboxTask,
      task_id: "t_demo_synth",
      status: "FUNDED",
      contract: {
        ...realSandboxTask.contract,
        task_id: "t_demo_synth",
        max_verification_budget: 99,
        synthetic_label: "DEMO_SYNTHETIC",
      },
      paypal_order: {
        orderId: "ORD_DEMO",
        status: "COMPLETED",
        amountUsd: "99.00",
        approveUrl: null,
        captureId: "CAP_DEMO",
      },
      funding_allocation: {
        funding_provenance: "DEMO_SYNTHETIC",
        original_task_id: "t_demo_synth",
        original_order_id: "ORD_DEMO",
        original_capture_id: "CAP_DEMO",
        is_payout_eligible_funding: false,
        creates_available_balance: false,
        provenance_explanation: "Synthetic demo funding",
      },
      reviewer_decision: null,
    } as unknown as TaskSummary;

    const earnings = computeVerifierEarningsMetrics([realSandboxTask, demoTask]);
    expect(earnings.realSandboxEligibleUsd).toBe(11.2);
    expect(earnings.demoTaskCount).toBe(1);

    const priorityDemo = computeOperatorPriority(
      { ...demoTask, status: "AI_ANALYZED" } as unknown as TaskSummary,
      "en"
    );
    expect(priorityDemo.level).toBe("HIGH");
  });
});

describe("verifier earnings never count an unreceived payout", () => {
  it("separates received, unclaimed and eligible Sandbox amounts", () => {
    const base = {
      status: "PROOF_PASSPORT_ISSUED",
      proof_passport: null,
      contract: { max_verification_budget: 14 },
      paypal_order: { status: "COMPLETED", captureId: "CAP", orderId: "ORD" },
      funding_allocation: {
        funding_provenance: "REAL_SANDBOX_CAPTURE",
        is_payout_eligible_funding: true,
      },
    };
    const metrics = computeVerifierEarningsMetrics([
      { ...base, payout_result: { itemTransactionStatus: "UNCLAIMED" } },
      { ...base, payout_result: { itemTransactionStatus: "SUCCESS" } },
      { ...base, payout_result: null },
    ] as never);
    expect(metrics.realSandboxUnclaimedUsd).toBe(11.2);
    expect(metrics.realSandboxReceivedUsd).toBe(11.2);
    expect(metrics.realSandboxEligibleUsd).toBe(11.2);
  });
});
