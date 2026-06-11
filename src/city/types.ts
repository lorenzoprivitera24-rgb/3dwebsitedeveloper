/**
 * City data contract.
 *
 * These types are the shared vocabulary between the layout generator (architect),
 * the instanced meshes (architect), the TSL materials (shader engineer) and the
 * traffic motion (shader + motion engineers). They are PLAIN DATA: no three.js
 * objects, no class instances. World units are meters; +Y is up; the ground plane
 * is Y = 0. The city is centered on the world origin.
 */

/** One building archetype = one InstancedMesh draw call. */
export type BuildingArchetype = 'lowrise' | 'midrise' | 'tower'

/**
 * A single building instance. Footprint is axis-aligned (no rotation) so facades stay
 * grid-facing, which keeps the procedural facade UVs simple for the shader engineer.
 *
 * `facadeSeed` is a per-instance 0..1 value the shader engineer hashes into window
 * patterns, lit-window probability, color tint, etc. `litBias` is a precomputed 0..1
 * the shader can multiply into night-window emissive so not every building lights up
 * identically. Keep both deterministic from the city seed.
 */
export interface BuildingInstance {
  archetype: BuildingArchetype
  /** Center of the footprint on the ground plane. y is always 0 (base sits on ground). */
  position: [x: number, y: number, z: number]
  /** Footprint width (X) and depth (Z) in meters. */
  footprint: [w: number, d: number]
  /** Building height in meters (the instance is scaled, base archetype is a unit box). */
  height: number
  /** 0..1 facade randomness (window grid phase, tint, lit-probability). */
  facadeSeed: number
  /** 0..1 precomputed "how brightly this building lights at night" bias. */
  litBias: number
}

/** A flat quad on the ground: roads, sidewalks, and the ground slab all use this. */
export interface GroundQuad {
  /** Center on the ground plane. y carries a tiny layer offset to avoid z-fighting. */
  position: [x: number, y: number, z: number]
  /** Size in meters (X, Z). */
  size: [w: number, d: number]
}

/**
 * A driveable lane. A lane is a polyline of waypoints in world space at car height.
 * For the MVP grid, lanes are straight segments between intersections (two points),
 * but the type supports polylines so the motion engineer can add turns later without
 * a contract change.
 *
 * Direction is implicit in waypoint order (cars travel point[0] -> point[last]).
 * `length` is precomputed (sum of segment lengths) so the shader can normalize a
 * car's progress along the lane without recomputing distances per frame.
 */
export interface Lane {
  id: number
  /** Ordered waypoints [x, y, z]. y is the car deck height (constant). */
  waypoints: Array<[number, number, number]>
  /** Total polyline length in meters. */
  length: number
}

/** Axis of a grid road, used when laying lanes and headlight orientation. */
export type Axis = 'x' | 'z'

export interface CityLayout {
  seed: number
  /** Half-extent of the populated area in meters (city spans [-extent, +extent] on X and Z). */
  extent: number
  /** Ground slab quad (single large plane under everything). */
  ground: GroundQuad
  buildings: BuildingInstance[]
  roads: GroundQuad[]
  sidewalks: GroundQuad[]
  lanes: Lane[]
  /** Convenience counts so consumers do not re-derive them. */
  counts: {
    buildings: number
    byArchetype: Record<BuildingArchetype, number>
    lanes: number
  }
}
