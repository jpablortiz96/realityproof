import crypto from "node:crypto";
import {
  PayoutEligibilityProofSchema,
  type PayoutEligibilityProof,
  type PayoutStatus,
} from "@realityproof/shared";
import type { AppConfig } from "../../config.js";

export interface PayPalOrderRecord {
  orderId: string;
  taskId: string;
  status: "CREATED" | "APPROVED" | "COMPLETED" | "VOIDED" | "FAILED";
  amountUsd: string;
  currency: "USD";
  approveUrl: string | null;
  captureId: string | null;
  paypalRequestId: string;
  rawOrderResponse: Record<string, unknown>;
  updatedAt: string;
}

export interface PayPalPayoutResult {
  payoutStatus: PayoutStatus;
  payoutBatchId: string | null;
  payoutItemId: string | null;
  remoteStatus: string;
  itemTransactionStatus?: string;
  explanation: string;
  isSimulated: boolean;
}

// PayPal order payloads carry payer names and emails; task records keep only what the audit needs.
function minimalOrderAudit(raw: Record<string, unknown>): Record<string, unknown> {
  return { id: raw.id, status: raw.status, intent: raw.intent };
}

export class PayPalService {
  private ordersByTask = new Map<string, PayPalOrderRecord>();
  private ordersById = new Map<string, PayPalOrderRecord>();
  private capturesById = new Map<string, string>();
  private inFlightCaptureOrders = new Set<string>();
  private payoutsByTask = new Map<string, PayPalPayoutResult>();
  private processedWebhookEventIds = new Set<string>();
  private cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly config: AppConfig["paypal"],
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    if (this.config.mode !== "sandbox") {
      throw new Error("PayPalService only operates in sandbox mode.");
    }
  }

  hasCredentials(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  async getAccessToken(): Promise<string> {
    if (!this.hasCredentials()) {
      throw new Error(
        "PAYPAL_CREDENTIALS_MISSING: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required in .env to call PayPal Sandbox APIs."
      );
    }

    if (
      this.cachedAccessToken &&
      this.cachedAccessToken.expiresAtMs > Date.now() + 30_000
    ) {
      return this.cachedAccessToken.token;
    }

    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
      "utf8"
    ).toString("base64");

    const response = await this.fetchImpl(
      `${this.config.apiBaseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "grant_type=client_credentials",
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(
        `PAYPAL_OAUTH_FAILED (${response.status}): Unable to obtain Sandbox OAuth2 token. ${errBody.slice(0, 240)}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cachedAccessToken = {
      token: data.access_token,
      expiresAtMs: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  async createOrderForTask(params: {
    taskId: string;
    amountUsd: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PayPalOrderRecord> {
    // Idempotency: if an active order already exists for this task, return it
    const existing = this.ordersByTask.get(params.taskId);
    if (existing && existing.status !== "FAILED" && existing.status !== "VOIDED") {
      return existing;
    }

    const token = await this.getAccessToken();
    const paypalRequestId = `rp_order_${params.taskId}`;
    const amountFormatted = params.amountUsd.toFixed(2);

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.taskId,
          custom_id: params.taskId,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: "USD",
            value: amountFormatted,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "RealityProof Sandbox",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: params.returnUrl,
            cancel_url: params.cancelUrl,
          },
        },
      },
    };

    const response = await this.fetchImpl(
      `${this.config.apiBaseUrl}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": paypalRequestId,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `PAYPAL_CREATE_ORDER_FAILED (${response.status}): ${text.slice(0, 300)}`
      );
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      links?: Array<{ href: string; rel: string; method?: string }>;
    };

    const approveLink =
      data.links?.find(
        (l) => l.rel === "payer-action" || l.rel === "approve"
      )?.href ?? null;

    const record: PayPalOrderRecord = {
      orderId: data.id,
      taskId: params.taskId,
      status: data.status === "COMPLETED" ? "COMPLETED" : "CREATED",
      amountUsd: amountFormatted,
      currency: "USD",
      approveUrl: approveLink,
      captureId: null,
      paypalRequestId,
      rawOrderResponse: minimalOrderAudit(data as unknown as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    };

    this.ordersByTask.set(params.taskId, record);
    this.ordersById.set(data.id, record);
    return record;
  }

  async getRemoteOrder(orderId: string): Promise<{
    id: string;
    status: string;
    customId: string | null;
    referenceId: string | null;
    amountValue: string | null;
    currencyCode: string | null;
    captureId: string | null;
    captureStatus: string | null;
    payerId: string | null;
    raw: Record<string, unknown>;
  }> {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(
      `${this.config.apiBaseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `PAYPAL_GET_ORDER_FAILED (${response.status}): ${text.slice(0, 300)}`
      );
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      payer?: { payer_id?: string; email_address?: string };
      purchase_units?: Array<{
        reference_id?: string;
        custom_id?: string;
        amount?: { currency_code?: string; value?: string };
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
            custom_id?: string;
            amount?: { value?: string; currency_code?: string };
          }>;
        };
      }>;
    };

    const unit = data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];

    return {
      id: data.id,
      status: data.status,
      customId: unit?.custom_id ?? capture?.custom_id ?? null,
      referenceId: unit?.reference_id ?? null,
      amountValue: unit?.amount?.value ?? capture?.amount?.value ?? null,
      currencyCode:
        unit?.amount?.currency_code ?? capture?.amount?.currency_code ?? null,
      captureId: capture?.id ?? null,
      captureStatus: capture?.status ?? null,
      payerId: data.payer?.payer_id ?? null,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  registerHydratedOrder(order: PayPalOrderRecord): void {
    this.ordersByTask.set(order.taskId, order);
    this.ordersById.set(order.orderId, order);
    if (order.captureId) {
      this.capturesById.set(order.captureId, order.taskId);
    }
  }

  async captureOrderForTask(params: {
    taskId: string;
    orderId: string;
    expectedAmountUsd: number;
  }): Promise<PayPalOrderRecord> {
    const existingForOrder = this.ordersById.get(params.orderId);
    if (existingForOrder && existingForOrder.taskId !== params.taskId) {
      throw new Error(
        `PAYPAL_FOREIGN_ORDER_REJECTED: Order '${params.orderId}' belongs to task '${existingForOrder.taskId}' and cannot be captured for task '${params.taskId}'.`
      );
    }

    const existing = this.ordersByTask.get(params.taskId);
    if (
      existing &&
      existing.orderId === params.orderId &&
      existing.status === "COMPLETED" &&
      existing.captureId
    ) {
      return existing;
    }

    if (this.inFlightCaptureOrders.has(params.orderId)) {
      throw new Error(
        `PAYPAL_CONCURRENT_CAPTURE_IN_PROGRESS: A capture request for order '${params.orderId}' is already in flight.`
      );
    }

    this.inFlightCaptureOrders.add(params.orderId);
    try {
      // Pre-capture verification: verify remote order exists and check if already COMPLETED
      // or if buyer has approved it before attempting capture.
      const preCheck = await this.getRemoteOrder(params.orderId);
      const expectedFormatted = params.expectedAmountUsd.toFixed(2);

      const boundRemoteTask = preCheck.customId ?? preCheck.referenceId;
      if (boundRemoteTask && boundRemoteTask !== params.taskId) {
        throw new Error(
          `PAYPAL_FOREIGN_ORDER_TASK_MISMATCH: Remote PayPal order '${params.orderId}' is bound to task '${boundRemoteTask}', which does not match requested task '${params.taskId}'.`
        );
      }

      if (
        preCheck.captureId &&
        this.capturesById.has(preCheck.captureId) &&
        this.capturesById.get(preCheck.captureId) !== params.taskId
      ) {
        throw new Error(
          `PAYPAL_CAPTURE_ALREADY_ALLOCATED: PayPal capture '${preCheck.captureId}' already funded task '${this.capturesById.get(preCheck.captureId)}' and cannot fund a second contract.`
        );
      }

      if (
        preCheck.status === "CREATED" ||
        preCheck.status === "PAYER_ACTION_REQUIRED"
      ) {
        throw new Error(
          `PAYPAL_BUYER_APPROVAL_REQUIRED: Order ${params.orderId} is in '${preCheck.status}' status. The buyer must approve the order in PayPal Sandbox Checkout before capture can proceed.`
        );
      }

      if (preCheck.status !== "COMPLETED") {
        const token = await this.getAccessToken();
        const captureRequestId = `rp_capture_${params.taskId}_${params.orderId}`;

        const captureResp = await this.fetchImpl(
          `${this.config.apiBaseUrl}/v2/checkout/orders/${encodeURIComponent(params.orderId)}/capture`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "PayPal-Request-Id": captureRequestId,
            },
          }
        );

        if (!captureResp.ok) {
          const errText = await captureResp.text();
          throw new Error(
            `PAYPAL_CAPTURE_FAILED (${captureResp.status}): Order could not be captured (ensure buyer approved order in PayPal Sandbox). Details: ${errText.slice(0, 300)}`
          );
        }
      }

      // Always verify remote state via GET /v2/checkout/orders/{id} to prevent state spoofing
      const remoteState = await this.getRemoteOrder(params.orderId);

      if (
        remoteState.status !== "COMPLETED" ||
        !remoteState.captureId ||
        remoteState.captureStatus !== "COMPLETED"
      ) {
        throw new Error(
          `PAYPAL_REMOTE_STATE_MISMATCH: Expected remote order and capture status COMPLETED with captureId, but PayPal returned orderStatus='${remoteState.status}', captureStatus='${remoteState.captureStatus ?? "null"}', captureId='${remoteState.captureId ?? "null"}'.`
        );
      }

      if (
        this.capturesById.has(remoteState.captureId) &&
        this.capturesById.get(remoteState.captureId) !== params.taskId
      ) {
        throw new Error(
          `PAYPAL_CAPTURE_ALREADY_ALLOCATED: PayPal capture '${remoteState.captureId}' already funded task '${this.capturesById.get(remoteState.captureId)}' and cannot fund a second contract.`
        );
      }

      if (
        remoteState.amountValue !== expectedFormatted ||
        remoteState.currencyCode !== "USD"
      ) {
        throw new Error(
          `PAYPAL_AMOUNT_MISMATCH: Expected ${expectedFormatted} USD, but remote order has ${remoteState.amountValue} ${remoteState.currencyCode}.`
        );
      }

      const updated: PayPalOrderRecord = {
        orderId: params.orderId,
        taskId: params.taskId,
        status: "COMPLETED",
        amountUsd: expectedFormatted,
        currency: "USD",
        approveUrl: existing?.approveUrl ?? null,
        captureId: remoteState.captureId,
        paypalRequestId:
          existing?.paypalRequestId ??
          `rp_capture_${params.taskId}_${params.orderId}`,
        rawOrderResponse: minimalOrderAudit(remoteState.raw),
        updatedAt: new Date().toISOString(),
      };

      this.ordersByTask.set(params.taskId, updated);
      this.ordersById.set(params.orderId, updated);
      this.capturesById.set(remoteState.captureId, params.taskId);
      return updated;
    } finally {
      this.inFlightCaptureOrders.delete(params.orderId);
    }
  }

  async verifyAndProcessWebhook(params: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: Record<string, unknown>;
  }): Promise<{
    verified: boolean;
    duplicate: boolean;
    eventId: string;
    eventType: string;
    reason?: string;
  }> {
    const eventId = String(params.rawBody.id ?? "");
    const eventType = String(params.rawBody.event_type ?? "");

    if (!eventId || !eventType) {
      return {
        verified: false,
        duplicate: false,
        eventId: eventId || "unknown",
        eventType: eventType || "unknown",
        reason: "MISSING_EVENT_ID_OR_TYPE",
      };
    }

    if (this.processedWebhookEventIds.has(eventId)) {
      return {
        verified: true,
        duplicate: true,
        eventId,
        eventType,
        reason: "DUPLICATE_WEBHOOK_EVENT_IGNORED",
      };
    }

    const transmissionId = String(
      params.headers["paypal-transmission-id"] ?? ""
    );
    const transmissionTime = String(
      params.headers["paypal-transmission-time"] ?? ""
    );
    const certUrl = String(params.headers["paypal-cert-url"] ?? "");
    const authAlgo = String(params.headers["paypal-auth-algo"] ?? "");
    const transmissionSig = String(
      params.headers["paypal-transmission-sig"] ?? ""
    );

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      return {
        verified: false,
        duplicate: false,
        eventId,
        eventType,
        reason: "MISSING_PAYPAL_SIGNATURE_HEADERS",
      };
    }

    if (!this.config.webhookId || !this.hasCredentials()) {
      return {
        verified: false,
        duplicate: false,
        eventId,
        eventType,
        reason: "WEBHOOK_ID_OR_CREDENTIALS_NOT_CONFIGURED",
      };
    }

    const token = await this.getAccessToken();
    const verifyResp = await this.fetchImpl(
      `${this.config.apiBaseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: this.config.webhookId,
          webhook_event: params.rawBody,
        }),
      }
    );

    if (!verifyResp.ok) {
      return {
        verified: false,
        duplicate: false,
        eventId,
        eventType,
        reason: `PAYPAL_VERIFY_ENDPOINT_HTTP_${verifyResp.status}`,
      };
    }

    const verifyJson = (await verifyResp.json()) as {
      verification_status?: string;
    };

    if (verifyJson.verification_status !== "SUCCESS") {
      return {
        verified: false,
        duplicate: false,
        eventId,
        eventType,
        reason: `SIGNATURE_VERIFICATION_${verifyJson.verification_status ?? "FAILED"}`,
      };
    }

    this.processedWebhookEventIds.add(eventId);
    return {
      verified: true,
      duplicate: false,
      eventId,
      eventType,
    };
  }

  /**
   * Conditional Payouts v1 capability with STRICT FINANCIAL INTEGRITY GATE:
   * - Never allows probes or health checks to create a real Payout.
   * - Requires a cryptographically & schema-validated PayoutEligibilityProof proving:
   *   ORDER_CREATED -> BUYER_APPROVED -> CAPTURE_COMPLETED -> EVIDENCE_SUBMITTED -> AI_ANALYZED -> HUMAN_APPROVED -> PAYOUT_ELIGIBLE.
   * - Requires explicit operator authorization (explicitOperatorAuthorization === true).
   * - Recipient email is bound strictly to the server-configured sandboxVerifierEmail; client overrides are forbidden.
   * - Never marks PAYOUT_SUCCESS if batch or item is PENDING or UNCLAIMED.
   */
  async executeOrProbePayout(params: {
    taskId: string;
    amountUsd: number;
    eligibilityProof: PayoutEligibilityProof;
    explicitOperatorAuthorization: boolean;
    allowSimulatedDryRun?: boolean;
  }): Promise<PayPalPayoutResult> {
    if (!params.explicitOperatorAuthorization) {
      throw new Error(
        "PAYOUT_AUTHORIZATION_REQUIRED: Payouts cannot be triggered by probes, health checks, or automated calls without explicit human Operator authorization."
      );
    }

    const parsedProof = PayoutEligibilityProofSchema.safeParse(
      params.eligibilityProof
    );
    if (!parsedProof.success || parsedProof.data.task_id !== params.taskId) {
      throw new Error(
        `PAYOUT_ELIGIBILITY_VIOLATION: Cannot request payout before ORDER_CREATED -> BUYER_APPROVED -> CAPTURE_COMPLETED -> EVIDENCE_SUBMITTED -> AI_ANALYZED -> HUMAN_APPROVED -> PAYOUT_ELIGIBLE. Validation errors: ${JSON.stringify(parsedProof.error?.flatten() ?? "Task ID mismatch")}`
      );
    }

    if (params.amountUsd > parsedProof.data.captured_amount_usd) {
      throw new Error(
        `PAYOUT_EXCEEDS_CAPTURED_FUNDS: Requested payout ($${params.amountUsd.toFixed(2)}) exceeds captured buyer funds ($${parsedProof.data.captured_amount_usd.toFixed(2)}).`
      );
    }

    // Idempotency: prevent duplicate payouts for the same task
    const existingPayout = this.payoutsByTask.get(params.taskId);
    if (existingPayout && existingPayout.payoutBatchId) {
      return existingPayout;
    }

    if (!this.hasCredentials()) {
      if (params.allowSimulatedDryRun) {
        const simResult: PayPalPayoutResult = {
          payoutStatus: "SIMULATED_DRY_RUN",
          payoutBatchId: `sim_batch_${params.taskId}`,
          payoutItemId: `sim_item_${params.taskId}`,
          remoteStatus: "SIMULATED_ONLY_NOT_REAL_PAYPAL",
          explanation:
            "PayPal Sandbox credentials are not present. Executed local SIMULATED adapter for testing only; no real payout occurred.",
          isSimulated: true,
        };
        this.payoutsByTask.set(params.taskId, simResult);
        return simResult;
      }
      return {
        payoutStatus: "PAYOUTS_BLOCKED",
        payoutBatchId: null,
        payoutItemId: null,
        remoteStatus: "CREDENTIALS_MISSING",
        explanation:
          "PAYOUTS_BLOCKED: PayPal Sandbox credentials are not configured.",
        isSimulated: false,
      };
    }

    try {
      const token = await this.getAccessToken();
      const senderBatchId = `rp_payout_${params.taskId}`;
      // Recipient is strictly bound to server configuration — never from untrusted request body
      const receiver = this.config.sandboxVerifierEmail;

      const response = await this.fetchImpl(
        `${this.config.apiBaseUrl}/v1/payments/payouts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": senderBatchId,
          },
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: senderBatchId,
              email_subject: "RealityProof Sandbox Verification Payout",
              email_message: `Sandbox payout for verified task ${params.taskId} (Capture ${parsedProof.data.capture_id})`,
            },
            items: [
              {
                recipient_type: "EMAIL",
                amount: {
                  value: params.amountUsd.toFixed(2),
                  currency: "USD",
                },
                receiver,
                note: `Verification reward for ${params.taskId}`,
                sender_item_id: `item_${params.taskId}`,
              },
            ],
          }),
        }
      );

      if (response.status === 403 || response.status === 401) {
        const errBody = await response.text();
        return {
          payoutStatus: "PAYOUTS_BLOCKED",
          payoutBatchId: null,
          payoutItemId: null,
          remoteStatus: `HTTP_${response.status}_NOT_AUTHORIZED`,
          explanation: `PAYOUTS_BLOCKED: PayPal Sandbox account does not have Payouts API permission enabled (${errBody.slice(0, 180)}).`,
          isSimulated: false,
        };
      }

      if (!response.ok) {
        const errBody = await response.text();
        return {
          payoutStatus: "PAYOUTS_BLOCKED",
          payoutBatchId: null,
          payoutItemId: null,
          remoteStatus: `HTTP_${response.status}`,
          explanation: `PAYOUTS_BLOCKED: PayPal Payouts endpoint returned HTTP ${response.status}: ${errBody.slice(0, 180)}`,
          isSimulated: false,
        };
      }

      const data = (await response.json()) as {
        batch_header?: {
          payout_batch_id?: string;
          batch_status?: string;
        };
      };

      const batchId = data.batch_header?.payout_batch_id ?? null;
      let batchStatus = data.batch_header?.batch_status ?? "PENDING";
      let itemStatus = "PENDING";

      if (batchId) {
        try {
          const remoteLookup = await this.getPayoutBatchStatus(batchId);
          batchStatus = remoteLookup.batchStatus;
          itemStatus = remoteLookup.items[0]?.transactionStatus ?? "PENDING";
        } catch {
          // Keep initial batchStatus if immediate lookup fails
        }
      }

      // STOP RULE: Never declare PAYOUT_SUCCESS if batch or item is PENDING or UNCLAIMED
      let mappedStatus: PayoutStatus = "PAYOUT_PENDING";
      if (batchStatus === "SUCCESS" && itemStatus === "SUCCESS") {
        mappedStatus = "PAYOUT_SUCCESS";
      } else if (itemStatus === "UNCLAIMED") {
        mappedStatus = "PAYOUT_UNCLAIMED";
      }

      const result: PayPalPayoutResult = {
        payoutStatus: mappedStatus,
        payoutBatchId: batchId,
        payoutItemId: `item_${params.taskId}`,
        remoteStatus: batchStatus,
        itemTransactionStatus: itemStatus,
        explanation: `PayPal Sandbox Payout batch ${batchId ?? "unknown"} status=${batchStatus}, itemTransactionStatus=${itemStatus}.`,
        isSimulated: false,
      };
      this.payoutsByTask.set(params.taskId, result);
      return result;
    } catch (err) {
      return {
        payoutStatus: "PAYOUTS_BLOCKED",
        payoutBatchId: null,
        payoutItemId: null,
        remoteStatus: "NETWORK_OR_AUTH_ERROR",
        explanation: `PAYOUTS_BLOCKED: ${(err as Error).message}`,
        isSimulated: false,
      };
    }
  }

  async getPayoutBatchStatus(payoutBatchId: string): Promise<{
    batchId: string;
    batchStatus: string;
    items: Array<{
      payoutItemId: string;
      transactionStatus: string;
      amountValue: string | null;
      currency: string | null;
    }>;
  }> {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(
      `${this.config.apiBaseUrl}/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `PAYPAL_GET_PAYOUT_FAILED (${response.status}): ${text.slice(0, 240)}`
      );
    }

    const data = (await response.json()) as {
      batch_header?: {
        payout_batch_id?: string;
        batch_status?: string;
      };
      items?: Array<{
        payout_item_id?: string;
        transaction_status?: string;
        payout_item?: {
          amount?: { value?: string; currency?: string };
        };
      }>;
    };

    return {
      batchId: data.batch_header?.payout_batch_id ?? payoutBatchId,
      batchStatus: data.batch_header?.batch_status ?? "UNKNOWN",
      items: (data.items ?? []).map((it) => ({
        payoutItemId: it.payout_item_id ?? "unknown",
        transactionStatus: it.transaction_status ?? "UNKNOWN",
        amountValue: it.payout_item?.amount?.value ?? null,
        currency: it.payout_item?.amount?.currency ?? null,
      })),
    };
  }

  getOrderByTask(taskId: string): PayPalOrderRecord | null {
    return this.ordersByTask.get(taskId) ?? null;
  }
}

