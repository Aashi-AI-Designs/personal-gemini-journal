import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import { entriesRouter } from "./routes/entries";
import { chatRouter } from "./routes/chat";
import { boardsRouter } from "./routes/boards";

initializeApp();

//export { enforceAllowlist } from "./auth-triggers";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/entries", entriesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/boards", boardsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(JSON.stringify({ event: "unhandled_error", message: err.message }));
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export const journalApi = onRequest(
  { maxInstances: 10, timeoutSeconds: 30, secrets: ["personal-journal-gemini-key"] }, 
  app
);
