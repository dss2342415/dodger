import React from "react";
import { GameState, DodgerAI } from "../ai/DodgerAI";
import { EnemySpawnSystem } from "../game/EnemySpawnSystem";
import { 
  calculateDifficulty,
  updateEnemies,
  checkCollisions
} from "../game/GameEngine";
import { 
  drawBackground,
  drawGrid,
  drawPlayer,
  drawEnemies,
  drawLives,
  drawHUD,
  drawGameOverlay
} from "../game/GameRenderer";
import { GAME_CONFIG } from "../game/GameConstants";
import { Player, GameRefs, TurnRecord } from "../game/TurnBasedGameLogic";

export interface UpdateParams {
  gameState: GameState;
  gameStateRef: React.MutableRefObject<any>;
  spawnSystemRef: React.MutableRefObject<EnemySpawnSystem | null>;
  aiRef: React.MutableRefObject<DodgerAI>;
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  refs: GameRefs;
  gameOver: boolean;
  running: boolean;
  onPlayerHit: () => void;
  setCurrentTurnTime: (time: number) => void;
  turnTimeRef: React.MutableRefObject<number>;
}

export interface DrawParams {
  canvas: HTMLCanvasElement | null;
  gameState: GameState;
  gameStateRef: React.MutableRefObject<any>;
  spawnSystemRef: React.MutableRefObject<EnemySpawnSystem | null>;
  currentPlayer: Player;
  currentTurnTime: number;
  turnHistory: TurnRecord[];
  gameOver: boolean;
  running: boolean;
}

// 使用与BasicGame相同的敌人维持系统
function maintainEnemies(
  gameState: GameState,
  spawnSystemRef: React.MutableRefObject<EnemySpawnSystem | null>
): void {
  const spawnSystem = spawnSystemRef.current;
  if (!spawnSystem) {
    console.warn("⚠️ 敌人生成系统未初始化");
    return;
  }

  // 使用新的维持敌人数量方法（与BasicGame完全相同）
  spawnSystem.maintainEnemyCount(gameState);
}

