// Basic HUD, virtual joystick (touch), action button, and stat display.
export default class UI {
  constructor(game, container) {
    this.game = game;
    this.container = container;
    this.player = null;
    this.element = null;
  }

  setup(player) {
    this.player = player;
    // Create virtual joystick and buttons
    // joystick
    const existing = document.querySelector('.virtual-joystick');
    if (existing) existing.remove();

    const vj = document.createElement('div');
    vj.className = 'virtual-joystick';
    document.body.appendChild(vj);
    // action button
    const btn = document.createElement('div');
    btn.className = 'btn';
    btn.id = 'action-btn';
    btn.innerText = 'A';
    document.body.appendChild(btn);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAction();
    });

    // Scavenge on double-tap area or use action for simplicity
    vj.addEventListener('pointerdown', (e) => {
      // joystick input capture left as minimal; in prototype, move with joystick not implemented.
      e.preventDefault();
    });

    // Desktop controls: keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e') this.onAction();
      if (e.key === 's') this.onScavenge();
    });

    // Small log hook
    this.log = (t) => {};
  }

  updateStats(stats) {
    document.getElementById('health-val').innerText = Math.max(0, Math.floor(stats.health));
    document.getElementById('hunger-val').innerText = Math.floor(stats.hunger);
    document.getElementById('thirst-val').innerText = Math.floor(stats.thirst);
    document.getElementById('fatigue-val').innerText = Math.floor(stats.fatigue);
    document.getElementById('sanity-val').innerText = Math.floor(stats.sanity);
  }

  onAction() {
    // Attempt to scavenge or interact with tile in front of player
    this.onScavenge();
  }

  onScavenge() {
    if (!this.player) return;
    const item = this.player.scavenge();
    if (item) {
      this.log('Picked up ' + item);
    } else {
      this.log('Nothing found.');
    }
  }
}