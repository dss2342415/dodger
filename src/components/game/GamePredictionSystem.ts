/**
 * 游戏预测系统 - 为AI提供下一步全局信息预测
 * 提供敌人位置预测、道具状态预测等功能，辅助AI决策
 */

import { GameState } from "./EnemySpawnSystem";

// 预测结果接口
export interface PredictedEnemy {
  // 当前状态
  currentX: number;
  currentY: number;
  currentDirX: number;
  currentDirY: number;
  
  // 预测状态
  predictedX: number;
  predictedY: number;
  predictedDirX: number;
  predictedDirY: number;
  
  // 元数据
  id: number; // 敌人在hazards数组中的索引
  kind: string;
  radius: number;
  baseSpeed: number;
  timeToReachPredicted: number;
  
  // 威胁评估
  currentThreatLevel: number; // 0-1，当前威胁程度
  predictedThreatLevel: number; // 0-1，预测威胁程度
  collisionRisk: number; // 0-1，碰撞风险
}

export interface PredictedPickup {
  currentX: number;
  currentY: number;
  type: string;
  currentLife: number;
  maxLife: number;
  urgency: number; // 0-1，紧急程度（基于剩余生命）
  accessibilityScore: number; // 0-1，可达性评分
}

export interface PredictedGameState {
  timestamp: number;
  lookAheadTime: number;
  
  // 预测的敌人状态
  enemies: PredictedEnemy[];
  
  // 预测的道具状态
  pickups: PredictedPickup[];
  
  // 安全区域分析
  safeZones: SafeZone[];
  
  // 全局威胁评估
  globalThreatLevel: number; // 0-1
  emergencyLevel: number; // 0-1，紧急程度
  
  // 推荐动作方向
  recommendedDirection: { x: number; y: number };
  avoidanceVector: { x: number; y: number };
}

export interface SafeZone {
  centerX: number;
  centerY: number;
  radius: number;
  safetyScore: number; // 0-1，安全评分
  accessTime: number; // 到达该安全区域的估计时间
}

/**
 * 游戏预测系统主类
 */
export class GamePredictionSystem {
  private readonly PREDICTION_STEPS = [0.1, 0.2, 0.5, 1.0]; // 预测时间点（秒）
  private readonly GRID_SIZE = 8; // 安全区域网格大小
  
  /**
   * 预测游戏状态
   * @param gameState 当前游戏状态
   * @param lookAheadTime 预测时间（秒）
   * @returns 预测结果
   */
  predictGameState(gameState: GameState, lookAheadTime: number = 1.0): PredictedGameState {
    const timestamp = Date.now();
    
    // 预测敌人状态
    const enemies = this.predictEnemies(gameState, lookAheadTime);
    
    // 预测道具状态
    const pickups = this.predictPickups(gameState, lookAheadTime);
    
    // 分析安全区域
    const safeZones = this.analyzeSafeZones(gameState, enemies);
    
    // 计算全局威胁
    const globalThreatLevel = this.calculateGlobalThreat(gameState, enemies);
    const emergencyLevel = this.calculateEmergencyLevel(gameState, enemies);
    
    // 计算推荐方向
    const recommendedDirection = this.calculateRecommendedDirection(gameState, enemies, safeZones);
    const avoidanceVector = this.calculateAvoidanceVector(gameState, enemies);
    
    return {
      timestamp,
      lookAheadTime,
      enemies,
      pickups,
      safeZones,
      globalThreatLevel,
      emergencyLevel,
      recommendedDirection,
      avoidanceVector
    };
  }
  
  /**
   * 预测敌人位置和状态
   */
  private predictEnemies(gameState: GameState, lookAheadTime: number): PredictedEnemy[] {
    return gameState.hazards.map((hazard, index) => {
      const currentX = hazard.x;
      const currentY = hazard.y;
      let currentDirX = hazard.dirX;
      let currentDirY = hazard.dirY;
      
      // 预测位置计算
      const { predictedX, predictedY, predictedDirX, predictedDirY } = this.predictEnemyPosition(
        hazard, gameState, lookAheadTime
      );
      
      // 威胁评估
      const currentThreatLevel = this.calculateThreatLevel(
        currentX, currentY, hazard.r, gameState.player
      );
      const predictedThreatLevel = this.calculateThreatLevel(
        predictedX, predictedY, hazard.r, gameState.player
      );
      
      // 碰撞风险评估
      const collisionRisk = this.calculateCollisionRisk(
        hazard, gameState, lookAheadTime
      );
      
      return {
        currentX,
        currentY,
        currentDirX,
        currentDirY,
        predictedX,
        predictedY,
        predictedDirX,
        predictedDirY,
        id: index,
        kind: hazard.kind,
        radius: hazard.r,
        baseSpeed: hazard.baseSpeed,
        timeToReachPredicted: lookAheadTime,
        currentThreatLevel,
        predictedThreatLevel,
        collisionRisk
      };
    });
  }
  
