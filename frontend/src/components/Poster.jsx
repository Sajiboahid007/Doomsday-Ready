import { useState } from "react";

// Shows the movie's poster image. If there is no image (or it fails to load, e.g. offline),
// it draws a simple poster instead: a gradient picked from the title, plus its initials.

const gradients = [
  ["#7f1d1d", "#dc2626"],
  ["#1e3a8a", "#3b82f6"],
  ["#14532d", "#22c55e"],
  ["#581c87", "#a855f7"],
  ["#78350f", "#f59e0b"],
  ["#134e4a", "#14b8a6"],
  ["#831843", "#ec4899"],
  ["#1f2937", "#6b7280"],
];

function pickGradient(title) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return gradients[hash % gradients.length];
}

function initials(title) {
  const words = title
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w && !["the", "of", "a", "and"].includes(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function Poster({ title, year, watched, posterUrl, small = false }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const [from, to] = pickGradient(title);
  const showImage = posterUrl && failedUrl !== posterUrl;
  const background = { background: `linear-gradient(160deg, ${from}, ${to})` };

  const image = showImage && (
    <img src={posterUrl} alt={`${title} poster`} loading="lazy" onError={() => setFailedUrl(posterUrl)} />
  );

  if (small) {
    return (
      <div className="poster-thumb" style={background}>
        {image || initials(title)}
      </div>
    );
  }

  return (
    <div className="poster" style={background}>
      {image || <span className="poster-initials">{initials(title)}</span>}
      {watched && <span className="poster-badge">Watched</span>}
      <div className="poster-footer">
        <span className="poster-title">{title}</span>
        <span className="poster-year">{year}</span>
      </div>
    </div>
  );
}
