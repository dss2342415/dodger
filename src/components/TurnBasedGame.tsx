import React, { useEffect, useRef, useState } from "react";
import { 
  createInferenceAI, 
  DodgerAI,
  GameState
} from "./ai/DodgerAI";
import { 
  EnemySpawnSystem, 
  createSpawnSystem, 
  GlobalSeedManager, 
  GAME_SEEDS 
} from "./game/EnemySpawnSystem";
import { createGameLoop } from "./game/GameCanvas";
import { useKeyboardInput, useDevicePixelRatio } from "./game/GameHooks";
import { GAME_CONFIG } from "./game/GameConstants";
import { 
  TurnRecord, 
  Player,
  createInitialTurnState,
  resetForNewTurn,
  calculateSwitchPlayer,
  playerHit as handlePlayerHit,
  GameRefs
} from "./game/TurnBasedGameLogic";
import { TurnBasedGameUI } from "./TurnBasedGame/TurnBasedGameUI";
import { updateGame, drawGame } from "./TurnBasedGame/TurnBasedGameCanvas";

interface TurnBasedGameProps {
  onBack: () => void;
}

export function TurnBasedGame({ onBack }: TurnBasedGameProps) {
  // UI State
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player>("human");
  const [currentTurnTime, setCurrentTurnTime] = useState(0);
  const [finalTotalTime, setFinalTotalTime] = useState(0);
  const [turnHistory, setTurnHistory] = useState<TurnRecord[]>([]);

  // AI Instance
  const aiRef = useRef<DodgerAI>(createInferenceAI());
  const [hasCustomWeights, setHasCustomWeights] = useState(false);

  // Enemy Spawn System
  const spawnSystemRef = useRef<EnemySpawnSystem | null>(null);

  // Canvas and refs
  const wrapperRef = useRef<HTMLDivElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const fileRef = useRef<HTMLInputElement>(null!);
  const dpr = useDevicePixelRatio();

  // Game refs
  const refs: GameRefs = {
    currentPlayerRef: useRef<Player>("human"),
    turnStartTimeRef: useRef<number>(0),
    aiCurrentActionRef: useRef({ mvx: 0, mvy: 0, speed: 0 }),
    aiDecideCDRef: useRef(0)
  };

  // 独立的轮换时间跟踪
  const turnTimeRef = useRef<number>(0);

  // Game state
  const stateRef = useRef<GameState>({
    width: GAME_CONFIG.DEFAULT_WIDTH,
    height: GAME_CONFIG.DEFAULT_HEIGHT,
    player: { x: 480, y: 280, r: GAME_CONFIG.PLAYER_RADIUS, speed: GAME_CONFIG.PLAYER_SPEED },
    playerVel: { x: 0, y: 0 },
    hazards: [],
    pickups: [],
    elapsed: 0,
    lives: GAME_CONFIG.TURNBASED_LIVES,
    maxLives: GAME_CONFIG.TURNBASED_LIVES,
  });

  const gameStateRef = useRef({
    spawnCooldown: 0,
    pickupSpawnCooldown: 4,
    over: false,
    hitIFrames: 0,
  });

  // Hooks
  const keysRef = useKeyboardInput();

  // Initialize AI
  useEffect(() => {
    async function initializeAI() {
      // 首先尝试从预设文件加载权重
      const presetLoaded = await aiRef.current.loadFromPresetFile();
      if (presetLoaded) {
        setHasCustomWeights(true);
        console.log("✅ 轮换模式已加载预设AI权重");
      } else {
        // 如果预设文件加载失败，尝试从本地存储加载
        const storageLoaded = aiRef.current.loadFromStorage();
        setHasCustomWeights(storageLoaded);
        if (!storageLoaded) {
          console.log("⚠️ 轮换模式使用默认启发式权重");
        }
      }
    }
    
    initializeAI();
  }, []);

  // Canvas setup
  useEffect(() => {
    const handleResize = () => {
      const wrap = wrapperRef.current;
      const cvs = canvasRef.current;
      if (!wrap || !cvs) return;

      // 使用wrapper容器的尺寸来获取真实的网页比例
      const wrapperRect = wrap.getBoundingClientRect();
      
      // 扩大游戏界面：游戏容器按16:9比例填充，占据58%的高度，添加页边距
      // 游戏区域高度为58%，游戏画布在保持16:9比例的情况下尽可能大
      const gameAreaHeight = wrapperRect.height * 0.58; // 58%的高度给游戏区域
      const availableWidth = wrapperRect.width - 128; // 减去更大的左右边距(64px * 2)
      const availableHeight = gameAreaHeight - 80; // 减去标题栏高度和内边距
      
      // 严格使用16:9比例，尽可能填充容器
      const targetRatio = 16/9;
      let gameWidth, gameHeight;
      
      // 计算按宽度和高度限制的两种情况
      const widthLimitedHeight = availableWidth / targetRatio;
      const heightLimitedWidth = availableHeight * targetRatio;
      
      if (widthLimitedHeight <= availableHeight) {
        // 按宽度限制，宽度触碰容器边界
        gameWidth = availableWidth;
        gameHeight = widthLimitedHeight;
      } else {
        // 按高度限制，高度触碰容器边界
        gameHeight = availableHeight;
        gameWidth = heightLimitedWidth;
      }

      // 设置游戏逻辑尺寸
      stateRef.current.width = gameWidth;
      stateRef.current.height = gameHeight;

      // 设置canvas实际显示尺寸（使用计算出的游戏尺寸）
      const displayWidth = gameWidth;
      const displayHeight = gameHeight;

      cvs.width = Math.floor(displayWidth * dpr);
      cvs.height = Math.floor(displayHeight * dpr);
      cvs.style.width = `${displayWidth}px`;
      cvs.style.height = `${displayHeight}px`;

      const ctx = cvs.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.scale(displayWidth / gameWidth, displayHeight / gameHeight);
      }
    };

    const timer = setTimeout(handleResize, 100);
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      setTimeout(handleResize, 10);
    });

    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [dpr]);

  // Game loop
  const { startLoop, stopLoop } = createGameLoop(
    canvasRef,
    (dt: number) => updateGame(dt, {
      gameState: stateRef.current,
      gameStateRef,
      spawnSystemRef,
      aiRef,
      keysRef,
      refs,
      gameOver,
      running,
      onPlayerHit: () => handlePlayerHit(stateRef.current, gameStateRef, handlePlayerDeath),
      setCurrentTurnTime,
      turnTimeRef
    }),
    () => drawGame({
      canvas: canvasRef.current,
      gameState: stateRef.current,
      gameStateRef,
      spawnSystemRef,
      currentPlayer: refs.currentPlayerRef.current, // 使用ref中的最新值
      currentTurnTime: turnTimeRef.current, // 使用ref中的最新值  
      turnHistory,
      gameOver,
      running
    }),
    () => running || !gameOver
  );

  useEffect(() => {
    startLoop();
    return stopLoop;
  }, [running]);

  // 确保React state与ref同步
  useEffect(() => {
    if (running && refs.currentPlayerRef.current !== currentPlayer) {
      console.log(`🔄 同步玩家状态: state=${currentPlayer} → ref=${refs.currentPlayerRef.current}`);
      setCurrentPlayer(refs.currentPlayerRef.current);
    }
  }, [running, refs.currentPlayerRef.current]);

  // Core game functions
  function handlePlayerDeath() {
    // 使用最新的轮换时间（因为时间更新可能已经停止）
    const actualTurnTime = turnTimeRef.current;
    
    const turnState = { currentPlayer, currentTurnTime: actualTurnTime, finalTotalTime, turnHistory, turnStartTime: refs.turnStartTimeRef.current };
    
    // 详细调试信息
    console.log(`🔍 死亡调试信息:`);
    console.log(`  - currentPlayer state: ${currentPlayer}`);
    console.log(`  - currentPlayerRef: ${refs.currentPlayerRef.current}`);
    console.log(`  - actualTurnTime ref: ${actualTurnTime}`);
    console.log(`  - TURNBASED_SWITCH_THRESHOLD: ${GAME_CONFIG.TURNBASED_SWITCH_THRESHOLD}`);
    
    // 不要覆盖ref，使用ref中的当前值（这是实际在游戏循环中使用的玩家）
    console.log(`🎮 使用ref中的玩家进行切换判断: ${refs.currentPlayerRef.current}`);
    
    // 使用实际的轮换时间进行计算，不强制同步ref
    const { canSwitch, turnRecord, newPlayer } = calculateSwitchPlayer(turnState, refs, actualTurnTime);
    
    console.log(`  - canSwitch: ${canSwitch}`);
    console.log(`  - turnRecord.duration: ${turnRecord.duration}`);
    console.log(`  - turnRecord.qualified: ${turnRecord.qualified}`);
    console.log(`  - newPlayer: ${newPlayer}`);
    
    const previousTotalTime = turnHistory.reduce((sum: number, turn: TurnRecord) => sum + turn.duration, 0);
    const currentTotalTime = previousTotalTime + turnRecord.duration;

    console.log(`📊 时间调试 - 计算轮次信息:`);
    console.log(`  - 新轮次时间: ${turnRecord.duration.toFixed(2)}s`);
    console.log(`  - 历史轮次数: ${turnHistory.length}`);
    console.log(`  - 历史总时间: ${previousTotalTime.toFixed(2)}s`);
    console.log(`  - 当前总时间: ${currentTotalTime.toFixed(2)}s`);

    if (canSwitch && newPlayer) {
      // 如果达到了5秒，切换到下一个玩家
      console.log(`🔄 死亡切换：${refs.currentPlayerRef.current === "human" ? "玩家" : "AI"}(${turnRecord.duration.toFixed(2)}s) → ${newPlayer === "human" ? "玩家" : "AI"}`);
      
      // 添加当前轮次到历史记录
      setTurnHistory((prev: TurnRecord[]) => [...prev, turnRecord]);
      
      // 重置游戏状态并切换玩家
      resetForNewTurn(stateRef.current, gameStateRef, spawnSystemRef, refs, newPlayer);
      setCurrentPlayer(newPlayer);
      setCurrentTurnTime(0);
      turnTimeRef.current = 0; // 重置轮换时间
      setGameOver(false);
      // 确保游戏状态不是over，以便继续游戏
      gameStateRef.current.over = false;
      console.log(`✅ 切换完成：当前玩家 = ${newPlayer}, ref = ${refs.currentPlayerRef.current}`);
    } else {
      // 如果没达到5秒，游戏结束
      console.log(`💀 玩家死亡，仅存活${turnRecord.duration.toFixed(2)}秒，未达到5秒阈值，游戏结束`);
      
      // 🔧 修复：只添加一次记录到历史
      setTurnHistory((prev: TurnRecord[]) => [...prev, turnRecord]);
      setFinalTotalTime(currentTotalTime);
      setGameOver(true);
      setRunning(false);
    }
  }

  function switchPlayer() {
    const turnState = { currentPlayer, currentTurnTime, finalTotalTime, turnHistory, turnStartTime: refs.turnStartTimeRef.current };
    
    console.log(`🎮 主动切换前: currentPlayer state = ${currentPlayer}, ref = ${refs.currentPlayerRef.current}`);
    
    // 使用游戏内时间而非实际时间戳进行计算，不强制同步ref
    const { canSwitch, turnRecord, newPlayer } = calculateSwitchPlayer(turnState, refs, currentTurnTime);
    
    // 主动切换只有在达到5秒后才能进行
    if (!canSwitch) {
      console.log("还未达到5秒，无法主动切换");
      return;
    }

    console.log(`✨ 主动切换：${refs.currentPlayerRef.current === "human" ? "玩家" : "AI"}(${turnRecord.duration.toFixed(2)}s) → ${newPlayer === "human" ? "玩家" : "AI"}`);
    
    // 更新轮换历史
    setTurnHistory((prev: TurnRecord[]) => [...prev, turnRecord]);
    
    console.log(`📊 主动切换时间调试:`);
    console.log(`  - 轮次时间: ${turnRecord.duration.toFixed(2)}s`);
    console.log(`  - 历史轮次数: ${turnHistory.length} → ${turnHistory.length + 1}`);

    if (newPlayer) {
      resetForNewTurn(stateRef.current, gameStateRef, spawnSystemRef, refs, newPlayer);
      setCurrentPlayer(newPlayer);
      setCurrentTurnTime(0);
      turnTimeRef.current = 0; // 重置轮换时间
      setGameOver(false);
      console.log(`✅ 主动切换完成：当前玩家 = ${newPlayer}, ref = ${refs.currentPlayerRef.current}`);
    }
  }

  function startGame() {
    // 使用预设权重文件，不再检查自定义权重
    if (!hasCustomWeights) {
      const proceed = confirm('预设AI权重加载失败，将使用默认启发式权重。是否继续？');
      if (!proceed) return;
    }

    // Initialize spawn system
    const seed = GlobalSeedManager.getSeed(GAME_SEEDS.BASIC_TURNBASED);
    spawnSystemRef.current = createSpawnSystem('basic_turnbased', seed);
    console.log(`🔄 页面3（轮换游戏）启动 - 使用标准敌人配置（无回复道具）`);
    console.log(`🌟 敌人配置：0-5s(6个) → 5-10s(10个) → 10-15s(15个) → 15-20s(20个) → 后续递增`);
    console.log(`⚡ AI动态速度控制：根据威胁距离、TTC、心形紧急度、边界拥挤度自适应调速`);
    console.log(`📌 注意：此配置与页面1（基础游玩）敌人配置完全相同，但移除了所有回复道具`);
    console.log(`❌ 特殊机制：轮换游戏中没有心形回复道具，增加挑战难度`);

    // Reset all state
    const initialState = createInitialTurnState();
    console.log(`🎮 游戏开始：初始玩家 = ${initialState.currentPlayer}`);
    
    setCurrentPlayer(initialState.currentPlayer);
    setCurrentTurnTime(initialState.currentTurnTime);
    setFinalTotalTime(initialState.finalTotalTime);
    setTurnHistory(initialState.turnHistory);
    
    refs.currentPlayerRef.current = initialState.currentPlayer;
    refs.turnStartTimeRef.current = initialState.turnStartTime;
    turnTimeRef.current = 0; // 重置轮换时间

    resetForNewTurn(stateRef.current, gameStateRef, spawnSystemRef, refs);
    
    setRunning(true);
    setGameOver(false);
  }

  function stopGame() {
    // 主动结束游戏时，需要记录当前玩家的信息
    if (running && currentTurnTime > 0) {
      console.log(`🛑 主动结束游戏，记录当前轮次: ${refs.currentPlayerRef.current}玩家，时间${currentTurnTime.toFixed(2)}s`);
      
      const actualTurnTime = turnTimeRef.current;
      const turnState = { currentPlayer, currentTurnTime: actualTurnTime, finalTotalTime, turnHistory, turnStartTime: refs.turnStartTimeRef.current };
      
      // 计算最终记录（不需要切换，只记录）
      const { turnRecord } = calculateSwitchPlayer(turnState, refs, actualTurnTime);
      
      const previousTotalTime = turnHistory.reduce((sum: number, turn: TurnRecord) => sum + turn.duration, 0);
      const currentTotalTime = previousTotalTime + turnRecord.duration;
      
      // 更新最终记录
      setTurnHistory((prev: TurnRecord[]) => [...prev, turnRecord]);
      setFinalTotalTime(currentTotalTime);
      
      console.log(`📊 游戏结束统计: 总时间${currentTotalTime.toFixed(2)}s，总轮次${turnHistory.length + 1}`);
    }
    
    setRunning(false);
    setGameOver(true);
  }

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && running && !gameOver && 
          currentTurnTime >= GAME_CONFIG.TURNBASED_SWITCH_THRESHOLD) {
        e.preventDefault();
        switchPlayer();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, gameOver, currentTurnTime]);

  return (
    <TurnBasedGameUI
      running={running}
      gameOver={gameOver}
      currentPlayer={currentPlayer}
      currentTurnTime={currentTurnTime}
      finalTotalTime={finalTotalTime}
      turnHistory={turnHistory}
      hasCustomWeights={hasCustomWeights}
      onBack={onBack}
      onStartGame={startGame}
      onStopGame={stopGame}
      onSwitchPlayer={switchPlayer} // 添加切换函数
      canvasRef={canvasRef}
      fileRef={fileRef}
      wrapperRef={wrapperRef}
      onFileChange={(e) => {
        // 移除了导入权重功能 - 现在使用预设权重
        console.log("导入功能已禁用，使用预设权重文件");
        e.currentTarget.value = '';
      }}
    />
  );
}