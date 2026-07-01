// Augment Express's Request so req.userId is typed everywhere.
import "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}