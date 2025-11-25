export interface EnemyRecord {
  time: number;
  side: number; // 0=top, 1=right, 2=bottom, 3=left  
  kind: 'normal' | 'sprinter' | 'heavy' | 'zigzag' | 'tracker';
  speedMul: number;
  radius: number;
  position: { x: number; y: number }; // 相对位置 (0-1)
  direction: { x: number; y: number };
  zigAmp?: number;
  zigFreq?: number;
  turnRate?: number;
}

export interface SpawnRecord {
  time: number;
  enemies: EnemyRecord[];
}

export interface GameState {
  width: number;
  height: number;
  player: { x: number; y: number; r: number; speed: number };
  playerVel: { x: number; y: number };
  hazards: Array<{
    x: number; y: number; r: number; life: number;
    kind: 'normal' | 'sprinter' | 'heavy' | 'zigzag' | 'tracker';
    baseSpeed: number; t: number; dirX: number; dirY: number;
    zigAmp: number; zigFreq: number; turnRate?: number;
  }>;
  pickups: Array<{
    x: number; y: number; r: number; life: number; maxLife: number; type: string;
  }>;
  elapsed: number;
  lives: number;
  maxLives: number;
}

// 全局种子管理器
export class GlobalSeedManager {
  private static seeds: Map<string, number> = new Map();
  
