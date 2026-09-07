import { Router, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../services/db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { summarizeEntry, isContentWorthSearching, generateFunFact } from "../services/gemini";
import { stage1LocalFilter } from "../services/triggerFunnel";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

entriesRouter.post("/check-connection", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { draftText } = req.body ?? {};

  if (typeof draftText !== "string") {
    res.status(400).json({ error: "draftText is required." });
    return;
  }

  const stage1 = stage1LocalFilter(draftText);
  if (!stage1.proceed) {
    res.json({ suggestion: null });
    return;
  }

  const worthSearching = await isContentWorthSearching(draftText);
  if (!worthSearching) {
    res.json({ suggestion: null });
    return;
  }

  const past = await db()
    .collection(`users/${uid}/entries`)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const match = past.docs.find((d) => {
    const summary: string = d.data().summary ?? "";
    return summary.length > 0 && draftText.toLowerCase().includes(summary.slice(0, 12).toLowerCase());
  });

  if (match) {
    res.json({
      suggestion: {
        type: "connection",
        entryId: match.id,
        title: match.data().title,
        date: match.data().createdAt,
      },
    });
    return;
  }

  // No past-entry connection — fall back to a lightweight, ungrounded
  // conversation-starter rather than staying silent.
  const funFact = await generateFunFact(draftText);
  res.json({ suggestion: { type: "fun_fact", text: funFact } });
});

entriesRouter.post("/", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { draftText, entryId } = req.body ?? {};

  if (typeof draftText !== "string" || draftText.trim().length === 0) {
    res.status(400).json({ error: "draftText is required." });
    return;
  }

  const { summary, themes } = await summarizeEntry(draftText);

  const collection = db().collection(`users/${uid}/entries`);
  const ref = entryId ? collection.doc(entryId) : collection.doc();

  await ref.set(
    {
      draftText,
      summary,
      themes,
      updatedAt: FieldValue.serverTimestamp(),
      ...(entryId ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  let suggestion = null;
  const stage1 = stage1LocalFilter(draftText);
  if (stage1.proceed && (await isContentWorthSearching(draftText))) {
    suggestion = { note: "This may connect to a past entry — check the Gemini panel." };
  }

  res.json({ id: ref.id, summary, themes, suggestion });
});

entriesRouter.get("/", async (req: AuthedRequest, res: Response) => {
  const uid = req.uid!;
  const { granularity } = req.query;

  const snap = await db()
    .collection(`users/${uid}/entries`)
    .orderBy("createdAt", "desc")
    .get();

  res.json({
    entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    granularity: granularity ?? "month",
  });
});
