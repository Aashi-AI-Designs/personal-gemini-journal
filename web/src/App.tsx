import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { User } from "firebase/auth";
import { onAuthChange } from "./lib/firebase";
import { SignIn } from "./pages/SignIn";
import { Journal } from "./pages/Journal";
import { PastEntries } from "./pages/PastEntries";
import { Boards } from "./pages/Boards";
import { BoardDetail } from "./pages/BoardDetail";
import "./styles/app.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return null; // avoid a flash of the sign-in screen while checking session

  if (!user) return <SignIn />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Journal />} />
        <Route path="/past" element={<PastEntries />} />
        <Route path="/boards" element={<Boards />} />
        <Route path="/boards/:boardId" element={<BoardDetail />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
