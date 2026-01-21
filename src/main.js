// Entry point. Initializes Pixi and launches the Game.
import Game from './game.js';

window.addEventListener('load', async () => {
  const root = document.getElementById('game-root');

  // Create Pixi Application sized to window
  const app = new PIXI.Application({
    resizeTo: window,
    backgroundColor: 0x080808,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: false,
  });

  root.prepend(app.view);

  // Start game
  const game = new Game(app);
  await game.init();
  game.start();
});