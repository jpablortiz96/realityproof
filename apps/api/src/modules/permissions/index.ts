import crypto from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Role } from "@realityproof/shared";
import type { AppConfig } from "../../config.js";

export interface AuthenticatedActor {
  role: Role;
  actorId: string;
}

function timingSafeTokenMatch(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const candidateHash = crypto.createHash("sha256").update(candidate, "utf8").digest();
  const expectedHash = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

export function detectSpoofedRoleClaim(req: FastifyRequest): string | null {
  const spoofHeaders = ["x-role", "x-user-role", "x-actor-role", "x-rp-role"];
  for (const h of spoofHeaders) {
    if (req.headers[h] !== undefined) {
      return `FORBIDDEN_ROLE_CLAIM_HEADER:${h}`;
    }
  }
  const q = (req.query ?? {}) as Record<string, unknown>;
  if (q.role !== undefined || q.actor_role !== undefined || q.actorId !== undefined) {
    return "FORBIDDEN_ROLE_CLAIM_QUERY_PARAM";
  }
  return null;
}

export function resolveActorFromHeaders(
  req: FastifyRequest,
  config: AppConfig
): AuthenticatedActor | null {
  const authHeader = req.headers.authorization;
  const roleTokenHeader = req.headers["x-rp-role-token"];
  const rawToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : typeof roleTokenHeader === "string"
        ? roleTokenHeader.trim()
        : "";

  if (!rawToken) {
    return null;
  }

  if (timingSafeTokenMatch(rawToken, config.tokens.requester)) {
    return { role: "REQUESTER", actorId: "actor_requester_demo" };
  }
  if (timingSafeTokenMatch(rawToken, config.tokens.verifier)) {
    return { role: "VERIFIER", actorId: "actor_verifier_mobile_01" };
  }
  if (timingSafeTokenMatch(rawToken, config.tokens.operator)) {
    return { role: "OPERATOR", actorId: "actor_operator_reviewer_01" };
  }
  if (timingSafeTokenMatch(rawToken, config.tokens.externalAgent)) {
    return { role: "EXTERNAL_AGENT", actorId: "actor_external_agent_01" };
  }

  return null;
}

/**
 * Object-level authorization. Roles alone do not scope tasks: requesters and external
 * agents reach only what they created; verifiers reach funded work offered to them.
 */
export function actorCanAccessTask(
  actor: AuthenticatedActor,
  task: {
    created_by: string;
    assigned_verifier_id?: string | null;
    funding_allocation?: unknown;
  }
): boolean {
  if (actor.role === "OPERATOR") return true;
  if (actor.role === "VERIFIER") {
    return (
      task.assigned_verifier_id === actor.actorId ||
      (!task.assigned_verifier_id && Boolean(task.funding_allocation))
    );
  }
  return task.created_by === actor.actorId;
}

export function requireRoles(
  allowedRoles: Role[],
  config: AppConfig
): (req: FastifyRequest, reply: FastifyReply) => Promise<AuthenticatedActor | undefined> {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const spoofAttempt = detectSpoofedRoleClaim(req);
    if (spoofAttempt) {
      await reply.code(400).send({
        error: "ROLE_SPOOFING_ATTEMPT_BLOCKED",
        message: `Client-supplied role claim (${spoofAttempt}) is strictly forbidden. Roles are derived exclusively from server-validated bearer tokens.`,
      });
      return undefined;
    }

    const actor = resolveActorFromHeaders(req, config);
    if (!actor) {
      await reply.code(401).send({
        error: "UNAUTHORIZED",
        message:
          "Missing or invalid authentication token. Provide Authorization: Bearer <token> or x-rp-role-token.",
      });
      return undefined;
    }

    if (!allowedRoles.includes(actor.role)) {
      await reply.code(403).send({
        error: "FORBIDDEN_ROLE",
        message: `Role '${actor.role}' is not authorized for this operation. Allowed roles: ${allowedRoles.join(", ")}`,
      });
      return undefined;
    }

    return actor;
  };
}

export function createSignedReadToken(
  proofId: string,
  expiresAtIso: string,
  secret: string
): string {
  const payload = `${proofId}.${expiresAtIso}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifySignedReadToken(
  token: string,
  expectedProofId: string,
  secret: string
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  try {
    const decoded = Buffer.from(parts[0], "base64url").toString("utf8");
    const [proofId, expiresAtIso] = decoded.split(".");
    if (proofId !== expectedProofId || !expiresAtIso) {
      return false;
    }
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(decoded)
      .digest("hex");
    if (
      !crypto.timingSafeEqual(
        Buffer.from(parts[1], "utf8"),
        Buffer.from(expectedSig, "utf8")
      )
    ) {
      return false;
    }
    return new Date(expiresAtIso).getTime() > Date.now();
  } catch {
    return false;
  }
}

