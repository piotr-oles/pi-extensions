import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import pino from "pino";

export type CommentsHandler = (
  comments: Array<{ quote: string; comment: string; timestamp: string }>,
) => void;

export interface ReviewServerOptions {
  filePath: string;
  appDistPath: string;
  allowedOrigin?: string;
  onComments: CommentsHandler;
}

export function createReviewServer(options: ReviewServerOptions) {
  const { filePath, appDistPath, allowedOrigin, onComments } = options;
  const logger = pino({ name: "review-server" });

  const app = express();

  if (allowedOrigin) {
    app.use(
      cors({
        origin: allowedOrigin,
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
      }),
    );
  }
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/api/content", async (_req: Request, res: Response) => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      logger.info({ filePath }, "served content");
      res.json({ content, file: filePath });
    } catch (err) {
      logger.error({ err, filePath }, "failed to read file");
      res.status(404).json({ error: "file not found" });
    }
  });

  app.post("/api/comments", (req: Request, res: Response) => {
    const body = req.body as { file?: string; comments?: unknown };
    if (!Array.isArray(body.comments)) {
      res.status(400).json({ error: "comments must be an array" });
      return;
    }
    const comments = body.comments.filter(
      (c): c is { quote: string; comment: string; timestamp: string } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).quote === "string" &&
        typeof (c as Record<string, unknown>).comment === "string",
    );
    logger.info({ count: comments.length, file: body.file }, "received comments");
    onComments(comments);
    res.json({ ok: true, received: comments.length });
  });

  app.use(express.static(appDistPath));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "unhandled error");
    res.status(500).json({ error: "internal server error" });
  });

  const server = createServer(app);

  function shutdown(): Promise<void> {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info("server closed");
        resolve();
      });
    });
  }

  return { server, shutdown };
}
