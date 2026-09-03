export class AppError extends Error {
  readonly code: string;
  readonly category: string;
  readonly httpStatus: number;
  readonly providerReference?: string;
  readonly internalReference: string;
  readonly timestamp: string;

  constructor(params: {
    code: string;
    message: string;
    category?: string;
    httpStatus?: number;
    providerReference?: string;
    internalReference?: string;
  }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.category = params.category ?? "APPLICATION";
    this.httpStatus = params.httpStatus ?? 400;
    this.providerReference = params.providerReference;
    this.internalReference = params.internalReference ?? crypto.randomUUID();
    this.timestamp = new Date().toISOString();
  }

  toPublicJSON() {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      reference: this.internalReference,
      timestamp: this.timestamp,
    };
  }
}

export class DomainError extends AppError {
  constructor(code: string, message: string, httpStatus = 400) {
    super({ code, message, category: "DOMAIN", httpStatus });
    this.name = "DomainError";
  }
}

export class RateLimitError extends DomainError {
  readonly retryAfterSec: number;

  constructor(message = "Too many requests. Please wait and try again.", retryAfterSec = 60) {
    super("RATE_LIMITED", message, 429);
    this.retryAfterSec = Math.max(1, retryAfterSec);
    this.name = "RateLimitError";
  }
}

export class IntegrationError extends AppError {
  constructor(code: string, message: string, providerReference?: string, httpStatus = 502) {
    super({
      code,
      message,
      category: "INTEGRATION",
      httpStatus,
      providerReference,
    });
  }
}

export type ProviderErrorDetails = {
  provider: string;
  operation: string;
  correlationId: string;
  providerErrorCode?: string;
  providerReference?: string;
  retryable?: boolean;
  unknownOutcome?: boolean;
};

const PUBLIC_PROVIDER_MESSAGES: Record<string, string> = {
  PROVIDER_TIMEOUT: "The airline system took too long to respond. Please wait — we will confirm the result without charging you twice.",
  PROVIDER_UNAVAILABLE: "Flight results are temporarily unavailable. Please try again in a few minutes.",
  PROVIDER_AUTH: "The airline connection is not available right now.",
  PROVIDER_VALIDATION: "This request could not be sent to the airline. Check the search details and try again.",
  PROVIDER_RATE_LIMIT: "Too many flight searches are in progress. Please wait a moment and try again.",
  PROVIDER_NO_AVAILABILITY: "This fare is no longer available. Search again for current prices.",
  PROVIDER_FARE_CHANGED: "The airline updated this fare. Review the new price before continuing.",
  PROVIDER_BOOKING: "The airline could not confirm this reservation. If you paid, a refund will follow.",
  PROVIDER_TICKETING: "Tickets could not be issued yet. Your payment and reservation are on file.",
  PROVIDER_CANCELLATION: "The airline could not confirm the cancellation yet. We will not send a second cancel blindly.",
  PROVIDER_UNKNOWN: "We could not confirm the airline response. Support has a reference to investigate.",
  PROVIDER_CIRCUIT_OPEN: "The airline connection is paused after repeated failures. Please try again shortly.",
};

export class ProviderError extends IntegrationError {
  readonly provider: string;
  readonly operation: string;
  readonly correlationId: string;
  readonly providerErrorCode?: string;
  readonly retryable: boolean;
  readonly unknownOutcome: boolean;

  constructor(code: keyof typeof PUBLIC_PROVIDER_MESSAGES, details: ProviderErrorDetails, httpStatus = 502) {
    super(code, PUBLIC_PROVIDER_MESSAGES[code] ?? PUBLIC_PROVIDER_MESSAGES.PROVIDER_UNKNOWN, details.providerReference, httpStatus);
    this.name = "ProviderError";
    this.provider = details.provider;
    this.operation = details.operation;
    this.correlationId = details.correlationId;
    this.providerErrorCode = details.providerErrorCode;
    this.retryable = details.retryable ?? false;
    this.unknownOutcome = details.unknownOutcome ?? false;
  }

  toPublicJSON() {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      reference: this.internalReference,
      timestamp: this.timestamp,
    };
  }

  toOpsJSON() {
    return {
      ...this.toPublicJSON(),
      provider: this.provider,
      operation: this.operation,
      correlationId: this.correlationId,
      providerErrorCode: this.providerErrorCode,
      providerReference: this.providerReference,
      retryable: this.retryable,
      unknownOutcome: this.unknownOutcome,
    };
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_TIMEOUT", { ...details, retryable: details.retryable ?? false, unknownOutcome: true }, 504);
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_UNAVAILABLE", { ...details, retryable: true }, 503);
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderAuthenticationError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_AUTH", { ...details, retryable: false }, 502);
    this.name = "ProviderAuthenticationError";
  }
}

export class ProviderValidationError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_VALIDATION", { ...details, retryable: false }, 400);
    this.name = "ProviderValidationError";
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_RATE_LIMIT", { ...details, retryable: true }, 429);
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderNoAvailabilityError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_NO_AVAILABILITY", { ...details, retryable: false }, 409);
    this.name = "ProviderNoAvailabilityError";
  }
}

export class ProviderFareChangedError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_FARE_CHANGED", { ...details, retryable: false }, 409);
    this.name = "ProviderFareChangedError";
  }
}

export class ProviderBookingError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_BOOKING", { ...details, retryable: false }, 502);
    this.name = "ProviderBookingError";
  }
}

export class ProviderTicketingError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_TICKETING", { ...details, retryable: false }, 502);
    this.name = "ProviderTicketingError";
  }
}

export class ProviderCancellationError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_CANCELLATION", { ...details, retryable: false }, 502);
    this.name = "ProviderCancellationError";
  }
}

export class ProviderUnknownError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_UNKNOWN", { ...details, unknownOutcome: true }, 502);
    this.name = "ProviderUnknownError";
  }
}

export class ProviderCircuitOpenError extends ProviderError {
  constructor(details: ProviderErrorDetails) {
    super("PROVIDER_CIRCUIT_OPEN", { ...details, retryable: true }, 503);
    this.name = "ProviderCircuitOpenError";
  }
}

export function isRetryableProviderError(error: unknown) {
  return (
    error instanceof ProviderTimeoutError ||
    error instanceof ProviderUnavailableError ||
    error instanceof ProviderRateLimitError ||
    (error instanceof ProviderError && error.retryable)
  );
}

export function isUnknownProviderOutcome(error: unknown) {
  return error instanceof ProviderError && error.unknownOutcome;
}