  /**
   * 预测单个敌人位置
   */
  private predictEnemyPosition(hazard: any, gameState: GameState, dt: number) {
    let x = hazard.x;
    let y = hazard.y;
    let dirX = hazard.dirX;
    let dirY = hazard.dirY;
    let t = hazard.t + dt;
    
    // 根据敌人类型预测运动
    switch (hazard.kind) {
      case 'tracker':
        // 追踪型：预测转向
        const tx = gameState.player.x - x;
        const ty = gameState.player.y - y;
        const tlen = Math.hypot(tx, ty) || 1;
        const targetDirX = tx / tlen;
        const targetDirY = ty / tlen;
        
        const dot = dirX * targetDirX + dirY * targetDirY;
        const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
        const maxTurn = (hazard.turnRate ?? Math.PI) * dt;
        
        if (theta > 1e-4) {
          const k = Math.min(1, maxTurn / theta);
          dirX = (1 - k) * dirX + k * targetDirX;
          dirY = (1 - k) * dirY + k * targetDirY;
          const n = Math.hypot(dirX, dirY) || 1;
          dirX /= n;
          dirY /= n;
        }
        break;
        
      case 'zigzag':
        // 锯齿型：预测震荡
        // 基本方向不变，但会有垂直于方向的震荡
        break;
        
      default:
        // 其他类型：直线运动，方向不变
        break;
    }
    
    // 计算有效速度
    let effVX = dirX * hazard.baseSpeed;
    let effVY = dirY * hazard.baseSpeed;
    
    if (hazard.kind === 'zigzag') {
      const pxn = -dirY;
      const pyn = dirX;
      const osc = Math.sin(t * hazard.zigFreq) * hazard.zigAmp;
      effVX += pxn * osc;
      effVY += pyn * osc;
    }
    
    // 更新位置
    x += effVX * dt;
    y += effVY * dt;
    
    return {
      predictedX: x,
      predictedY: y,
      predictedDirX: dirX,
      predictedDirY: dirY
    };
  }
  
  /**
   * 预测道具状态
   */
  private predictPickups(gameState: GameState, lookAheadTime: number): PredictedPickup[] {
    return gameState.pickups.map(pickup => {
      const urgency = (pickup.maxLife - (pickup.life - lookAheadTime)) / pickup.maxLife;
      const accessibilityScore = this.calculatePickupAccessibility(pickup, gameState);
      
      return {
        currentX: pickup.x,
        currentY: pickup.y,
        type: pickup.type,
        currentLife: pickup.life,
        maxLife: pickup.maxLife,
        urgency: Math.max(0, Math.min(1, urgency)),
        accessibilityScore
      };
    });
  }
  
  /**
   * 分析安全区域
   */
  private analyzeSafeZones(gameState: GameState, enemies: PredictedEnemy[]): SafeZone[] {
    const zones: SafeZone[] = [];
    const { width, height } = gameState;
    const cellWidth = width / this.GRID_SIZE;
    const cellHeight = height / this.GRID_SIZE;
    
    for (let i = 0; i < this.GRID_SIZE; i++) {
      for (let j = 0; j < this.GRID_SIZE; j++) {
        const centerX = (i + 0.5) * cellWidth;
        const centerY = (j + 0.5) * cellHeight;
        const radius = Math.min(cellWidth, cellHeight) / 2;
        
        // 计算该区域的安全评分
        let safetyScore = 1.0;
        for (const enemy of enemies) {
          const distanceCurrent = Math.hypot(enemy.currentX - centerX, enemy.currentY - centerY);
          const distancePredicted = Math.hypot(enemy.predictedX - centerX, enemy.predictedY - centerY);
          
          const minSafeDistance = enemy.radius + radius + 40; // 从20增加到40，提高安全边距
          const currentSafety = Math.min(1, distanceCurrent / minSafeDistance);
          const predictedSafety = Math.min(1, distancePredicted / minSafeDistance);
          
          safetyScore *= Math.min(currentSafety, predictedSafety);
        }
        
        // 计算到达时间
        const accessTime = Math.hypot(centerX - gameState.player.x, centerY - gameState.player.y) / gameState.player.speed;
        
        // 只保存相对安全的区域
        if (safetyScore > 0.4) { // 从0.3提升到0.4，提高安全标准
          zones.push({
            centerX,
            centerY,
            radius,
            safetyScore,
            accessTime
          });
        }
      }
    }
    
    // 按安全评分排序
    zones.sort((a, b) => b.safetyScore - a.safetyScore);
    
    return zones.slice(0, 10); // 返回最安全的10个区域
  }
  
