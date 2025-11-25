import { GameState } from "./EnemySpawnSystem";

// Game constants
export const GAME_CONFIG = {
  PLAYER_RADIUS: 12,
  PLAYER_SPEED: 300,
  MAX_LIVES: 3,
  DEFAULT_WIDTH: 960,
  DEFAULT_HEIGHT: 560,
  ASPECT_RATIO: 16/9,
  
  // Turn-based specific
  TURNBASED_LIVES: 1,
  TURNBASED_SWITCH_THRESHOLD: 5.0,
  HIT_IFRAMES_DURATION: 1.2,
  AI_DECISION_FREQUENCY: 0.04,
  
  SPAWN: {
    COOLDOWN_NORMAL: 0.25,
    COOLDOWN_EARLY: 0.15,
    PICKUP_COOLDOWN_BASE: 3.0,
    PICKUP_COOLDOWN_RANDOM: 2.2
  },
  
  COLORS: {
    PLAYER_HUMAN: '#22d3ee',
    PLAYER_AI_GREEN: '#22c55e',
    PICKUP: '#22c55e',
    ENEMY_NORMAL: '#fb7185',
    ENEMY_TRACKER: '#8b5cf6',
    LIFE_HEART: '#f43f5e',
    TEXT: '#e2e8f0',
    DANGER_ZONE: '#ef4444'
  }
};

export function calculateDifficulty(elapsed: number): number {
  return elapsed / 12;
}

export function calculateSpawnCooldowns(difficulty: number) {
  const spawnInterval = GAME_CONFIG.SPAWN.COOLDOWN_NORMAL;
  const pickupSpawn = GAME_CONFIG.SPAWN.PICKUP_COOLDOWN_BASE + Math.random() * GAME_CONFIG.SPAWN.PICKUP_COOLDOWN_RANDOM;
  return { spawnInterval, pickupSpawn };
}

export function spawnEnemyWave(state: GameState, difficulty: number) {
  const side = Math.floor(Math.random() * 4);
  if (Math.random() < 0.08) {
    const n = 2;
    for (let i = 0; i < n; i++) spawnSingleEnemy(state, side, difficulty, i);
  } else {
    spawnSingleEnemy(state, side, difficulty, 0);
  }
}

function spawnSingleEnemy(state: GameState, side: number, diff: number, offset = 0) {
  const { width: W, height: H } = state;
  const r = Math.random();
  let kind: 'normal' | 'sprinter' | 'heavy' | 'zigzag' | 'tracker' = 'normal';
  
  // Progressive enemy introduction based on elapsed time
  if (state.elapsed < 3.0) {
    if (r < 0.4) kind = 'normal';
    else if (r < 0.65) kind = 'sprinter';
    else if (r < 0.85) kind = 'heavy';
    else kind = 'zigzag';
  } else {
    if (r < 0.35) kind = 'normal';
    else if (r < 0.55) kind = 'sprinter';
    else if (r < 0.70) kind = 'heavy';
    else if (r < 0.85) kind = 'zigzag';
    else kind = 'tracker';
  }

  const base = 110 + diff * 95;
  let speedMul = 1;
  let radius = 10 + Math.random() * 12;
  let zigAmp = 0, zigFreq = 0;
  let turnRate: number | undefined;

  // Configure enemy properties based on type
  switch (kind) {
    case 'sprinter':
      speedMul = 1.8 + Math.random() * 0.8;
      radius *= 0.8;
      break;
    case 'heavy':
      speedMul = 0.6 + Math.random() * 0.25;
      radius *= 1.35;
      break;
    case 'zigzag':
      speedMul = 1.1 + Math.random() * 0.4;
      zigAmp = 60 + Math.random() * 70;
      zigFreq = 4 + Math.random() * 3;
      break;
    case 'tracker':
      speedMul = 1.1 + Math.random() * 0.3;
      turnRate = Math.PI * (0.6 + Math.random() * 0.7);
      break;
    default:
      speedMul = 0.9 + Math.random() * 0.6;
  }

  const baseSpeed = base * speedMul;

  // Position based on spawn side
  let x = 0, y = 0, dirX = 0, dirY = 0;
  const edgeOffset = offset * 80;
  
  switch (side) {
    case 0: // Top
      x = Math.random() * W + edgeOffset;
      y = -radius;
      dirX = 0;
      dirY = 1;
      break;
    case 1: // Right
      x = W + radius;
      y = Math.random() * H + edgeOffset;
      dirX = -1;
      dirY = 0;
      break;
    case 2: // Bottom
      x = Math.random() * W + edgeOffset;
      y = H + radius;
      dirX = 0;
      dirY = -1;
      break;
    case 3: // Left
      x = -radius;
      y = Math.random() * H + edgeOffset;
      dirX = 1;
      dirY = 0;
      break;
  }

  // Add some randomness to direction
  const jitter = 0.25;
  dirX += (Math.random() - 0.5) * jitter;
  dirY += (Math.random() - 0.5) * jitter;
  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;

  state.hazards.push({
    x, y, r: radius, life: 14, kind, baseSpeed, t: 0, 
    dirX, dirY, zigAmp, zigFreq, turnRate
  });
}

