import { describe, expect, it } from "vitest";
import {
  assertValidTransition,
  CANONICAL_REQUIRED_VIEWS,
  computeValueOfInformation,
  evaluateEvidenceCompleteness,
  EvidenceContractV0Schema,
  isLegacyViewContract,
  type EvidenceArtifact,
} from "../src/index.js";

describe("@realityproof/shared", () => {
  it("computes Value of Information accurately with explicit assumptions", () => {
    const voi = computeValueOfInformation({
      part_purchase_price_usd: 240,
      estimated_return_or_downtime_cost_usd: 60,
      assumed_mismatch_probability: 0.15,
      verification_fee_usd: 12,
      assumption_source_label: "DEMO_SYNTHETIC_SCENARIO",
    });

    expect(voi.total_loss_if_wrong_usd).toBe(300);
    expect(voi.expected_loss_without_verification_usd).toBe(45);
    expect(voi.net_expected_savings_usd).toBe(33);
    expect(voi.recommendation).toBe("VERIFY_BEFORE_PAYMENT");
  });

  it("recommends abstaining when verification fee exceeds expected loss", () => {
    const voi = computeValueOfInformation({
      part_purchase_price_usd: 30,
      estimated_return_or_downtime_cost_usd: 10,
      assumed_mismatch_probability: 0.05,
      verification_fee_usd: 12,
      assumption_source_label: "USER_DECLARED_ASSUMPTION",
    });

    expect(voi.expected_loss_without_verification_usd).toBe(2);
    expect(voi.net_expected_savings_usd).toBe(-10);
    expect(voi.recommendation).toBe("ABSTAIN_VERIFICATION_TOO_EXPENSIVE");
  });

  it("enforces deterministic state transitions and blocks illegal jumps", () => {
    expect(() =>
      assertValidTransition("EVIDENCE_CONTRACT_DEFINED", "FUNDING_PENDING")
    ).not.toThrow();
    expect(() =>
      assertValidTransition("FUNDING_PENDING", "VERIFIED")
    ).toThrow(/Invalid deterministic state transition/);
  });

  it("validates EvidenceContract v0 schema", () => {
    const now = new Date();
    const later = new Date(now.getTime() + 3600_000);
    const parsed = EvidenceContractV0Schema.safeParse({
      task_id: "task_demo_001",
      item_title: "Bosch Fuel Injector 0280158040 (DEMO_SYNTHETIC)",
      seller_reference: "Synthetic AutoParts Depot #42",
      expected_sku: "BOSCH-0280158040",
      expected_attributes: [
        "Laser-etched SKU 0280158040 on body",
        "Sealed OEM box hologram",
        "2-pin EV14 connector",
      ],
      required_views: ["FRONT_PACKAGING", "SKU_BARCODE_CLOSEUP"],
      deadline_at: later.toISOString(),
      expires_at: later.toISOString(),
      max_verification_budget: 12.5,
      currency: "USD",
      acceptance_rules: [
        "SKU must be clearly legible in closeup photo",
        "No blurred or edited labels",
      ],
      prohibited_data: ["FACES", "GOVERNMENT_ID", "PAYMENT_CARDS"],
      proof_schema_version: "0.1.0",
      review_required: true,
      synthetic_label: "DEMO_SYNTHETIC",
    });
    expect(parsed.success).toBe(true);
  });

  it("evaluates EvidenceContract view completeness and rejects duplicate views as satisfying missing views", () => {
    const makeArtifact = (id: string, view: "FRONT_PACKAGING" | "SKU_BARCODE_CLOSEUP"): EvidenceArtifact => ({
      artifact_id: id,
      task_id: "task_demo_001",
      view_type: view,
      artifact_provenance: "DEMO_SYNTHETIC_FIXTURE",
      mime_type: "image/png",
      size_bytes: 4096,
      sha256_hex: "a".repeat(64),
      captured_at_declared: null,
      received_at_server: new Date().toISOString(),
      verifier_id: "actor_verifier_01",
      verifier_declared_sku: "BOSCH-0280158040",
      verifier_notes: "test",
      consent_granted: true,
      no_prohibited_data_confirmed: true,
      storage_key: `${id}.png`,
    });

    const duplicateFrontReport = evaluateEvidenceCompleteness({
      requiredViews: ["FRONT_PACKAGING", "SKU_BARCODE_CLOSEUP"],
      artifacts: [
        makeArtifact("art_1", "FRONT_PACKAGING"),
        makeArtifact("art_2", "FRONT_PACKAGING"),
      ],
      aiAnalysis: null,
    });

    expect(duplicateFrontReport.submitted_declared_views).toEqual(["FRONT_PACKAGING"]);
    expect(duplicateFrontReport.duplicate_declared_views).toEqual(["FRONT_PACKAGING"]);
    expect(duplicateFrontReport.missing_views).toEqual(["SKU_BARCODE_CLOSEUP"]);
    expect(duplicateFrontReport.is_sufficient_for_full_approval).toBe(false);
    expect(duplicateFrontReport.status).toBe("INCOMPLETE_MISSING_VIEWS");

    const completeReport = evaluateEvidenceCompleteness({
      requiredViews: ["FRONT_PACKAGING", "SKU_BARCODE_CLOSEUP"],
      artifacts: [
        makeArtifact("art_1", "FRONT_PACKAGING"),
        makeArtifact("art_2", "SKU_BARCODE_CLOSEUP"),
      ],
      aiAnalysis: null,
    });

    expect(completeReport.missing_views).toEqual([]);
    expect(completeReport.is_sufficient_for_full_approval).toBe(true);
    expect(completeReport.status).toBe("COMPLETE");
  });

  it("enforces the canonical 3-view contract (FRONT_PART, SKU_LABEL_CLOSEUP, PACKAGING_BOX) while detecting legacy 2-view contracts", () => {
    expect(CANONICAL_REQUIRED_VIEWS).toEqual([
      "FRONT_PART",
      "SKU_LABEL_CLOSEUP",
      "PACKAGING_BOX",
    ]);
    expect(
      isLegacyViewContract(["FRONT_PACKAGING", "SKU_BARCODE_CLOSEUP"])
    ).toBe(true);
    expect(
      isLegacyViewContract([
        "FRONT_PART",
        "SKU_LABEL_CLOSEUP",
        "PACKAGING_BOX",
      ])
    ).toBe(false);

    const makeCanonicalArtifact = (
      id: string,
      view: "FRONT_PART" | "SKU_LABEL_CLOSEUP" | "PACKAGING_BOX"
    ): EvidenceArtifact => ({
      artifact_id: id,
      task_id: "task_demo_3view",
      view_type: view,
      artifact_provenance: "USER_UPLOADED_FILE",
      mime_type: "image/png",
      size_bytes: 4096,
      sha256_hex: "b".repeat(64),
      captured_at_declared: null,
      received_at_server: new Date().toISOString(),
      verifier_id: "actor_verifier_01",
      verifier_declared_sku: "BOSCH-0280158040",
      verifier_notes: "3-view test",
      consent_granted: true,
      no_prohibited_data_confirmed: true,
      storage_key: `${id}.png`,
    });

    const partialOneOfThree = evaluateEvidenceCompleteness({
      requiredViews: ["FRONT_PART", "SKU_LABEL_CLOSEUP", "PACKAGING_BOX"],
      artifacts: [makeCanonicalArtifact("art_1", "FRONT_PART")],
      aiAnalysis: null,
    });
    expect(partialOneOfThree.missing_views).toEqual([
      "SKU_LABEL_CLOSEUP",
      "PACKAGING_BOX",
    ]);
    expect(partialOneOfThree.is_sufficient_for_full_approval).toBe(false);

    const fullThreeOfThree = evaluateEvidenceCompleteness({
      requiredViews: ["FRONT_PART", "SKU_LABEL_CLOSEUP", "PACKAGING_BOX"],
      artifacts: [
        makeCanonicalArtifact("art_1", "FRONT_PART"),
        makeCanonicalArtifact("art_2", "SKU_LABEL_CLOSEUP"),
        makeCanonicalArtifact("art_3", "PACKAGING_BOX"),
      ],
      aiAnalysis: null,
    });
    expect(fullThreeOfThree.missing_views).toEqual([]);
    expect(fullThreeOfThree.is_sufficient_for_full_approval).toBe(true);
    expect(fullThreeOfThree.status).toBe("COMPLETE");
  });
});

