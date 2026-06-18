import express from "express";
import cors from "cors";
import { AppError } from "./errors.js";
import { errorMiddleware } from "./middleware/error.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { labelsRouter } from "./routes/labels.js";
import { githubRouter } from "./github/routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/tasks", tasksRouter);
  app.use("/projects", projectsRouter);
  app.use("/labels", labelsRouter);
  app.use("/github", githubRouter);

  app.use((_req, _res, next) => next(new AppError(404, "Not found")));
  app.use(errorMiddleware);
  return app;
}
