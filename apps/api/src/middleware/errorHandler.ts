import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      message: "Request failed validation",
      details: err.flatten(),
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal_error", message: "Something went wrong" });
}
