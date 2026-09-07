import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuthedFetchHeaders } from "../lib/firebase";
import { TopBar } from "../components/TopBar";

const API_BASE = "/api";

interface Board {
  id: string;
  title: string;
}

export function Boards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [newTitle, setNewTitle] = useState("");

  async function loadBoards() {
    const headers = await getAuthedFetchHeaders();
    const res = await fetch(`${API_BASE}/boards`, { headers });
    const data = await res.json();
    setBoards(data.boards ?? []);
  }

  useEffect(() => {
    loadBoards();
  }, []);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const headers = await getAuthedFetchHeaders();
    await fetch(`${API_BASE}/boards`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: newTitle }),
    });
    setNewTitle("");
    loadBoards();
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="boards-page">
        <form onSubmit={createBoard} className="new-board-form">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New board — planning an event, writing a book, anything..."
          />
          <button className="btn btn-primary" type="submit">Create board</button>
        </form>

        {boards.length === 0 && (
          <p className="empty-state">No boards yet. Start one for whatever you're working on.</p>
        )}

        <div className="board-grid">
          {boards.map((b) => (
            <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
              <h3>{b.title}</h3>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