  /**
   * 计算威胁等级
   */
  private calculateThreatLevel(x: number, y: number, radius: number, player: any): number {
    const distance = Math.hypot(x - player.x, y - player.y);
    const criticalDistance = radius + player.r + 80; // 从50增加到80，扩大临界距离
    
    if (distance <= criticalDistance) {
      return 1.0; // 最高威胁
    }
    
    // 距离越近威胁越大，使用指数衰减
    return Math.exp(-distance / 200); // 从100增加到200，扩大威胁感知范围
  }
  
  /**
   * 计算碰撞风险
   */
  private calculateCollisionRisk(hazard: any, gameState: GameState, lookAheadTime: number): number {
    const player = gameState.player;
    const playerVel = gameState.playerVel;
    
    // 计算相对位置和速度
    const relX = hazard.x - player.x;
    const relY = hazard.y - player.y;
    
    let effVX = hazard.dirX * hazard.baseSpeed;
    let effVY = hazard.dirY * hazard.baseSpeed;
    
    if (hazard.kind === 'zigzag') {
      const pxn = -hazard.dirY;
      const pyn = hazard.dirX;
      const osc = Math.sin(hazard.t * hazard.zigFreq) * hazard.zigAmp;
      effVX += pxn * osc;
      effVY += pyn * osc;
    }
    
    const relVX = effVX - playerVel.x;
    const relVY = effVY - playerVel.y;
    
    // 使用二次方程求解最近接近时间
    const a = relVX * relVX + relVY * relVY;
    const b = 2 * (relX * relVX + relY * relVY);
    const c = relX * relX + relY * relY - Math.pow(hazard.r + player.r, 2);
    
    if (a === 0) return 0; // 相对速度为0
    
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 0; // 不会碰撞
    
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    
    const minTime = Math.min(t1, t2);
    const maxTime = Math.max(t1, t2);
    
    // 如果在预测时间范围内会碰撞
    if (minTime >= 0 && minTime <= lookAheadTime) {
      return 1.0 - (minTime / lookAheadTime); // 时间越短风险越高
    }
    
    if (maxTime >= 0 && maxTime <= lookAheadTime) {
      return 0.5 - (maxTime / lookAheadTime); // 较低的风险
    }
    
    return 0;
  }
  
  /**
   * 计算全局威胁等级
   */
  private calculateGlobalThreat(_gameState: GameState, enemies: PredictedEnemy[]): number {
    if (enemies.length === 0) return 0;
    
    let totalThreat = 0;
    let maxThreat = 0;
    
    for (const enemy of enemies) {
      const threat = Math.max(enemy.currentThreatLevel, enemy.predictedThreatLevel);
      totalThreat += threat;
      maxThreat = Math.max(maxThreat, threat);
    }
    
    // 综合平均威胁和最大威胁
    const avgThreat = totalThreat / enemies.length;
    return 0.7 * maxThreat + 0.3 * avgThreat;
  }
  
  /**
   * 计算紧急程度
   */
  private calculateEmergencyLevel(gameState: GameState, enemies: PredictedEnemy[]): number {
    let emergencyLevel = 0;
    
    // 基于高风险碰撞
    for (const enemy of enemies) {
      if (enemy.collisionRisk > 0.7) {
        emergencyLevel = Math.max(emergencyLevel, enemy.collisionRisk);
      }
    }
    
    // 基于生命值
    const healthRatio = gameState.lives / gameState.maxLives;
    if (healthRatio <= 0.33) {
      emergencyLevel = Math.max(emergencyLevel, 0.8);
    } else if (healthRatio <= 0.66) {
      emergencyLevel = Math.max(emergencyLevel, 0.4);
    }
    
    return emergencyLevel;
  }
  
