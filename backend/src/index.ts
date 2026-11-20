import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import moviesRouter from "./routes/movies.js";
import cinemasRouter from "./routes/cinemas.js";
import { sendError } from "./lib/errors.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api/movies", moviesRouter);
app.use("/api/cinemas", cinemasRouter);

app.use((req: Request, res: Response) => {
  sendError(res, 404, "NOT_FOUND", `Cannot ${req.method} ${req.path}`);
});

// Catches broken JSON bodies and anything else that slips through the routes.
app.use((err: Error & { type?: string }, req: Request, res: Response, next: NextFunction) => {
  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "VALIDATION_ERROR", "Request body is not valid JSON.");
  }
  console.error(err);
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong.");
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other server or set a different PORT in .env.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
