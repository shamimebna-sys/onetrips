import { DomainError } from "@onetrips/shared";

export class AuthError extends DomainError {
  constructor(code: string, message: string, httpStatus = 401) {
    super(code, message, httpStatus);
    this.name = "AuthError";
  }
}
