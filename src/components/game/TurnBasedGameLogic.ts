import { GameState } from "../ai/DodgerAI";
import { GAME_CONFIG } from "./GameConstants";

export type Player = "human" | "ai";

export interface TurnRecord {
  player: Player;
  duration: number;
  qualified: boolean;
}

export interface TurnState {
  currentPlayer: Player;
  currentTurnTime: number;
  finalTotalTime: number;
  turnHistory: TurnRecord[];
  turnStartTime: number;
}

export interface GameRefs {
  currentPlayerRef: React.MutableRefObject<Player>;
  turnStartTimeRef: React.MutableRefObject<number>;
  aiCurrentActionRef: React.MutableRefObject<{ mvx: number; mvy: number; speed: number }>;
  aiDecideCDRef: React.MutableRefObject<number>;
}

export function createInitialTurnState(): TurnState {
  return {
    currentPlayer: "human",
    currentTurnTime: 0,
    finalTotalTime: 0,
    turnHistory: [],
    turnStartTime: Date.now(),
  };
}

export function resetForNewTurn(
  gameState: GameState,
  gameStateRef: React.MutableRefObject<any>,
  spawnSystemRef: React.MutableRefObject<any>,
  refs: GameRefs,
  nextPlayer?: Player
): void {
  const S = gameState;
  const G = gameStateRef.current;

  // Reset game state
  S.player.x = S.width / 2;
  S.player.y = S.height / 2;
  S.playerVel.x = 0;
  S.playerVel.y = 0;
  S.hazards = [];
  S.pickups = []; // 清空道具，轮换游戏不需要回复道具
  S.elapsed = 0;
  G.spawnCooldown = 0.1; // 使用与BasicGame相同的初始间隔
  // 移除pickupSpawnCooldown - 轮换游戏不生成道具
  S.lives = S.maxLives;
  G.hitIFrames = 0;
  G.over = false;

  // Reset AI state
  refs.aiCurrentActionRef.current = { mvx: 0, mvy: 0, speed: 0 };
  refs.aiDecideCDRef.current = 0;

  // Reset spawn system time
  if (spawnSystemRef.current) {
    spawnSystemRef.current.reset();
  }

  // Reset timing
  const now = Date.now();
  refs.turnStartTimeRef.current = now;

  if (nextPlayer) {
    refs.currentPlayerRef.current = nextPlayer;
  }
}

export function calculateSwitchPlayer(
  turnState: TurnState,
  refs: GameRefs,
  gameTime?: number // 可选的游戏时间参数
): { canSwitch: boolean; turnRecord: TurnRecord; newPlayer?: Player } {
  // 如果提供了游戏时间，使用游戏时间；否则使用实际时间戳
  let turnDuration: number;
  if (gameTime !== undefined) {
    turnDuration = gameTime;
    console.log(`🕐 使用游戏时间: ${turnDuration.toFixed(2)}s`);
  } else {
    const currentTime = Date.now();
    turnDuration = (currentTime - refs.turnStartTimeRef.current) / 1000;
    console.log(`🕐 使用实际时间戳: ${turnDuration.toFixed(2)}s`);
  }
  
  const canSwitch = turnDuration >= GAME_CONFIG.TURNBASED_SWITCH_THRESHOLD;
  console.log(`🔄 切换判断: ${turnDuration.toFixed(2)}s >= ${GAME_CONFIG.TURNBASED_SWITCH_THRESHOLD}s = ${canSwitch}`);

  const turnRecord: TurnRecord = {
    player: refs.currentPlayerRef.current,
    duration: turnDuration,
    qualified: canSwitch,
  };

  const newPlayer = canSwitch 
    ? (refs.currentPlayerRef.current === "human" ? "ai" : "human")
    : undefined;

  console.log(`🔄 切换逻辑: 当前玩家=${refs.currentPlayerRef.current}, 新玩家=${newPlayer}`);

  return { canSwitch, turnRecord, newPlayer };
}

export function getTotalTime(turnHistory: TurnRecord[], currentTurnTime: number): number {
  const previousTotal = turnHistory.reduce((sum, turn) => sum + turn.duration, 0);
  return previousTotal + currentTurnTime;
}

export function playerHit(
  gameState: GameState,
  gameStateRef: React.MutableRefObject<any>,
  onPlayerDeath: () => void
): void {
  const S = gameState;
  const G = gameStateRef.current;
  
  if (G.hitIFrames > 0 || G.over) return;

  S.lives = Math.max(0, S.lives - 1);
  G.hitIFrames = GAME_CONFIG.HIT_IFRAMES_DURATION;

  if (S.lives <= 0) {
    G.over = true;
    onPlayerDeath();
  }
}