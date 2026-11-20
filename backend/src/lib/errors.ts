import { Response } from "express";
import { Prisma } from "@prisma/client";

export function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

// True when the database rejected a row because of a UNIQUE constraint.
// This can still happen after our own duplicate check if two requests arrive at the same time.
export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
