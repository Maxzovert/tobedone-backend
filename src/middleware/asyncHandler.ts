import { RequestHandler } from "express";

/** Catches async route errors and forwards them to Express errorHandler. */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
