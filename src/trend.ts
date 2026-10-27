export interface Point {
  t: number; // ms since epoch
  v: number;
}

export type Trend = 'up' | 'down' | 'stable';

// Index of the last point at or before the window start, -1 if none.
function referenceIndex(points: Point[], start: number): number {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].t <= start) return i;
  }
  return -1;
}

export function computeTrend(points: Point[], now: number, windowMs: number, threshold: number): Trend | null {
  if (points.length === 0) return null;
  const startIdx = referenceIndex(points, now - windowMs);
  // Last known value predates the window: it held for the whole window.
  if (startIdx === points.length - 1) return 'stable';
  if (points.length < 2) return null;
  const refIdx = Math.max(startIdx, 0);
  const delta = points[points.length - 1].v - points[refIdx].v;
  if (Math.abs(delta) < threshold) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

export function prune(points: Point[], now: number, windowMs: number): Point[] {
  const refIdx = referenceIndex(points, now - windowMs);
  return refIdx <= 0 ? points.slice() : points.slice(refIdx);
}

export function addPoint(points: Point[], p: Point): Point[] {
  const last = points[points.length - 1];
  return last && p.t <= last.t ? points : [...points, p];
}