  static getSeed(key: string): number {
    if (!this.seeds.has(key)) {
      // 为每个游戏模式生成固定种子
      const hash = this.hashString(key);
      this.seeds.set(key, hash);
    }
    return this.seeds.get(key)!;
  }
  
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const GAME_SEEDS = {
  BASIC_TURNBASED: 'basic_turnbased_v6_fine_grained',
  PVAI_DUAL: 'pvai_dual_v6_fine_grained'
};

// 敌人数量维持配置
interface EnemyCountConfig {
  startTime: number;
  endTime: number;
  targetCount: number;
  speedMultiplier: number;
}

// 新的细化时间段敌人生成配置
function generateEnemyCountTimeline(configName: string): EnemyCountConfig[] {
  const timeline: EnemyCountConfig[] = [];
  
  if (configName === 'basic_turnbased') {
    // 基础/轮换模式：细化的前20秒 + 后续递增
    
    // === 第一阶段 (0-5秒): 6个敌人 ===
    timeline.push({
      startTime: 0,
      endTime: 5,
      targetCount: 6,
      speedMultiplier: 1.0
    });
    
    // === 第二阶段 (5-10秒): 10个敌人 ===
    timeline.push({
      startTime: 5,
      endTime: 10,
      targetCount: 10,
      speedMultiplier: 1.05
    });
    
    // === 第三阶段 (10-15秒): 15个敌人 ===
    timeline.push({
      startTime: 10,
      endTime: 15,
      targetCount: 15,
      speedMultiplier: 1.1
    });
    
    // === 第四阶段 (15-20秒): 20个敌人 ===
    timeline.push({
      startTime: 15,
      endTime: 20,
      targetCount: 20,
      speedMultiplier: 1.15
    });
    
    // === 后续阶段：每隔10秒增加5个敌人 ===
    let currentCount = 20; // 从20个开始
    for (let startTime = 20; startTime < 60; startTime += 10) {
      currentCount += 5;
      timeline.push({
        startTime: startTime,
        endTime: startTime + 10,
        targetCount: currentCount,
        speedMultiplier: 1.0 + (startTime / 60) * 0.5 // 逐步增加速度
      });
    }
    
    // === 60秒后：每隔30秒敌人数目翻倍 ===
    let doubleStartTime = 60;
    let doubleCount = currentCount; // 从前一阶段的数量开始（40个）
    
    // 60-90秒：翻倍
    doubleCount *= 2; // 80个
    timeline.push({
      startTime: doubleStartTime,
      endTime: doubleStartTime + 30,
      targetCount: Math.min(doubleCount, 100), // 限制最大数量
      speedMultiplier: 1.5
    });
    
    // 90-120秒：再翻倍
    doubleStartTime += 30;
    doubleCount *= 2; // 160个，但限制到100个
    timeline.push({
      startTime: doubleStartTime,
      endTime: doubleStartTime + 30,
      targetCount: Math.min(doubleCount, 100), // 限制最大数量
      speedMultiplier: 1.8
    });
    
    // === 120秒后：敌人数量不变，但速度每15秒×1.25 ===
    const fixedCount = Math.min(doubleCount, 100);
    let speedBoostTime = 120;
    let currentSpeedMul = 2.0;
    
    for (let i = 0; i < 20; i++) { // 添加20个阶段，覆盖300秒以上
      currentSpeedMul *= 1.25;
      timeline.push({
        startTime: speedBoostTime,
        endTime: speedBoostTime + 15,
        targetCount: fixedCount,
        speedMultiplier: Math.min(currentSpeedMul, 12.0) // 限制最大速度倍数
      });
      speedBoostTime += 15;
      
      if (speedBoostTime > 600) break; // 10分钟后停止
    }
    
  } else if (configName === 'pvai_dual') {
    // 人机对战模式：更平衡但也细化的配置
    
    // === 细化开局 (0-20秒) ===
    // 0-5秒：4个敌人
    timeline.push({
      startTime: 0,
      endTime: 5,
      targetCount: 4,
      speedMultiplier: 0.9
    });
    
    // 5-10秒：6个敌人
    timeline.push({
      startTime: 5,
      endTime: 10,
      targetCount: 6,
      speedMultiplier: 0.95
    });
    
    // 10-15秒：8个敌人
    timeline.push({
      startTime: 10,
      endTime: 15,
      targetCount: 8,
      speedMultiplier: 1.0
    });
    
    // 15-20秒：10个敌人
    timeline.push({
      startTime: 15,
      endTime: 20,
      targetCount: 10,
      speedMultiplier: 1.05
    });
    
    // === 20-60秒：每10秒增加3个 ===
    let pvaiCount = 10;
    for (let startTime = 20; startTime < 60; startTime += 10) {
      pvaiCount += 3;
      timeline.push({
        startTime: startTime,
        endTime: startTime + 10,
        targetCount: pvaiCount,
        speedMultiplier: 1.0 + (startTime / 120) * 0.4
      });
    }
    
    // === 60-120秒：每30秒增加4个 ===
    for (let startTime = 60; startTime < 120; startTime += 30) {
      pvaiCount += 4;
      timeline.push({
        startTime: startTime,
        endTime: startTime + 30,
        targetCount: Math.min(pvaiCount, 30), // 人机对战限制更低
        speedMultiplier: 1.3 + ((startTime - 60) / 60) * 0.5
      });
    }
    
    // === 120秒后：固定数量，速度递增 ===
    const pvaiFixedCount = Math.min(pvaiCount, 30);
    let pvaiSpeedTime = 120;
    let pvaiSpeedMul = 1.8;
    
    for (let i = 0; i < 15; i++) {
      pvaiSpeedMul *= 1.15; // 较温和的速度增长
      timeline.push({
        startTime: pvaiSpeedTime,
        endTime: pvaiSpeedTime + 20, // 较长的间隔
        targetCount: pvaiFixedCount,
        speedMultiplier: Math.min(pvaiSpeedMul, 6.0)
      });
      pvaiSpeedTime += 20;
      
      if (pvaiSpeedTime > 420) break; // 7分钟后停止
    }
  }
  
  console.log(`📊 ${configName} 敌人数量时间线生成完成，阶段数: ${timeline.length}`);
  return timeline;
}

const ENEMY_COUNT_CONFIGS = {
  basic_turnbased: generateEnemyCountTimeline('basic_turnbased'),
  pvai_dual: generateEnemyCountTimeline('pvai_dual')
};

export class EnemySpawnSystem {
  private config: EnemyCountConfig[];
  private currentTime: number = 0;
  private configName: string;
  private lastSpawnTime: number = 0;
  private currentTargetCount: number = 0;
  private currentSpeedMultiplier: number = 1.0;
  private rng: number = 0; // 伪随机数生成器状态
  
  constructor(configName: string, seed: number) {
    this.configName = configName;
    this.config = ENEMY_COUNT_CONFIGS[configName as keyof typeof ENEMY_COUNT_CONFIGS] || ENEMY_COUNT_CONFIGS.basic_turnbased;
    this.rng = seed % 2147483647; // 初始化伪随机数
    
    console.log(`🎯 敌人数量维持系统初始化: ${configName}`);
    console.log(`📊 配置阶段数量: ${this.config.length}`);
    console.log(`🌟 细化机制：0-5s(6个) → 5-10s(10个) → 10-15s(15个) → 15-20s(20个) → 后续递增`);
  }
  