export function spawnPickupAt(state: GameState, x?: number, y?: number) {
  const { width: W, height: H } = state;
  const pBias = state.lives < state.maxLives ? 1 : 0.4;
  if (Math.random() > 0.55 * pBias) return;
  
  const px = x ?? Math.random() * (W - 120) + 60;
  const py = y ?? Math.random() * (H - 120) + 60;
  state.pickups.push({
    x: px, y: py, r: 10, life: 6, maxLife: 6, type: 'heart'
  });
}

export function updatePlayerPhysics(state: GameState, dt: number, mvx: number, mvy: number, difficulty: number) {
  const P = state.player;
  const spd = P.speed * (1 + Math.min(0.6, difficulty * 0.09));
  const len = Math.hypot(mvx, mvy) || 1;
  const vx = (mvx / len) * spd;
  const vy = (mvy / len) * spd;
  state.playerVel.x = vx;
  state.playerVel.y = vy;
  P.x = Math.max(P.r, Math.min(state.width - P.r, P.x + vx * dt));
  P.y = Math.max(P.r, Math.min(state.height - P.r, P.y + vy * dt));
}

export function updateEnemies(state: GameState, dt: number) {
  const remainHaz = [];
  for (const h of state.hazards) {
    h.t += dt;
    
    // Handle tracker movement
    if (h.kind === 'tracker') {
      const tx = state.player.x - h.x;
      const ty = state.player.y - h.y;
      const tlen = Math.hypot(tx, ty) || 1;
      const dx = tx / tlen, dy = ty / tlen;
      const dot = h.dirX * dx + h.dirY * dy;
      const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
      const maxTurn = (h.turnRate ?? Math.PI) * dt;
      if (theta > 1e-4) {
        const k = Math.min(1, maxTurn / theta);
        h.dirX = (1 - k) * h.dirX + k * dx;
        h.dirY = (1 - k) * h.dirY + k * dy;
        const n = Math.hypot(h.dirX, h.dirY) || 1;
        h.dirX /= n;
        h.dirY /= n;
      }
    }
    
    // Calculate effective velocity
    let effVX = h.dirX * h.baseSpeed;
    let effVY = h.dirY * h.baseSpeed;
    if (h.kind === 'zigzag') {
      const pxn = -h.dirY, pyn = h.dirX;
      const osc = Math.sin(h.t * h.zigFreq) * h.zigAmp;
      effVX += pxn * osc;
      effVY += pyn * osc;
    }
    
    // Update position
    h.x += effVX * dt;
    h.y += effVY * dt;
    h.life -= dt;
    
    // Remove if out of bounds or expired
    if (h.x < -64 || h.x > state.width + 64 || h.y < -64 || h.y > state.height + 64 || h.life <= 0) {
      continue;
    }
    remainHaz.push(h);
  }
  state.hazards = remainHaz;
}

export function updatePickups(state: GameState, dt: number) {
  const remainPick = [];
  for (const p of state.pickups) {
    p.life -= dt;
    if (p.life > 0) remainPick.push(p);
  }
  state.pickups = remainPick;
}

export function checkCollisions(state: GameState): { hitEnemy: boolean; collectedPickups: any[] } {
  let hitEnemy = false;
  const collectedPickups = [];
  
  // Check enemy collisions
  for (const h of state.hazards) {
    const d = Math.hypot(h.x - state.player.x, h.y - state.player.y);
    if (d <= h.r + state.player.r) {
      hitEnemy = true;
      break;
    }
  }
  
  // Check pickup collection
  const rest = [];
  for (const p of state.pickups) {
    const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
    if (d <= p.r + state.player.r) {
      collectedPickups.push(p);
    } else {
      rest.push(p);
    }
  }
  state.pickups = rest;
  
  return { hitEnemy, collectedPickups };
}