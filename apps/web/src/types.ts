import type {
  EvidenceCompletenessReport,
  FinancialSequenceStep,
  FundingAllocation,
  HumanExceptionRecord,
  ProofPassportV0,
  RequiredView,
  TaskStatus,
} from "@realityproof/shared";

/** Shape returned by GET /api/v1/system/capabilities (unchanged API contract). */
export interface SystemCapabilities {
  service: string;
  version: string;
  gate: string;
  paypal: {
    mode: string;
    api_base_url: string;
    orders_v2_status: string;
    webhooks_status: string;
    payouts_v1_status: string;
  };
  gemini_ai: {
    primary_model: string;
    fallback_model: string;
    status: string;
  };
  public_demo_mode?: boolean;
  third_party_brands_masked?: boolean;
  demo_tokens_available_for_local_ui?: {
    requester: string;
    verifier: string;
    operator: string;
    external_agent: string;
  };
}

export interface AuditTrailEvent {
  event_id: string;
  task_id: string | null;
  actor_role: string;
  actor_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ReviewerDecisionRecord {
  reviewer_id: string;
  decision: string;
  rationale: string;
  reviewed_at: string;
  from_status?: string;
  to_status?: string;
  evidence_artifact_ids?: string[];
  ai_recommendation_overridden?: boolean;
  human_exception?: HumanExceptionRecord;
}

/** Shape returned by GET /api/v1/verification-requests (unchanged API contract). */
export interface TaskSummary {
  task_id: string;
  status: TaskStatus;
  financial_sequence?: FinancialSequenceStep[];
  created_by?: string;
  assigned_verifier_id?: string | null;
  created_at?: string;
  updated_at?: string;
  contract: {
    task_id: string;
    item_title: string;
    seller_reference: string;
    expected_sku: string;
    expected_attributes: string[];
    required_views: RequiredView[];
    deadline_at: string;
    expires_at: string;
    max_verification_budget: number;
    currency: "USD";
    acceptance_rules: string[];
    prohibited_data: string[];
    synthetic_label: "DEMO_SYNTHETIC" | "SANDBOX_LIVE_TEST";
  };
  voi: {
    part_purchase_price_usd: number;
    total_loss_if_wrong_usd: number;
    assumed_mismatch_probability: number;
    expected_loss_without_verification_usd: number;
    verification_fee_usd: number;
    net_expected_savings_usd: number;
    recommendation: string;
    assumption_source_label: string;
    epistemic_disclaimer: string;
  };
  paypal_order: {
    orderId: string;
    status: string;
    amountUsd: string;
    approveUrl: string | null;
    captureId: string | null;
  } | null;
  funding_allocation?: FundingAllocation | null;
  evidence_completeness?: EvidenceCompletenessReport;
  human_exception?: HumanExceptionRecord | null;
  evidence_artifacts: Array<{
    artifact_id: string;
    view_type: string;
    mime_type: string;
    size_bytes: number;
    sha256_hex: string;
    received_at_server: string;
    verifier_id?: string;
    verifier_declared_sku: string;
    verifier_notes: string;
    artifact_provenance?: "CAMERA_OR_FILE_UPLOAD" | "DEMO_SYNTHETIC_FIXTURE";
  }>;
  ai_analysis: {
    observed_sku: string | null;
    matches_expected: "MATCH" | "MISMATCH" | "INSUFFICIENT_EVIDENCE";
    visible_evidence: string[];
    unverifiable_claims?: string[];
    limitations: string[];
    additional_evidence_needed: string[];
    needs_human_review: boolean;
    safety_flags: string[];
    confidence_level?: string;
    confidence_note: string;
    recommended_decision?: string;
    model_id: string;
    analyzed_at: string;
  } | null;
  ai_blocked_reason: string | null;
  reviewer_decision: ReviewerDecisionRecord | null;
  decision_history?: ReviewerDecisionRecord[];
  payout_result: {
    itemTransactionStatus?: string;
    payoutStatus: string;
    payoutBatchId: string | null;
    remoteStatus: string;
    explanation: string;
    isSimulated: boolean;
  } | null;
  proof_passport: ProofPassportV0 | null;
  audit_trail?: AuditTrailEvent[];
}

