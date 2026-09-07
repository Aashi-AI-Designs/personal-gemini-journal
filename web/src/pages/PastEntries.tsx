import { useEffect, useState } from "react";
import { getAuthedFetchHeaders } from "../lib/firebase";
import { TopBar } from "../components/TopBar";

const API_BASE = "/api";

type Granularity = "day" | "month" | "year";

interface Entry {
  id: string;
  title?: string;
  summary?: string;
  createdAt?: { _seconds: number };
}

function groupKey(entry: Entry, granularity: Granularity): string {
  if (!entry.createdAt) return "Unknown";
  const date = new Date(entry.createdAt._seconds * 1000);
  if (granularity === "year") return date.getFullYear().toString();
  if (granularity === "month") return date.toLocaleString("default", { month: "long", year: "numeric" });
  return date.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" });
}

export function PastEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [granularity, setGranularity] = useState<Granularity>("month");

  useEffect(() => {
    (async () => {
      const headers = await getAuthedFetchHeaders();
      const res = await fetch(`${API_BASE}/entries`, { headers });
      const data = await res.json();
      setEntries(data.entries ?? []);
    })();
  }, []);

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const key = groupKey(e, granularity);
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="app-shell">
      <TopBar />
      <div className="past-entries-page">
        <div className="granularity-toggle">
          {(["day", "month", "year"] as Granularity[]).map((g) => (
            <button
              key={g}
              className={`btn btn-quiet ${granularity === g ? "active" : ""}`}
              onClick={() => setGranularity(g)}
            >
              {g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {Object.entries(grouped).length === 0 && (
          <p className="empty-state">Nothing here yet — your entries will appear once you save one.</p>
        )}

        {Object.entries(grouped).map(([group, groupEntries]) => (
          <section key={group} className="entry-group">
            <h2>{group}</h2>
            {groupEntries.map((e) => (
              <div key={e.id} className="entry-row">
                <span className="entry-summary">{e.summary || "(no summary yet)"}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
