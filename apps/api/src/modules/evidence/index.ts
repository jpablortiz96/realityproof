import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactProvenance,
  EvidenceArtifact,
  RequiredView,
} from "@realityproof/shared";

export type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectSyntheticFixtureFromBuffer(
  buffer: Buffer,
  declaredProvenance?: ArtifactProvenance
): ArtifactProvenance {
  if (declaredProvenance === "DEMO_SYNTHETIC_FIXTURE") {
    return "DEMO_SYNTHETIC_FIXTURE";
  }
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width === 680 && height === 260) {
      return "DEMO_SYNTHETIC_FIXTURE";
    }
  }
  if (buffer.includes(Buffer.from("DEMO_SYNTHETIC", "utf8"))) {
    return "DEMO_SYNTHETIC_FIXTURE";
  }
  return "CAMERA_OR_FILE_UPLOAD";
}

export function detectImageMimeFromMagicBytes(
  buffer: Buffer
): AllowedImageMime | null {
  if (buffer.length < 12) {
    return null;
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP"
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  return null;
}

export function computeSha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeMetadataText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

export class EvidenceService {
  private artifactsByTask = new Map<string, EvidenceArtifact[]>();
  private globalHashToTask = new Map<string, string>();

  constructor(
    private readonly storageDir: string,
    private readonly maxUploadBytes: number
  ) {}

  async storeEvidence(params: {
    taskId: string;
    viewType: RequiredView;
    fileBuffer: Buffer;
    declaredMimeType?: string;
    declaredProvenance?: ArtifactProvenance;
    capturedAtDeclared: string | null;
    verifierId: string;
    verifierDeclaredSku: string;
    verifierNotes: string;
    consentGranted: boolean;
    noProhibitedDataConfirmed: boolean;
  }): Promise<EvidenceArtifact> {
    if (!params.consentGranted || !params.noProhibitedDataConfirmed) {
      throw new Error(
        "CONSENT_REQUIRED: Verifier must explicitly confirm consent and absence of prohibited personal data (faces, IDs, payment cards)."
      );
    }

    if (params.fileBuffer.length === 0) {
      throw new Error("EMPTY_UPLOAD: Uploaded evidence file is empty.");
    }

    if (params.fileBuffer.length > this.maxUploadBytes) {
      throw new Error(
        `FILE_TOO_LARGE: Uploaded file (${params.fileBuffer.length} bytes) exceeds maximum limit of ${this.maxUploadBytes} bytes.`
      );
    }

    const detectedMime = detectImageMimeFromMagicBytes(params.fileBuffer);
    if (!detectedMime) {
      throw new Error(
        "INVALID_IMAGE_FORMAT: File magic bytes do not match JPEG, PNG, or WebP. Disguised or unsupported files are rejected."
      );
    }

    if (
      params.declaredMimeType &&
      params.declaredMimeType !== detectedMime &&
      params.declaredMimeType !== "application/octet-stream"
    ) {
      throw new Error(
        `MIME_MISMATCH: Declared MIME '${params.declaredMimeType}' does not match detected magic-byte format '${detectedMime}'.`
      );
    }

    const sha256Hex = computeSha256Hex(params.fileBuffer);
    const existingTaskForHash = this.globalHashToTask.get(sha256Hex);
    if (existingTaskForHash && existingTaskForHash !== params.taskId) {
      throw new Error(
        `EVIDENCE_REUSED_ACROSS_TASKS: Artifact SHA-256 (${sha256Hex.slice(0, 12)}...) was already submitted for task ${existingTaskForHash}. Replay rejected.`
      );
    }

    const existingInSameTask = (
      this.artifactsByTask.get(params.taskId) ?? []
    ).some((a) => a.sha256_hex === sha256Hex);
    if (existingInSameTask) {
      throw new Error(
        `DUPLICATE_EVIDENCE_IN_TASK: Artifact SHA-256 (${sha256Hex.slice(0, 12)}...) was already uploaded for this task.`
      );
    }

    await fs.mkdir(this.storageDir, { recursive: true });
    const ext =
      detectedMime === "image/jpeg"
        ? "jpg"
        : detectedMime === "image/png"
          ? "png"
          : "webp";
    const artifactId = `art_${crypto.randomUUID()}`;
    const storageKey = `${params.taskId}_${artifactId}.${ext}`;
    const fullPath = path.join(this.storageDir, storageKey);

    await fs.writeFile(fullPath, params.fileBuffer, { mode: 0o600 });

    const artifactProvenance = detectSyntheticFixtureFromBuffer(
      params.fileBuffer,
      params.declaredProvenance
    );

    const artifact: EvidenceArtifact = {
      artifact_id: artifactId,
      task_id: params.taskId,
      view_type: params.viewType,
      artifact_provenance: artifactProvenance,
      mime_type: detectedMime,
      size_bytes: params.fileBuffer.length,
      sha256_hex: sha256Hex,
      captured_at_declared: params.capturedAtDeclared,
      received_at_server: new Date().toISOString(),
      verifier_id: params.verifierId,
      verifier_declared_sku: sanitizeMetadataText(params.verifierDeclaredSku),
      verifier_notes: sanitizeMetadataText(params.verifierNotes),
      consent_granted: true,
      no_prohibited_data_confirmed: true,
      storage_key: storageKey,
    };

    const current = this.artifactsByTask.get(params.taskId) ?? [];
    current.push(artifact);
    this.artifactsByTask.set(params.taskId, current);
    this.globalHashToTask.set(sha256Hex, params.taskId);

    return artifact;
  }

  hydrateArtifacts(taskId: string, artifacts: EvidenceArtifact[]): void {
    const existing = this.artifactsByTask.get(taskId) ?? [];
    for (const art of artifacts) {
      if (!existing.some((a) => a.artifact_id === art.artifact_id)) {
        existing.push(art);
      }
      this.globalHashToTask.set(art.sha256_hex, taskId);
    }
    this.artifactsByTask.set(taskId, existing);
  }

  getArtifactsForTask(taskId: string): EvidenceArtifact[] {
    return [...(this.artifactsByTask.get(taskId) ?? [])];
  }

  async readArtifactBytes(storageKey: string): Promise<Buffer> {
    const safeName = path.basename(storageKey);
    const fullPath = path.join(this.storageDir, safeName);
    return fs.readFile(fullPath);
  }
}

