// Shared data shapes for the world, tiles and entities.

export type TileType = 'grass' | 'water' | 'sand' | 'bog' | 'path' | 'field';

export interface Tile {
  type: TileType;
  /** 0..1 variation used for colour / detail. */
  v: number;
  /** Water tile that touches land (drawn with a foam rim). */
  shore: boolean;
  /** Bog tile carrying a pitkospuut (plank boardwalk) segment. */
  plank?: boolean;
}

export interface Tree {
  kind: 'tree';
  wx: number;
  wy: number;
  /** 0 = koivu (birch), 1 = mänty (pine), 2 = kuusi (spruce). */
  variant: 0 | 1 | 2;
  seed: number;
  scale: number;
}

export interface House {
  kind: 'house';
  wx: number;
  wy: number;
  /** Footprint size in tiles. */
  w: number;
  d: number;
  /** Per-house variation (roof type, weathering, proportions). */
  seed: number;
}

/** navetta — a small log cowshed. */
export interface Barn {
  kind: 'barn';
  wx: number;
  wy: number;
  w: number;
  d: number;
  seed: number;
}

/** aitta — a small raised log storehouse (grain, clothes, valuables). */
export interface Aitta {
  kind: 'aitta';
  wx: number;
  wy: number;
  w: number;
  d: number;
  seed: number;
}

/** kaivo — a log-framed well with a windlass, near the tupa. */
export interface Well {
  kind: 'well';
  wx: number;
  wy: number;
  seed: number;
}

/** A small log outbuilding sharing one simple draw fn: savusauna, riihi, lato, käymälä. */
export type OutbuildingType = 'savusauna' | 'riihi' | 'lato' | 'kaymala';
export interface Outbuilding {
  kind: 'outbuilding';
  btype: OutbuildingType;
  wx: number;
  wy: number;
  w: number;
  d: number;
  seed: number;
}

/** One fence post, optionally with a rail running to the +x and/or +y neighbour. */
export interface Fence {
  kind: 'fence';
  wx: number;
  wy: number;
  railX: boolean;
  railY: boolean;
}

/** variksenpelätin — a scarecrow standing watch over the kasvimaa. */
export interface Scarecrow {
  kind: 'scarecrow';
  wx: number;
  wy: number;
  facing: number; // screen-space x direction it leans/looks
  seed: number;
}

/** laituri — a wooden jetty stepping from the shore (wx,wy) out into the water. */
export interface Jetty {
  kind: 'jetty';
  wx: number;
  wy: number;
  dx: number; // unit step toward the water
  dy: number;
}

/** A family member that stands at a station doing a looping activity. */
export type VillagerRole = 'wife' | 'granny' | 'son';
export interface Villager {
  kind: 'villager';
  role: VillagerRole;
  wx: number;
  wy: number;
  facing: number; // screen-space x direction
  seed: number;
}

/** Shared shape for wandering animals (cow, deer). */
export interface Critter {
  wx: number;
  wy: number;
  facing: number; // screen-space x direction: -1 left, 1 right
  homeX: number;
  homeY: number;
  tx: number; // wander target
  ty: number;
  wait: number;
  moving: boolean;
}

export interface Cow extends Critter {
  kind: 'cow';
}

export interface Deer extends Critter {
  kind: 'deer';
  seed: number;
}

export interface Rock {
  kind: 'rock';
  wx: number;
  wy: number;
  seed: number;
  scale: number;
  /** Bigger glacier-rounded bedrock outcrop (kallio) vs a small stone (kivi). */
  boulder: boolean;
}

export interface Reed {
  kind: 'reed';
  wx: number;
  wy: number;
  seed: number;
}

export interface Player {
  kind: 'player';
  wx: number;
  wy: number;
  faceX: number; // screen-space facing
  faceY: number;
  moving: boolean;
  anim: number;
}

export type Entity =
  | Tree
  | House
  | Barn
  | Aitta
  | Outbuilding
  | Well
  | Fence
  | Scarecrow
  | Jetty
  | Villager
  | Cow
  | Deer
  | Rock
  | Reed
  | Player;

/** A rectangular footprint that blocks movement (houses, barn). */
export interface Solid {
  wx: number;
  wy: number;
  w: number;
  d: number;
}

/** puro — a forest stream, drawn as a decorative line overlay (not water tiles). */
export interface Stream {
  points: { wx: number; wy: number }[];
}

/** lähde — a small forest spring, drawn as a decorative pool overlay. */
export interface Spring {
  wx: number;
  wy: number;
  r: number;
}

export interface World {
  width: number;
  height: number;
  tiles: Tile[]; // row-major: tiles[y * width + x]
  entities: Entity[]; // props (everything except the player)
  player: Player;
  solids: Solid[]; // footprints that block movement (houses, barn)
  streams: Stream[];
  springs: Spring[];
}

export interface Camera {
  x: number;
  y: number;
}

export interface GameState {
  world: World;
  player: Player;
  camera: Camera;
  time: number;
}
