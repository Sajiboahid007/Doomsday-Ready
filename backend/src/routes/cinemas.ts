import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { sendError, isUniqueViolation } from "../lib/errors.js";
import { calculateBooking } from "../algorithms/bookingQuote.js";

const router = Router();

const MAX_BUNDLE_SIZES = 10;

function toCinemaResponse(cinema: { id: number; name: string; bundleSizes: { size: number }[] }) {
  return {
    id: cinema.id,
    name: cinema.name,
    bundleSizes: cinema.bundleSizes.map((b) => b.size).sort((a, b) => a - b),
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const cinemas = await prisma.cinemas.findMany({
      orderBy: { id: "asc" },
      include: { bundleSizes: true },
    });
    res.json(cinemas.map(toCinemaResponse));
  } catch (err) {
    console.error("GET /cinemas failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not load cinemas.");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, bundleSizes } = req.body ?? {};

    if (typeof name !== "string" || name.trim() === "" || name.trim().length > 200) {
      return sendError(res, 400, "VALIDATION_ERROR", "Cinema name is required (max 200 characters).");
    }
    if (!Array.isArray(bundleSizes) || bundleSizes.length === 0) {
      return sendError(res, 400, "VALIDATION_ERROR", "bundleSizes must be a non-empty list of numbers.");
    }
    if (bundleSizes.length > MAX_BUNDLE_SIZES) {
      return sendError(res, 400, "VALIDATION_ERROR", `A cinema can have at most ${MAX_BUNDLE_SIZES} bundle sizes.`);
    }

    const sizes: number[] = bundleSizes;
    if (sizes.some((s) => !Number.isInteger(s) || s < 1 || s > 500)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Each bundle size must be a whole number between 1 and 500.");
    }
    if (new Set(sizes).size !== sizes.length) {
      return sendError(res, 400, "VALIDATION_ERROR", "Bundle sizes must all be different.");
    }

    const cleanName = name.trim();
    const duplicate = await prisma.cinemas.findFirst({ where: { name: cleanName } });
    if (duplicate) {
      return sendError(res, 409, "DUPLICATE_NAME", `A cinema called "${duplicate.name}" already exists.`);
    }

    const cinema = await prisma.cinemas.create({
      data: {
        name: cleanName,
        bundleSizes: { create: sizes.map((size) => ({ size })) },
      },
      include: { bundleSizes: true },
    });

    res.status(201).json(toCinemaResponse(cinema));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return sendError(res, 409, "DUPLICATE_NAME", "A cinema with this name already exists.");
    }
    console.error("POST /cinemas failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not create the cinema.");
  }
});

router.get("/:id/booking", async (req: Request, res: Response) => {
  try {
    const cinemaId = Number(req.params.id);
    if (!Number.isInteger(cinemaId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid cinema id.");
    }

    const groupSize = Number(req.query.groupSize);
    if (req.query.groupSize === undefined || !Number.isInteger(groupSize) || groupSize < 1 || groupSize > 10000) {
      return sendError(res, 400, "VALIDATION_ERROR", "groupSize must be a whole number between 1 and 10,000.");
    }

    const cinema = await prisma.cinemas.findUnique({
      where: { id: cinemaId },
      include: { bundleSizes: true },
    });
    if (!cinema) {
      return sendError(res, 404, "NOT_FOUND", "Cinema not found.");
    }

    const sizes = cinema.bundleSizes.map((b) => b.size);
    res.json(calculateBooking(cinemaId, groupSize, sizes));
  } catch (err) {
    console.error("GET /cinemas/:id/booking failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not calculate the booking.");
  }
});

export default router;
