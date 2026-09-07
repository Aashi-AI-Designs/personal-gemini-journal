import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAuthedFetchHeaders } from "../lib/firebase";
import { uploadBoardImage } from "../lib/storage";
import { TopBar } from "../components/TopBar";

const API_BASE = "/api";

interface Item {
  id: string;
  type: "idea" | "image";
  content: string | null;
  storagePath: string | null;
  source: "manual" | "gemini-suggested";
}

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
  addedToBoard?: boolean;
}

export function BoardDetail() {
  const { boardId } = useParams<{ boardId: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [newTodo, setNewTodo] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function loadBoardContents() {
    if (!boardId) return;
    const headers = await getAuthedFetchHeaders();
    const res = await fetch(`${API_BASE}/boards/${boardId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
    setTodos(data.todos ?? []);
  }

  useEffect(() => {
    loadBoardContents();
  }, [boardId]);

  // --- Brainstorm chat, scoped to this board ---
  async function sendMessage() {
    if (!input.trim() || !boardId) return;
    const text = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);

    try {
      const headers = await getAuthedFetchHeaders();
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, conversationId, boardId }),
      });
      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "model", text: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "model", text: "Gemini's resting for a bit — try again shortly." }]);
    } finally {
      setSending(false);
    }
  }

  // Confirm-before-add: nothing lands on the board until this is clicked.
  async function addReplyToBoard(index: number) {
    if (!boardId) return;
    const msg = messages[index];
    const headers = await getAuthedFetchHeaders();
    await fetch(`${API_BASE}/boards/${boardId}/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "idea", content: msg.text, source: "gemini-suggested" }),
    });
    setMessages((m) => m.map((x, i) => (i === index ? { ...x, addedToBoard: true } : x)));
    loadBoardContents();
  }

  // --- Manual additions ---
  async function addManualIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdea.trim() || !boardId) return;
    const headers = await getAuthedFetchHeaders();
    await fetch(`${API_BASE}/boards/${boardId}/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "idea", content: newIdea, source: "manual" }),
    });
    setNewIdea("");
    loadBoardContents();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !boardId) return;
    try {
      const { storagePath } = await uploadBoardImage(boardId, file);
      const headers = await getAuthedFetchHeaders();
      await fetch(`${API_BASE}/boards/${boardId}/items`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: "image", storagePath, source: "manual" }),
      });
      loadBoardContents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodo.trim() || !boardId) return;
    const headers = await getAuthedFetchHeaders();
    await fetch(`${API_BASE}/boards/${boardId}/todos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: newTodo }),
    });
    setNewTodo("");
    loadBoardContents();
  }

  async function toggleTodo(todoId: string, done: boolean) {
    const headers = await getAuthedFetchHeaders();
    await fetch(`${API_BASE}/boards/${boardId}/todos/${todoId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ done: !done }),
    });
    loadBoardContents();
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="board-detail-layout">
        <aside className="gemini-panel">
          <div className="gemini-panel-inner">
            <p className="board-brainstorm-label">Brainstorm for this board</p>
            <div className="chat-messages">
              {messages.length === 0 && (
                <p className="chat-empty">Talk through ideas for this board — you can add anything useful straight from the conversation.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`chat-message chat-message-${m.role}`}>
                  {m.text}
                  {m.role === "model" && !m.addedToBoard && (
                    <button className="btn btn-text add-to-board-btn" onClick={() => addReplyToBoard(i)}>
                      + Add to board
                    </button>
                  )}
                  {m.addedToBoard && <span className="added-note">Added ✓</span>}
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Brainstorm out loud..."
                disabled={sending}
              />
              <button className="btn btn-quiet" onClick={sendMessage} disabled={sending}>Send</button>
            </div>
          </div>
        </aside>

        <main className="board-main">
          <section>
            <h2>Ideas &amp; images</h2>
            <form onSubmit={addManualIdea} className="inline-form">
              <input value={newIdea} onChange={(e) => setNewIdea(e.target.value)} placeholder="Add an idea..." />
              <button className="btn btn-quiet" type="submit">Add</button>
              <label className="btn btn-quiet upload-label">
                Upload image
                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
              </label>
            </form>
            <div className="board-items-grid">
              {items.map((item) => (
                <div key={item.id} className="board-item-card">
                  {item.type === "idea" ? <p>{item.content}</p> : <span>[image]</span>}
                  {item.source === "gemini-suggested" && <span className="source-tag">from Gemini</span>}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>To-do</h2>
            <form onSubmit={addTodo} className="inline-form">
              <input value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="Add a task..." />
              <button className="btn btn-quiet" type="submit">Add</button>
            </form>
            <ul className="todo-list">
              {todos.map((t) => (
                <li key={t.id}>
                  <label>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id, t.done)} />
                    <span className={t.done ? "todo-done" : ""}>{t.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