  /**
   * 计算推荐移动方向
   */
  private calculateRecommendedDirection(
    gameState: GameState, 
    _enemies: PredictedEnemy[], 
    safeZones: SafeZone[]
  ): { x: number; y: number } {
    if (safeZones.length === 0) {
      return { x: 0, y: 0 };
    }
    
    // 选择最安全且最近的区域
    const bestZone = safeZones.reduce((best, zone) => {
      const score = zone.safetyScore / (1 + zone.accessTime * 0.1);
      const bestScore = best.safetyScore / (1 + best.accessTime * 0.1);
      return score > bestScore ? zone : best;
    });
    
    const dx = bestZone.centerX - gameState.player.x;
    const dy = bestZone.centerY - gameState.player.y;
    const length = Math.hypot(dx, dy) || 1;
    
    return {
      x: dx / length,
      y: dy / length
    };
  }
  
  /**
   * 计算规避向量
   */
  private calculateAvoidanceVector(gameState: GameState, enemies: PredictedEnemy[]): { x: number; y: number } {
    let avoidanceX = 0;
    let avoidanceY = 0;
    let totalWeight = 0;
    
    for (const enemy of enemies) {
      const threat = Math.max(enemy.currentThreatLevel, enemy.predictedThreatLevel);
      if (threat > 0.05) { // 从0.1降低到0.05，对更微弱的威胁也做出反应
        const dx = gameState.player.x - enemy.predictedX;
        const dy = gameState.player.y - enemy.predictedY;
        const distance = Math.hypot(dx, dy) || 1;
        
        const weight = threat / distance * 2.0; // 增加权重因子2.0，加强规避反应
        avoidanceX += (dx / distance) * weight;
        avoidanceY += (dy / distance) * weight;
        totalWeight += weight;
      }
    }
    
    if (totalWeight > 0) {
      avoidanceX /= totalWeight;
      avoidanceY /= totalWeight;
      
      // 归一化
      const length = Math.hypot(avoidanceX, avoidanceY) || 1;
      avoidanceX /= length;
      avoidanceY /= length;
    }
    
    return {
      x: avoidanceX,
      y: avoidanceY
    };
  }
  
  /**
   * 计算道具可达性
   */
  private calculatePickupAccessibility(pickup: any, gameState: GameState): number {
    const distance = Math.hypot(pickup.x - gameState.player.x, pickup.y - gameState.player.y);
    const timeToReach = distance / gameState.player.speed;
    
    // 如果无法在道具消失前到达
    if (timeToReach >= pickup.life) {
      return 0;
    }
    
    // 基于距离和剩余时间的可达性评分
    const distanceScore = Math.exp(-distance / 200); // 距离越近分数越高
    const timeScore = (pickup.life - timeToReach) / pickup.life; // 时间余量越多分数越高
    
    return Math.min(1, distanceScore * timeScore);
  }
  
  /**
   * 批量预测多个时间点
   */
  public predictMultipleTimePoints(gameState: GameState): PredictedGameState[] {
    return this.PREDICTION_STEPS.map(timeStep => 
      this.predictGameState(gameState, timeStep)
    );
  }
  
  /**
   * 获取最危险的敌人
   */
  public getMostDangerousEnemy(gameState: GameState): PredictedEnemy | null {
    const prediction = this.predictGameState(gameState, 0.5);
    
    if (prediction.enemies.length === 0) return null;
    
    return prediction.enemies.reduce((most, enemy) => 
      enemy.collisionRisk > most.collisionRisk ? enemy : most
    );
  }
  
  /**
   * 获取最佳逃生路径
   */
  public getBestEscapeRoute(gameState: GameState): SafeZone | null {
    const prediction = this.predictGameState(gameState, 1.0);
    
    if (prediction.safeZones.length === 0) return null;
    
    // 返回综合评分最高的安全区域
    return prediction.safeZones[0];
  }
}

// 单例实例
export const gamePredictionSystem = new GamePredictionSystem();

// 便捷函数
export function predictNextGameState(gameState: GameState, lookAheadTime: number = 1.0): PredictedGameState {
  return gamePredictionSystem.predictGameState(gameState, lookAheadTime);
}

export function getPredictionForAI(gameState: GameState): {
  immediate: PredictedGameState;
  short: PredictedGameState;
  medium: PredictedGameState;
  long: PredictedGameState;
} {
  const predictions = gamePredictionSystem.predictMultipleTimePoints(gameState);
  return {
    immediate: predictions[0], // 0.1s
    short: predictions[1],     // 0.2s
    medium: predictions[2],    // 0.5s
    long: predictions[3]       // 1.0s
  };
}
