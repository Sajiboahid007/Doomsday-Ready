import { useEffect, useState } from "react";
import { getMovies, getRewatchOrder, updateMovie } from "../api/client.js";
import Poster from "../components/Poster.jsx";

function formatRuntime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RewatchPlan() {
  const [movies, setMovies] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMovies()
      .then((list) => {
        setMovies(list);
        // Default to Doomsday if it exists, otherwise the newest movie.
        const doomsday = list.find((m) => m.title === "Avengers: Doomsday");
        const defaultMovie = doomsday || list[list.length - 1];
        if (defaultMovie) setTargetId(String(defaultMovie.id));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function loadPlan(id) {
    try {
      setPlan(await getRewatchOrder(id));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (targetId) loadPlan(targetId);
  }, [targetId]);

  function posterFor(id) {
    return movies.find((m) => m.id === id)?.posterUrl;
  }

  async function toggleWatched(movie) {
    try {
      await updateMovie(movie.id, { watched: !movie.watched });
      await loadPlan(targetId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Rewatch plan</h2>
      <label>
        I want to be ready for
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      {plan && (
        <>
          <div className="stats">
            <div>
              <strong>{plan.totalCount}</strong>
              <span>movies to watch first</span>
            </div>
            <div>
              <strong>
                {plan.watchedCount} / {plan.totalCount}
              </strong>
              <span>already watched</span>
            </div>
            <div>
              <strong>{formatRuntime(plan.remainingRuntimeMinutes)}</strong>
              <span>left to watch</span>
            </div>
          </div>

          {plan.totalCount > 0 && (
            <div className="progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(plan.watchedCount / plan.totalCount) * 100}%` }}
                />
              </div>
              <span className="progress-text">
                {plan.watchedCount} of {plan.totalCount} watched
              </span>
            </div>
          )}

          {plan.movies.length === 0 ? (
            <p className="muted">Nothing to watch first. You can go straight to {plan.target.title}.</p>
          ) : (
            <ol className="plan">
              {plan.movies.map((movie) => (
                <li key={movie.id} className={movie.watched ? "done" : ""}>
                  <Poster title={movie.title} posterUrl={posterFor(movie.id)} small />
                  <label className="inline">
                    <input type="checkbox" checked={movie.watched} onChange={() => toggleWatched(movie)} />
                    {movie.title}
                  </label>
                  <span className="muted">{movie.runtimeMinutes} min</span>
                </li>
              ))}
              <li className="target">
                <Poster title={plan.target.title} posterUrl={posterFor(plan.target.id)} small />
                <span>{plan.target.title}</span>
              </li>
            </ol>
          )}
        </>
      )}
    </section>
  );
}
