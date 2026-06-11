import type {
  Axis,
  BuildingArchetype,
  BuildingInstance,
  CityLayout,
  GroundQuad,
  Lane,
} from './types'

/**
 * Pure, deterministic city layout generator.
 *
 * Given the same (seed, gridSize) it returns identical plain-data output every time.
 * No three.js, no DOM, no randomness beyond the seeded PRNG -> trivially testable and
 * safe for the shader/motion agents to consume without surprises.
 *
 * Layout model: a gridSize x gridSize array of square BLOCKS. Between blocks run ROADS
 * (with SIDEWALKS lining each block). Each block holds 1..N buildings. Each road carries
 * two LANES (one per direction). Coordinates are centered on the world origin.
 */

// ---- seeded PRNG (mulberry32): tiny, fast, good enough for layout variation ----
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ---- world dimensions (meters) ----
const BLOCK_SIZE = 40 // edge length of one square block
const ROAD_WIDTH = 12 // gap between blocks carrying two lanes
const SIDEWALK_WIDTH = 3 // border strip inside the road gap, lining each block
const CELL = BLOCK_SIZE + ROAD_WIDTH // grid pitch (block + the road after it)
const CAR_DECK_Y = 0.4 // height at which lane waypoints (and cars) sit
const LAYER = {
  ground: 0,
  road: 0.01,
  sidewalk: 0.02,
} as const

const ARCHES: BuildingArchetype[] = ['lowrise', 'midrise', 'tower']

interface ArchSpec {
  heightRange: [number, number]
  footprintFrac: [number, number] // fraction of a building slot footprint
  weight: number // selection weight
}

const ARCH_SPEC: Record<BuildingArchetype, ArchSpec> = {
  lowrise: { heightRange: [8, 18], footprintFrac: [0.7, 0.95], weight: 0.5 },
  midrise: { heightRange: [20, 45], footprintFrac: [0.6, 0.85], weight: 0.35 },
  tower: { heightRange: [60, 130], footprintFrac: [0.45, 0.7], weight: 0.15 },
}

function pickArchetype(r: number): BuildingArchetype {
  // weighted pick using a single uniform sample
  const total = ARCHES.reduce((s, a) => s + ARCH_SPEC[a].weight, 0)
  let acc = 0
  const x = r * total
  for (const a of ARCHES) {
    acc += ARCH_SPEC[a].weight
    if (x <= acc) return a
  }
  return 'lowrise'
}

