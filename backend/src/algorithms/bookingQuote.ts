export interface BundleItem {
  size: number;
  count: number;
}

export interface BookingResult {
  cinemaId: number;
  groupSize: number;
  possible: boolean;
  totalBundles?: number;
  bundles?: BundleItem[];
  message?: string;
}

export function calculateBooking(
  cinemaId: number,
  groupSize: number,
  bundleSizes: number[]
): BookingResult {
  if (!groupSize || groupSize <= 0) {
    return {
      cinemaId,
      groupSize,
      possible: false,
      message: "Group size must be greater than 0.",
    };
  }

  if (!bundleSizes || bundleSizes.length === 0) {
    return {
      cinemaId,
      groupSize,
      possible: false,
      message: "This cinema has no bundle sizes configured.",
    };
  }

  const distinctSizes = Array.from(new Set(bundleSizes)).sort((a, b) => b - a);

  const dp: number[] = new Array(groupSize + 1).fill(Infinity);
  const parent: number[] = new Array(groupSize + 1).fill(-1);

  dp[0] = 0;

  for (let seat = 1; seat <= groupSize; seat++) {
    for (const size of distinctSizes) {
      if (size <= seat && dp[seat - size] !== Infinity) {
        if (dp[seat - size] + 1 < dp[seat]) {
          dp[seat] = dp[seat - size] + 1;
          parent[seat] = size;
        }
      }
    }
  }

  if (dp[groupSize] === Infinity) {
    return {
      cinemaId,
      groupSize,
      possible: false,
      message: `No combination of bundles adds up to exactly ${groupSize} seats.`,
    };
  }

  const bundleCounts: Record<number, number> = {};
  let currentSeats = groupSize;

  while (currentSeats > 0) {
    const size = parent[currentSeats];
    bundleCounts[size] = (bundleCounts[size] || 0) + 1;
    currentSeats -= size;
  }

  const bundles: BundleItem[] = Object.keys(bundleCounts)
    .map(Number)
    .sort((a, b) => b - a)
    .map((size) => ({
      size,
      count: bundleCounts[size],
    }));

  return {
    cinemaId,
    groupSize,
    possible: true,
    totalBundles: dp[groupSize],
    bundles,
  };
}
