import { Router, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../services/db";
import { AuthedRequest, requireAuth } from "../middleware/auth";

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

boardsRouter.get("/", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const snap = await db().collection(`users/${uid}/boards`).orderBy("updatedAt", "desc").get();
  res.json({ boards: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
});

boardsRouter.post("/", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { title } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required." });
    return;
  }
  const ref = await db().collection(`users/${uid}/boards`).add({
    title: title.trim(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ id: ref.id });
});

// Single board with its items and todos — powers the board detail page.
boardsRouter.get("/:boardId", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { boardId } = req.params;
  const boardRef = db().doc(`users/${uid}/boards/${boardId}`);

  const [boardSnap, itemsSnap, todosSnap] = await Promise.all([
    boardRef.get(),
    boardRef.collection("items").orderBy("createdAt", "desc").get(),
    boardRef.collection("todos").orderBy("createdAt", "asc").get(),
  ]);

  if (!boardSnap.exists) {
    res.status(404).json({ error: "Board not found." });
    return;
  }

  res.json({
    board: { id: boardSnap.id, ...boardSnap.data() },
    items: itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    todos: todosSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
});

boardsRouter.post("/:boardId/items", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { boardId } = req.params;
  const { type, content, storagePath, source } = req.body ?? {};

  if (type !== "idea" && type !== "image") {
    res.status(400).json({ error: "type must be 'idea' or 'image'." });
    return;
  }

  const boardRef = db().doc(`users/${uid}/boards/${boardId}`);
  const boardSnap = await boardRef.get();
  if (!boardSnap.exists) {
    res.status(404).json({ error: "Board not found." });
    return;
  }

  const itemCount = (await boardRef.collection("items").count().get()).data().count;
  if (itemCount >= 500) {
    res.status(400).json({ error: "This board has reached its item limit." });
    return;
  }

  const itemRef = await boardRef.collection("items").add({
    type,
    content: content ?? null,
    storagePath: storagePath ?? null,
    source: source === "gemini-suggested" ? "gemini-suggested" : "manual",
    createdAt: FieldValue.serverTimestamp(),
  });

  await boardRef.update({ updatedAt: FieldValue.serverTimestamp() });
  res.json({ id: itemRef.id });
});

boardsRouter.post("/:boardId/todos", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { boardId } = req.params;
  const { text } = req.body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required." });
    return;
  }

  const boardRef = db().doc(`users/${uid}/boards/${boardId}`);
  const todoRef = await boardRef.collection("todos").add({
    text: text.trim(),
    done: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  res.json({ id: todoRef.id });
});

boardsRouter.patch("/:boardId/todos/:todoId", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { boardId, todoId } = req.params;
  const { done } = req.body ?? {};

  await db().doc(`users/${uid}/boards/${boardId}/todos/${todoId}`).update({ done: !!done });
  res.json({ ok: true });
});
