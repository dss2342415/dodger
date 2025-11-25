import { useEffect, useRef, useState } from "react";
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
import { GAME_CONFIG } from "./game/GameConstants";

interface PvAIGameProps {
  onBack: () => void;
}

export function PvAIGame({ onBack }: PvAIGameProps) {
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAIScore] = useState(0);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);
  const [battleRecorded, setBattleRecorded] = useState(false);
  const [partialGameOver, setPartialGameOver] = useState(false);
  
  // 最佳分数记录
  const [bestPlayerPvAI, setBestPlayerPvAI] = useState<number>(0);
  const [bestAIPvAI, setBestAIPvAI] = useState<number>(0);
  
  // 对战历史记录
  interface BattleRecord {
    timestamp: string;
    playerScore: number;
    aiScore: number;
    winner: 'player' | 'ai' | null;
    duration: number;
  }
  const [battleHistory, setBattleHistory] = useState<BattleRecord[]>([]);

  // AI实例 - 仅推理模式
  const aiRef = useRef<DodgerAI>(createInferenceAI());
  const [hasCustomWeights, setHasCustomWeights] = useState(false);
  const aiDecideCDRef = useRef(0);

  // 敌人生成系统 - 双方共享一个系统
  const spawnSystemRef = useRef<EnemySpawnSystem | null>(null);

  // 画布
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const playerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reqRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // 文件导入引用 - 移除了导入AI权重功能
  // const fileRef = useRef<HTMLInputElement | null>(null);

  // 双重游戏状态
  const playerStateRef = useRef<GameState>({
    width: 600,
    height: 337.5, // 16:9 比例
    player: { x: 300, y: 168.75, r: 12, speed: 300 },
    playerVel: { x: 0, y: 0 },
    hazards: [],
    pickups: [],
    elapsed: 0,
    lives: 3,
    maxLives: 3,
  });

  const aiStateRef = useRef<GameState>({
    width: 600,
    height: 337.5, // 16:9 比例
    player: { x: 300, y: 168.75, r: 12, speed: 300 },
    playerVel: { x: 0, y: 0 },
    hazards: [],
    pickups: [],
    elapsed: 0,
    lives: 3,
    maxLives: 3,
  });

  // 扩展状态
  const playerGameRef = useRef({
    spawnCooldown: 0,
    pickupSpawnCooldown: 4,
    over: false,
    hitIFrames: 0,
  });

  const aiGameRef = useRef({
    spawnCooldown: 0,
    pickupSpawnCooldown: 4,
    over: false,
    hitIFrames: 0,
  });

  // 键盘控制
  const keysRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { 
      // 防止方向键和WASD键触发页面滚动
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
          e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'd' ||
          e.key === ' ') { // 也阻止空格键滚动
        e.preventDefault();
      }
      keysRef.current[e.key.toLowerCase()] = true; 
    };
    const onUp = (e: KeyboardEvent) => { 
      // 防止方向键和WASD键触发页面滚动
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
          e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'd' ||
          e.key === ' ') { // 也阻止空格键滚动
        e.preventDefault();
      }
      keysRef.current[e.key.toLowerCase()] = false; 
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // 初始化AI和加载最佳分数
  useEffect(() => {
    async function initializeAI() {
      // 首先尝试从预设文件加载权重
      const presetLoaded = await aiRef.current.loadFromPresetFile();
      if (presetLoaded) {
        setHasCustomWeights(true);
        console.log("✅ PvAI模式已加载预设AI权重");
      } else {
        // 如果预设文件加载失败，尝试从本地存储加载
        const storageLoaded = aiRef.current.loadFromStorage();
        setHasCustomWeights(storageLoaded);
        if (!storageLoaded) {
          console.log("⚠️ 使用默认启发式权重");
        }
      }
    }
    
    initializeAI();
    
    // 🔄 每次应用启动时清除历史最佳分数记录
    console.log("🗑️ 清除人机对战历史记录");
    localStorage.removeItem('dodger_best_player_pvai_v1');
    localStorage.removeItem('dodger_best_ai_pvai_v1');
    
    // 重置最佳分数为0
    setBestPlayerPvAI(0);
    setBestAIPvAI(0);
  }, []);

  // 自适应尺寸 - 强制16:9比例
  useEffect(() => {
    const handleResize = () => {
      const wrap = wrapperRef.current;
      if (!wrap || !playerCanvasRef.current || !aiCanvasRef.current) return;
      
      const rect = wrap.getBoundingClientRect();
      
      // 为双画布计算适合的尺寸，考虑留白空间
      const availableWidth = rect.width / 2 - 32 - 24; // 双画布各占一半，减去间距和左右留白(px-3 = 12px * 2)
      const availableHeight = rect.height * 0.55 - 20 - 16; // 使用55%的高度空间，减去上下留白(py-2 = 8px * 2)
      
      // 强制使用16:9比例
      const targetRatio = 16/9;
      let w, h;
      
      if (availableWidth / availableHeight > targetRatio) {
        // 高度限制，使用完整高度
        h = Math.max(400, availableHeight);
        w = h * targetRatio;
      } else {
        // 宽度限制，使用完整宽度
        w = Math.max(600, availableWidth);
        h = w / targetRatio;
      }
      
      playerStateRef.current.width = w;
      playerStateRef.current.height = h;
      aiStateRef.current.width = w;
      aiStateRef.current.height = h;
      
      [playerCanvasRef.current, aiCanvasRef.current].forEach(cvs => {
        if (cvs) {
          // 设置画布的实际像素尺寸
          cvs.width = Math.floor(w * dpr);
          cvs.height = Math.floor(h * dpr);
          
          // 设置画布的CSS显示尺寸，确保16:9比例并在留白区域内居中显示
          const maxWidth = availableWidth;
          const maxHeight = availableHeight;
          
          // 确保画布不超过留白区域
          const displayWidth = Math.min(w, maxWidth);
          const displayHeight = Math.min(h, maxHeight);
          
          cvs.style.width = `${displayWidth}px`;
          cvs.style.height = `${displayHeight}px`;
          cvs.style.maxWidth = 'none';
          cvs.style.maxHeight = 'none';
          cvs.style.display = 'block';
          
          const ctx = cvs.getContext('2d');
          if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      });
    };
    
    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [dpr]);

  // 游戏逻辑函数
  function difficulty(elapsed: number) { return elapsed / 12; }

  // 使用新的敌人维持系统
  function maintainEnemies(state: GameState) {
    const spawnSystem = spawnSystemRef.current;
    if (!spawnSystem) {
      console.log("⚠️ 敌人生成系统未初始化");
      return;
    }

    console.log(`🔍 维持敌人检查: 当前时间=${state.elapsed.toFixed(2)}s, 当前敌人数=${state.hazards.length}, 目标数=${spawnSystem.getCurrentTargetCount()}`);

    // 使用新的维持敌人数量方法
    // 需要类型转换以匹配 EnemySpawnSystem 的 GameState 接口
    const convertedState = {
      ...state,
      hazards: state.hazards.map(h => ({
        ...h,
        kind: h.kind as 'normal' | 'sprinter' | 'heavy' | 'zigzag' | 'tracker',
        zigAmp: h.zigAmp || 0,
        zigFreq: h.zigFreq || 0
      }))
    };
    
    // 调用敌人维持方法（会修改传入的状态）
    spawnSystem.maintainEnemyCount(convertedState as any);
    
    // 同步新生成的敌人回到原始状态
    state.hazards = convertedState.hazards.map(h => ({
      ...h,
      kind: h.kind as string, // 转换回原始类型
      zigAmp: h.zigAmp,
      zigFreq: h.zigFreq
    }));
    
    console.log(`✅ 敌人维持完成: 更新后敌人数=${state.hazards.length}`);
  }

  function spawnHeartAt(state: GameState, x?: number, y?: number) {
    const { width: W, height: H } = state;
    const pBias = state.lives < state.maxLives ? 1 : 0.4;
    if (Math.random() > 0.55 * pBias) return;
    const px = x ?? Math.random() * (W - 120) + 60;
    const py = y ?? Math.random() * (H - 120) + 60;
    state.pickups.push({
      x: px, y: py, r: 10, life: 6, maxLife: 6, type: 'heart'
    });
  }

  function playerHit(state: GameState, gameState: any) {
    if (gameState.hitIFrames > 0 || gameState.over) return;
    
    state.lives = Math.max(0, state.lives - 1); 
    gameState.hitIFrames = 1.2;
    
    if (state.lives <= 0) {
      gameState.over = true;
      
      // 检查游戏结束条件
      const playerGame = playerGameRef.current;
      const aiGame = aiGameRef.current;
      
      // 检测单方结束状态
      if (!partialGameOver && running && (playerGame.over || aiGame.over) && !(playerGame.over && aiGame.over)) {
        setPartialGameOver(true);
      }
      
      // 只有当双方都结束游戏时才处理结束逻辑和显示信息
      if (!gameOver && !battleRecorded && running && playerGame.over && aiGame.over) {
        // 立即标记为已记录，防止重复执行
        setBattleRecorded(true);
        setGameOver(true);
        setPartialGameOver(false);
        
        const currentPlayerScore = playerStateRef.current.elapsed;
        const currentAiScore = aiStateRef.current.elapsed;
        let gameWinner: 'player' | 'ai' | null;
        
        // 双方都死亡，比较总游戏时间
        if (currentPlayerScore > currentAiScore) {
          gameWinner = 'player';
        } else if (currentAiScore > currentPlayerScore) {
          gameWinner = 'ai';
        } else {
          gameWinner = null; // 平局
        }
        
        setWinner(gameWinner);
        
        // 只有双方都结束时才记录和显示对战结果
        console.log('🎯 双方游戏结束，记录对战结果:', { currentPlayerScore, currentAiScore, gameWinner });
        recordBattle(currentPlayerScore, currentAiScore, gameWinner);
      }
    }
  }

  // 记录对战结果
  function recordBattle(playerScore: number, aiScore: number, winner: 'player' | 'ai' | null) {
    const now = new Date();
    const battleRecord: BattleRecord = {
      timestamp: now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      playerScore,
      aiScore,
      winner,
      duration: Math.max(playerScore, aiScore)
    };
    
    setBattleHistory(prev => [battleRecord, ...prev].slice(0, 10)); // 只保留最近10场记录
  }

  function updateState(state: GameState, gameState: any, dt: number, mvx: number, mvy: number, speedMultiplier: number) {
    if (gameState.over) return;
    
    state.elapsed += dt; 
    gameState.hitIFrames = Math.max(0, gameState.hitIFrames - dt);

    // 敌人数量维持系统 - 定期检查
    gameState.spawnCooldown -= dt;
    if (gameState.spawnCooldown <= 0) {
      gameState.spawnCooldown = 0.5; // 每0.5秒检查一次敌人数量
      maintainEnemies(state);
    }
    
    gameState.pickupSpawnCooldown -= dt; 
    if (gameState.pickupSpawnCooldown <= 0) { 
      gameState.pickupSpawnCooldown = 3.0 + Math.random() * 2.2; 
      spawnHeartAt(state); 
    }

    // 物理 - 使用动态速度控制
    const P = state.player; 
    const baseDifficultySpeedMultiplier = (1 + Math.min(0.6, difficulty(state.elapsed) * 0.09)); 
    const finalSpeed = P.speed * baseDifficultySpeedMultiplier * speedMultiplier; // 基础速度 * 难度倍率 * 动态速度倍率
    
    const len = Math.hypot(mvx, mvy) || 1; 
    const vx = (mvx / len) * finalSpeed; 
    const vy = (mvy / len) * finalSpeed; 
    state.playerVel.x = vx; 
    state.playerVel.y = vy; 
    P.x = Math.max(P.r, Math.min(state.width - P.r, P.x + vx * dt)); 
    P.y = Math.max(P.r, Math.min(state.height - P.r, P.y + vy * dt));

    // 敌人
    const remainHaz = [];
    for (const h of state.hazards) {
      h.t += dt;
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
      let effVX = h.dirX * h.baseSpeed; 
      let effVY = h.dirY * h.baseSpeed;
      if (h.kind === 'zigzag') { 
        const pxn = -h.dirY, pyn = h.dirX; 
        const osc = Math.sin(h.t * (h.zigFreq || 0)) * (h.zigAmp || 0); 
        effVX += pxn * osc; 
        effVY += pyn * osc; 
      }
      h.x += effVX * dt; 
      h.y += effVY * dt; 
      h.life -= dt;
      if (h.x < -64 || h.x > state.width + 64 || h.y < -64 || h.y > state.height + 64 || h.life <= 0) continue;
      remainHaz.push(h);
    }
    state.hazards = remainHaz;

    // 道具
    const remainPick = [];
    for (const p of state.pickups) { 
      p.life -= dt; 
      if (p.life > 0) remainPick.push(p); 
    }
    state.pickups = remainPick;

    // 碰撞
    if (gameState.hitIFrames <= 0) {
      for (const h of state.hazards) { 
        const d = Math.hypot(h.x - state.player.x, h.y - state.player.y); 
        if (d <= h.r + state.player.r) { 
          playerHit(state, gameState); 
          break; 
        } 
      }
    }

    // 拾取
    if (!gameState.over) {
      const rest = [];
      for (const p of state.pickups) {
        const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
        if (d <= p.r + state.player.r) {
          if (p.type === 'heart') {
            state.lives = Math.min(state.maxLives, state.lives + 1);
          }
        } else { 
          rest.push(p); 
        }
      }
      state.pickups = rest;
    }
  }

  function update(dt: number) {
    // 更新敌人生成系统时间（全局）
    if (spawnSystemRef.current) {
      spawnSystemRef.current.updateTime(dt);
    }

    // 玩家控制
    let playerMvx = 0, playerMvy = 0, playerSpeedMultiplier = 1.0;
    const K = keysRef.current; 
    if(K['arrowleft'] || K['a']) playerMvx -= 1; 
    if(K['arrowright'] || K['d']) playerMvx += 1; 
    if(K['arrowup'] || K['w']) playerMvy -= 1; 
    if(K['arrowdown'] || K['s']) playerMvy += 1;
    // 玩家使用固定速度倍率
    playerSpeedMultiplier = (playerMvx !== 0 || playerMvy !== 0) ? 1.0 : 0.0;

    // AI 控制 - 使用封装的AI模块 + 动态速度控制
    let aiMvx = 0, aiMvy = 0, aiSpeedMultiplier = 0.0;
    aiDecideCDRef.current -= dt;
    if (aiDecideCDRef.current <= 0) {
      aiDecideCDRef.current = 0.04; // 25fps决策频率
      
      const diff = difficulty(aiStateRef.current.elapsed);
      // 推理模式：不使用探索
      const decision = aiRef.current.decide(aiStateRef.current, diff, false);
      aiMvx = decision.mvx;
      aiMvy = decision.mvy;
      aiSpeedMultiplier = decision.speed; // 使用AI的动态速度控制
    }

    // 更新双方状态 - 传入各自的速度倍率
    updateState(playerStateRef.current, playerGameRef.current, dt, playerMvx, playerMvy, playerSpeedMultiplier);
    updateState(aiStateRef.current, aiGameRef.current, dt, aiMvx, aiMvy, aiSpeedMultiplier);

    // 更新分数显示和最佳分数记录
    setPlayerScore(playerStateRef.current.elapsed);
    setAIScore(aiStateRef.current.elapsed);
    
    // 实时更新最佳分数
    if (playerStateRef.current.elapsed > bestPlayerPvAI) {
      setBestPlayerPvAI(playerStateRef.current.elapsed);
      localStorage.setItem('dodger_best_player_pvai_v1', String(playerStateRef.current.elapsed));
    }
    
    if (aiStateRef.current.elapsed > bestAIPvAI) {
      setBestAIPvAI(aiStateRef.current.elapsed);
      localStorage.setItem('dodger_best_ai_pvai_v1', String(aiStateRef.current.elapsed));
    }
  }

  // 绘制函数
  function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean, color: string = '#f43f5e') {
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

  function drawGame(canvas: HTMLCanvasElement, state: GameState, gameState: any, title: string, isAI: boolean = false) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width: W, height: H } = state;

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H); 
    g.addColorStop(0, '#0b1220'); 
    g.addColorStop(1, '#0a0f1a'); 
    ctx.fillStyle = g; 
    ctx.fillRect(0, 0, W, H);
    
    // 网格
    ctx.globalAlpha = 0.08 + Math.min(0.12, difficulty(state.elapsed) * 0.02); 
    ctx.strokeStyle = '#64748b'; 
    ctx.lineWidth = 1; 
    ctx.beginPath(); 
    for(let x = 0; x <= W; x += 40){ 
      ctx.moveTo(x + 0.5, 0); 
      ctx.lineTo(x + 0.5, H);
    } 
    for(let y = 0; y <= H; y += 40){ 
      ctx.moveTo(0, y + 0.5); 
      ctx.lineTo(W, y + 0.5);
    } 
    ctx.stroke(); 
    ctx.globalAlpha = 1;

    // 玩家
    const P = state.player; 
    const flicker = gameState.hitIFrames > 0 ? (Math.sin(state.elapsed * 25) > 0 ? 0.4 : 1) : 1; 
    ctx.globalAlpha = flicker; 
    // 根据是否AI使用不同颜色
    ctx.fillStyle = isAI ? GAME_CONFIG.COLORS.PLAYER_AI : GAME_CONFIG.COLORS.PLAYER_HUMAN; 
    ctx.beginPath(); 
    ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2); 
    ctx.fill(); 
    ctx.globalAlpha = 1;

    // 道具
    for (const p of state.pickups) { 
      const remaining = p.life; 
      const blink = remaining <= 2; 
      const alpha = !blink ? 1 : (Math.sin((2 - remaining) * 14) > 0 ? 0.35 : 1); 
      ctx.globalAlpha = Math.max(0.25, alpha); 
      drawHeart(ctx, p.x, p.y, 12, true, '#22c55e'); 
      ctx.globalAlpha = 1; 
    }

    // 敌人
    for (const h of state.hazards) { 
      ctx.fillStyle = (h.kind === 'tracker') ? '#8b5cf6' : '#fb7185'; 
      ctx.beginPath(); 
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); 
      ctx.fill(); 
    }

    // 生命值
    const padX = 8, padY = 8, heartSize = 8, gap = 18; 
    for(let i = 0; i < state.maxLives; i++){ 
      const filled = i < state.lives; 
      drawHeart(ctx, padX + i * gap, padY, heartSize, filled, '#f43f5e'); 
    }

    // 标题、分数和敌人数量
    ctx.fillStyle = '#e2e8f0'; 
    ctx.font = '600 14px ui-sans-serif,system-ui,-apple-system'; 
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 25);
    ctx.fillText(`Score: ${state.elapsed.toFixed(2)}s`, W / 2, H - 45);
    ctx.fillText(`Enemies: ${state.hazards.length}`, W / 2, H - 25);
    
    // 显示AI动态速度（仅AI侧）
    if (isAI) {
      const speedRatio = Math.hypot(state.playerVel.x, state.playerVel.y) / state.player.speed;
      ctx.fillText(`Speed: ${speedRatio.toFixed(2)}x`, W / 2, H - 5);
    }
    
    ctx.textAlign = 'left';

    // 游戏结束
    if (gameState.over) { 
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; 
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e2e8f0'; 
      ctx.font = '700 20px ui-sans-serif,system-ui,-apple-system'; 
      ctx.textAlign = 'center'; 
      ctx.fillText('Game Over', W / 2, H / 2); 
      ctx.textAlign = 'left'; 
    }
  }

  // 渲染循环
  const loop = (ts: number) => { 
    if (!running) { 
      lastTsRef.current = ts; 
      if (playerCanvasRef.current && aiCanvasRef.current) {
        drawGame(playerCanvasRef.current, playerStateRef.current, playerGameRef.current, 'Player', false);
        drawGame(aiCanvasRef.current, aiStateRef.current, aiGameRef.current, 'AI', true);
      }
      reqRef.current = requestAnimationFrame(loop); 
      return; 
    } 
    
    const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000 || 0); 
    lastTsRef.current = ts; 
    update(dt); 
    
    if (playerCanvasRef.current && aiCanvasRef.current) {
      drawGame(playerCanvasRef.current, playerStateRef.current, playerGameRef.current, 'Player', false);
      drawGame(aiCanvasRef.current, aiStateRef.current, aiGameRef.current, 'AI', true);
    }
    
    reqRef.current = requestAnimationFrame(loop); 
  };
  
  useEffect(() => { 
    lastTsRef.current = performance.now(); 
    reqRef.current = requestAnimationFrame(loop); 
    return () => { 
      if (reqRef.current) cancelAnimationFrame(reqRef.current); 
    }; 
  }, [running]);

  function startGame() {
    // 使用预设权重文件，不再检查自定义权重
    if (!hasCustomWeights) {
      alert('AI权重加载失败！请确保预设权重文件存在。');
      return;
    }

    // 初始化敌人数量维持系统 - 人机对战使用独立的种子
    const seed = GlobalSeedManager.getSeed(GAME_SEEDS.PVAI_DUAL);
    spawnSystemRef.current = createSpawnSystem('pvai_dual', seed);
    console.log(`⚔️ 人机对战模式启动 - 敌人数量维持系统 + AI动态速度控制`);
    console.log(`🌟 特性：平衡的细化配置，双方共享同一敌人维持系统，AI具备动态速度优势`);
    console.log(`📊 敌人生成系统初始化完成，初始目标数量: ${spawnSystemRef.current?.getCurrentTargetCount() || 0}`);

    // 重置双方状态
    [playerStateRef.current, aiStateRef.current].forEach(state => {
      state.player.x = state.width / 2; 
      state.player.y = state.height / 2; 
      state.playerVel.x = 0; 
      state.playerVel.y = 0; 
      state.hazards = []; 
      state.pickups = []; 
      state.elapsed = 0; 
      state.lives = state.maxLives;
    });

    [playerGameRef.current, aiGameRef.current].forEach(gameState => {
      gameState.spawnCooldown = 0.1; 
      gameState.pickupSpawnCooldown = 4; 
      gameState.over = false; 
      gameState.hitIFrames = 0;
    });

    setGameOver(false); 
    setWinner(null);
    setPlayerScore(0);
    setAIScore(0);
    setBattleRecorded(false);
    setPartialGameOver(false);
    setRunning(true); 
    lastTsRef.current = performance.now();
  }

  function stopGame() { 
    setRunning(false); 
    // 不重置gameOver状态，保持游戏结束状态以防止重复记录
  }

  return (
    <div ref={wrapperRef} className="w-full h-screen p-1 md:p-2 geometric-bg text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 geometric-shapes" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 h-full flex flex-col">
        <div className="max-w-none mx-auto h-full flex flex-col w-full px-1 md:px-2">
          {/* 顶部按钮区域 */}
          <div className="flex items-center justify-end overflow-visible relative pr-8" style={{ height: '15%' }}>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-lg font-semibold shadow transition-colors"
            >
              Back to Menu
            </button>
          </div>

          {/* 游戏区域 - 占据更多空间，确保16:9比例 */}
          <div className="grid md:grid-cols-2 gap-2 md:gap-4" style={{ height: '55%' }}>
            {/* Player side */}
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 flex items-center gap-4 bg-slate-900/50 border-b border-slate-800 rounded-t-lg ring-1 ring-t-slate-800">
                <span className="text-base font-bold text-cyan-300">Player</span>
                <div className="ml-auto flex gap-1.5 opacity-90">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                </div>
              </div>
              <div className="flex-1 relative rounded-b-lg overflow-hidden bg-slate-950/60 backdrop-blur ring-1 ring-slate-800">
                <div className="absolute inset-0 px-3 py-2 flex justify-center items-center">
                  <canvas ref={playerCanvasRef} className="rounded" style={{ display: 'block' }} />
                </div>
              </div>
            </div>

            {/* AI侧 */}
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 flex items-center gap-4 bg-slate-900/50 border-b border-slate-800 rounded-t-lg ring-1 ring-t-slate-800">
                <span className="text-base font-bold text-blue-400">🤖 AI</span>
                <div className="ml-auto flex gap-1.5 opacity-90">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                </div>
              </div>
              <div className="flex-1 relative rounded-b-lg overflow-hidden bg-slate-950/60 backdrop-blur ring-1 ring-slate-800">
                <div className="absolute inset-0 px-3 py-2 flex justify-center items-center">
                  <canvas ref={aiCanvasRef} className="rounded" style={{ display: 'block' }} />
                </div>
              </div>
            </div>
          </div>

          {/* 间隙区域 */}
          <div style={{ height: '5%' }}></div>

          {/* 控制信息区 - 调整高度以适应新布局 */}
          <div className="rounded-lg ring-1 ring-slate-800 bg-slate-950/60 shadow-sm" style={{ height: '25%', overflow: 'auto' }}>
            <div className="h-full flex flex-col gap-4 p-8">
              {/* 控制按钮和状态 */}
              <div className="flex flex-wrap items-center justify-between gap-3 transform scale-40 -mt-8">
                <div className="flex gap-2">
                  {!running ? (
                    <button onClick={startGame} className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow hover:from-green-600 hover:to-green-700 transition-colors text-lg">
                      Start Battle
                    </button>
                  ) : (
                    gameOver ? (
                      <button onClick={startGame} className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow hover:from-blue-600 hover:to-blue-700 transition-colors text-lg">
                        Restart Battle
                      </button>
                    ) : (
                      <button onClick={stopGame} className="px-6 py-3 rounded-lg bg-rose-400 text-slate-900 font-semibold shadow hover:brightness-110 transition-colors text-lg">
                        End Battle
                      </button>
                    )
                  )}
                </div>
                
                {/* 对战状态 */}
                <div className="flex items-center gap-4 text-sm">
                  {gameOver ? (
                    // 双方都结束时显示最终的总时间
                    <>
                      <div className="text-cyan-300 font-semibold">
                        Player Total: {playerScore.toFixed(1)}s
                      </div>
                      <div className="text-blue-400 font-bold">
                        🤖 AI总时间: {aiScore.toFixed(1)}s
                      </div>
                    </>
                  ) : running ? (
                    // 游戏进行中显示实时生存时间
                    <>
                      <div className="text-cyan-300 font-medium">
                        Player: {playerScore.toFixed(1)}s
                      </div>
                      <div className="text-blue-400 font-medium">
                        🤖 AI: {aiScore.toFixed(1)}s
                      </div>
                    </>
                  ) : (
                    // 游戏未开始
                    <div className="text-slate-400 text-sm">
                      Ready to Start Battle
                    </div>
                  )}
                  {gameOver && winner !== null && (
                    <div className={`font-bold px-3 py-1 rounded text-sm ${
                      winner === 'player' ? 'bg-cyan-400 text-slate-900' : 
                      winner === 'ai' ? 'bg-blue-800 text-white' : 
                      'bg-slate-600 text-slate-200'
                    }`}>
                      {winner === 'player' ? '🏆 Player Wins' : winner === 'ai' ? '🤖 AI Wins' : '🤝 Draw'}
                    </div>
                  )}
                  {running && !gameOver && !partialGameOver && (
                    <div className="text-amber-400 font-medium text-sm">
                      Battle in Progress...
                    </div>
                  )}
                  {running && !gameOver && partialGameOver && (
                    <div className="text-orange-400 font-medium text-sm animate-pulse">
                      Waiting for other side to finish...
                    </div>
                  )}
                </div>
              </div>
              
              {/* 对战历史记录 */}
              <div className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-bold text-orange-300">Battle History</h4>
                </div>
                <div className="h-full overflow-y-auto space-y-2 max-h-32">
                  {battleHistory.length === 0 ? (
                    <div className="text-sm text-slate-500 italic py-2">No battle records yet</div>
                  ) : (
                    battleHistory.map((record, index) => (
                      <div key={index} className="bg-slate-800/40 rounded-lg p-3 text-sm border border-slate-700/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-400 font-medium">{record.timestamp}</span>
                          <span className={`font-bold px-2 py-1 rounded text-xs ${
                            record.winner === 'player' ? 'bg-cyan-400/20 text-cyan-300' : 
                            record.winner === 'ai' ? 'bg-blue-800/30 text-blue-400' : 
                            'bg-slate-600/30 text-slate-300'
                          }`}>
                            {record.winner === 'player' ? '🏆 Player Wins' : 
                             record.winner === 'ai' ? '🤖 AI Wins' : 
                             '🤝 Draw'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="font-medium">Player: {record.playerScore.toFixed(1)}s</span>
                          <span className="font-medium">AI: {record.aiScore.toFixed(1)}s</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}