export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Please sign in to continue.") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have permission to perform this action.") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppError(409, "CONFLICT", message, details);
export const tooManyRequests = (message: string, retryAfterSeconds?: number) =>
  new AppError(429, "RATE_LIMITED", message, retryAfterSeconds ? { retryAfterSeconds } : undefined);
export const serviceUnavailable = (message: string) => new AppError(503, "SERVICE_UNAVAILABLE", message);
