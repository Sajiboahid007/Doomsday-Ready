import { useEffect, useState } from "react";
import { getCinemas, createCinema, deleteCinema, getBookingQuote } from "../api/client.js";

export default function Booking() {
  const [cinemas, setCinemas] = useState([]);
  const [error, setError] = useState("");

  const [cinemaId, setCinemaId] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");

  const [name, setName] = useState("");
  const [sizesText, setSizesText] = useState("");
  const [addError, setAddError] = useState("");

  async function loadCinemas() {
    try {
      const list = await getCinemas();
      setCinemas(list);
      // Keep the selected cinema if it still exists, otherwise pick the first one.
      setCinemaId((current) =>
        list.some((c) => String(c.id) === current) ? current : list.length > 0 ? String(list[0].id) : ""
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(cinema) {
    if (!window.confirm(`Delete "${cinema.name}"?`)) return;
    try {
      await deleteCinema(cinema.id);
      if (String(cinema.id) === cinemaId) setQuote(null);
      await loadCinemas();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCinemas();
  }, []);

  async function handleQuote(e) {
    e.preventDefault();
    setQuote(null);
    setQuoteError("");
    try {
      setQuote(await getBookingQuote(cinemaId, groupSize));
    } catch (err) {
      setQuoteError(err.message);
    }
  }

  async function handleAddCinema(e) {
    e.preventDefault();
    setAddError("");

    const bundleSizes = sizesText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number);

    try {
      await createCinema({ name, bundleSizes });
      setName("");
      setSizesText("");
      await loadCinemas();
    } catch (err) {
      setAddError(err.message);
    }
  }

  const selectedCinema = cinemas.find((c) => String(c.id) === cinemaId);

  return (
    <div>
      <section className="card">
        <h2>Book a watch party</h2>
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleQuote}>
          <div className="fields">
            <label>
              Cinema
              <select value={cinemaId} onChange={(e) => setCinemaId(e.target.value)} required>
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Group size
              <input
                type="number"
                min="1"
                max="10000"
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
                required
              />
            </label>
          </div>
          {selectedCinema && (
            <p className="muted">Sells seats in bundles of {selectedCinema.bundleSizes.join(", ")}.</p>
          )}
          <button type="submit" disabled={!cinemaId}>
            Get quote
          </button>
        </form>

        {quoteError && <p className="error">{quoteError}</p>}

        {quote && quote.possible && (
          <div className="result success">
            <p>
              Buy <strong>{quote.totalBundles}</strong> bundle{quote.totalBundles > 1 ? "s" : ""} for{" "}
              {quote.groupSize} people:
            </p>
            <ul>
              {quote.bundles.map((b) => (
                <li key={b.size}>
                  {b.count} × bundle of {b.size}
                </li>
              ))}
            </ul>
          </div>
        )}

        {quote && !quote.possible && (
          <div className="result fail">
            <strong>Not possible.</strong> {quote.message}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Cinemas</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Bundle sizes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cinemas.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.bundleSizes.join(", ")}</td>
                <td className="actions-cell">
                  <button className="danger small-btn" onClick={() => handleDelete(c)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Add a cinema</h3>
        <form onSubmit={handleAddCinema}>
          <div className="fields">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Bundle sizes (comma separated)
              <input
                value={sizesText}
                onChange={(e) => setSizesText(e.target.value)}
                placeholder="6, 9, 20"
                required
              />
            </label>
          </div>
          {addError && <p className="error">{addError}</p>}
          <button type="submit">Add cinema</button>
        </form>
      </section>
    </div>
  );
}
