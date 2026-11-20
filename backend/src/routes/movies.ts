import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { sendError, isUniqueViolation } from "../lib/errors.js";
import { checkForCycle } from "../algorithms/cycleCheck.js";
import { calculateRewatchOrder } from "../algorithms/rewatchOrder.js";

const router = Router();

const withPrerequisites = {
  prerequisites: {
    include: { prerequisite: { select: { id: true, title: true } } },
  },
};

type MovieWithPrerequisites = {
  id: number;
  title: string;
  releaseYear: number;
  runtimeMinutes: number;
  watched: boolean;
  posterUrl: string | null;
  prerequisites: { prerequisite: { id: number; title: string } }[];
};

function toMovieResponse(movie: MovieWithPrerequisites) {
  return {
    id: movie.id,
    title: movie.title,
    releaseYear: movie.releaseYear,
    runtimeMinutes: movie.runtimeMinutes,
    watched: movie.watched,
    posterUrl: movie.posterUrl,
    prerequisites: movie.prerequisites.map((p) => p.prerequisite),
  };
}

// posterUrl is optional. Empty or null means "no poster"; otherwise it must be an http(s) link.
function parsePosterUrl(value: unknown): { ok: boolean; url: string | null } {
  if (value === null || value === undefined || value === "") return { ok: true, url: null };
  if (typeof value !== "string" || value.length > 500 || !/^https?:\/\/\S+$/.test(value.trim())) {
    return { ok: false, url: null };
  }
  return { ok: true, url: value.trim() };
}

const MAX_TITLE_LENGTH = 200;

function isValidTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.trim().length <= MAX_TITLE_LENGTH;
}

function isValidYear(value: unknown) {
  return Number.isInteger(value) && (value as number) >= 1900 && (value as number) <= 2100;
}

function isValidRuntime(value: unknown) {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 300;
}

// Returns a clean list of unique ids, or null if the input is not a list of whole numbers.
function parseIdList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.some((id) => !Number.isInteger(id) || id < 1)) return null;
  return [...new Set(value as number[])];
}

