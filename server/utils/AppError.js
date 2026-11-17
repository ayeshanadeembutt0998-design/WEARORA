export class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined, code = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
  }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const ok = (res, data = {}, message, status = 200) =>
  res.status(status).json({ success: true, ...(message ? { message } : {}), ...data });
