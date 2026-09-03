import { randomUUID } from "node:crypto";
import {
  ProviderCircuitOpenError,
  ProviderError,
  ProviderTimeoutError,
  ProviderUnknownError,
  isUnknownProviderOutcome,
} from "@onetrips/shared";
import type { FlightProviderConfig } from "./config";
import { assertCircuitClosed, recordCircuitFailure, recordCircuitSuccess } from "./circuit";
import { recordProviderSample } from "./health";
import { logProviderOp } from "./log";
import { findOperation, finishOperation, startOperation } from "./operations";
import { withRetry } from "./retry";
import { withTimeout } from "./timeout";
import type {
  CancelBookingRequest,
  CreateBookingRequest,
  CreateBookingResponse,
  FlightOffer,
  FlightProviderPort,
  GetBookingStatusRequest,
  GetBookingStatusResponse,
  IssueTicketRequest,
  IssueTicketResponse,
  NormalizedFareRule,
  NormalizedSeatMap,
  ProviderCapabilities,
  SearchRequest,
  VoidTicketRequest,
} from "./types";

function correlation(existing?: string) {
  return existing || randomUUID();
}

function asProviderError(error: unknown, fallback: { provider: string; operation: string; correlationId: string }) {
  if (error instanceof ProviderError) return error;
  return new ProviderUnknownError(fallback);
}

export class InstrumentedFlightProvider implements FlightProviderPort {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  constructor(
    private readonly inner: FlightProviderPort,
    private readonly config: FlightProviderConfig,
  ) {
    this.id = inner.id;
    this.capabilities = inner.capabilities;
  }

  private async guard(operation: string, correlationId: string) {
    if (operation === "getBookingStatus") return;
    const state = await assertCircuitClosed(this.id, { openMs: this.config.circuitOpenMs });
    if (state === "OPEN") {
      throw new ProviderCircuitOpenError({ provider: this.id, operation, correlationId });
    }
  }

