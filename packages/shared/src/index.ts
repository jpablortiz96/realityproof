import { z } from "zod";

// ============================================================================
// Roles & Actors
// ============================================================================
export const RoleSchema = z.enum([
  "REQUESTER",
  "VERIFIER",
  "OPERATOR",
  "EXTERNAL_AGENT",
]);
export type Role = z.infer<typeof RoleSchema>;

// ============================================================================
// Task & Financial State Machine
// ============================================================================
export const TaskStatusSchema = z.enum([
  "DRAFT",
  "EVIDENCE_CONTRACT_DEFINED",
  "FUNDING_PENDING",
  "BLOCKED_BUYER_APPROVAL",
  "PAYMENT_FAILED",
  "FUNDED",
  "ASSIGNED",
  "SUBMITTED",
  "AI_PROCESSING",
  "AI_ANALYZED",
  "AI_BLOCKED",
  "HUMAN_REVIEWED",
  "VERIFIED",
  "INCONCLUSIVE",
  "REJECTED",
  "EXPIRED",
  "PAYOUT_ELIGIBLE",
  "PAYOUT_REQUESTED",
  "PAYOUT_PENDING",
  "PAYOUT_SUCCESS",
  "PAYOUT_CONFIRMED",
  "PAYOUTS_BLOCKED",
  "PROOF_PASSPORT_ISSUED",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const SyntheticLabelSchema = z.enum([
  "DEMO_SYNTHETIC",
  "SANDBOX_LIVE_TEST",
]);
export type SyntheticLabel = z.infer<typeof SyntheticLabelSchema>;

export const FundingProvenanceSchema = z.enum([
  "REAL_SANDBOX_CAPTURE",
  "HISTORICAL_SANDBOX_REPLAY",
  "DEMO_SYNTHETIC",
  "UNFUNDED",
]);
export type FundingProvenance = z.infer<typeof FundingProvenanceSchema>;

export const FundingAllocationSchema = z.object({
  funding_provenance: FundingProvenanceSchema,
  original_task_id: z.string().nullable(),
  original_order_id: z.string().nullable(),
  original_capture_id: z.string().nullable(),
  is_payout_eligible_funding: z.boolean(),
  creates_available_balance: z.boolean(),
  provenance_explanation: z.string(),
});
export type FundingAllocation = z.infer<typeof FundingAllocationSchema>;

export const ArtifactProvenanceSchema = z.enum([
  "CAMERA_OR_FILE_UPLOAD",
  "DEMO_SYNTHETIC_FIXTURE",
]);
export type ArtifactProvenance = z.infer<typeof ArtifactProvenanceSchema>;

export const TrustClassificationTagSchema = z.enum([
  "RECORD_INTEGRITY_VERIFIED",
  "EVIDENCE_REVIEW_COMPLETED",
  "PHYSICAL_AUTHENTICITY_UNVERIFIED",
  "INSUFFICIENT_EVIDENCE",
  "DEMO_ONLY",
]);
export type TrustClassificationTag = z.infer<
  typeof TrustClassificationTagSchema
>;

export const PassportApprovalClassificationSchema = z.enum([
  "APPROVED_FOR_DEMO",
  "APPROVED_WITH_HUMAN_EXCEPTION",
  "COMMERCIAL_EVIDENCE_REVIEWED",
  "REJECTED",
  "INCONCLUSIVE",
]);
export type PassportApprovalClassification = z.infer<
  typeof PassportApprovalClassificationSchema
>;

export const ComponentProvenanceSchema = z.object({
  payment: FundingProvenanceSchema,
  photograph: z.enum([
    "CAMERA_OR_FILE_UPLOAD",
    "DEMO_SYNTHETIC_FIXTURE",
    "MIXED",
  ]),
  ai_analysis: z.enum([
    "LIVE_GEMINI_API",
    "RECORDED_SANDBOX_ANALYSIS",
    "MANUAL_NO_AI",
  ]),
  human_decision: z.enum([
    "AUTHENTICATED_OPERATOR_REVIEW",
    "HYDRATED_HISTORICAL_REVIEW",
  ]),
  document: z.enum([
    "DEMO_ONLY",
    "HISTORICAL_REPLAY_DEMO",
    "SANDBOX_VERIFICATION_RECORD",
  ]),
});
export type ComponentProvenance = z.infer<typeof ComponentProvenanceSchema>;

export const FinancialSequenceStepSchema = z.enum([
  "ORDER_CREATED",
  "BUYER_APPROVED",
  "CAPTURE_COMPLETED",
  "EVIDENCE_SUBMITTED",
  "AI_ANALYZED",
  "HUMAN_APPROVED",
  "PAYOUT_ELIGIBLE",
  "PAYOUT_REQUESTED",
  "PAYOUT_SUCCESS",
]);
export type FinancialSequenceStep = z.infer<typeof FinancialSequenceStepSchema>;

export const PayoutEligibilityProofSchema = z.object({
  task_id: z.string(),
  order_id: z.string(),
  buyer_approved: z.literal(true),
  capture_id: z.string(),
  capture_status: z.literal("COMPLETED"),
  captured_amount_usd: z.number().positive(),
  evidence_submitted_count: z.number().int().positive(),
  ai_analyzed: z.literal(true),
  human_approved_by: z.string().min(2),
  human_approved_at: z.string().datetime(),
  payout_eligible: z.literal(true),
});
export type PayoutEligibilityProof = z.infer<
  typeof PayoutEligibilityProofSchema
>;

export const PayoutStatusSchema = z.enum([
  "NOT_STARTED",
  "PAYOUT_ELIGIBLE",
  "PAYOUT_REQUESTED",
  "PAYOUT_PENDING",
  "PAYOUT_UNCLAIMED",
  "PAYOUT_SUCCESS",
  "PAYOUT_CONFIRMED",
  "PAYOUTS_BLOCKED",
  "SIMULATED_DRY_RUN",
]);
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

// ============================================================================
// Evidence Contract v0 (Canonical 3-View Contract + Legacy 2-View Compatibility)
// ============================================================================
export const RequiredViewSchema = z.enum([
  "FRONT_PART",
  "SKU_LABEL_CLOSEUP",
  "PACKAGING_BOX",
  "FRONT_PACKAGING",
  "SKU_BARCODE_CLOSEUP",
  "PART_LABEL_STAMP",
  "CONNECTOR_DETAIL",
]);
export type RequiredView = z.infer<typeof RequiredViewSchema>;

export const CANONICAL_REQUIRED_VIEWS: readonly RequiredView[] = [
  "FRONT_PART",
  "SKU_LABEL_CLOSEUP",
  "PACKAGING_BOX",
] as const;

export const LEGACY_V0_REQUIRED_VIEWS: readonly RequiredView[] = [
  "FRONT_PACKAGING",
  "SKU_BARCODE_CLOSEUP",
] as const;

export function isLegacyViewContract(requiredViews: readonly string[]): boolean {
  return (
    requiredViews.length > 0 &&
    requiredViews.every(
      (v) =>
        v === "FRONT_PACKAGING" ||
        v === "SKU_BARCODE_CLOSEUP" ||
        v === "PART_LABEL_STAMP" ||
        v === "CONNECTOR_DETAIL"
    )
  );
}

export const ProhibitedDataSchema = z.enum([
  "FACES",
  "GOVERNMENT_ID",
  "PAYMENT_CARDS",
  "PRECISE_HOME_ADDRESS",
  "UNCONSENTED_BYSTANDERS",
]);
export type ProhibitedData = z.infer<typeof ProhibitedDataSchema>;

export const EvidenceContractV0Schema = z.object({
  task_id: z.string().min(3),
  item_title: z.string().min(3).max(200),
  seller_reference: z.string().min(2).max(120),
  expected_sku: z.string().min(2).max(80),
  expected_attributes: z.array(z.string().min(1)).min(1),
  required_views: z.array(RequiredViewSchema).min(1),
  deadline_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  max_verification_budget: z.number().positive().max(500),
  currency: z.literal("USD"),
  acceptance_rules: z.array(z.string().min(3)).min(1),
  prohibited_data: z.array(ProhibitedDataSchema).min(1),
  proof_schema_version: z.literal("0.1.0"),
  review_required: z.literal(true),
  synthetic_label: SyntheticLabelSchema.default("DEMO_SYNTHETIC"),
});
export type EvidenceContractV0 = z.infer<typeof EvidenceContractV0Schema>;

// ============================================================================
// Value of Information (VoI) Economics Engine
// ============================================================================
export const ValueOfInformationInputSchema = z.object({
  part_purchase_price_usd: z.number().positive(),
  estimated_return_or_downtime_cost_usd: z.number().nonnegative(),
  assumed_mismatch_probability: z.number().min(0).max(1),
  verification_fee_usd: z.number().positive(),
  assumption_source_label: z.enum([
    "USER_DECLARED_ASSUMPTION",
    "DEMO_SYNTHETIC_SCENARIO",
  ]),
});
export type ValueOfInformationInput = z.infer<
  typeof ValueOfInformationInputSchema
>;

export const ValueOfInformationOutputSchema = z.object({
  part_purchase_price_usd: z.number(),
  total_loss_if_wrong_usd: z.number(),
  assumed_mismatch_probability: z.number(),
  expected_loss_without_verification_usd: z.number(),
  verification_fee_usd: z.number(),
  net_expected_savings_usd: z.number(),
  recommendation: z.enum([
    "VERIFY_BEFORE_PAYMENT",
    "ABSTAIN_VERIFICATION_TOO_EXPENSIVE",
    "BORDERLINE_MANUAL_DECISION",
  ]),
  assumption_source_label: z.string(),
  epistemic_disclaimer: z.string(),
});
export type ValueOfInformationOutput = z.infer<
  typeof ValueOfInformationOutputSchema
>;

export function computeValueOfInformation(
  input: ValueOfInformationInput
): ValueOfInformationOutput {
  const parsed = ValueOfInformationInputSchema.parse(input);
  const totalLossIfWrong = Number(
    (
      parsed.part_purchase_price_usd +
      parsed.estimated_return_or_downtime_cost_usd
    ).toFixed(2)
  );
  const expectedLossWithoutVerification = Number(
    (totalLossIfWrong * parsed.assumed_mismatch_probability).toFixed(2)
  );
  const netExpectedSavings = Number(
    (expectedLossWithoutVerification - parsed.verification_fee_usd).toFixed(2)
  );

  let recommendation: ValueOfInformationOutput["recommendation"] =
    "BORDERLINE_MANUAL_DECISION";
  if (netExpectedSavings >= 2.0) {
    recommendation = "VERIFY_BEFORE_PAYMENT";
  } else if (netExpectedSavings < 0) {
    recommendation = "ABSTAIN_VERIFICATION_TOO_EXPENSIVE";
  }

  return {
    part_purchase_price_usd: parsed.part_purchase_price_usd,
    total_loss_if_wrong_usd: totalLossIfWrong,
    assumed_mismatch_probability: parsed.assumed_mismatch_probability,
    expected_loss_without_verification_usd: expectedLossWithoutVerification,
    verification_fee_usd: parsed.verification_fee_usd,
    net_expected_savings_usd: netExpectedSavings,
    recommendation,
    assumption_source_label: parsed.assumption_source_label,
    epistemic_disclaimer:
      "Expected loss is computed strictly from the explicit probability assumption above, not an empirical prediction of seller honesty.",
  };
}

// ============================================================================
// Gemini AI Multimodal Structured Analysis Output
// ============================================================================
export const SafetyFlagSchema = z.enum([
  "PROMPT_INJECTION_ATTEMPT",
  "PII_DETECTED",
  "BLURRY_OR_UNREADABLE",
  "SCREEN_RECAPTURE_SUSPECTED",
  "TAMPERING_OR_OCCLUSION",
]);
export type SafetyFlag = z.infer<typeof SafetyFlagSchema>;

export const GeminiAnalysisResultSchema = z.object({
  observed_sku: z.string().nullable(),
  matches_expected: z.enum([
    "MATCH",
    "MISMATCH",
    "INSUFFICIENT_EVIDENCE",
  ]),
  visible_evidence: z.array(z.string()).min(1),
  unverifiable_claims: z.array(z.string()).default([]),
  limitations: z.array(z.string()).min(1),
  additional_evidence_needed: z.array(z.string()).default([]),
  needs_human_review: z.boolean(),
  safety_flags: z.array(SafetyFlagSchema),
  confidence_level: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  confidence_note: z.string(),
  recommended_decision: z
    .enum([
      "PROCEED_TO_HUMAN_APPROVAL",
      "REQUEST_NEW_EVIDENCE",
      "REJECT_MISMATCH_OR_UNSAFE",
    ])
    .default("PROCEED_TO_HUMAN_APPROVAL"),
  model_id: z.string(),
  analyzed_at: z.string().datetime(),
});
export type GeminiAnalysisResult = z.infer<typeof GeminiAnalysisResultSchema>;

// ============================================================================
// Human Review Decision
// ============================================================================
export const ReviewerDecisionTypeSchema = z.enum([
  "APPROVE",
  "REJECT",
  "MARK_INCONCLUSIVE",
  "REQUEST_MORE_EVIDENCE",
]);
export type ReviewerDecisionType = z.infer<typeof ReviewerDecisionTypeSchema>;

export const HumanExceptionRecordSchema = z.object({
  granted: z.boolean(),
  granted_by: z.string(),
  granted_at: z.string().datetime(),
  missing_views_waived: z.array(RequiredViewSchema),
  foundation_rationale: z.string().min(5),
  scope: z.string().min(3),
  limitations: z.array(z.string()).min(1),
});
export type HumanExceptionRecord = z.infer<typeof HumanExceptionRecordSchema>;

export const EvidenceCompletenessStatusSchema = z.enum([
  "COMPLETE",
  "INCOMPLETE_MISSING_VIEWS",
  "NO_EVIDENCE",
  "HUMAN_EXCEPTION_GRANTED",
]);
export type EvidenceCompletenessStatus = z.infer<
  typeof EvidenceCompletenessStatusSchema
>;

export const EvidenceCompletenessReportSchema = z.object({
  required_views: z.array(RequiredViewSchema),
  submitted_declared_views: z.array(RequiredViewSchema),
  missing_views: z.array(RequiredViewSchema),
  duplicate_declared_views: z.array(RequiredViewSchema),
  total_artifacts_received: z.number().int().nonnegative(),
  ai_observed_content_summary: z.array(z.string()),
  is_sufficient_for_full_approval: z.boolean(),
  status: EvidenceCompletenessStatusSchema,
  human_exception: HumanExceptionRecordSchema.nullable(),
});
export type EvidenceCompletenessReport = z.infer<
  typeof EvidenceCompletenessReportSchema
>;

export const ReviewerDecisionSchema = z.object({
  reviewer_id: z.string().min(2),
  decision: ReviewerDecisionTypeSchema,
  rationale: z.string().min(5),
  reviewed_at: z.string().datetime(),
  from_status: TaskStatusSchema.optional(),
  to_status: TaskStatusSchema.optional(),
  evidence_artifact_ids: z.array(z.string()).optional(),
  ai_recommendation_overridden: z.boolean().optional(),
  human_exception: HumanExceptionRecordSchema.nullable().optional(),
});
export type ReviewerDecision = z.infer<typeof ReviewerDecisionSchema>;

// ============================================================================
// Evidence Artifact Metadata
// ============================================================================
export const EvidenceArtifactSchema = z.object({
  artifact_id: z.string(),
  task_id: z.string(),
  view_type: RequiredViewSchema,
  artifact_provenance: ArtifactProvenanceSchema.default("CAMERA_OR_FILE_UPLOAD"),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size_bytes: z.number().int().positive().max(5242880),
  sha256_hex: z.string().regex(/^[a-f0-9]{64}$/),
  captured_at_declared: z.string().datetime().nullable(),
  received_at_server: z.string().datetime(),
  verifier_id: z.string(),
  verifier_declared_sku: z.string(),
  verifier_notes: z.string(),
  consent_granted: z.literal(true),
  no_prohibited_data_confirmed: z.literal(true),
  storage_key: z.string(),
});
export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;

export function evaluateEvidenceCompleteness(params: {
  requiredViews: RequiredView[];
  artifacts: EvidenceArtifact[];
  aiAnalysis: GeminiAnalysisResult | null;
  humanException?: HumanExceptionRecord | null;
}): EvidenceCompletenessReport {
  const viewCounts = new Map<RequiredView, number>();
  for (const art of params.artifacts) {
    viewCounts.set(art.view_type, (viewCounts.get(art.view_type) ?? 0) + 1);
  }

  const submittedDeclaredViews = Array.from(viewCounts.keys());
  const duplicateDeclaredViews = Array.from(viewCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([view]) => view);

  const missingViews = params.requiredViews.filter(
    (reqView) => !viewCounts.has(reqView)
  );

  const aiObservedSummary = params.aiAnalysis?.visible_evidence ?? [];
  const aiSaysInsufficient =
    params.aiAnalysis?.matches_expected === "INSUFFICIENT_EVIDENCE";

  const isSufficientForFullApproval =
    params.artifacts.length > 0 &&
    missingViews.length === 0 &&
    !aiSaysInsufficient;

  let status: EvidenceCompletenessStatus = "COMPLETE";
  if (params.artifacts.length === 0) {
    status = "NO_EVIDENCE";
  } else if (missingViews.length > 0 || aiSaysInsufficient) {
    status = params.humanException?.granted
      ? "HUMAN_EXCEPTION_GRANTED"
      : "INCOMPLETE_MISSING_VIEWS";
  }

  return {
    required_views: params.requiredViews,
    submitted_declared_views: submittedDeclaredViews,
    missing_views: missingViews,
    duplicate_declared_views: duplicateDeclaredViews,
    total_artifacts_received: params.artifacts.length,
    ai_observed_content_summary: aiObservedSummary,
    is_sufficient_for_full_approval: isSufficientForFullApproval,
    status,
    human_exception: params.humanException ?? null,
  };
}

// ============================================================================
// Proof Passport v0
// ============================================================================
export const ProofPassportV0Schema = z.object({
  proof_id: z.string(),
  task_id: z.string(),
  proof_schema_version: z.literal("0.1.0"),
  status: z.enum(["VERIFIED", "INCONCLUSIVE", "REJECTED"]),
  approval_classification:
    PassportApprovalClassificationSchema.default("APPROVED_FOR_DEMO"),
  trust_classifications: z
    .array(TrustClassificationTagSchema)
    .default([
      "RECORD_INTEGRITY_VERIFIED",
      "EVIDENCE_REVIEW_COMPLETED",
      "PHYSICAL_AUTHENTICITY_UNVERIFIED",
    ]),
  component_provenance: ComponentProvenanceSchema.optional(),
  evidence_completeness: EvidenceCompletenessReportSchema.optional(),
  funding_provenance: FundingProvenanceSchema.default("DEMO_SYNTHETIC"),
  source_type: z.enum([
    "HUMAN_PHOTO_WITH_AI_AND_OPERATOR_REVIEW",
    "HUMAN_PHOTO_MANUAL_OPERATOR_REVIEW",
  ]),
  captured_at: z.object({
    value: z.string().datetime().nullable(),
    verification_status: z.literal("DECLARED_BY_SUBMITTER_UNVERIFIED"),
  }),
  received_at: z.string().datetime(),
  evidence_hashes: z.array(
    z.object({
      artifact_id: z.string(),
      view_type: RequiredViewSchema,
      sha256_hex: z.string().regex(/^[a-f0-9]{64}$/),
      mime_type: z.string(),
    })
  ),
  manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  observations: z.array(z.string()).min(1),
  verifier_claims: z.object({
    declared_sku: z.string(),
    notes: z.string(),
    separation_notice: z.literal(
      "Submitted by human verifier; separated from pixel observations."
    ),
  }),
  unknowns: z.array(z.string()).min(1),
  model_id: z.string().nullable(),
  reviewer_decision: ReviewerDecisionSchema,
  valid_until: z.string().datetime(),
  funding_order_id: z.string(),
  capture_id: z.string(),
  payout_batch_id: z.string().nullable(),
  payout_status: PayoutStatusSchema,
  scope_of_claim: z.string(),
  limitations: z.array(z.string()).min(1),
  synthetic_label: SyntheticLabelSchema,
  authorized_read_url: z.string(),
});
export type ProofPassportV0 = z.infer<typeof ProofPassportV0Schema>;

// ============================================================================
// Deterministic State Machine Transitions
// ============================================================================
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["EVIDENCE_CONTRACT_DEFINED"],
  EVIDENCE_CONTRACT_DEFINED: ["FUNDING_PENDING", "EXPIRED"],
  FUNDING_PENDING: ["BLOCKED_BUYER_APPROVAL", "FUNDED", "PAYMENT_FAILED", "EXPIRED"],
  BLOCKED_BUYER_APPROVAL: ["FUNDED", "PAYMENT_FAILED", "EXPIRED"],
  PAYMENT_FAILED: ["FUNDING_PENDING", "BLOCKED_BUYER_APPROVAL", "EXPIRED"],
  FUNDED: ["ASSIGNED", "EXPIRED"],
  ASSIGNED: ["SUBMITTED", "EXPIRED"],
  SUBMITTED: ["AI_PROCESSING", "AI_ANALYZED", "AI_BLOCKED", "HUMAN_REVIEWED"],
  AI_PROCESSING: ["AI_ANALYZED", "AI_BLOCKED"],
  AI_ANALYZED: ["HUMAN_REVIEWED"],
  AI_BLOCKED: ["AI_PROCESSING", "HUMAN_REVIEWED", "AI_ANALYZED"],
  HUMAN_REVIEWED: ["VERIFIED", "INCONCLUSIVE", "REJECTED", "ASSIGNED"],
  VERIFIED: [
    "PAYOUT_ELIGIBLE",
    "PAYOUT_PENDING",
    "PAYOUTS_BLOCKED",
    "PROOF_PASSPORT_ISSUED",
  ],
  INCONCLUSIVE: ["PROOF_PASSPORT_ISSUED"],
  REJECTED: ["PROOF_PASSPORT_ISSUED"],
  EXPIRED: [],
  PAYOUT_ELIGIBLE: [
    "PAYOUT_REQUESTED",
    "PAYOUT_PENDING",
    "PAYOUTS_BLOCKED",
    "PROOF_PASSPORT_ISSUED",
  ],
  PAYOUT_REQUESTED: [
    "PAYOUT_PENDING",
    "PAYOUT_SUCCESS",
    "PAYOUT_CONFIRMED",
    "PAYOUTS_BLOCKED",
    "PROOF_PASSPORT_ISSUED",
  ],
  PAYOUT_PENDING: [
    "PAYOUT_SUCCESS",
    "PAYOUT_CONFIRMED",
    "PAYOUTS_BLOCKED",
    "PROOF_PASSPORT_ISSUED",
  ],
  PAYOUT_SUCCESS: ["PROOF_PASSPORT_ISSUED"],
  PAYOUT_CONFIRMED: ["PROOF_PASSPORT_ISSUED"],
  PAYOUTS_BLOCKED: ["PROOF_PASSPORT_ISSUED", "PAYOUT_CONFIRMED", "PAYOUT_SUCCESS"],
  PROOF_PASSPORT_ISSUED: ["PAYOUT_CONFIRMED", "PAYOUT_SUCCESS", "PAYOUTS_BLOCKED"],
};

export function canTransitionTaskStatus(
  from: TaskStatus,
  to: TaskStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTaskStatus(from, to)) {
    throw new Error(
      `Invalid deterministic state transition: cannot move from ${from} to ${to}`
    );
  }
}

