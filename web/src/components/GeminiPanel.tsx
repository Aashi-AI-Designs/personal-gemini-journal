import { useState } from "react";
import { getAuthedFetchHeaders } from "../lib/firebase";

const API_BASE = "/api";

interface Suggestion {
  type: "connection" | "fun_fact";
  entryId?: string;
  title?: string;
  date?: string;
  text?: string;
}

interface Message {
  role: "user" | "model";
  text: string;
}

interface Props {
  entryId: string | null;
  suggestion: Suggestion | null;
  onDismissSuggestion: () => void;
}

export function GeminiPanel({ entryId, suggestion, onDismissSuggestion }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);

    try {
      const headers = await getAuthedFetchHeaders();
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "model", text: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "model", text: "Gemini's resting for a bit — try again in a moment." }]);
    } finally {
      setSending(false);
    }
  }

  async function endConversation(save: boolean) {
    if (conversationId) {
      const headers = await getAuthedFetchHeaders();
      await fetch(`${API_BASE}/chat/end`, {
        method: "POST",
        headers,
        body: JSON.stringify({ conversationId, save, entryId }),
      });
    }
    setMessages([]);
    setConversationId(null);
    setShowEndConfirm(false);
  }

  return (
    <div className="gemini-panel-inner">
      {suggestion && (
        <div className="suggestion-card">
          {suggestion.type === "connection" ? (
            <>
              <p>🔗 This connects to something you wrote on {suggestion.date}: "{suggestion.title}"</p>
              <div className="suggestion-actions">
                <button className="btn btn-quiet">Show me</button>
                <button className="btn btn-quiet" onClick={onDismissSuggestion}>Not now</button>
              </div>
            </>
          ) : (
            <>
              <p>💡 {suggestion.text}</p>
              <div className="suggestion-actions">
                <button className="btn btn-quiet" onClick={onDismissSuggestion}>Dismiss</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">Talk something through, brainstorm, or ask a question.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-message chat-message-${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask Gemini anything..."
          disabled={sending}
        />
        <button className="btn btn-quiet" onClick={sendMessage} disabled={sending}>Send</button>
      </div>

      {messages.length > 0 && (
        <button className="btn btn-text" onClick={() => setShowEndConfirm(true)}>
          End conversation
        </button>
      )}

      {showEndConfirm && (
        <div className="end-confirm-modal">
          <p>Save this conversation?</p>
          <div className="end-confirm-actions">
            <button className="btn btn-primary" onClick={() => endConversation(true)}>Save</button>
            <button className="btn btn-quiet" onClick={() => endConversation(false)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
