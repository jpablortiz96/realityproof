import type { FundingProvenance, TaskStatus } from "@realityproof/shared";

export type PayPalFinancialAnalyticsState =
  | "CAPTURED"
  | "PAYOUT_ELIGIBLE"
  | "PAYOUT_PENDING"
  | "PAYOUT_SUCCESS"
  | "PAYOUT_UNCLAIMED"
  | "DEMO_NON_PAYABLE"
  | "HISTORICAL_REPLAY_NON_PAYABLE"
  | "UNFUNDED";

export interface VerificationIntelligenceRow {
  task_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  item_title: string;
  expected_sku: string;
  observed_sku: string | null;
  status: TaskStatus;
  verification_cost_usd: number;
  estimated_loss_if_wrong_usd: number;
  subjective_defect_risk_assumption: number;
  expected_loss_without_verification_usd: number;
  expected_net_benefit_usd: number;
  voi_recommendation:
    | "PROCEED_WITH_VERIFICATION"
    | "ABSTAIN_VERIFICATION_TOO_EXPENSIVE"
    | "INSUFFICIENT_INFORMATION";
  required_views_count: number;
  received_views_count: number;
  missing_views_count: number;
  duplicate_views_count: number;
  required_views_csv: string;
  received_views_csv: string;
  missing_views_csv: string;
  duplicate_views_csv: string;
  evidence_completeness_status:
    | "COMPLETE"
    | "INCOMPLETE"
    | "COMPLETE_WITH_WARNINGS";
  technical_file_receipt_status:
    | "FILES_HASHED_IN_STORAGE"
    | "NO_FILES_RECEIVED";
  physical_content_validation_status:
    | "HUMAN_VALIDATED_MATCH"
    | "HUMAN_EXCEPTION_RECORDED"
    | "AI_FLAGGED_PENDING_HUMAN"
    | "UNVERIFIED_PHYSICAL_TRUTH";
  gemini_status:
    | "MATCH"
    | "MISMATCH"
    | "INSUFFICIENT_EVIDENCE"
    | "NOT_ANALYZED";
  gemini_confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  gemini_needs_human_review: boolean;
  safety_flags_csv: string;
  human_review_status:
    | "APPROVED"
    | "APPROVED_WITH_EXCEPTION"
    | "REJECTED"
    | "MORE_EVIDENCE_REQUESTED"
    | "PENDING_HUMAN_REVIEW"
    | "AWAITING_EVIDENCE";
  human_reviewer_id: string | null;
  human_exception_reason: string | null;
  funding_provenance: FundingProvenance;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  paypal_financial_state: PayPalFinancialAnalyticsState;
  real_captured_usd: number;
  demo_synthetic_non_payable_usd: number;
  verifier_expected_remuneration_usd: number;
  real_payout_disbursed_usd: number;
  payout_batch_id: string | null;
  payout_item_id: string | null;
  payout_transaction_status: string;
  proof_passport_id: string | null;
  proof_passport_classification:
    | "COMMERCIAL_EVIDENCE_REVIEWED"
    | "APPROVED_WITH_HUMAN_EXCEPTION"
    | "APPROVED_FOR_DEMO"
    | "NOT_ISSUED";
  decision_trace_summary: string;
  needs_evidence_flag: boolean;
  pending_human_review_flag: boolean;
}

export interface IntelligenceStudioSummary {
  total_tasks: number;
  real_sandbox_captured_count: number;
  real_sandbox_captured_usd: number;
  real_sandbox_payout_eligible_usd: number;
  real_sandbox_payout_pending_or_unclaimed_usd: number;
  real_sandbox_payout_success_usd: number;
  demo_synthetic_count: number;
  demo_synthetic_non_payable_usd: number;
  historical_replay_count: number;
  unfunded_count: number;
  needs_evidence_count: number;
  pending_human_review_count: number;
  passports_issued_commercial_count: number;
  passports_issued_exception_count: number;
  passports_issued_demo_count: number;
  invariant_real_vs_synthetic_separated: true;
}

export type StudioQuickFilterPreset =
  | "ALL"
  | "NEEDS_EVIDENCE"
  | "PENDING_HUMAN_REVIEW"
  | "REAL_SANDBOX_ONLY"
  | "DEMO_SYNTHETIC_ONLY"
  | "HIGHEST_POTENTIAL_LOSS"
  | "VOI_COMPARISON";

export interface StudioAgentTurnOutputMessage {
  kind: "output";
  type: "message";
  role: "assistant";
  status: "completed";
  content: Array<{
    type: "text";
    text: string;
    annotations: never[];
  }>;
}

export interface StudioAgentTurnOutputToolCall {
  kind: "output";
  type: "function_call";
  callId: string;
  name: string;
  arguments: string;
  status: "completed";
}

export type StudioAgentTurnOutputItem =
  | StudioAgentTurnOutputMessage
  | StudioAgentTurnOutputToolCall;

export interface StudioAgentTurnResponse {
  id: string;
  createdAt: number;
  status: "completed";
  output: StudioAgentTurnOutputItem[];
  meta: {
    engine: "GEMINI_LIVE_PLUS_GUARDRAILS" | "DETERMINISTIC_GUARDED_PLANNER";
    model_id: string | null;
    degraded_mode: boolean;
    degraded_reason: string | null;
    guardrail_triggered: boolean;
    guardrail_code: string | null;
    matched_demo_query: "A" | "B" | "C" | "D" | "E" | "CUSTOM" | "ADVERSARIAL";
    stripped_forbidden_tools: string[];
    deduplicated_turn: boolean;
  };
}

