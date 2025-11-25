import { GameState } from "./EnemySpawnSystem";
import { GAME_CONFIG, calculateDifficulty } from "./GameEngine";

const COLORS = {
  BACKGROUND: {
    START: '#0b1220',
    END: '#0a0f1a'
  },
  GRID: '#64748b',
  PLAYER: '#22d3ee',
  PICKUP: '#22c55e',
  ENEMY_NORMAL: '#fb7185',
  ENEMY_TRACKER: '#8b5cf6',
  LIFE_HEART: '#f43f5e',
  TEXT: '#e2e8f0',
  DANGER_ZONE: '#ef4444'
};

export function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, COLORS.BACKGROUND.START);
  g.addColorStop(1, COLORS.BACKGROUND.END);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

export function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, difficulty: number) {
  const alpha = 0.08 + Math.min(0.12, difficulty * 0.02);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 40) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, hitIFrames: number, color: string = COLORS.PLAYER) {
  const flicker = hitIFrames > 0 ? (Math.sin(state.elapsed * 25) > 0 ? 0.4 : 1) : 1;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawEnemies(ctx: CanvasRenderingContext2D, hazards: any[]) {
  for (const h of hazards) {
    ctx.fillStyle = (h.kind === 'tracker') ? COLORS.ENEMY_TRACKER : COLORS.ENEMY_NORMAL;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean, color: string = COLORS.LIFE_HEART) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.25);
  ctx.bezierCurveTo(0, 0, -size * 0.5, 0, -size * 0.5, size * 0.25);
  ctx.bezierCurveTo(-size * 0.5, size * 0.55, 0, size * 0.9, 0, size * 1.1);
  ctx.bezierCurveTo(0, size * 0.9, size * 0.5, size * 0.55, size * 0.5, size * 0.25);
  ctx.bezierCurveTo(size * 0.5, 0, 0, 0, 0, size * 0.25);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
  } else {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#475569';
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPickups(ctx: CanvasRenderingContext2D, pickups: any[]) {
  for (const p of pickups) {
    const remaining = p.life;
    const blink = remaining <= 2;
    const alpha = !blink ? 1 : (Math.sin((2 - remaining) * 14) > 0 ? 0.35 : 1);
    ctx.globalAlpha = Math.max(0.25, alpha);
    drawHeart(ctx, p.x, p.y, 12, true, COLORS.PICKUP);
    ctx.globalAlpha = 1;
  }
}

export function drawLives(ctx: CanvasRenderingContext2D, lives: number, maxLives: number) {
  const padX = 12;
  const padY = 12;
  const heartSize = 10;
  const gap = 22;
  
  for (let i = 0; i < maxLives; i++) {
    const filled = i < lives;
    drawHeart(ctx, padX + i * gap, padY, heartSize, filled, COLORS.LIFE_HEART);
  }
}

export function drawHUD(ctx: CanvasRenderingContext2D, lines: string[], width: number) {
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = '600 16px ui-sans-serif,system-ui,-apple-system';
  
  const hudX = width - 12;
  let hudY = 22;
  ctx.textAlign = 'right';
  for (const line of lines) {
    ctx.fillText(line, hudX, hudY);
    hudY += 20;
  }
  ctx.textAlign = 'left';
}

export function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string = '700 28px ui-sans-serif,system-ui,-apple-system', color: string = COLORS.TEXT) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

export function drawGameOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Semi-transparent background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, width, height);
}

export function drawBoundaryDangerZone(ctx: CanvasRenderingContext2D, width: number, height: number, dangerZone: number) {
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = COLORS.DANGER_ZONE;
  ctx.fillRect(0, 0, dangerZone, height); // Left
  ctx.fillRect(width - dangerZone, 0, dangerZone, height); // Right
  ctx.fillRect(0, 0, width, dangerZone); // Top
  ctx.fillRect(0, height - dangerZone, width, dangerZone); // Bottom
  ctx.globalAlpha = 1;
}