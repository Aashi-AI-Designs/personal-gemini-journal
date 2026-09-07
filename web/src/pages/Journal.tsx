import { useRef, useState, useEffect, useCallback } from "react";
import { getAuthedFetchHeaders } from "../lib/firebase";
import { TriggerFunnel } from "../lib/triggerFunnel";
import { TopBar } from "../components/TopBar";
import { GeminiPanel } from "../components/GeminiPanel";

const API_BASE = "/api";

interface Suggestion {
  type: "connection" | "fun_fact";
  entryId?: string;
  title?: string;
  date?: string;
  text?: string;
}

export function Journal() {
  const [draftText, setDraftText] = useState("");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const funnelRef = useRef(new TriggerFunnel());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkForConnection = useCallback(async (text: string) => {
    try {
      const headers = await getAuthedFetchHeaders();
      const res = await fetch(`${API_BASE}/entries/check-connection`, {
        method: "POST",
        headers,
        body: JSON.stringify({ draftText: text }),
      });
      const data = await res.json();
      if (data.suggestion) setSuggestion(data.suggestion);
    } catch {
      // Ambient feature — fail silently, never interrupt writing with an error.
    }
  }, []);

  function handleChange(text: string) {
    setDraftText(text);
    setSavedNote(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (funnelRef.current.shouldFire(text)) {
        checkForConnection(text);
      }
    }, 2500); // debounce: only evaluate after a real pause
  }

  async function handleSave() {
    if (!draftText.trim()) return;
    setSaving(true);
    try {
      const headers = await getAuthedFetchHeaders();
      const res = await fetch(`${API_BASE}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify({ draftText, entryId }),
      });
      const data = await res.json();
      setEntryId(data.id);
      funnelRef.current.resetOnSave(draftText);
      setSavedNote("Saved");
      if (data.suggestion) {
        // save-time fallback surfaced a connection for a short entry
        checkForConnection(draftText);
      }
    } catch {
      setSavedNote("Couldn't save just now — your writing is still here, try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="journal-layout">
        <aside className="gemini-panel">
          <GeminiPanel
            entryId={entryId}
            suggestion={suggestion}
            onDismissSuggestion={() => setSuggestion(null)}
          />
        </aside>

        <main className="journal-panel">
          <textarea
            className="journal-textarea"
            placeholder="Start writing — Gemini's here if it notices something worth connecting."
            value={draftText}
            onChange={(e) => handleChange(e.target.value)}
            autoFocus
          />
          <div className="journal-footer">
            {savedNote && <span className="saved-note">{savedNote}</span>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save entry"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