export function updateGame(dt: number, params: UpdateParams): void {
  const { 
    gameState: S, 
    gameStateRef, 
    spawnSystemRef, 
    aiRef, 
    keysRef, 
    refs, 
    gameOver, 
    running,
    onPlayerHit,
    setCurrentTurnTime,
    turnTimeRef
  } = params;
  
  const G = gameStateRef.current;

  // 使用游戏状态的over标志而不是React state，避免异步更新问题
  if (G.over || !running) return;

  S.elapsed += dt;
  G.hitIFrames = Math.max(0, G.hitIFrames - dt);
  
  // 独立跟踪轮换时间
  turnTimeRef.current += dt;
  setCurrentTurnTime(turnTimeRef.current);

  // 更新敌人生成系统时间
  if (spawnSystemRef.current) {
    spawnSystemRef.current.updateTime(dt);
  }

  // 敌人数量维持系统 - 与BasicGame完全相同的逻辑
  G.spawnCooldown -= dt;
  if (G.spawnCooldown <= 0) {
    G.spawnCooldown = 0.5; // 每0.5秒检查一次敌人数量
    maintainEnemies(S, spawnSystemRef);
  }

  // 移除回复道具生成逻辑 - 轮换游戏不需要回复道具

  // Control - 支持动态速度控制
  let mvx = 0, mvy = 0, speedMultiplier = 1.0;
  
  if (refs.currentPlayerRef.current === "human") {
    const K = keysRef.current;
    if (K["arrowleft"] || K["a"]) mvx -= 1;
    if (K["arrowright"] || K["d"]) mvx += 1;
    if (K["arrowup"] || K["w"]) mvy -= 1;
    if (K["arrowdown"] || K["s"]) mvy += 1;
    speedMultiplier = (mvx !== 0 || mvy !== 0) ? 1.0 : 0.0;
  } else {
    // AI control with dynamic speed
    refs.aiDecideCDRef.current -= dt;
    mvx = refs.aiCurrentActionRef.current.mvx;
    mvy = refs.aiCurrentActionRef.current.mvy;
    speedMultiplier = refs.aiCurrentActionRef.current.speed;

    if (refs.aiDecideCDRef.current <= 0) {
      refs.aiDecideCDRef.current = GAME_CONFIG.AI_DECISION_FREQUENCY;
      try {
        const decision = aiRef.current.decide(S, calculateDifficulty(S.elapsed), false);
        refs.aiCurrentActionRef.current = { 
          mvx: decision.mvx, 
          mvy: decision.mvy, 
          speed: decision.speed
        };
        mvx = decision.mvx;
        mvy = decision.mvy;
        speedMultiplier = decision.speed;
      } catch (error) {
        console.error("❌ AI决策错误:", error);
      }
    }
  }

  // Physics updates - 使用动态速度控制
  const P = S.player;
  const diff = calculateDifficulty(S.elapsed);
  const baseDifficultySpeedMultiplier = (1 + Math.min(0.6, diff * 0.09));
  const finalSpeed = P.speed * baseDifficultySpeedMultiplier * speedMultiplier;
  
  const len = Math.hypot(mvx, mvy) || 1;
  const vx = (mvx / len) * finalSpeed;
  const vy = (mvy / len) * finalSpeed;
  S.playerVel.x = vx;
  S.playerVel.y = vy;
  P.x = Math.max(P.r, Math.min(S.width - P.r, P.x + vx * dt));
  P.y = Math.max(P.r, Math.min(S.height - P.r, P.y + vy * dt));

  // 敌人更新 - 使用与BasicGame相同的逻辑
  const remainHaz = [];
  for (const h of S.hazards) {
    h.t += dt;
    if (h.kind === 'tracker') {
      const tx = S.player.x - h.x;
      const ty = S.player.y - h.y;
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
    let effVX = h.dirX * h.baseSpeed;
    let effVY = h.dirY * h.baseSpeed;
    if (h.kind === 'zigzag') {
      const pxn = -h.dirY, pyn = h.dirX;
      const osc = Math.sin(h.t * h.zigFreq) * h.zigAmp;
      effVX += pxn * osc;
      effVY += pyn * osc;
    }
    h.x += effVX * dt;
    h.y += effVY * dt;
    h.life -= dt;
    if (h.x < -64 || h.x > S.width + 64 || h.y < -64 || h.y > S.height + 64 || h.life <= 0) continue;
    remainHaz.push(h);
  }
  S.hazards = remainHaz;

  // 移除道具更新逻辑 - 轮换游戏不需要道具
  S.pickups = []; // 确保没有道具

  // 碰撞检测 - 简化版本，只检测敌人碰撞
  if (G.hitIFrames <= 0) {
    for (const h of S.hazards) {
      const d = Math.hypot(h.x - S.player.x, h.y - S.player.y);
      if (d <= h.r + S.player.r) {
        onPlayerHit();
        break;
      }
    }
  }

  // 移除道具拾取逻辑 - 轮换游戏不需要道具
}

export function drawGame(params: DrawParams): void {
  const {
    canvas: cvs,
    gameState: S,
    gameStateRef,
    spawnSystemRef,
    currentPlayer,
    currentTurnTime,
    turnHistory,
    gameOver,
    running
  } = params;

  if (!cvs) return;
  const ctx = cvs.getContext("2d");
  if (!ctx) return;

  const G = gameStateRef.current;
  const W = S.width, H = S.height;

  // Background and grid
  drawBackground(ctx, W, H);
  drawGrid(ctx, W, H, calculateDifficulty(S.elapsed));

  // Player
  const playerColor = currentPlayer === "human" ? 
    GAME_CONFIG.COLORS.PLAYER_HUMAN : 
    GAME_CONFIG.COLORS.PLAYER_AI_GREEN;
  drawPlayer(ctx, S, G.hitIFrames, playerColor);

  // 只绘制敌人，不绘制道具
  drawEnemies(ctx, S.hazards);
  drawLives(ctx, S.lives, S.maxLives);

  // HUD - 只显示本轮玩家和本轮时间
  const hudLines = [
    `Current Player: ${currentPlayer === "human" ? "Player" : "AI"}`,
    `Current Turn Time: ${currentTurnTime.toFixed(2)}s`
  ];

  if (running && !G.over && currentTurnTime >= GAME_CONFIG.TURNBASED_SWITCH_THRESHOLD) {
    hudLines.push("✅ Can Switch (Press Space)");
  }

  // 绘制HUD
  ctx.fillStyle = 'white';
  drawHUD(ctx, hudLines, W);

  // Game over screen - 只有当React state gameOver为true且运行停止时才显示
  if (gameOver && !running) {
    drawGameOverlay(ctx, W, H);
  }
}