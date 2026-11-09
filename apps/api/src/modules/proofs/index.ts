import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  assertValidTransition,
  computeValueOfInformation,
  evaluateEvidenceCompleteness,
  EvidenceContractV0Schema,
  PayoutEligibilityProofSchema,
  ProofPassportV0Schema,
  type ComponentProvenance,
  type EvidenceArtifact,
  type EvidenceCompletenessReport,
  type EvidenceContractV0,
  type FinancialSequenceStep,
  type FundingAllocation,
  type FundingProvenance,
  type GeminiAnalysisResult,
  type HumanExceptionRecord,
  type PassportApprovalClassification,
  type PayoutEligibilityProof,
  type PayoutStatus,
  type ProofPassportV0,
  type ReviewerDecision,
  type TaskStatus,
  type TrustClassificationTag,
  type ValueOfInformationInput,
  type ValueOfInformationOutput,
} from "@realityproof/shared";
import type { AuditService } from "../audit/index.js";
import type { PayPalOrderRecord, PayPalPayoutResult } from "../paypal/index.js";
import { createSignedReadToken } from "../permissions/index.js";

export interface VerificationTaskRecord {
  task_id: string;
  status: TaskStatus;
  financial_sequence: FinancialSequenceStep[];
  payout_eligibility_proof: PayoutEligibilityProof | null;
  funding_allocation?: FundingAllocation;
  evidence_completeness?: EvidenceCompletenessReport;
  human_exception?: HumanExceptionRecord | null;
  contract: EvidenceContractV0;
  voi: ValueOfInformationOutput;
  created_by: string;
  assigned_verifier_id: string | null;
  paypal_order: PayPalOrderRecord | null;
  evidence_artifacts: EvidenceArtifact[];
  ai_analysis: GeminiAnalysisResult | null;
  ai_blocked_reason: string | null;
  reviewer_decision: ReviewerDecision | null;
  decision_history?: ReviewerDecision[];
  payout_result: PayPalPayoutResult | null;
  proof_passport: ProofPassportV0 | null;
  created_at: string;
  updated_at: string;
}

export class ProofsService {
  private tasks = new Map<string, VerificationTaskRecord>();
  private passportsById = new Map<string, ProofPassportV0>();
  private orderIdToOwnerTask = new Map<string, string>();
  private captureIdToOwnerTask = new Map<string, string>();
  private inFlightFundingLocks = new Set<string>();

