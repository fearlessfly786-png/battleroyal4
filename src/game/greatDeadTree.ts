/**
 * THE GREAT DEAD TREE — a procedural voxel landmark built box by box,
 * modelled after the reference art: a thick two-by-two trunk that forks
 * into two thin spiked prongs, splayed stepped root flares, and eight
 * staircase branches (horizontal run → one-block step up → run → thin
 * upright end spike) sweeping out of the crown — the classic blocky
 * leafless tree silhouette.
 *
 * The geometry is built in "block" space (1 unit = 1 terrain block),
 * base on y = 0 and centred on x/z, then normalised to unit height —
 * exactly the space deadTrees.ts expects from its GLB variants. There
 * it becomes the FIFTH dead-tree variant and is painted with the SAME
 * pixel bark texture as the rest of the pack (box-projection UVs are
 * regenerated there, so none are needed here).
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ------------------------------ tuning ------------------------------ */

/** Square cross-section of branch runs, in blocks. */
const BRANCH_T = 0.9;

/** Square cross-section of the thin upright end spikes. */
const SPIKE_T = 0.42;

/** Step-up between the two runs of a branch (blocks). */
const STEP_UP = 0.85;

/** Trunk half-width where branches attach — they embed slightly past
 *  the face so no coplanar seams shimmer. */
const TRUNK_FACE = 0.94;

/** One staircase branch sweeping out of the trunk. */
interface BranchSpec {
  /** Horizontal axis the branch runs along. */
  axis: 'x' | 'z';
  /** Direction sign along that axis. */
  side: 1 | -1;
  /** Underside height where the branch leaves the trunk. */
  y: number;
  /** Lengths of the two horizontal runs. */
  runs: [number, number];
  /** Height of the thin upright spike at the tip. */
  spike: number;
  /** Small upright stub on the first joint. */
  stub?: boolean;
  /** Lateral (perpendicular) offset for organic asymmetry. */
  off?: number;
}

/** The eight staircase branches — three per flank plus a depth pair,
 *  mirroring the reference's silhouette from the front. Heights stack
 *  from low-and-long up to short-and-steep, end spikes growing taller
 *  toward the crown. */
const BRANCHES: BranchSpec[] = [
  // left flank (−x)
  { axis: 'x', side: -1, y: 3.9, runs: [2.6, 3.0], spike: 2.3, stub: true },
  { axis: 'x', side: -1, y: 5.9, runs: [1.7, 2.9], spike: 3.3 },
  { axis: 'x', side: -1, y: 7.1, runs: [1.3, 1.7], spike: 4.3 }, // tallest spike
  { axis: 'z', side: -1, y: 4.9, runs: [1.9, 1.5], spike: 1.8, off: -0.15 },
  // right flank (+x)
  { axis: 'x', side: 1, y: 4.4, runs: [3.0, 2.6], spike: 2.0, stub: true },
  { axis: 'x', side: 1, y: 6.3, runs: [1.5, 2.5], spike: 2.9 },
  { axis: 'x', side: 1, y: 7.5, runs: [1.4, 1.6], spike: 3.5 },
  { axis: 'z', side: 1, y: 5.5, runs: [1.7, 1.4], spike: 1.6, off: -0.15 },
];

/* ------------------------------ builder ------------------------------ */

/** Box from min/max corners. */
function boxAt(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number
): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** Emit one branch's boxes: run → step → run → (stub) → end spike. */
function addBranch(parts: THREE.BoxGeometry[], b: BranchSpec): void {
  const t = BRANCH_T;
  const p = b.off ?? 0.12;

  // along-distance d (0 = trunk face) → world interval on the axis
  const along = (d0: number, d1: number): [number, number] => {
    const a0 = b.side * (TRUNK_FACE + d0);
    const a1 = b.side * (TRUNK_FACE + d1);
    return [Math.min(a0, a1), Math.max(a0, a1)];
  };

  /** Horizontal run between along-distances d0..d1, underside at y. */
  const run = (d0: number, d1: number, y: number): void => {
    const [a0, a1] = along(d0, d1);
    if (b.axis === 'x') parts.push(boxAt(a0, y, p - t / 2, a1, y + t, p + t / 2));
    else parts.push(boxAt(p - t / 2, y, a0, p + t / 2, y + t, a1));
  };

  /** Vertical step box spanning d0..d1, welding run level y to y+STEP_UP. */
  const step = (d0: number, d1: number, y: number): void => {
    const [a0, a1] = along(d0, d1);
    if (b.axis === 'x')
      parts.push(boxAt(a0, y + t - 0.05, p - t / 2, a1, y + STEP_UP + t, p + t / 2));
    else parts.push(boxAt(p - t / 2, y + t - 0.05, a0, p + t / 2, y + STEP_UP + t, a1));
  };

  /** Thin upright spike of height h, base at yBase, centred at d. */
  const spike = (d: number, yBase: number, h: number): void => {
    const c = b.side * (TRUNK_FACE + d);
    if (b.axis === 'x')
      parts.push(
        boxAt(c - SPIKE_T / 2, yBase, p - SPIKE_T / 2, c + SPIKE_T / 2, yBase + h, p + SPIKE_T / 2)
      );
    else
      parts.push(
        boxAt(p - SPIKE_T / 2, yBase, c - SPIKE_T / 2, p + SPIKE_T / 2, yBase + h, c + SPIKE_T / 2)
      );
  };

  const [r1, r2] = b.runs;
  run(0, r1, b.y);
  step(r1 - t, r1, b.y);
  const y2 = b.y + STEP_UP;
  run(r1 - 0.05, r1 + r2, y2);
  if (b.stub) spike(r1 - t * 0.5, y2 + t, 1.15);
  spike(r1 + r2 - 0.55, y2 + t, b.spike);
}

