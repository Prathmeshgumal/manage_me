import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { AppError } from "./errors.js";
import { errorMiddleware } from "./middleware/error.js";
import { authRouter } from "./auth/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { labelsRouter } from "./routes/labels.js";
import { githubRouter } from "./github/routes.js";
import { libraryRouter } from "./routes/library.js";

export function createApp() {
  const app = express();
  // In production, lock CORS to the deployed frontend; in dev/test reflect the
  // request origin so local frontends (and the test runner) work without config.
  const corsOrigin = process.env.NODE_ENV === "production" ? (process.env.FRONTEND_URL ?? true) : true;
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/tasks", requireAuth, tasksRouter);
  app.use("/projects", requireAuth, projectsRouter);
  app.use("/labels", requireAuth, labelsRouter);
  app.use("/github", requireAuth, githubRouter);
  app.use(requireAuth, libraryRouter);

  app.use((_req, _res, next) => next(new AppError(404, "Not found")));
  app.use(errorMiddleware);
  return app;
}
