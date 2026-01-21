// World generator: grid of tiles, simple value-noise-based biomes, building placement, tile helpers.
// Exposes helpers to spawn entities and random tiles.

import { Zombie, HostileHuman } from './entities.js';

export default class WorldGenerator {
  constructor(w, h, seed = 12345) {
    this.w = w;
    this.h = h;
    this.seed = seed;
    this.tileSize = 32;
    this.tiles = [];
    this.rng = mulberry32(seed);
  }

  generate() {
    // create tiles and biome map using layered value noise
    this.tiles = Array.from({ length: this.h }, (_, y) =>
      Array.from({ length: this.w }, (_, x) => {
        const n = valueNoise(x / 12, y / 12, this.rng) * 1.0 +
                  valueNoise(x / 6, y / 6, this.rng) * 0.5;
        const biome = n > 0.6 ? 'urban' : n > 0.3 ? 'suburban' : (n > 0.05 ? 'rural' : 'industrial');
        return {
          x, y,
          biome,
          type: 'ground',
          building: Math.random() < (biome === 'urban' ? 0.25 : 0.05),
          items: [],
        };
      })
    );

    // Create roads: simple horizontal/vertical splits
    for (let i = 3; i < this.w; i += 8) {
      for (let y = 0; y < this.h; y++) {
        this.tiles[y][i].type = 'road';
      }
    }

    // Place some points of interest (POI)
    this.placePOIs();
  }

  placePOIs() {
    // Small clusters for loot/buildings
    for (let i = 0; i < 28; i++) {
      const x = Math.floor(this.rng() * this.w);
      const y = Math.floor(this.rng() * this.h);
      const t = this.tiles[y][x];
      t.building = true;
      t.items.push(randomLoot(this.rng));
      // cluster
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny) && Math.random() < 0.5) this.tiles[ny][nx].building = true;
      }
    }
  }

  randomSpawn() {
    // pick a tile with low danger (suburban/rural)
    for (let attempt = 0; attempt < 2000; attempt++) {
      const x = Math.floor(this.rng() * this.w);
      const y = Math.floor(this.rng() * this.h);
      const t = this.tiles[y][x];
      if (t.biome === 'rural' || t.biome === 'suburban') return { x, y };
    }
    return { x: Math.floor(this.w / 2), y: Math.floor(this.h / 2) };
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  tileAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  randomTileOfType(types = []) {
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(this.rng() * this.w);
      const y = Math.floor(this.rng() * this.h);
      const t = this.tiles[y][x];
      if (types.includes(t.biome) || types.includes(t.type)) return { x, y, tile: t };
    }
    return null;
  }

  createZombie(x, y, game) {
    return new Zombie(x, y, game);
  }

  createHostileHuman(x, y, game) {
    return new HostileHuman(x, y, game);
  }
}

// Lightweight RNG for deterministic seeds
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Simple value noise (not super-perf but small)
function valueNoise(x, y, rng) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const v00 = pseudo(xi, yi, rng);
  const v10 = pseudo(xi + 1, yi, rng);
  const v01 = pseudo(xi, yi + 1, rng);
  const v11 = pseudo(xi + 1, yi + 1, rng);
  const u = fade(xf), v = fade(yf);
  return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
}
function pseudo(x, y, rng) {
  const s = Math.sin(x * 127.1 + y * 311.7 + rng()) * 43758.5453;
  return s - Math.floor(s);
}
function fade(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function randomLoot(rng) {
  const pool = ['bandage', 'canned_food', 'bottle_water', 'scrap', 'ammo_small'];
  return pool[Math.floor(rng() * pool.length)];
}