export function generateCity(seed: number, gridSize: number): CityLayout {
  const rand = mulberry32(seed)

  // The grid spans gridSize cells; center the whole thing on the origin.
  const span = gridSize * CELL - ROAD_WIDTH // last cell has no trailing road
  const half = span / 2
  // origin of cell (0,0) corner, so that the populated area is centered
  const originX = -half
  const originZ = -half

  const buildings: BuildingInstance[] = []
  const roads: GroundQuad[] = []
  const sidewalks: GroundQuad[] = []
  const lanes: Lane[] = []
  const byArchetype: Record<BuildingArchetype, number> = {
    lowrise: 0,
    midrise: 0,
    tower: 0,
  }

  // ---- blocks + buildings ----
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gz = 0; gz < gridSize; gz++) {
      const blockMinX = originX + gx * CELL
      const blockMinZ = originZ + gz * CELL
      const blockCenterX = blockMinX + BLOCK_SIZE / 2
      const blockCenterZ = blockMinZ + BLOCK_SIZE / 2

      // sidewalks line the block on all four sides (thin slabs just outside the block edge)
      sidewalks.push(
        groundQuad(blockCenterX, blockMinZ - SIDEWALK_WIDTH / 2, BLOCK_SIZE + SIDEWALK_WIDTH * 2, SIDEWALK_WIDTH, LAYER.sidewalk),
        groundQuad(blockCenterX, blockMinZ + BLOCK_SIZE + SIDEWALK_WIDTH / 2, BLOCK_SIZE + SIDEWALK_WIDTH * 2, SIDEWALK_WIDTH, LAYER.sidewalk),
        groundQuad(blockMinX - SIDEWALK_WIDTH / 2, blockCenterZ, SIDEWALK_WIDTH, BLOCK_SIZE, LAYER.sidewalk),
        groundQuad(blockMinX + BLOCK_SIZE + SIDEWALK_WIDTH / 2, blockCenterZ, SIDEWALK_WIDTH, BLOCK_SIZE, LAYER.sidewalk),
      )

      // subdivide the block into a small per-block sub-grid of building slots
      const sub = 1 + Math.floor(rand() * 2) // 1x1 or 2x2 cluster
      const slot = BLOCK_SIZE / sub
      for (let sx = 0; sx < sub; sx++) {
        for (let sz = 0; sz < sub; sz++) {
          // skip the occasional slot so the city is not 100% built up (plazas/gaps)
          if (rand() < 0.12) continue

          const slotCenterX = blockMinX + slot * (sx + 0.5)
          const slotCenterZ = blockMinZ + slot * (sz + 0.5)

          const archetype = pickArchetype(rand())
          const spec = ARCH_SPEC[archetype]
          const ff = lerp(spec.footprintFrac[0], spec.footprintFrac[1], rand())
          const w = slot * ff
          const d = slot * lerp(0.85, 1.0, rand()) * ff
          const height = lerp(spec.heightRange[0], spec.heightRange[1], rand())

          buildings.push({
            archetype,
            position: [slotCenterX, 0, slotCenterZ],
            footprint: [w, d],
            height,
            facadeSeed: rand(),
            litBias: lerp(0.25, 1.0, rand()),
          })
          byArchetype[archetype]++
        }
      }
    }
  }

  // ---- roads + lanes (run in the gaps after each cell, both axes) ----
  // vertical roads (run along Z) sit between column gx and gx+1
  let laneId = 0
  for (let g = 0; g < gridSize - 1; g++) {
    const roadCenterX = originX + g * CELL + BLOCK_SIZE + ROAD_WIDTH / 2
    roads.push(groundQuad(roadCenterX, 0, ROAD_WIDTH, span, LAYER.road))
    laneId = pushLanePair(lanes, laneId, 'z', roadCenterX, originZ, originZ + span)

    const roadCenterZ = originZ + g * CELL + BLOCK_SIZE + ROAD_WIDTH / 2
    roads.push(groundQuad(0, roadCenterZ, span, ROAD_WIDTH, LAYER.road))
    laneId = pushLanePair(lanes, laneId, 'x', roadCenterZ, originX, originX + span)
  }

  const ground: GroundQuad = groundQuad(0, 0, span + CELL, span + CELL, LAYER.ground)

  return {
    seed,
    extent: half,
    ground,
    buildings,
    roads,
    sidewalks,
    lanes,
    counts: {
      buildings: buildings.length,
      byArchetype,
      lanes: lanes.length,
    },
  }
}

// center-x, center-z helpers (y carries the layer offset to avoid z-fighting)
function groundQuad(cx: number, cz: number, w: number, d: number, layerY: number): GroundQuad {
  return { position: [cx, layerY, cz], size: [w, d] }
}

/**
 * Two opposite-direction lanes for one road, offset to either side of the centerline
 * so oncoming traffic does not overlap. `fixed` is the coordinate on the perpendicular
 * axis (X for a Z-axis road, Z for an X-axis road).
 */
function pushLanePair(out: Lane[], startId: number, axis: Axis, fixed: number, from: number, to: number): number {
  const off = ROAD_WIDTH / 4 // quarter-width offset to each side of the road center
  let id = startId
  if (axis === 'z') {
    // northbound (+Z) on one side, southbound (-Z) on the other
    out.push(makeLane(id++, [fixed + off, CAR_DECK_Y, from], [fixed + off, CAR_DECK_Y, to]))
    out.push(makeLane(id++, [fixed - off, CAR_DECK_Y, to], [fixed - off, CAR_DECK_Y, from]))
  } else {
    out.push(makeLane(id++, [from, CAR_DECK_Y, fixed - off], [to, CAR_DECK_Y, fixed - off]))
    out.push(makeLane(id++, [to, CAR_DECK_Y, fixed + off], [from, CAR_DECK_Y, fixed + off]))
  }
  return id
}

function makeLane(id: number, a: [number, number, number], b: [number, number, number]): Lane {
  const dx = b[0] - a[0]
  const dz = b[2] - a[2]
  const length = Math.hypot(dx, dz)
  return { id, waypoints: [a, b], length }
}

/** Exposed so consumers (and tests) can reason about world scale without magic numbers. */
export const CITY_CONSTANTS = {
  BLOCK_SIZE,
  ROAD_WIDTH,
  SIDEWALK_WIDTH,
  CELL,
  CAR_DECK_Y,
  LAYER,
} as const
