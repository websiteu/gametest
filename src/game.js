// Main game class wiring the systems: world generation, player, entities, UI, loop.
import WorldGenerator from './worldgen.js';
import { Player } from './entities.js';
import UI from './ui.js';
import AStar from './a_star.js';

export default class Game {
  constructor(app) {
    this.app = app;
    this.stage = new PIXI.Container();
    this.app.stage.addChild(this.stage);

    this.world = null;
    this.player = null;
    this.entities = [];
    this.ui = new UI(this, document.getElementById('controls-ui'));
    this.paused = false;
    this.seed = Date.now();
    this.saveKey = 'last-stand-save-v1';
    this.pathfinder = new AStar();
    this.dayTime = 12; // hours
    this.timeSpeed = 0.01; // hours per tick
    this.lastTick = performance.now();
    this.logLines = [];
  }

  async init() {
    // Load placeholder graphics (we use simple Graphics instead of large sprite sheets)
    // If you have art, load via PIXI.Loader here.

    // Generate world
    this.log('Generating world...');
    this.world = new WorldGenerator(80, 60, this.seed);
    this.world.generate();

    // Create parallax layers container (simple approach)
    this.backLayer = new PIXI.Container();
    this.groundLayer = new PIXI.Container();
    this.entityLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.stage.addChild(this.backLayer, this.groundLayer, this.entityLayer, this.uiLayer);

    // Render ground tiles
    this.renderWorld();

    // Create player at random spawn
    const spawn = this.world.randomSpawn();
    this.player = new Player(spawn.x, spawn.y, this);
    this.entities.push(this.player);
    this.entityLayer.addChild(this.player.sprite);

    // Spawn initial NPCs & zombies
    this.spawnEntities();

    // Hook UI
    this.ui.setup(this.player);
    this.ui.log = (t) => this.log(t);

    // Lighting overlay for day/night
    this.lightMask = new PIXI.Graphics();
    this.uiLayer.addChild(this.lightMask);

    // Input
    this.setupPointer();

    // Periodic auto-save (only non-permadeath session state; we adhere to permadeath: on death we wipe save)
    this.autoSaveInterval = setInterval(() => this.save(), 15_000);
  }

  start() {
    this.app.ticker.add((dt) => this.update(dt));
  }

  log(text) {
    const el = document.getElementById('log');
    const time = Math.floor(this.dayTime).toString().padStart(2, '0');
    el.innerText = `[${time}:00] ${text}\n` + el.innerText;
  }

  renderWorld() {
    const tileSize = this.world.tileSize;
    // Simple parallax background: distant hills/sky
    const sky = new PIXI.Graphics();
    sky.beginFill(0x101214);
    sky.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    sky.endFill();
    this.backLayer.addChild(sky);

    // Draw tiles on groundLayer
    for (let y = 0; y < this.world.h; y++) {
      for (let x = 0; x < this.world.w; x++) {
        const t = this.world.tiles[y][x];
        const g = new PIXI.Graphics();
        const px = x * tileSize;
        const py = y * tileSize;
        // Color by biome/type
        let color = 0x29623f; // default rural
        if (t.biome === 'urban') color = 0x5a5a5a;
        if (t.biome === 'industrial') color = 0x3b3b4b;
        if (t.biome === 'suburban') color = 0x3f5a3b;
        if (t.type === 'road') color = 0x2b2b2b;
        g.beginFill(color);
        g.drawRect(px, py, tileSize, tileSize);
        g.endFill();
        this.groundLayer.addChild(g);

        // If building, draw roof/symbol
        if (t.building) {
          const b = new PIXI.Graphics();
          b.beginFill(0x5a2d2d);
          b.drawRect(px + 6, py + 6, tileSize - 12, tileSize - 12);
          b.endFill();
          this.groundLayer.addChild(b);
        }
      }
    }

    // Center camera on player
    this.centerCameraOn = (xPx, yPx) => {
      this.stage.x = this.app.screen.width / 2 - xPx;
      this.stage.y = this.app.screen.height / 2 - yPx;
    };
  }