// Returns the first id that does not exist in the movies table, or null if all exist.
async function findMissingMovieId(ids: number[]) {
  if (ids.length === 0) return null;
  const found = await prisma.movies.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((m) => m.id));
  return ids.find((id) => !foundIds.has(id)) ?? null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const movies = await prisma.movies.findMany({
      orderBy: [{ releaseYear: "asc" }, { id: "asc" }],
      include: withPrerequisites,
    });
    res.json(movies.map(toMovieResponse));
  } catch (err) {
    console.error("GET /movies failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not load movies.");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, releaseYear, runtimeMinutes, prerequisiteIds = [], watched = false, posterUrl } = req.body ?? {};

    if (!isValidTitle(title)) {
      return sendError(res, 400, "VALIDATION_ERROR", `Title is required (max ${MAX_TITLE_LENGTH} characters).`);
    }
    if (!isValidYear(releaseYear)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Release year must be a whole number between 1900 and 2100.");
    }
    if (!isValidRuntime(runtimeMinutes)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Runtime must be a whole number between 1 and 300 minutes.");
    }
    if (typeof watched !== "boolean") {
      return sendError(res, 400, "VALIDATION_ERROR", "Watched must be true or false.");
    }

    const poster = parsePosterUrl(posterUrl);
    if (!poster.ok) {
      return sendError(res, 400, "VALIDATION_ERROR", "posterUrl must be an http(s) link (max 500 characters).");
    }

    const prereqIds = parseIdList(prerequisiteIds);
    if (!prereqIds) {
      return sendError(res, 400, "VALIDATION_ERROR", "prerequisiteIds must be a list of movie ids.");
    }

    const missingId = await findMissingMovieId(prereqIds);
    if (missingId !== null) {
      return sendError(res, 400, "VALIDATION_ERROR", `Prerequisite movie with id ${missingId} does not exist.`);
    }

    // SQL Server's default collation is case-insensitive, so "iron man" matches "Iron Man".
    const cleanTitle = title.trim();
    const duplicate = await prisma.movies.findFirst({ where: { title: cleanTitle } });
    if (duplicate) {
      return sendError(res, 409, "DUPLICATE_TITLE", `A movie called "${duplicate.title}" already exists.`);
    }

    const movie = await prisma.movies.create({
      data: {
        title: cleanTitle,
        releaseYear,
        runtimeMinutes,
        watched,
        posterUrl: poster.url,
        prerequisites: {
          create: prereqIds.map((id) => ({ prerequisiteId: id })),
        },
      },
      include: withPrerequisites,
    });

    res.status(201).json(toMovieResponse(movie));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return sendError(res, 409, "DUPLICATE_TITLE", "A movie with this title already exists.");
    }
    console.error("POST /movies failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not create the movie.");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isInteger(movieId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid movie id.");
    }

    const movie = await prisma.movies.findUnique({ where: { id: movieId } });
    if (!movie) {
      return sendError(res, 404, "NOT_FOUND", "Movie not found.");
    }

    const { title, releaseYear, runtimeMinutes, watched, prerequisiteIds, posterUrl } = req.body ?? {};
    const changes: {
      title?: string;
      releaseYear?: number;
      runtimeMinutes?: number;
      watched?: boolean;
      posterUrl?: string | null;
    } = {};

    if (posterUrl !== undefined) {
      const poster = parsePosterUrl(posterUrl);
      if (!poster.ok) {
        return sendError(res, 400, "VALIDATION_ERROR", "posterUrl must be an http(s) link (max 500 characters).");
      }
      changes.posterUrl = poster.url;
    }

    if (title !== undefined) {
      if (!isValidTitle(title)) {
        return sendError(res, 400, "VALIDATION_ERROR", `Title cannot be empty (max ${MAX_TITLE_LENGTH} characters).`);
      }
      const duplicate = await prisma.movies.findFirst({
        where: { title: title.trim(), NOT: { id: movieId } },
      });
      if (duplicate) {
        return sendError(res, 409, "DUPLICATE_TITLE", `A movie called "${duplicate.title}" already exists.`);
      }
      changes.title = title.trim();
    }

    if (releaseYear !== undefined) {
      if (!isValidYear(releaseYear)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Release year must be a whole number between 1900 and 2100.");
      }
      changes.releaseYear = releaseYear;
    }

    if (runtimeMinutes !== undefined) {
      if (!isValidRuntime(runtimeMinutes)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Runtime must be a whole number between 1 and 300 minutes.");
      }
      changes.runtimeMinutes = runtimeMinutes;
    }

    if (watched !== undefined) {
      if (typeof watched !== "boolean") {
        return sendError(res, 400, "VALIDATION_ERROR", "Watched must be true or false.");
      }
      changes.watched = watched;
    }

    let newPrereqIds: number[] | null = null;
    if (prerequisiteIds !== undefined) {
      newPrereqIds = parseIdList(prerequisiteIds);
      if (!newPrereqIds) {
        return sendError(res, 400, "VALIDATION_ERROR", "prerequisiteIds must be a list of movie ids.");
      }

      const missingId = await findMissingMovieId(newPrereqIds);
      if (missingId !== null) {
        return sendError(res, 400, "VALIDATION_ERROR", `Prerequisite movie with id ${missingId} does not exist.`);
      }

      const edges = await prisma.moviePrerequisites.findMany();
      const allMovies = await prisma.movies.findMany({ select: { id: true, title: true } });
      const titles = new Map(allMovies.map((m) => [m.id, m.title]));

      const cycle = checkForCycle(movieId, newPrereqIds, edges, titles);
      if (cycle.hasCycle) {
        return sendError(res, 409, "CIRCULAR_DEPENDENCY", cycle.message!);
      }
    }

    // Save the field changes and the new prerequisite list together.
    const updated = await prisma.$transaction(async (tx) => {
      if (newPrereqIds) {
        await tx.moviePrerequisites.deleteMany({ where: { movieId } });
        await tx.moviePrerequisites.createMany({
          data: newPrereqIds.map((id) => ({ movieId, prerequisiteId: id })),
        });
      }
      return tx.movies.update({
        where: { id: movieId },
        data: { ...changes, updatedAt: new Date() },
        include: withPrerequisites,
      });
    });

    res.json(toMovieResponse(updated));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return sendError(res, 409, "DUPLICATE_TITLE", "A movie with this title already exists.");
    }
    console.error("PATCH /movies/:id failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not update the movie.");
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isInteger(movieId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid movie id.");
    }

    const movie = await prisma.movies.findUnique({ where: { id: movieId } });
    if (!movie) {
      return sendError(res, 404, "NOT_FOUND", "Movie not found.");
    }

    // Remove this movie from other movies' prerequisite lists, then delete it.
    // Its own prerequisite rows are removed by the cascade on movieId.
    await prisma.$transaction([
      prisma.moviePrerequisites.deleteMany({ where: { prerequisiteId: movieId } }),
      prisma.movies.delete({ where: { id: movieId } }),
    ]);

    res.status(204).end();
  } catch (err) {
    console.error("DELETE /movies/:id failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not delete the movie.");
  }
});

router.get("/:id/rewatch-order", async (req: Request, res: Response) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isInteger(movieId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid movie id.");
    }

    const target = await prisma.movies.findUnique({
      where: { id: movieId },
      select: { id: true, title: true },
    });
    if (!target) {
      return sendError(res, 404, "NOT_FOUND", "Movie not found.");
    }

    const allMovies = await prisma.movies.findMany({
      select: { id: true, title: true, runtimeMinutes: true, watched: true },
    });
    const edges = await prisma.moviePrerequisites.findMany();

    res.json(calculateRewatchOrder(target, allMovies, edges));
  } catch (err) {
    console.error("GET /movies/:id/rewatch-order failed:", err);
    sendError(res, 500, "INTERNAL_ERROR", "Could not build the rewatch order.");
  }
});

export default router;
