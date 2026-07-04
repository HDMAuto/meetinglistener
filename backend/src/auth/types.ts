// Augment Express's Request so req.userId / req.userRole are typed everywhere.
import "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    userRole?: string;
  }
}