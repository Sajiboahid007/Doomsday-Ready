const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

export function getMovies() {
  return request("/movies");
}

export function createMovie(movie) {
  return request("/movies", { method: "POST", body: JSON.stringify(movie) });
}

export function updateMovie(id, changes) {
  return request(`/movies/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
}

export function getRewatchOrder(id) {
  return request(`/movies/${id}/rewatch-order`);
}

export function getCinemas() {
  return request("/cinemas");
}

export function createCinema(cinema) {
  return request("/cinemas", { method: "POST", body: JSON.stringify(cinema) });
}

export function getBookingQuote(cinemaId, groupSize) {
  return request(`/cinemas/${cinemaId}/booking?groupSize=${groupSize}`);
}
