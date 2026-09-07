import { Router, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../services/db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { rateLimit, validateMessageInput } from "../middleware/rateLimit";
import { sendChatMessage, summarizeEntry, ChatTurn } from "../services/gemini";

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.post("/message", rateLimit, validateMessageInput, async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { message, conversationId, boardId } = req.body as {
    message: string;
    conversationId?: string;
    boardId?: string;
  };

  const draftRef = conversationId
    ? db().doc(`users/${uid}/_chatDrafts/${conversationId}`)
    : db().collection(`users/${uid}/_chatDrafts`).doc();

  const existing = conversationId ? (await draftRef.get()).data() : null;
  const history: ChatTurn[] = existing?.history ?? [];

  // Board context re-fetched fresh every turn — never cached — so an item
  // added mid-conversation is visible on the very next turn. Always
  // scoped to this uid's own board.
  let boardContext: string[] | undefined;
  if (boardId) {
    const itemsSnap = await db()
      .collection(`users/${uid}/boards/${boardId}/items`)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    boardContext = itemsSnap.docs
      .map((d) => d.data())
      .filter((item) => item.type === "idea" && item.content)
      .map((item) => item.content as string);
  }

  const reply = await sendChatMessage(history, message, boardContext);

  const updatedHistory: ChatTurn[] = [
    ...history,
    { role: "user", text: message },
    { role: "model", text: reply },
  ];

  await draftRef.set(
    { history: updatedHistory, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  res.json({ conversationId: draftRef.id, reply });
});

chatRouter.post("/end", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { conversationId, save, entryId } = req.body as {
    conversationId: string;
    save: boolean;
    entryId?: string | null;
  };

  if (!conversationId) {
    res.status(400).json({ error: "conversationId is required." });
    return;
  }

  const draftRef = db().doc(`users/${uid}/_chatDrafts/${conversationId}`);
  const draftSnap = await draftRef.get();

  if (!draftSnap.exists) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  if (!save) {
    await draftRef.delete();
    res.json({ saved: false });
    return;
  }

  const history: ChatTurn[] = draftSnap.data()!.history ?? [];
  const fullText = history.map((t) => t.text).join("\n");
  const { summary } = await summarizeEntry(fullText);

  await db().collection(`users/${uid}/gemini_engagements`).add({
    entryId: entryId ?? null,
    transcript: history,
    summary,
    saved: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await draftRef.delete();
  res.json({ saved: true });
});