  // 简单的伪随机数生成器
  private random(): number {
    this.rng = (this.rng * 16807) % 2147483647;
    return this.rng / 2147483647;
  }
  
  updateTime(dt: number) {
    this.currentTime += dt;
    this.updateCurrentConfig();
  }
  
  reset() {
    this.currentTime = 0;
    this.lastSpawnTime = 0;
    this.currentTargetCount = 0;
    this.currentSpeedMultiplier = 1.0;
  }
  
  private updateCurrentConfig() {
    // 找到当前时间对应的配置
    for (const config of this.config) {
      if (this.currentTime >= config.startTime && this.currentTime < config.endTime) {
        this.currentTargetCount = config.targetCount;
        this.currentSpeedMultiplier = config.speedMultiplier;
        return;
      }
    }
    
    // 如果超过了最后一个配置，使用最后一个
    if (this.config.length > 0) {
      const lastConfig = this.config[this.config.length - 1];
      this.currentTargetCount = lastConfig.targetCount;
      this.currentSpeedMultiplier = lastConfig.speedMultiplier;
    }
  }
  
  getScheduledSpawn(difficulty: number): SpawnRecord | null {
    // 这个方法现在主要用于维持敌人数量
    return null; // 我们将在 maintainEnemyCount 中处理
  }
  
  // 新的核心方法：维持敌人数量
  maintainEnemyCount(gameState: GameState) {
    const currentEnemyCount = gameState.hazards.length;
    const shortage = this.currentTargetCount - currentEnemyCount;
    
    if (shortage > 0) {
      // 需要生成更多敌人
      for (let i = 0; i < shortage; i++) {
        this.spawnSingleEnemy(gameState);
      }
      console.log(`⚡ 维持敌人数量: 目标${this.currentTargetCount}, 当前${currentEnemyCount}, 新增${shortage}`);
    }
    
    // 更新现有敌人的速度
    this.updateEnemySpeeds(gameState);
  }
  
  private updateEnemySpeeds(gameState: GameState) {
    // 更新所有现有敌人的速度
    for (const enemy of gameState.hazards) {
      // 基础速度 * 难度 * 当前速度倍数
      const baseDifficulty = this.currentTime / 12;
      enemy.baseSpeed = (110 + baseDifficulty * 95) * this.currentSpeedMultiplier;
    }
  }
  
  private spawnSingleEnemy(gameState: GameState) {
    const { width: W, height: H } = gameState;
    
    // 随机选择敌人类型
    const types: Array<'normal' | 'sprinter' | 'heavy' | 'zigzag' | 'tracker'> = 
      ['normal', 'sprinter', 'heavy', 'zigzag', 'tracker'];
    const kind = types[Math.floor(this.random() * types.length)];
    
    // 随机选择生成边
    const side = Math.floor(this.random() * 4);
    
    // 计算位置
    let x: number, y: number;
    let radius = 12 + this.random() * 6; // 12-18
    
    switch (side) {
      case 0: // Top
        x = this.random() * W;
        y = -radius;
        break;
      case 1: // Right
        x = W + radius;
        y = this.random() * H;
        break;
      case 2: // Bottom
        x = this.random() * W;
        y = H + radius;
        break;
      case 3: // Left
        x = -radius;
        y = this.random() * H;
        break;
      default:
        x = W / 2;
        y = H / 2;
    }
    
    // 计算方向
    const centerX = W / 2;
    const centerY = H / 2;
    let dirX = centerX - x;
    let dirY = centerY - y;
    const dirLength = Math.hypot(dirX, dirY) || 1;
    dirX /= dirLength;
    dirY /= dirLength;
    
    // 添加一些随机偏移
    const randomAngle = (this.random() - 0.5) * Math.PI / 3; // ±30度
    const cos = Math.cos(randomAngle);
    const sin = Math.sin(randomAngle);
    const newDirX = dirX * cos - dirY * sin;
    const newDirY = dirX * sin + dirY * cos;
    dirX = newDirX;
    dirY = newDirY;
    
    // 根据类型调整属性
    let speedMul = this.currentSpeedMultiplier;
    let zigAmp = 0, zigFreq = 0, turnRate = undefined;
    
    if (kind === 'sprinter') {
      speedMul *= 1.5;
      radius *= 0.8;
    } else if (kind === 'heavy') {
      speedMul *= 0.7;
      radius *= 1.4;
    } else if (kind === 'zigzag') {
      zigAmp = 80 + this.random() * 40;
      zigFreq = 4 + this.random() * 3;
    } else if (kind === 'tracker') {
      turnRate = Math.PI * (1.0 + this.random() * 0.5);
    }
    
    // 计算基础速度
    const baseDifficulty = this.currentTime / 12;
    const baseSpeed = (110 + baseDifficulty * 95) * speedMul;
    
    const newEnemy = {
      x,
      y,
      r: radius,
      life: 14,
      kind,
      baseSpeed,
      t: 0,
      dirX,
      dirY,
      zigAmp,
      zigFreq,
      turnRate
    };
    
    gameState.hazards.push(newEnemy);
  }
  
