import type { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 ignores rejected promises from async handlers; this forwards
// them to the error middleware instead of leaving an unhandled rejection.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
