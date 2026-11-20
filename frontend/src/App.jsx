import { useState } from "react";
import Movies from "./pages/Movies.jsx";
import RewatchPlan from "./pages/RewatchPlan.jsx";
import Booking from "./pages/Booking.jsx";

const tabs = [
  { id: "movies", label: "Movies" },
  { id: "plan", label: "Rewatch Plan" },
  { id: "booking", label: "Watch Party" },
];

export default function App() {
  const [tab, setTab] = useState("movies");

  return (
    <div className="app">
      <header>
        <h1>Doomsday Ready</h1>
        <p className="subtitle">Plan your MCU rewatch and book the opening night.</p>
        <nav>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "movies" && <Movies />}
        {tab === "plan" && <RewatchPlan />}
        {tab === "booking" && <Booking />}
      </main>
    </div>
  );
}