  spawnMultipleFromRecord(record: SpawnRecord, gameState: GameState) {
    // 这个方法保留向后兼容性，但在新系统中不常用
    for (const enemyRecord of record.enemies) {
      this.spawnSingleFromRecord(enemyRecord, gameState);
    }
  }
  
  private spawnSingleFromRecord(record: EnemyRecord, gameState: GameState) {
    const { width: W, height: H } = gameState;
    
    let x: number, y: number;
    const radius = record.radius;
    
    switch (record.side) {
      case 0: // Top
        x = record.position.x * W;
        y = -radius;
        break;
      case 1: // Right
        x = W + radius;
        y = record.position.y * H;
        break;
      case 2: // Bottom
        x = record.position.x * W;
        y = H + radius;
        break;
      case 3: // Left
        x = -radius;
        y = record.position.y * H;
        break;
      default:
        x = record.position.x * W;
        y = record.position.y * H;
    }
    
    const baseDifficulty = this.currentTime / 12;
    const baseSpeed = (110 + baseDifficulty * 95) * record.speedMul * this.currentSpeedMultiplier;
    
    const dirLength = Math.hypot(record.direction.x, record.direction.y) || 1;
    const dirX = record.direction.x / dirLength;
    const dirY = record.direction.y / dirLength;
    
    const newEnemy = {
      x,
      y,
      r: radius,
      life: 14,
      kind: record.kind,
      baseSpeed,
      t: 0,
      dirX,
      dirY,
      zigAmp: record.zigAmp || 0,
      zigFreq: record.zigFreq || 0,
      turnRate: record.turnRate
    };
    
    gameState.hazards.push(newEnemy);
  }
  
  isInSyncMode(): boolean {
    return true; // 维持模式始终同步
  }
  
  getPredefinedProgress(): { current: number; total: number; isInCycle: boolean } {
    const currentConfigIndex = this.config.findIndex(config => 
      this.currentTime >= config.startTime && this.currentTime < config.endTime
    );
    
    return { 
      current: Math.max(0, currentConfigIndex + 1), 
      total: this.config.length, 
      isInCycle: false 
    };
  }
  
  getStatusInfo(): { mode: string; detail: string } {
    const currentConfig = this.config.find(config => 
      this.currentTime >= config.startTime && this.currentTime < config.endTime
    );
    
    if (currentConfig) {
      const phase = this.currentTime < 20 ? 'Ramp' :
                   this.currentTime < 60 ? 'Growth' : 
                   this.currentTime < 120 ? 'Double' : 'Speed+';
      return {
        mode: 'Maintain',
        detail: `${phase} ${this.currentTargetCount}x${this.currentSpeedMultiplier.toFixed(2)}`
      };
    } else {
      return {
        mode: 'Maintain',
        detail: `Final ${this.currentTargetCount}x${this.currentSpeedMultiplier.toFixed(2)}`
      };
    }
  }
  
  // 获取当前目标敌人数量（用于调试和UI显示）
  getCurrentTargetCount(): number {
    return this.currentTargetCount;
  }
  
  // 获取当前速度倍数（用于调试和UI显示）
  getCurrentSpeedMultiplier(): number {
    return this.currentSpeedMultiplier;
  }
}

export function createSpawnSystem(configName: string, seed: number): EnemySpawnSystem {
  return new EnemySpawnSystem(configName, seed);
}