  constructor(
    private readonly audit: AuditService,
    private readonly publicApiBaseUrl: string,
    private readonly authTokenSecret: string,
    private readonly stateFilePath?: string
  ) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.stateFilePath || !fs.existsSync(this.stateFilePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.stateFilePath, "utf8");
      const data = JSON.parse(raw) as {
        tasks?: VerificationTaskRecord[];
        passports?: ProofPassportV0[];
        audit_events?: Array<{
          event_id: string;
          task_id: string | null;
          actor_role: string;
          actor_id: string;
          action: string;
          from_status: string | null;
          to_status: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        }>;
      };
      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          this.refreshTaskDerivedFields(t);
          this.tasks.set(t.task_id, t);
          if (
            t.paypal_order?.orderId &&
            t.funding_allocation?.funding_provenance === "REAL_SANDBOX_CAPTURE"
          ) {
            this.orderIdToOwnerTask.set(t.paypal_order.orderId, t.task_id);
            if (t.paypal_order.captureId) {
              this.captureIdToOwnerTask.set(t.paypal_order.captureId, t.task_id);
            }
          }
        }
      }
      if (Array.isArray(data.passports)) {
        for (const p of data.passports) {
          this.passportsById.set(p.proof_id, p);
        }
      }
      if (Array.isArray(data.audit_events)) {
        this.audit.hydrate(data.audit_events);
      }
    } catch (err) {
      // Never let the next write replace a file we could not read: keep it for recovery.
      const quarantinePath = `${this.stateFilePath}.corrupt-${Date.now()}`;
      fs.renameSync(this.stateFilePath, quarantinePath);
      console.error(
        `[RealityProof] State file unreadable (${(err as Error).message}). Moved to ${quarantinePath}; restore it from a backup.`
      );
    }
  }

  /** Saves events recorded since the last task change; called on shutdown. */
  flush(): void {
    this.persistToDisk();
  }

  private persistToDisk(): void {
    if (!this.stateFilePath) {
      return;
    }
    try {
      const dir = path.dirname(this.stateFilePath);
      fs.mkdirSync(dir, { recursive: true });
      const payload = JSON.stringify(
        {
          tasks: Array.from(this.tasks.values()),
          passports: Array.from(this.passportsById.values()),
          audit_events: this.audit.listAll(),
          saved_at: new Date().toISOString(),
        },
        null,
        2
      );
      const tmpFile = `${this.stateFilePath}.${process.pid}.${Date.now()}.tmp`;
      const fd = fs.openSync(tmpFile, "w", 0o600);
      try {
        fs.writeFileSync(fd, payload, "utf8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmpFile, this.stateFilePath);
    } catch (err) {
      // The request still succeeds, but a failed save must be visible to the operator.
      console.error(
        `[RealityProof] Failed to persist state: ${(err as Error).message}`
      );
    }
  }

  private refreshTaskDerivedFields(task: VerificationTaskRecord): void {
    if (!task.funding_allocation) {
      if (task.paypal_order?.captureId && task.paypal_order.status === "COMPLETED") {
        const isSimulatedOrder = task.paypal_order.orderId.startsWith("DEMO_ORD_");
        task.funding_allocation = {
          funding_provenance: isSimulatedOrder
            ? "DEMO_SYNTHETIC"
            : "REAL_SANDBOX_CAPTURE",
          original_task_id: task.task_id,
          original_order_id: task.paypal_order.orderId,
          original_capture_id: task.paypal_order.captureId,
          is_payout_eligible_funding: !isSimulatedOrder,
          creates_available_balance: !isSimulatedOrder,
          provenance_explanation: isSimulatedOrder
            ? "Simulated DEMO_SYNTHETIC funding for workflow testing. Does not charge PayPal or create payout eligibility."
            : "Verified 1-to-1 PayPal Sandbox capture allocated exclusively to this verification contract.",
        };
      } else {
        task.funding_allocation = {
          funding_provenance: "UNFUNDED",
          original_task_id: null,
          original_order_id: task.paypal_order?.orderId ?? null,
          original_capture_id: null,
          is_payout_eligible_funding: false,
          creates_available_balance: false,
          provenance_explanation:
            "No completed PayPal Sandbox capture has been allocated to this task yet.",
        };
      }
    }

    task.evidence_completeness = evaluateEvidenceCompleteness({
      requiredViews: task.contract.required_views,
      artifacts: task.evidence_artifacts ?? [],
      aiAnalysis: task.ai_analysis ?? null,
      humanException: task.human_exception ?? null,
    });
  }

  hydrateTaskRecord(record: VerificationTaskRecord): void {
    this.refreshTaskDerivedFields(record);
    if (
      record.paypal_order?.orderId &&
      record.funding_allocation?.funding_provenance === "REAL_SANDBOX_CAPTURE"
    ) {
      this.orderIdToOwnerTask.set(record.paypal_order.orderId, record.task_id);
      if (record.paypal_order.captureId) {
        this.captureIdToOwnerTask.set(
          record.paypal_order.captureId,
          record.task_id
        );
      }
    }
    if (record.proof_passport) {
      const validUntil = new Date(Date.now() + 72 * 3600_000).toISOString();
      const freshToken = createSignedReadToken(
        record.proof_passport.proof_id,
        validUntil,
        this.authTokenSecret
      );
      record.proof_passport = {
        ...record.proof_passport,
        valid_until: validUntil,
        authorized_read_url: `${this.publicApiBaseUrl}/api/v1/proofs/${record.proof_passport.proof_id}?token=${encodeURIComponent(freshToken)}`,
      };
      this.passportsById.set(record.proof_passport.proof_id, record.proof_passport);
    }
    this.tasks.set(record.task_id, record);
    this.persistToDisk();
  }

  createVerificationTask(params: {
    actorId: string;
    actorRole: string;
    contractInput: Omit<EvidenceContractV0, "task_id"> & { task_id?: string };
    voiInput: ValueOfInformationInput;
  }): VerificationTaskRecord {
    const taskId =
      params.contractInput.task_id ?? `task_${crypto.randomUUID().slice(0, 12)}`;
    const contract = EvidenceContractV0Schema.parse({
      ...params.contractInput,
      task_id: taskId,
    });
    const voi = computeValueOfInformation(params.voiInput);

    const now = new Date().toISOString();
    const record: VerificationTaskRecord = {
      task_id: taskId,
      status: "EVIDENCE_CONTRACT_DEFINED",
      financial_sequence: [],
      payout_eligibility_proof: null,
      funding_allocation: {
        funding_provenance: "UNFUNDED",
        original_task_id: null,
        original_order_id: null,
        original_capture_id: null,
        is_payout_eligible_funding: false,
        creates_available_balance: false,
        provenance_explanation:
          "No completed PayPal Sandbox capture has been allocated to this task yet.",
      },
      evidence_completeness: evaluateEvidenceCompleteness({
        requiredViews: contract.required_views,
        artifacts: [],
        aiAnalysis: null,
        humanException: null,
      }),
      human_exception: null,
      contract,
      voi,
      created_by: params.actorId,
      assigned_verifier_id: null,
      paypal_order: null,
      evidence_artifacts: [],
      ai_analysis: null,
      ai_blocked_reason: null,
      reviewer_decision: null,
      decision_history: [],
      payout_result: null,
      proof_passport: null,
      created_at: now,
      updated_at: now,
    };

    this.tasks.set(taskId, record);
    this.audit.record({
      task_id: taskId,
      actor_role: params.actorRole,
      actor_id: params.actorId,
      action: "CREATE_VERIFICATION_TASK",
      from_status: "DRAFT",
      to_status: "EVIDENCE_CONTRACT_DEFINED",
      metadata: {
        expected_sku: contract.expected_sku,
        budget_usd: contract.max_verification_budget,
        voi_recommendation: voi.recommendation,
        synthetic_label: contract.synthetic_label,
      },
    });
    this.persistToDisk();

    return record;
  }

  transitionStatus(
    task: VerificationTaskRecord,
    toStatus: TaskStatus,
    actor: { role: string; actorId: string },
    action: string,
    metadata: Record<string, unknown> = {}
  ): void {
    const fromStatus = task.status;
    assertValidTransition(fromStatus, toStatus);
    task.status = toStatus;
    task.updated_at = new Date().toISOString();
    this.audit.record({
      task_id: task.task_id,
      actor_role: actor.role,
      actor_id: actor.actorId,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      metadata,
    });
    this.persistToDisk();
  }

  private recordFinancialStep(
    task: VerificationTaskRecord,
    step: FinancialSequenceStep
  ): void {
    const orderedSteps: FinancialSequenceStep[] = [
      "ORDER_CREATED",
      "BUYER_APPROVED",
      "CAPTURE_COMPLETED",
      "EVIDENCE_SUBMITTED",
      "AI_ANALYZED",
      "HUMAN_APPROVED",
      "PAYOUT_ELIGIBLE",
      "PAYOUT_REQUESTED",
      "PAYOUT_SUCCESS",
    ];
    if (!task.financial_sequence) {
      task.financial_sequence = [];
    }
    if (task.financial_sequence.includes(step)) {
      return;
    }
    const targetIdx = orderedSteps.indexOf(step);
    for (let i = 0; i < targetIdx; i++) {
      const prerequisite = orderedSteps[i]!;
      // Allow manual human review path if AI was blocked, otherwise enforce full sequence
      if (
        prerequisite === "AI_ANALYZED" &&
        task.ai_blocked_reason &&
        step === "HUMAN_APPROVED"
      ) {
        continue;
      }
      if (!task.financial_sequence.includes(prerequisite)) {
        throw new Error(
          `FINANCIAL_SEQUENCE_VIOLATION: Cannot advance to '${step}' because prerequisite step '${prerequisite}' has not been completed. Current sequence: [${task.financial_sequence.join(" -> ")}]`
        );
      }
    }
    task.financial_sequence.push(step);
  }

  attachOrderCreated(
    taskId: string,
    order: PayPalOrderRecord,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    const existingOwner = this.orderIdToOwnerTask.get(order.orderId);
    if (existingOwner && existingOwner !== taskId) {
      throw new Error(
        `FOREIGN_ORDER_ALREADY_BOUND: PayPal order '${order.orderId}' is already bound to task '${existingOwner}' and cannot be linked to '${taskId}'.`
      );
    }
    this.orderIdToOwnerTask.set(order.orderId, taskId);

    if (task.status !== "FUNDING_PENDING") {
      this.transitionStatus(task, "FUNDING_PENDING", actor, "PAYPAL_ORDER_CREATED", {
        order_id: order.orderId,
        amount_usd: order.amountUsd,
      });
    }
    task.paypal_order = order;
    task.funding_allocation = {
      funding_provenance: "UNFUNDED",
      original_task_id: taskId,
      original_order_id: order.orderId,
      original_capture_id: null,
      is_payout_eligible_funding: false,
      creates_available_balance: false,
      provenance_explanation:
        "PayPal Sandbox order created; awaiting buyer approval and capture.",
    };
    this.recordFinancialStep(task, "ORDER_CREATED");
    this.persistToDisk();
    return task;
  }

  markBlockedBuyerApproval(
    taskId: string,
    approveUrl: string | null,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "BLOCKED_BUYER_APPROVAL") {
      this.transitionStatus(
        task,
        "BLOCKED_BUYER_APPROVAL",
        actor,
        "PAYPAL_BLOCKED_BUYER_APPROVAL",
        {
          order_id: task.paypal_order?.orderId ?? null,
          approve_url: approveUrl,
        }
      );
    }
    return task;
  }

  attachOrderCaptured(
    taskId: string,
    order: PayPalOrderRecord,
    actor: { role: string; actorId: string },
    provenance: Extract<
      FundingProvenance,
      "REAL_SANDBOX_CAPTURE" | "DEMO_SYNTHETIC"
    > = "REAL_SANDBOX_CAPTURE"
  ): VerificationTaskRecord {
    const lockKey = `${order.orderId}:${order.captureId ?? "nocap"}`;
    if (this.inFlightFundingLocks.has(lockKey)) {
      throw new Error(
        `CONCURRENT_FUNDING_ALLOCATION_BLOCKED: Order/capture '${lockKey}' is currently being allocated by another request.`
      );
    }
    this.inFlightFundingLocks.add(lockKey);

    try {
      const task = this.getTaskOrThrow(taskId);
      if (order.taskId !== taskId) {
        throw new Error(
          `FOREIGN_ORDER_TASK_MISMATCH: Order '${order.orderId}' belongs to task '${order.taskId}' and cannot fund '${taskId}'.`
        );
      }

      const existingOrderOwner = this.orderIdToOwnerTask.get(order.orderId);
      if (existingOrderOwner && existingOrderOwner !== taskId) {
        throw new Error(
          `FOREIGN_ORDER_ALREADY_BOUND: PayPal order '${order.orderId}' is already bound to task '${existingOrderOwner}' and cannot fund '${taskId}'.`
        );
      }

      if (order.captureId) {
        const existingCaptureOwner = this.captureIdToOwnerTask.get(
          order.captureId
        );
        if (existingCaptureOwner && existingCaptureOwner !== taskId) {
          throw new Error(
            `CAPTURE_ALREADY_ALLOCATED: PayPal capture '${order.captureId}' already funded task '${existingCaptureOwner}'. A single capture cannot independently fund multiple verification contracts.`
          );
        }
      }

      this.orderIdToOwnerTask.set(order.orderId, taskId);
      if (order.captureId) {
        this.captureIdToOwnerTask.set(order.captureId, taskId);
      }

      if (task.status === "EVIDENCE_CONTRACT_DEFINED") {
        this.transitionStatus(task, "FUNDING_PENDING", actor, provenance === "REAL_SANDBOX_CAPTURE" ? "PAYPAL_ORDER_LINKED" : "SYNTHETIC_ORDER_LINKED", {
          order_id: order.orderId,
          amount_usd: order.amountUsd,
          funding_provenance: provenance,
        });
      }
      task.paypal_order = order;
      task.funding_allocation = {
        funding_provenance: provenance,
        original_task_id: taskId,
        original_order_id: order.orderId,
        original_capture_id: order.captureId,
        is_payout_eligible_funding: provenance === "REAL_SANDBOX_CAPTURE",
        creates_available_balance: provenance === "REAL_SANDBOX_CAPTURE",
        provenance_explanation:
          provenance === "REAL_SANDBOX_CAPTURE"
            ? "Verified 1-to-1 PayPal Sandbox capture allocated exclusively to this verification contract."
            : "Simulated DEMO_SYNTHETIC funding for workflow demonstration. Does not charge PayPal, create available balance, or enable Payouts.",
      };
      this.recordFinancialStep(task, "ORDER_CREATED");
      this.recordFinancialStep(task, "BUYER_APPROVED");
      this.recordFinancialStep(task, "CAPTURE_COMPLETED");
      if (task.status !== "FUNDED") {
        this.transitionStatus(task, "FUNDED", actor, provenance === "REAL_SANDBOX_CAPTURE" ? "PAYPAL_ORDER_CAPTURED" : "SYNTHETIC_FUNDING_RECORDED", {
          order_id: order.orderId,
          capture_id: order.captureId,
          amount_usd: order.amountUsd,
          funding_provenance: provenance,
        });
      }
      this.persistToDisk();
      return task;
    } finally {
      this.inFlightFundingLocks.delete(lockKey);
    }
  }

  attachHistoricalSandboxReplay(
    taskId: string,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    task.funding_allocation = {
      funding_provenance: "HISTORICAL_SANDBOX_REPLAY",
      original_task_id: "task_live_sbx_1793222660264",
      original_order_id: "4J744493RC470905K",
      original_capture_id: "0TL320715J3450828",
      is_payout_eligible_funding: false,
      creates_available_balance: false,
      provenance_explanation:
        "Historical replay reference to PayPal Sandbox Capture 0TL320715J3450828 (originally allocated to contract task_live_sbx_1793222660264). Does NOT fund this contract, does NOT create available balance, and CANNOT trigger Payouts.",
    };
    this.audit.record({
      task_id: task.task_id,
      actor_role: actor.role,
      actor_id: actor.actorId,
      action: "HISTORICAL_SANDBOX_REPLAY_INSPECTED",
      from_status: task.status,
      to_status: task.status,
      metadata: {
        funding_provenance: "HISTORICAL_SANDBOX_REPLAY",
        original_task_id: "task_live_sbx_1793222660264",
        original_order_id: "4J744493RC470905K",
        original_capture_id: "0TL320715J3450828",
        is_payout_eligible_funding: false,
        creates_available_balance: false,
      },
    });
    this.persistToDisk();
    return task;
  }

  attachSimulatedDemoFunding(
    taskId: string,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.contract.synthetic_label !== "DEMO_SYNTHETIC") {
      throw new Error(
        "DEMO_FUNDING_REQUIRES_SYNTHETIC_LABEL: Simulated demo funding is only permitted on tasks explicitly labeled DEMO_SYNTHETIC."
      );
    }
    const demoOrder: PayPalOrderRecord = {
      orderId: `DEMO_ORD_${task.task_id}`,
      taskId: task.task_id,
      status: "COMPLETED",
      amountUsd: task.contract.max_verification_budget.toFixed(2),
      currency: "USD",
      approveUrl: null,
      captureId: `DEMO_CAP_${task.task_id}`,
      paypalRequestId: `rp_demo_fund_${task.task_id}`,
      rawOrderResponse: {
        synthetic_demo_funding: true,
        creates_available_balance: false,
        is_payout_eligible: false,
      },
      updatedAt: new Date().toISOString(),
    };
    return this.attachOrderCaptured(
      task.task_id,
      demoOrder,
      actor,
      "DEMO_SYNTHETIC"
    );
  }

  markPaymentFailed(
    taskId: string,
    reason: string,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    this.transitionStatus(task, "PAYMENT_FAILED", actor, "PAYPAL_PAYMENT_FAILED", {
      reason,
    });
    return task;
  }

  assignVerifier(
    taskId: string,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (new Date(task.contract.deadline_at).getTime() < Date.now()) {
      this.transitionStatus(task, "EXPIRED", actor, "TASK_DEADLINE_EXPIRED");
      throw new Error("TASK_EXPIRED: Verification deadline has already passed.");
    }
    task.assigned_verifier_id = actor.actorId;
    this.transitionStatus(task, "ASSIGNED", actor, "ASSIGN_VERIFIER", {
      verifier_id: actor.actorId,
    });
    return task;
  }

  attachSubmittedEvidence(
    taskId: string,
    artifacts: EvidenceArtifact[],
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (new Date(task.contract.deadline_at).getTime() < Date.now()) {
      this.transitionStatus(task, "EXPIRED", actor, "TASK_DEADLINE_EXPIRED");
      throw new Error("TASK_EXPIRED: Verification deadline has passed.");
    }
    const mergedMap = new Map<string, EvidenceArtifact>();
    for (const existing of task.evidence_artifacts) {
      mergedMap.set(existing.artifact_id, existing);
    }
    for (const incoming of artifacts) {
      mergedMap.set(incoming.artifact_id, incoming);
    }
    task.evidence_artifacts = Array.from(mergedMap.values());
    task.evidence_completeness = evaluateEvidenceCompleteness({
      requiredViews: task.contract.required_views,
      artifacts: task.evidence_artifacts,
      aiAnalysis: task.ai_analysis,
      humanException: task.human_exception,
    });
    this.recordFinancialStep(task, "EVIDENCE_SUBMITTED");
    if (task.status === "ASSIGNED") {
      this.transitionStatus(task, "SUBMITTED", actor, "SUBMIT_EVIDENCE", {
        artifact_count: task.evidence_artifacts.length,
        submitted_views: task.evidence_completeness.submitted_declared_views,
        missing_views: task.evidence_completeness.missing_views,
        sha256_hashes: task.evidence_artifacts.map((a) => a.sha256_hex),
      });
    } else {
      this.audit.record({
        task_id: task.task_id,
        actor_role: actor.role,
        actor_id: actor.actorId,
        action: "SUBMIT_ADDITIONAL_EVIDENCE",
        from_status: task.status,
        to_status: task.status,
        metadata: {
          artifact_count: task.evidence_artifacts.length,
          submitted_views: task.evidence_completeness.submitted_declared_views,
          missing_views: task.evidence_completeness.missing_views,
          sha256_hashes: task.evidence_artifacts.map((a) => a.sha256_hex),
        },
      });
    }
    this.persistToDisk();
    return task;
  }

  markAiProcessing(
    taskId: string,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "AI_PROCESSING") {
      this.transitionStatus(task, "AI_PROCESSING", actor, "GEMINI_ANALYSIS_STARTED");
    }
    return task;
  }

  attachAiAnalysis(
    taskId: string,
    analysis: GeminiAnalysisResult,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    task.ai_analysis = analysis;
    task.ai_blocked_reason = null;
    task.evidence_completeness = evaluateEvidenceCompleteness({
      requiredViews: task.contract.required_views,
      artifacts: task.evidence_artifacts,
      aiAnalysis: task.ai_analysis,
      humanException: task.human_exception,
    });
    this.recordFinancialStep(task, "AI_ANALYZED");
    this.transitionStatus(task, "AI_ANALYZED", actor, "GEMINI_ANALYSIS_COMPLETED", {
      model_id: analysis.model_id,
      matches_expected: analysis.matches_expected,
      safety_flags: analysis.safety_flags,
      needs_human_review: analysis.needs_human_review,
      missing_views: task.evidence_completeness.missing_views,
    });
    return task;
  }

  markAiBlocked(
    taskId: string,
    reason: string,
    actor: { role: string; actorId: string }
  ): VerificationTaskRecord {
    const task = this.getTaskOrThrow(taskId);
    task.ai_blocked_reason = reason;
    this.transitionStatus(task, "AI_BLOCKED", actor, "GEMINI_ANALYSIS_BLOCKED", {
      reason,
    });
    return task;
  }

  buildPayoutEligibilityProof(
    taskId: string,
    operatorId: string
  ): PayoutEligibilityProof {
    const task = this.getTaskOrThrow(taskId);
    if (
      !task.paypal_order ||
      task.paypal_order.status !== "COMPLETED" ||
      !task.paypal_order.captureId
    ) {
      throw new Error(
        "PAYOUT_INELIGIBLE_NO_CAPTURE: Cannot build PayoutEligibilityProof without a COMPLETED PayPal capture."
      );
    }
    if (
      task.funding_allocation?.funding_provenance !== "REAL_SANDBOX_CAPTURE" ||
      !task.funding_allocation?.is_payout_eligible_funding ||
      task.funding_allocation?.original_task_id !== task.task_id
    ) {
      throw new Error(
        `PAYOUT_INELIGIBLE_NON_REAL_CAPTURE: Task '${task.task_id}' has funding provenance '${task.funding_allocation?.funding_provenance ?? "UNFUNDED"}'. Only 1-to-1 REAL_SANDBOX_CAPTURE contracts can generate payout eligibility or available balance.`
      );
    }
    if (task.evidence_artifacts.length === 0) {
      throw new Error(
        "PAYOUT_INELIGIBLE_NO_EVIDENCE: Cannot build PayoutEligibilityProof without submitted evidence."
      );
    }
    if (!task.ai_analysis) {
      throw new Error(
        "PAYOUT_INELIGIBLE_NO_AI_ANALYSIS: Full financial sequence requires AI_ANALYZED before PAYOUT_ELIGIBLE."
      );
    }
    return PayoutEligibilityProofSchema.parse({
      task_id: task.task_id,
      order_id: task.paypal_order.orderId,
      buyer_approved: true,
      capture_id: task.paypal_order.captureId,
      capture_status: "COMPLETED",
      captured_amount_usd: Number(task.paypal_order.amountUsd),
      evidence_submitted_count: task.evidence_artifacts.length,
      ai_analyzed: true,
      human_approved_by: operatorId,
      human_approved_at: new Date().toISOString(),
      payout_eligible: true,
    });
  }

  submitOperatorReviewAndIssuePassport(params: {
    taskId: string;
    operatorId: string;
    decision: ReviewerDecision["decision"];
    rationale: string;
    payoutResult?: PayPalPayoutResult | null;
    humanException?: {
      granted: boolean;
      foundation_rationale: string;
      scope: string;
      limitations: string[];
    } | null;
  }): VerificationTaskRecord {
    const task = this.getTaskOrThrow(params.taskId);

    const submittedBySameActor = task.evidence_artifacts.some(
      (a) => a.verifier_id === params.operatorId
    );
    if (
      (task.assigned_verifier_id &&
        task.assigned_verifier_id === params.operatorId) ||
      task.created_by === params.operatorId ||
      submittedBySameActor
    ) {
      throw new Error(
        "SEPARATION_OF_DUTIES_VIOLATION: An operator cannot review or approve their own verification request or evidence submission."
      );
    }

    if (
      !task.paypal_order ||
      task.paypal_order.status !== "COMPLETED" ||
      !task.paypal_order.captureId
    ) {
      throw new Error(
        "UNFUNDED_TASK_CANNOT_BE_VERIFIED: Cannot finalize review or issue Proof Passport without verified funding."
      );
    }

    // Recompute evidence completeness before allowing APPROVE
    const preCompleteness = evaluateEvidenceCompleteness({
      requiredViews: task.contract.required_views,
      artifacts: task.evidence_artifacts,
      aiAnalysis: task.ai_analysis,
      humanException: null,
    });

    let recordedException: HumanExceptionRecord | null = null;
    if (params.decision === "APPROVE") {
      if (preCompleteness.missing_views.length > 0) {
        if (
          !params.humanException ||
          !params.humanException.granted ||
          params.humanException.foundation_rationale.trim().length < 5
        ) {
          throw new Error(
            `INCOMPLETE_EVIDENCE_CONTRACT: Cannot approve contract as complete because required photographic views are missing: [${preCompleteness.missing_views.join(", ")}]. Submitted views: [${preCompleteness.submitted_declared_views.join(", ")}]. Use REQUEST_MORE_EVIDENCE to request missing views [${preCompleteness.missing_views.join(", ")}], or explicitly authorize a human exception with foundation, scope, and limitations.`
          );
        }
        recordedException = {
          granted: true,
          granted_by: params.operatorId,
          granted_at: new Date().toISOString(),
          missing_views_waived: preCompleteness.missing_views,
          foundation_rationale: params.humanException.foundation_rationale.trim(),
          scope: params.humanException.scope.trim(),
          limitations: params.humanException.limitations,
        };
        task.human_exception = recordedException;
      }
    }

    task.evidence_completeness = evaluateEvidenceCompleteness({
      requiredViews: task.contract.required_views,
      artifacts: task.evidence_artifacts,
      aiAnalysis: task.ai_analysis,
      humanException: recordedException,
    });

    const fromStatusBeforeReview = task.status;
    const expectedFromAi = task.ai_analysis?.recommended_decision;
    const aiRecommendationOverridden = Boolean(
      expectedFromAi &&
        ((params.decision === "APPROVE" &&
          expectedFromAi !== "PROCEED_TO_HUMAN_APPROVAL") ||
          (params.decision === "REJECT" &&
            expectedFromAi === "PROCEED_TO_HUMAN_APPROVAL"))
    );

    const actor = { role: "OPERATOR", actorId: params.operatorId };
    const evidenceArtifactIds = task.evidence_artifacts.map(
      (a) => a.artifact_id
    );

    this.transitionStatus(
      task,
      "HUMAN_REVIEWED",
      actor,
      "OPERATOR_REVIEW_SUBMITTED",
      {
        decision: params.decision,
        rationale: params.rationale,
        from_status: fromStatusBeforeReview,
        evidence_artifact_ids: evidenceArtifactIds,
        missing_views: task.evidence_completeness.missing_views,
        human_exception_granted: Boolean(recordedException),
        ai_recommendation_overridden: aiRecommendationOverridden,
      }
    );

    if (params.decision === "REQUEST_MORE_EVIDENCE") {
      this.transitionStatus(
        task,
        "ASSIGNED",
        actor,
        "OPERATOR_REQUESTED_NEW_EVIDENCE",
        {
          rationale: params.rationale,
          missing_views: task.evidence_completeness.missing_views,
          evidence_artifact_ids: evidenceArtifactIds,
        }
      );
      const moreEvidenceDecision: ReviewerDecision = {
        reviewer_id: params.operatorId,
        decision: params.decision,
        rationale: params.rationale,
        reviewed_at: new Date().toISOString(),
        from_status: fromStatusBeforeReview,
        to_status: "ASSIGNED",
        evidence_artifact_ids: evidenceArtifactIds,
        ai_recommendation_overridden: aiRecommendationOverridden,
        human_exception: null,
      };
      task.reviewer_decision = moreEvidenceDecision;
      if (!task.decision_history) {
        task.decision_history = [];
      }
      task.decision_history.push(moreEvidenceDecision);
      this.persistToDisk();
      return task;
    }

    const verdictStatus =
      params.decision === "APPROVE"
        ? "VERIFIED"
        : params.decision === "REJECT"
          ? "REJECTED"
          : "INCONCLUSIVE";

    this.transitionStatus(task, verdictStatus, actor, `TASK_${verdictStatus}`, {
      evidence_artifact_ids: evidenceArtifactIds,
    });

    const reviewerDecision: ReviewerDecision = {
      reviewer_id: params.operatorId,
      decision: params.decision,
      rationale: params.rationale,
      reviewed_at: new Date().toISOString(),
      from_status: fromStatusBeforeReview,
      to_status: "PROOF_PASSPORT_ISSUED",
      evidence_artifact_ids: evidenceArtifactIds,
      ai_recommendation_overridden: aiRecommendationOverridden,
      human_exception: recordedException,
    };
    task.reviewer_decision = reviewerDecision;
    if (!task.decision_history) {
      task.decision_history = [];
    }
    task.decision_history.push(reviewerDecision);

    let payoutStatus: PayoutStatus = "NOT_STARTED";
    let payoutBatchId: string | null = null;
    const fundingProvenance: FundingProvenance =
      task.funding_allocation?.funding_provenance ?? "UNFUNDED";

    if (verdictStatus === "VERIFIED") {
      this.recordFinancialStep(task, "HUMAN_APPROVED");
      if (
        task.ai_analysis &&
        fundingProvenance === "REAL_SANDBOX_CAPTURE" &&
        task.funding_allocation?.is_payout_eligible_funding
      ) {
        this.recordFinancialStep(task, "PAYOUT_ELIGIBLE");
        task.payout_eligibility_proof = this.buildPayoutEligibilityProof(
          task.task_id,
          params.operatorId
        );
        this.transitionStatus(
          task,
          "PAYOUT_ELIGIBLE",
          actor,
          "PAYOUT_ELIGIBLE_CONFIRMED"
        );
      }
    }

    if (params.payoutResult) {
      task.payout_result = params.payoutResult;
      payoutStatus = params.payoutResult.payoutStatus;
      payoutBatchId = params.payoutResult.payoutBatchId;

      if (verdictStatus === "VERIFIED") {
        this.recordFinancialStep(task, "PAYOUT_REQUESTED");
        this.transitionStatus(task, "PAYOUT_REQUESTED", actor, "PAYOUT_REQUESTED", {
          payout_batch_id: payoutBatchId,
        });
        if (payoutStatus === "PAYOUT_SUCCESS" || payoutStatus === "PAYOUT_CONFIRMED") {
          this.recordFinancialStep(task, "PAYOUT_SUCCESS");
          this.transitionStatus(task, "PAYOUT_SUCCESS", actor, "PAYOUT_SUCCESS", {
            payout_batch_id: payoutBatchId,
          });
        } else if (
          payoutStatus === "PAYOUT_PENDING" ||
          payoutStatus === "PAYOUT_UNCLAIMED"
        ) {
          this.transitionStatus(task, "PAYOUT_PENDING", actor, "PAYOUT_PENDING", {
            payout_batch_id: payoutBatchId,
            item_status: params.payoutResult.itemTransactionStatus ?? "PENDING",
          });
        } else if (payoutStatus === "PAYOUTS_BLOCKED") {
          this.transitionStatus(task, "PAYOUTS_BLOCKED", actor, "PAYOUTS_BLOCKED", {
            explanation: params.payoutResult.explanation,
          });
        }
      }
    }

    const firstArtifact = task.evidence_artifacts[0];
    if (!firstArtifact) {
      throw new Error("MISSING_EVIDENCE: Cannot issue Proof Passport without evidence artifacts.");
    }

    const proofId = `proof_${crypto.randomUUID().slice(0, 12)}`;
    const validUntil = task.contract.expires_at;
    const readToken = createSignedReadToken(
      proofId,
      validUntil,
      this.authTokenSecret
    );

    const evidenceHashes = task.evidence_artifacts.map((a) => ({
      artifact_id: a.artifact_id,
      view_type: a.view_type,
      sha256_hex: a.sha256_hex,
      mime_type: a.mime_type,
    }));

    const manifestSha256 = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          task_id: task.task_id,
          evidence_hashes: evidenceHashes,
          funding_order_id: task.paypal_order.orderId,
          capture_id: task.paypal_order.captureId,
          verdict: verdictStatus,
        })
      )
      .digest("hex");

    const hasSyntheticFixturePhoto = task.evidence_artifacts.some(
      (a) => a.artifact_provenance === "DEMO_SYNTHETIC_FIXTURE"
    );
    const hasCameraOrFilePhoto = task.evidence_artifacts.some(
      (a) => a.artifact_provenance === "CAMERA_OR_FILE_UPLOAD"
    );
    const photoProvenance: ComponentProvenance["photograph"] =
      hasSyntheticFixturePhoto && hasCameraOrFilePhoto
        ? "MIXED"
        : hasSyntheticFixturePhoto
          ? "DEMO_SYNTHETIC_FIXTURE"
          : "CAMERA_OR_FILE_UPLOAD";

    const isDemoOrSynthetic =
      task.contract.synthetic_label === "DEMO_SYNTHETIC" ||
      fundingProvenance !== "REAL_SANDBOX_CAPTURE" ||
      photoProvenance !== "CAMERA_OR_FILE_UPLOAD";

    let approvalClassification: PassportApprovalClassification =
      "APPROVED_FOR_DEMO";
    if (verdictStatus === "REJECTED") {
      approvalClassification = "REJECTED";
    } else if (verdictStatus === "INCONCLUSIVE") {
      approvalClassification = "INCONCLUSIVE";
    } else if (isDemoOrSynthetic) {
      approvalClassification = "APPROVED_FOR_DEMO";
    } else if (recordedException) {
      approvalClassification = "APPROVED_WITH_HUMAN_EXCEPTION";
    } else {
      approvalClassification = "COMMERCIAL_EVIDENCE_REVIEWED";
    }

    const trustClassifications: TrustClassificationTag[] = [
      "RECORD_INTEGRITY_VERIFIED",
      "EVIDENCE_REVIEW_COMPLETED",
      "PHYSICAL_AUTHENTICITY_UNVERIFIED",
    ];
    if (
      task.evidence_completeness.missing_views.length > 0 ||
      recordedException ||
      verdictStatus === "INCONCLUSIVE"
    ) {
      trustClassifications.push("INSUFFICIENT_EVIDENCE");
    }
    if (isDemoOrSynthetic) {
      trustClassifications.push("DEMO_ONLY");
    }

    const componentProvenance: ComponentProvenance = {
      payment: fundingProvenance,
      photograph: photoProvenance,
      ai_analysis: task.ai_analysis ? "LIVE_GEMINI_API" : "MANUAL_NO_AI",
      human_decision: "AUTHENTICATED_OPERATOR_REVIEW",
      document:
        fundingProvenance === "HISTORICAL_SANDBOX_REPLAY"
          ? "HISTORICAL_REPLAY_DEMO"
          : isDemoOrSynthetic
            ? "DEMO_ONLY"
            : "SANDBOX_VERIFICATION_RECORD",
    };

    const observations =
      task.ai_analysis?.visible_evidence ?? [
        `Operator manually inspected ${task.evidence_artifacts.length} submitted image(s) for expected SKU ${task.contract.expected_sku}.`,
      ];

    const limitations = [
      ...(task.ai_analysis?.limitations ?? []),
      ...(recordedException ? recordedException.limitations : []),
      "SHA-256 hashes and server timestamps verify digital file integrity after upload, NOT physical authenticity or absence of pre-capture staging.",
      "Does not guarantee seller ownership, internal component functionality, or post-inspection shipping integrity.",
      ...(isDemoOrSynthetic
        ? [
            "DEMO_ONLY: This Proof Passport was issued on a synthetic or demonstration workflow (APPROVED_FOR_DEMO) and does NOT certify physical spare-part authenticity.",
          ]
        : []),
    ];

    const unknowns = [
      "Internal mechanical/electrical condition of the part cannot be determined from exterior photographs.",
      "Physical custody between inspection timestamp and final shipment is unverified.",
      ...(task.ai_blocked_reason ? [`AI analysis was unavailable: ${task.ai_blocked_reason}`] : []),
      ...(recordedException
        ? [
            `Human exception waived missing view(s) [${recordedException.missing_views_waived.join(", ")}]: ${recordedException.foundation_rationale}`,
          ]
        : []),
    ];

    const scopeOfClaim = isDemoOrSynthetic
      ? `DEMO_ONLY (${approvalClassification}): Gemini multimodal pixel inspection and operator review of provided demonstration image(s) against EvidenceContract v0 (${task.contract.expected_sku}). Does NOT represent physical spare-part certification.`
      : recordedException
        ? `APPROVED_WITH_HUMAN_EXCEPTION: Visual inspection of submitted photographs against EvidenceContract v0 (${task.contract.expected_sku}) with documented operator exception for missing view(s) [${recordedException.missing_views_waived.join(", ")}].`
        : `Visual inspection of submitted photographs against EvidenceContract v0 (${task.contract.expected_sku}) reviewed by human operator. Physical authenticity beyond uploaded pixels remains unverified.`;

    const passport: ProofPassportV0 = ProofPassportV0Schema.parse({
      proof_id: proofId,
      task_id: task.task_id,
      proof_schema_version: "0.1.0",
      status: verdictStatus,
      approval_classification: approvalClassification,
      trust_classifications: trustClassifications,
      component_provenance: componentProvenance,
      evidence_completeness: task.evidence_completeness,
      funding_provenance: fundingProvenance,
      source_type: task.ai_analysis
        ? "HUMAN_PHOTO_WITH_AI_AND_OPERATOR_REVIEW"
        : "HUMAN_PHOTO_MANUAL_OPERATOR_REVIEW",
      captured_at: {
        value: firstArtifact.captured_at_declared,
        verification_status: "DECLARED_BY_SUBMITTER_UNVERIFIED",
      },
      received_at: firstArtifact.received_at_server,
      evidence_hashes: evidenceHashes,
      manifest_sha256: manifestSha256,
      observations,
      verifier_claims: {
        declared_sku: firstArtifact.verifier_declared_sku,
        notes: firstArtifact.verifier_notes,
        separation_notice:
          "Submitted by human verifier; separated from pixel observations.",
      },
      unknowns,
      model_id: task.ai_analysis?.model_id ?? null,
      reviewer_decision: reviewerDecision,
      valid_until: validUntil,
      funding_order_id: task.paypal_order.orderId,
      capture_id: task.paypal_order.captureId,
      payout_batch_id: payoutBatchId,
      payout_status: payoutStatus,
      scope_of_claim: scopeOfClaim,
      limitations,
      synthetic_label: task.contract.synthetic_label,
      authorized_read_url: `${this.publicApiBaseUrl}/api/v1/proofs/${proofId}?token=${encodeURIComponent(readToken)}`,
    });

    task.proof_passport = passport;
    this.passportsById.set(proofId, passport);
    this.transitionStatus(
      task,
      "PROOF_PASSPORT_ISSUED",
      actor,
      "ISSUE_PROOF_PASSPORT",
      {
        proof_id: proofId,
        verdict: verdictStatus,
        approval_classification: approvalClassification,
        trust_classifications: trustClassifications,
        manifest_sha256: manifestSha256,
      }
    );

    return task;
  }

  getTaskOrThrow(taskId: string): VerificationTaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND: Verification task '${taskId}' does not exist.`);
    }
    return task;
  }

  getPassportOrThrow(proofId: string): ProofPassportV0 {
    const passport = this.passportsById.get(proofId);
    if (!passport) {
      throw new Error(`PROOF_NOT_FOUND: Proof Passport '${proofId}' does not exist.`);
    }
    return passport;
  }

  listTasks(): VerificationTaskRecord[] {
    return Array.from(this.tasks.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }
}

