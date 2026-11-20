export interface CycleResult {
  hasCycle: boolean;
  cyclePath?: string[];
  message?: string;
}

export function checkForCycle(
  targetMovieId: number,
  proposedPrerequisiteIds: number[],
  allPrerequisites: { movieId: number; prerequisiteId: number }[],
  movieTitles: Map<number, string>
): CycleResult {
  if (proposedPrerequisiteIds.includes(targetMovieId)) {
    const title = movieTitles.get(targetMovieId) || `Movie #${targetMovieId}`;
    return {
      hasCycle: true,
      cyclePath: [title, title],
      message: `Adding this prerequisite would create a cycle: ${title} → ${title}`,
    };
  }

  const graph = new Map<number, number[]>();

  for (const edge of allPrerequisites) {
    if (edge.movieId === targetMovieId) {
      continue;
    }
    const list = graph.get(edge.movieId) || [];
    list.push(edge.prerequisiteId);
    graph.set(edge.movieId, list);
  }

  graph.set(targetMovieId, proposedPrerequisiteIds);

  const visited = new Set<number>();
  let cyclePathIds: number[] | null = null;

  function dfs(currentId: number, currentPath: number[]): boolean {
    const nextPrereqs = graph.get(currentId) || [];

    for (const prereqId of nextPrereqs) {
      if (prereqId === targetMovieId) {
        cyclePathIds = [...currentPath, prereqId];
        return true;
      }

      if (!visited.has(prereqId)) {
        visited.add(prereqId);
        if (dfs(prereqId, [...currentPath, prereqId])) {
          return true;
        }
      }
    }

    return false;
  }

  visited.add(targetMovieId);
  const found = dfs(targetMovieId, [targetMovieId]);

  if (found && cyclePathIds) {
    const pathTitles = (cyclePathIds as number[]).map(
      (id) => movieTitles.get(id) || `Movie #${id}`
    );
    return {
      hasCycle: true,
      cyclePath: pathTitles,
      message: `Adding this prerequisite would create a cycle: ${pathTitles.join(" → ")}`,
    };
  }

  return { hasCycle: false };
}
