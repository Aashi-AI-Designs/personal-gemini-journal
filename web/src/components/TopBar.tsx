import { useState } from "react";
import { Link } from "react-router-dom";
import { auth, signOut } from "../lib/firebase";

export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = auth.currentUser?.displayName || auth.currentUser?.email || "";

  return (
    <header className="top-bar">
      <span className="top-bar-title">Personal Gemini Journal</span>

      <div className="top-bar-right">
        <span className="top-bar-user">{displayName}</span>
        <div className="menu-wrapper">
          <button className="btn btn-quiet" onClick={() => setMenuOpen((v) => !v)}>
            Menu ▾
          </button>
          {menuOpen && (
            <nav className="dropdown-menu" onClick={() => setMenuOpen(false)}>
              <Link to="/">Journal</Link>
              <Link to="/boards">Moodboards</Link>
              <Link to="/past">Past entries</Link>
              <hr />
              <button className="btn btn-text" onClick={() => signOut()}>Sign out</button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