  spawnEntities() {
    // Simple spawns based on biome distribution
    const countZombies = Math.floor((this.world.w * this.world.h) / 300);
    for (let i = 0; i < countZombies; i++) {
      const p = this.world.randomTileOfType(['rubble', 'road', 'field', 'urban']);
      if (!p) continue;
      const z = this.world.createZombie(p.x, p.y, this);
      this.entities.push(z);
      this.entityLayer.addChild(z.sprite);
    }

    // Hostile humans
    const countHumans = Math.floor((this.world.w * this.world.h) / 900);
    for (let i = 0; i < countHumans; i++) {
      const p = this.world.randomTileOfType(['urban', 'suburban']);
      if (!p) continue;
      const h = this.world.createHostileHuman(p.x, p.y, this);
      this.entities.push(h);
      this.entityLayer.addChild(h.sprite);
    }
  }

  update(dt) {
    if (this.paused) return;

    // Time progression
    this.dayTime += this.timeSpeed * dt;
    if (this.dayTime >= 24) this.dayTime -= 24;

    // Update entities (AI simple tick)
    for (let ent of this.entities.slice()) {
      ent.update(dt);
      // Remove dead
      if (ent.dead) {
        this.entityLayer.removeChild(ent.sprite);
        const ix = this.entities.indexOf(ent);
        if (ix !== -1) this.entities.splice(ix, 1);
      }
    }

    // Keep camera centered on player (2.5D)
    const px = this.player.x * this.world.tileSize + this.world.tileSize / 2;
    const py = this.player.y * this.world.tileSize + this.world.tileSize / 2;
    this.centerCameraOn(px, py);

    // Lighting: simple overlay circle based on dayTime
    const normalized = Math.cos((this.dayTime / 24) * Math.PI * 2) * -1; // night when 1
    const darkness = Math.min(Math.max((normalized + 0.2), 0), 1);
    const maxRad = 300;
    this.lightMask.clear();
    // full-screen dark rectangle then a radial hole around player
    this.lightMask.beginFill(0x000000, darkness * 0.85);
    this.lightMask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    this.lightMask.endFill();

    const globalPos = { x: px + this.stage.x, y: py + this.stage.y };
    const spotlight = new PIXI.Graphics();
    const radius = 120 + (1 - darkness) * 180;
    spotlight.beginFill(0xffffff);
    spotlight.drawCircle(globalPos.x, globalPos.y, radius);
    spotlight.endFill();

    // Blend mode to cut hole: use masked container approach is better but this is a simple approximation.
    // Here we tint entityLayer visuals to simulate darkness:
    const tintValue = Math.floor(0xAA - darkness * 0x80);
    this.stage.children.forEach(c => {
      if (c !== this.lightMask) c.alpha = 1.0;
    });

    // Update UI values
    this.ui.updateStats({
      health: this.player.health,
      hunger: this.player.hunger,
      thirst: this.player.thirst,
      fatigue: this.player.fatigue,
      sanity: this.player.sanity,
    });

    // Save state (lightweight)
    // (autoSave handles periodic)
  }

  setupPointer() {
    // Pointer for mouse aiming and touch actions
    const canvas = this.app.view;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.isPrimary) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) - this.stage.x;
        const y = (e.clientY - rect.top) - this.stage.y;
        this.player.requestMoveToScreen(x, y);
      }
    });
  }

  save() {
    // Save only minimal unlocks — because permadeath clears world progress; we can save meta unlocks.
    const meta = {
      seed: this.seed,
      timestamp: Date.now(),
      unlocks: {}, // placeholder for achievements/unlocks
    };
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(meta));
      document.getElementById('save-notice')?.remove();
      const n = document.createElement('div');
      n.id = 'save-notice';
      n.innerText = 'Game saved (meta only)';
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 1800);
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  permadeath() {
    // Called when player dies: wipe world and reload new seeded world
    localStorage.removeItem(this.saveKey);
    // Simple death flow: show message and regenerate
    this.log('You died. Permadeath triggered — generating new world...');
    this.resetWorld();
  }

  resetWorld() {
    // clear stage children and re-init
    this.entityLayer.removeChildren();
    this.groundLayer.removeChildren();
    this.backLayer.removeChildren();
    this.uiLayer.removeChildren();
    this.entities = [];
    this.seed = Date.now();
    this.world = new WorldGenerator(80, 60, this.seed);
    this.world.generate();
    this.renderWorld();
    const spawn = this.world.randomSpawn();
    this.player = new Player(spawn.x, spawn.y, this);
    this.entities.push(this.player);
    this.entityLayer.addChild(this.player.sprite);
    this.spawnEntities();
    this.ui.setup(this.player);
  }
}