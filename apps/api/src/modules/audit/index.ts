import crypto from "node:crypto";

export interface AuditEvent {
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

const SENSITIVE_KEYS = new Set([
  "authorization",
  "client_secret",
  "clientsecret",
  "api_key",
  "apikey",
  "password",
  "token",
  "secret",
]);

export function scrubSensitiveMetadata(
  input: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = scrubSensitiveMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

// Bounds memory on a public demo, where anonymous visitors can generate events.
const MAX_AUDIT_EVENTS = 20_000;

export class AuditService {
  private events: AuditEvent[] = [];

  record(params: {
    task_id?: string | null;
    actor_role: string;
    actor_id: string;
    action: string;
    from_status?: string | null;
    to_status?: string | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
  }): AuditEvent {
    const event: AuditEvent = {
      event_id: `evt_${crypto.randomUUID()}`,
      task_id: params.task_id ?? null,
      actor_role: params.actor_role,
      actor_id: params.actor_id,
      action: params.action,
      from_status: params.from_status ?? null,
      to_status: params.to_status ?? null,
      metadata: scrubSensitiveMetadata(params.metadata ?? {}),
      created_at: params.created_at ?? new Date().toISOString(),
    };
    this.events.push(event);
    if (this.events.length > MAX_AUDIT_EVENTS) {
      this.events.splice(0, this.events.length - MAX_AUDIT_EVENTS);
    }
    return event;
  }

  listByTask(taskId: string): AuditEvent[] {
    return this.events.filter((e) => e.task_id === taskId);
  }

  listAll(): AuditEvent[] {
    return [...this.events];
  }

  hydrate(events: AuditEvent[]): void {
    const existingIds = new Set(this.events.map((e) => e.event_id));
    for (const ev of events) {
      if (!existingIds.has(ev.event_id)) {
        this.events.push(ev);
        existingIds.add(ev.event_id);
      }
    }
  }
}