/** A splayed root flare marching out on a diagonal, three shrinking
 *  slabs stepping down to the ground. */
function addRootDiag(parts: THREE.BoxGeometry[], sx: 1 | -1, sz: 1 | -1): void {
  const slab = (e0: number, e1: number, top: number): void => {
    const x0 = sx > 0 ? e0 : -e1;
    const x1 = sx > 0 ? e1 : -e0;
    const z0 = sz > 0 ? e0 : -e1;
    const z1 = sz > 0 ? e1 : -e0;
    parts.push(boxAt(x0, 0, z0, x1, top, z1));
  };
  slab(0.7, 2.1, 1.7);
  slab(1.7, 2.7, 1.0);
  slab(2.4, 3.2, 0.5);
}

/**
 * Build the great dead tree: ~14 blocks tall with a ~13.7-block branch
 * span, base on y = 0, centred on x/z, normalised to unit height.
 */
export function buildGreatDeadTreeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BoxGeometry[] = [];

  // trunk + bark ledges (character bumps) + crown collar
  parts.push(boxAt(-1, 0, -1, 1, 8.5, 1));
  parts.push(boxAt(-1.35, 4.6, -0.9, 0.05, 5.5, 0.15));
  parts.push(boxAt(-0.1, 6.3, -0.9, 1.25, 7.1, 0.1));
  parts.push(boxAt(-0.9, 3.2, 0.6, 0.2, 4.0, 1.3));
  parts.push(boxAt(-0.7, 8.3, -0.9, 0.9, 9.0, 0.9));

  // crown fork: two prongs rising into thin spikes (the reference's V)
  parts.push(boxAt(-1.05, 8.5, -0.5, 0.15, 10.3, 0.55));
  parts.push(boxAt(-0.75, 10.3, -0.3, -0.1, 11.0, 0.35));
  parts.push(boxAt(-0.65, 11.0, -0.12, -0.2, 13.3, 0.22));
  parts.push(boxAt(-0.1, 8.5, -0.5, 1.05, 9.8, 0.55));
  parts.push(boxAt(0.15, 9.8, -0.3, 0.75, 10.5, 0.3));
  parts.push(boxAt(0.25, 10.5, -0.12, 0.65, 12.4, 0.2));

  // root flares: four diagonals + two cardinal buttresses
  addRootDiag(parts, 1, 1);
  addRootDiag(parts, 1, -1);
  addRootDiag(parts, -1, 1);
  addRootDiag(parts, -1, -1);
  parts.push(boxAt(-0.9, 0, 0.94, 0.9, 1.5, 2.2));
  parts.push(boxAt(-0.55, 0, 2.0, 0.55, 0.75, 2.9));
  parts.push(boxAt(-2.2, 0, -0.8, -0.94, 1.4, 0.8));
  parts.push(boxAt(-3.1, 0, -0.5, -2.0, 0.7, 0.5));

  for (const b of BRANCHES) addBranch(parts, b);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const g = merged ?? boxAt(-1, 0, -1, 1, 8.5, 1); // never expected

  // normalise: centre x/z, base on y = 0, unit height
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const h = Math.max(1e-6, bb.max.y - bb.min.y);
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.scale(1 / h, 1 / h, 1 / h);
  g.computeBoundingSphere();
  return g;
}
