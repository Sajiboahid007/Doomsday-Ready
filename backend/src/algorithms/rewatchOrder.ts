export interface MovieInfo {
  id: number;
  title: string;
  runtimeMinutes: number;
  watched: boolean;
}

export interface RewatchOrderResult {
  target: {
    id: number;
    title: string;
  };
  movies: MovieInfo[];
  totalCount: number;
  watchedCount: number;
  remainingRuntimeMinutes: number;
}

export function calculateRewatchOrder(
  targetMovie: { id: number; title: string },
  allMovies: MovieInfo[],
  allPrerequisites: { movieId: number; prerequisiteId: number }[]
): RewatchOrderResult {
  const moviesMap = new Map<number, MovieInfo>();
  for (const movie of allMovies) {
    moviesMap.set(movie.id, movie);
  }

  const graph = new Map<number, number[]>();
  for (const edge of allPrerequisites) {
    const list = graph.get(edge.movieId) || [];
    list.push(edge.prerequisiteId);
    graph.set(edge.movieId, list);
  }

  const visited = new Set<number>();
  const orderedIds: number[] = [];

  function dfs(currentId: number) {
    const prereqIds = graph.get(currentId) || [];

    for (const prereqId of prereqIds) {
      if (!visited.has(prereqId)) {
        visited.add(prereqId);
        dfs(prereqId);
      }
    }

    if (currentId !== targetMovie.id) {
      orderedIds.push(currentId);
    }
  }

  visited.add(targetMovie.id);
  dfs(targetMovie.id);

  const orderedMovies: MovieInfo[] = [];
  for (const id of orderedIds) {
    const m = moviesMap.get(id);
    if (m) {
      orderedMovies.push(m);
    }
  }

  const totalCount = orderedMovies.length;
  const watchedCount = orderedMovies.filter((m) => m.watched).length;
  const remainingRuntimeMinutes = orderedMovies
    .filter((m) => !m.watched)
    .reduce((sum, m) => sum + m.runtimeMinutes, 0);

  return {
    target: {
      id: targetMovie.id,
      title: targetMovie.title,
    },
    movies: orderedMovies,
    totalCount,
    watchedCount,
    remainingRuntimeMinutes,
  };
}
