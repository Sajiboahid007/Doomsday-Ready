import { useEffect, useState } from "react";
import { getMovies, createMovie, updateMovie } from "../api/client.js";
import Poster from "../components/Poster.jsx";

const emptyForm = {
  title: "",
  releaseYear: "",
  runtimeMinutes: "",
  posterUrl: "",
  watched: false,
  prerequisiteIds: [],
};

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function PrerequisitePicker({ movies, selected, onChange, excludeId }) {
  const options = movies.filter((m) => m.id !== excludeId);
  if (options.length === 0) return <p className="muted">No other movies yet.</p>;

  return (
    <div className="picker">
      {options.map((m) => (
        <label key={m.id}>
          <input
            type="checkbox"
            checked={selected.includes(m.id)}
            onChange={() => onChange(toggleId(selected, m.id))}
          />
          {m.title}
        </label>
      ))}
    </div>
  );
}

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editPrereqs, setEditPrereqs] = useState([]);
  const [editError, setEditError] = useState("");

  async function loadMovies() {
    try {
      setMovies(await getMovies());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovies();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await createMovie({
        title: form.title,
        releaseYear: Number(form.releaseYear),
        runtimeMinutes: Number(form.runtimeMinutes),
        posterUrl: form.posterUrl.trim() || null,
        watched: form.watched,
        prerequisiteIds: form.prerequisiteIds,
      });
      setForm(emptyForm);
      await loadMovies();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleWatched(movie) {
    try {
      await updateMovie(movie.id, { watched: !movie.watched });
      await loadMovies();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditing(movie) {
    setEditingId(movie.id);
    setEditPrereqs(movie.prerequisites.map((p) => p.id));
    setEditError("");
  }

  async function savePrereqs() {
    setEditError("");
    try {
      await updateMovie(editingId, { prerequisiteIds: editPrereqs });
      setEditingId(null);
      await loadMovies();
    } catch (err) {
      setEditError(err.message);
    }
  }

  if (loading) return <p>Loading movies...</p>;

  return (
    <div>
      <section className="card">
        <h2>All movies</h2>
        {error && <p className="error">{error}</p>}
        {movies.length === 0 ? (
          <p className="muted">No movies yet. Add one below.</p>
        ) : (
          <div className="movie-grid">
            {movies.map((movie) => (
              <div key={movie.id} className="movie-card">
                <Poster
                  title={movie.title}
                  year={movie.releaseYear}
                  watched={movie.watched}
                  posterUrl={movie.posterUrl}
                />

                <div className="movie-info">
                  <p className="muted small">{movie.runtimeMinutes} min</p>

                  <label className="inline small">
                    <input type="checkbox" checked={movie.watched} onChange={() => toggleWatched(movie)} />
                    Watched
                  </label>

                  {editingId === movie.id ? (
                    <div>
                      <p className="label">Watch first:</p>
                      <PrerequisitePicker
                        movies={movies}
                        selected={editPrereqs}
                        onChange={setEditPrereqs}
                        excludeId={movie.id}
                      />
                      {editError && <p className="error">{editError}</p>}
                      <div className="row">
                        <button onClick={savePrereqs}>Save</button>
                        <button className="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="label">Watch first:</p>
                      {movie.prerequisites.length > 0 ? (
                        <div className="chips">
                          {movie.prerequisites.map((p) => (
                            <span key={p.id} className="chip">
                              {p.title}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted small">Nothing, start here</p>
                      )}
                      <button className="secondary small-btn" onClick={() => startEditing(movie)}>
                        Edit prerequisites
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Add a movie</h2>
        <form onSubmit={handleAdd}>
          <div className="fields">
            <label>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>
            <label>
              Release year
              <input
                type="number"
                min="1900"
                max="2100"
                value={form.releaseYear}
                onChange={(e) => setForm({ ...form, releaseYear: e.target.value })}
                required
              />
            </label>
            <label>
              Runtime (minutes)
              <input
                type="number"
                min="1"
                max="300"
                value={form.runtimeMinutes}
                onChange={(e) => setForm({ ...form, runtimeMinutes: e.target.value })}
                required
              />
            </label>
            <label>
              Poster image URL (optional)
              <input
                type="url"
                value={form.posterUrl}
                onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
                placeholder="https://..."
              />
            </label>
          </div>

          <label className="inline">
            <input
              type="checkbox"
              checked={form.watched}
              onChange={(e) => setForm({ ...form, watched: e.target.checked })}
            />
            Already watched
          </label>

          <p className="label">Movies to watch before this one</p>
          <PrerequisitePicker
            movies={movies}
            selected={form.prerequisiteIds}
            onChange={(ids) => setForm({ ...form, prerequisiteIds: ids })}
          />

          {formError && <p className="error">{formError}</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Add movie"}
          </button>
        </form>
      </section>
    </div>
  );
}