  private async run<T>(params: {
    operation: string;
    timeoutMs: number;
    correlationId: string;
    bookingId?: string;
    work: () => Promise<T>;
    retry?: boolean;
  }): Promise<T> {
    const started = Date.now();
    await this.guard(params.operation, params.correlationId);
    try {
      const exec = () => withTimeout(params.work(), params.timeoutMs, {
        provider: this.id,
        operation: params.operation,
        correlationId: params.correlationId,
      });
      const result = params.retry
        ? await withRetry(params.operation, exec, { retries: this.config.retryLimit })
        : await exec();
      const durationMs = Date.now() - started;
      await recordCircuitSuccess(this.id);
      await recordProviderSample(this.id, true, durationMs);
      logProviderOp({
        correlationId: params.correlationId,
        bookingId: params.bookingId,
        operation: params.operation,
        provider: this.id,
        durationMs,
        result: "SUCCESS",
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - started;
      const mapped = error instanceof ProviderError ? error : asProviderError(error, {
        provider: this.id,
        operation: params.operation,
        correlationId: params.correlationId,
      });
      await recordCircuitFailure(this.id, {
        threshold: this.config.circuitFailureThreshold,
        openMs: this.config.circuitOpenMs,
      });
      await recordProviderSample(this.id, false, durationMs);
      logProviderOp({
        correlationId: params.correlationId,
        bookingId: params.bookingId,
        operation: params.operation,
        provider: this.id,
        durationMs,
        result: mapped instanceof ProviderTimeoutError ? "TIMEOUT" : "FAILURE",
        errorCategory: mapped.code,
        providerReference: mapped.providerReference,
      });
      throw mapped;
    }
  }

  search(request: SearchRequest) {
    return this.run({
      operation: "search",
      timeoutMs: this.config.searchTimeoutMs,
      correlationId: correlation(),
      retry: true,
      work: () => this.inner.search(request),
    });
  }

  revalidate(offer: FlightOffer) {
    return this.run({
      operation: "revalidate",
      timeoutMs: this.config.revalidationTimeoutMs,
      correlationId: correlation(),
      retry: true,
      work: () => this.inner.revalidate(offer),
    });
  }

  async createBooking(request: CreateBookingRequest): Promise<CreateBookingResponse> {
    const existing = await findOperation(request.idempotencyKey);
    if (existing?.status === "SUCCEEDED" && existing.providerReference) {
      return { providerRef: existing.providerReference, status: "CONFIRMED", correlationId: request.correlationId };
    }
    if (existing && (existing.status === "STARTED" || existing.status === "TIMED_OUT" || existing.status === "UNKNOWN")) {
      const looked = await this.inner.getBookingStatus({
        bookingId: request.bookingId,
        idempotencyKey: request.idempotencyKey,
        correlationId: request.correlationId,
      });
      if (looked.status === "CONFIRMED" && looked.providerRef) {
        await finishOperation(request.idempotencyKey, {
          status: "SUCCEEDED",
          providerReference: looked.providerRef,
          responseMetadata: { resolved: true },
        });
        return { providerRef: looked.providerRef, status: "CONFIRMED", correlationId: request.correlationId };
      }
    }
    await startOperation({
      bookingId: request.bookingId,
      provider: this.id,
      operation: "CREATE_BOOKING",
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
      requestMetadata: { bookingRef: request.bookingRef, offerId: request.offerId },
    });
    try {
      const result = await this.run({
        operation: "createBooking",
        timeoutMs: this.config.bookingTimeoutMs,
        correlationId: request.correlationId,
        bookingId: request.bookingId,
        work: () => this.inner.createBooking(request),
      });
      await finishOperation(request.idempotencyKey, {
        status: "SUCCEEDED",
        providerReference: result.providerRef,
        responseMetadata: { status: result.status },
      });
      return result;
    } catch (error) {
      if (error instanceof ProviderTimeoutError || isUnknownProviderOutcome(error)) {
        await finishOperation(request.idempotencyKey, { status: "TIMED_OUT", errorCode: "PROVIDER_TIMEOUT" });
        try {
          const looked = await this.inner.getBookingStatus({
            bookingId: request.bookingId,
            idempotencyKey: request.idempotencyKey,
            correlationId: request.correlationId,
          });
          if (looked.status === "CONFIRMED" && looked.providerRef) {
            await finishOperation(request.idempotencyKey, {
              status: "SUCCEEDED",
              providerReference: looked.providerRef,
              responseMetadata: { resolvedAfterTimeout: true },
            });
            return { providerRef: looked.providerRef, status: "CONFIRMED", correlationId: request.correlationId };
          }
        } catch {
          /* still unknown */
        }
        await finishOperation(request.idempotencyKey, { status: "UNKNOWN", errorCode: "PROVIDER_TIMEOUT" });
      } else if (error instanceof ProviderError) {
        await finishOperation(request.idempotencyKey, {
          status: "FAILED",
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }

  getBookingStatus(request: GetBookingStatusRequest): Promise<GetBookingStatusResponse> {
    return this.run({
      operation: "getBookingStatus",
      timeoutMs: this.config.revalidationTimeoutMs,
      correlationId: correlation(request.correlationId),
      bookingId: request.bookingId,
      retry: true,
      work: () => this.inner.getBookingStatus(request),
    });
  }

  async issueTicket(request: IssueTicketRequest): Promise<IssueTicketResponse> {
    const existing = await findOperation(request.idempotencyKey);
    if (existing?.status === "SUCCEEDED" && existing.responseMetadata && typeof existing.responseMetadata === "object") {
      const tickets = (existing.responseMetadata as { ticketNumbers?: string[] }).ticketNumbers;
      if (tickets?.length) {
        return { ticketNumbers: tickets, status: "TICKETED", correlationId: request.correlationId };
      }
    }
    if (existing && (existing.status === "STARTED" || existing.status === "TIMED_OUT" || existing.status === "UNKNOWN")) {
      const looked = await this.inner.getBookingStatus({
        providerRef: request.providerRef,
        bookingId: request.bookingId,
        correlationId: request.correlationId,
      });
      if (looked.ticketNumbers.length > 0) {
        await finishOperation(request.idempotencyKey, {
          status: "SUCCEEDED",
          providerReference: request.providerRef,
          responseMetadata: { ticketNumbers: looked.ticketNumbers, resolved: true },
        });
        return { ticketNumbers: looked.ticketNumbers, status: "TICKETED", correlationId: request.correlationId };
      }
    }
    await startOperation({
      bookingId: request.bookingId,
      provider: this.id,
      operation: "ISSUE_TICKET",
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
      requestMetadata: { providerRef: request.providerRef, passengerCount: request.passengerCount },
    });
    try {
      const result = await this.run({
        operation: "issueTicket",
        timeoutMs: this.config.ticketingTimeoutMs,
        correlationId: request.correlationId,
        bookingId: request.bookingId,
        work: () => this.inner.issueTicket(request),
      });
      await finishOperation(request.idempotencyKey, {
        status: "SUCCEEDED",
        providerReference: request.providerRef,
        responseMetadata: { ticketNumbers: result.ticketNumbers },
      });
      return result;
    } catch (error) {
      if (error instanceof ProviderTimeoutError || isUnknownProviderOutcome(error)) {
        await finishOperation(request.idempotencyKey, { status: "TIMED_OUT", errorCode: "PROVIDER_TIMEOUT" });
        try {
          const looked = await this.inner.getBookingStatus({
            providerRef: request.providerRef,
            bookingId: request.bookingId,
            correlationId: request.correlationId,
          });
          if (looked.ticketNumbers.length > 0) {
            await finishOperation(request.idempotencyKey, {
              status: "SUCCEEDED",
              providerReference: request.providerRef,
              responseMetadata: { ticketNumbers: looked.ticketNumbers, resolvedAfterTimeout: true },
            });
            return { ticketNumbers: looked.ticketNumbers, status: "TICKETED", correlationId: request.correlationId };
          }
        } catch {
          /* unknown */
        }
        await finishOperation(request.idempotencyKey, { status: "UNKNOWN", errorCode: "PROVIDER_TIMEOUT" });
      } else if (error instanceof ProviderError) {
        await finishOperation(request.idempotencyKey, { status: "FAILED", errorCode: error.code, errorMessage: error.message });
      }
      throw error;
    }
  }

  async voidTicket(request: VoidTicketRequest) {
    const existing = await findOperation(request.idempotencyKey);
    if (existing?.status === "SUCCEEDED") {
      return { voided: true, correlationId: request.correlationId };
    }
    await startOperation({
      bookingId: request.bookingId,
      provider: this.id,
      operation: "VOID_TICKET",
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
      requestMetadata: { ticketNumber: request.ticketNumber, providerRef: request.providerRef },
    });
    try {
      const result = await this.run({
        operation: "voidTicket",
        timeoutMs: this.config.cancellationTimeoutMs,
        correlationId: request.correlationId,
        bookingId: request.bookingId,
        work: () => this.inner.voidTicket(request),
      });
      await finishOperation(request.idempotencyKey, { status: "SUCCEEDED", providerReference: request.providerRef, responseMetadata: { voided: result.voided } });
      return result;
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        await finishOperation(request.idempotencyKey, { status: "UNKNOWN", errorCode: "PROVIDER_TIMEOUT" });
      } else if (error instanceof ProviderError) {
        await finishOperation(request.idempotencyKey, { status: "FAILED", errorCode: error.code, errorMessage: error.message });
      }
      throw error;
    }
  }

  async cancelBooking(request: CancelBookingRequest) {
    const existing = await findOperation(request.idempotencyKey);
    if (existing?.status === "SUCCEEDED") {
      return { cancelled: true, correlationId: request.correlationId };
    }
    if (existing && (existing.status === "STARTED" || existing.status === "TIMED_OUT" || existing.status === "UNKNOWN")) {
      const looked = await this.inner.getBookingStatus({
        providerRef: request.providerRef,
        bookingId: request.bookingId,
        correlationId: request.correlationId,
      });
      if (looked.status === "CANCELLED") {
        await finishOperation(request.idempotencyKey, { status: "SUCCEEDED", providerReference: request.providerRef, responseMetadata: { resolved: true } });
        return { cancelled: true, correlationId: request.correlationId };
      }
      if (looked.status === "CONFIRMED" || looked.status === "TICKETED") {
        /* do not send a second cancel blindly — caller may retry after ops review */
      }
    }
    await startOperation({
      bookingId: request.bookingId,
      provider: this.id,
      operation: "CANCEL_BOOKING",
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
      requestMetadata: { providerRef: request.providerRef },
    });
    try {
      const result = await this.run({
        operation: "cancelBooking",
        timeoutMs: this.config.cancellationTimeoutMs,
        correlationId: request.correlationId,
        bookingId: request.bookingId,
        work: () => this.inner.cancelBooking(request),
      });
      await finishOperation(request.idempotencyKey, { status: "SUCCEEDED", providerReference: request.providerRef, responseMetadata: { cancelled: result.cancelled } });
      return result;
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        await finishOperation(request.idempotencyKey, { status: "UNKNOWN", errorCode: "PROVIDER_TIMEOUT" });
        try {
          const looked = await this.inner.getBookingStatus({
            providerRef: request.providerRef,
            bookingId: request.bookingId,
            correlationId: request.correlationId,
          });
          if (looked.status === "CANCELLED") {
            await finishOperation(request.idempotencyKey, { status: "SUCCEEDED", providerReference: request.providerRef, responseMetadata: { resolvedAfterTimeout: true } });
            return { cancelled: true, correlationId: request.correlationId };
          }
        } catch {
          /* unknown */
        }
      } else if (error instanceof ProviderError) {
        await finishOperation(request.idempotencyKey, { status: "FAILED", errorCode: error.code, errorMessage: error.message });
      }
      throw error;
    }
  }

  getFareRules(offerId: string) {
    return this.run({
      operation: "getFareRules",
      timeoutMs: this.config.revalidationTimeoutMs,
      correlationId: correlation(),
      retry: true,
      work: () => this.inner.getFareRules(offerId),
    }) as Promise<NormalizedFareRule>;
  }

  getSeatMap(offerId: string, segmentIndex = 0) {
    return this.run({
      operation: "getSeatMap",
      timeoutMs: this.config.revalidationTimeoutMs,
      correlationId: correlation(),
      retry: true,
      work: () => this.inner.getSeatMap(offerId, segmentIndex),
    }) as Promise<NormalizedSeatMap>;
  }
}
