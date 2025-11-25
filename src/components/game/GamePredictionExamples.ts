/**
 * GamePredictionSystem 使用示例
 * 展示如何在游戏中集成和使用预测系统为AI提供下一步信息
 */

import { GameState } from './EnemySpawnSystem';
import { 
  GamePredictionSystem, 
  gamePredictionSystem,
  predictNextGameState,
  getPredictionForAI
} from './GamePredictionSystem';

// 使用示例 1: 基本预测
export function basicPredictionExample(gameState: GameState) {
  console.log('=== 基本预测示例 ===');
  
  // 预测1秒后的游戏状态
  const prediction = predictNextGameState(gameState, 1.0);
  
  console.log(`预测时间点: ${prediction.lookAheadTime}秒`);
  console.log(`敌人数量: ${prediction.enemies.length}`);
  console.log(`全局威胁等级: ${prediction.globalThreatLevel.toFixed(3)}`);
  console.log(`紧急程度: ${prediction.emergencyLevel.toFixed(3)}`);
  console.log(`安全区域数量: ${prediction.safeZones.length}`);
  
  if (prediction.safeZones.length > 0) {
    const bestZone = prediction.safeZones[0];
    console.log(`最安全区域: (${bestZone.centerX.toFixed(1)}, ${bestZone.centerY.toFixed(1)}) 安全评分: ${bestZone.safetyScore.toFixed(3)}`);
  }
  
  console.log(`推荐方向: (${prediction.recommendedDirection.x.toFixed(3)}, ${prediction.recommendedDirection.y.toFixed(3)})`);
  console.log(`规避向量: (${prediction.avoidanceVector.x.toFixed(3)}, ${prediction.avoidanceVector.y.toFixed(3)})`);
}

// 使用示例 2: 多时间点预测
export function multiTimePredictionExample(gameState: GameState) {
  console.log('\n=== 多时间点预测示例 ===');
  
  const predictions = gamePredictionSystem.predictMultipleTimePoints(gameState);
  
  predictions.forEach((prediction) => {
    console.log(`时间点 ${prediction.lookAheadTime}s:`);
    console.log(`  威胁等级: ${prediction.globalThreatLevel.toFixed(3)}`);
    console.log(`  最危险敌人碰撞风险: ${prediction.enemies.length > 0 ? Math.max(...prediction.enemies.map(e => e.collisionRisk)).toFixed(3) : '0'}`);
  });
}

// 使用示例 3: AI专用预测
export function aiPredictionExample(gameState: GameState) {
  console.log('\n=== AI专用预测示例 ===');
  
  const aiPredictions = getPredictionForAI(gameState);
  
  console.log('即时预测 (0.1s):');
  console.log(`  威胁: ${aiPredictions.immediate.globalThreatLevel.toFixed(3)}`);
  
  console.log('短期预测 (0.2s):');
  console.log(`  威胁: ${aiPredictions.short.globalThreatLevel.toFixed(3)}`);
  
  console.log('中期预测 (0.5s):');
  console.log(`  威胁: ${aiPredictions.medium.globalThreatLevel.toFixed(3)}`);
  
  console.log('长期预测 (1.0s):');
  console.log(`  威胁: ${aiPredictions.long.globalThreatLevel.toFixed(3)}`);
}

// 使用示例 4: 危险检测和逃生路径
export function dangerDetectionExample(gameState: GameState) {
  console.log('\n=== 危险检测示例 ===');
  
  // 获取最危险的敌人
  const mostDangerous = gamePredictionSystem.getMostDangerousEnemy(gameState);
  if (mostDangerous) {
    console.log(`最危险敌人:`);
    console.log(`  类型: ${mostDangerous.kind}`);
    console.log(`  当前位置: (${mostDangerous.currentX.toFixed(1)}, ${mostDangerous.currentY.toFixed(1)})`);
    console.log(`  预测位置: (${mostDangerous.predictedX.toFixed(1)}, ${mostDangerous.predictedY.toFixed(1)})`);
    console.log(`  碰撞风险: ${mostDangerous.collisionRisk.toFixed(3)}`);
    console.log(`  威胁等级: ${mostDangerous.currentThreatLevel.toFixed(3)}`);
  }
  
  // 获取最佳逃生路径
  const escapeRoute = gamePredictionSystem.getBestEscapeRoute(gameState);
  if (escapeRoute) {
    console.log(`最佳逃生路径:`);
    console.log(`  目标位置: (${escapeRoute.centerX.toFixed(1)}, ${escapeRoute.centerY.toFixed(1)})`);
    console.log(`  安全评分: ${escapeRoute.safetyScore.toFixed(3)}`);
    console.log(`  到达时间: ${escapeRoute.accessTime.toFixed(2)}秒`);
  }
}

// 使用示例 5: 在游戏循环中集成预测
export function gameLoopIntegrationExample(gameState: GameState, _dt: number) {
  // 这个函数展示如何在游戏的每一帧中使用预测系统
  
  // 1. 获取当前预测
  const prediction = predictNextGameState(gameState, 0.5);
  
  // 2. 基于预测调整游戏难度或AI行为
  if (prediction.emergencyLevel > 0.8) {
    console.log('⚠️ 紧急情况！AI需要立即采取规避动作');
    // 可以在这里调整AI的决策策略
  }
  
  // 3. 基于预测提供玩家提示
  if (prediction.globalThreatLevel > 0.6) {
    console.log('💡 建议玩家移动到安全区域');
    // 可以在UI中显示安全区域提示
  }
  
  // 4. 基于预测优化敌人生成
  if (prediction.globalThreatLevel < 0.3) {
    console.log('📈 当前威胁较低，可以考虑增加敌人生成');
    // 可以动态调整敌人生成率
  }
  
  // 5. 记录预测数据用于分析
  return {
    timestamp: Date.now(),
    gameTime: gameState.elapsed,
    threatLevel: prediction.globalThreatLevel,
    emergencyLevel: prediction.emergencyLevel,
    enemyCount: prediction.enemies.length,
    safeZoneCount: prediction.safeZones.length
  };
}

// 使用示例 6: 自定义预测系统
export function customPredictionExample(gameState: GameState) {
  console.log('\n=== 自定义预测示例 ===');
  
  // 创建自定义预测系统实例
  const customPredictor = new GamePredictionSystem();
  
  // 预测多个时间点
  const timePoints = [0.1, 0.3, 0.7, 1.5];
  
  timePoints.forEach(time => {
    const prediction = customPredictor.predictGameState(gameState, time);
    console.log(`${time}s 预测:`);
    console.log(`  威胁等级: ${prediction.globalThreatLevel.toFixed(3)}`);
    console.log(`  紧急程度: ${prediction.emergencyLevel.toFixed(3)}`);
  });
}

// 工具函数：创建测试用的游戏状态
export function createTestGameState(): GameState {
  return {
    width: 800,
    height: 600,
    player: { x: 400, y: 300, r: 12, speed: 300 },
    playerVel: { x: 0, y: 0 },
    hazards: [
      {
        x: 100, y: 100, r: 15, life: 10,
        kind: 'normal' as const,
        baseSpeed: 150, t: 0,
        dirX: 1, dirY: 0,
        zigAmp: 0, zigFreq: 0,
        turnRate: undefined
      },
      {
        x: 700, y: 500, r: 20, life: 8,
        kind: 'tracker' as const,
        baseSpeed: 120, t: 2,
        dirX: -0.7, dirY: -0.7,
        zigAmp: 0, zigFreq: 0,
        turnRate: Math.PI
      },
      {
        x: 400, y: 50, r: 12, life: 12,
        kind: 'zigzag' as const,
        baseSpeed: 130, t: 1,
        dirX: 0, dirY: 1,
        zigAmp: 50, zigFreq: 4,
        turnRate: undefined
      }
    ],
    pickups: [
      {
        x: 200, y: 400, r: 10,
        life: 5, maxLife: 6, type: 'heart'
      }
    ],
    elapsed: 15.0,
    lives: 2,
    maxLives: 3
  };
}

// 完整示例：运行所有预测示例
export function runAllPredictionExamples() {
  console.log('🔮 游戏预测系统完整示例\n');
  
  const testGameState = createTestGameState();
  
  basicPredictionExample(testGameState);
  multiTimePredictionExample(testGameState);
  aiPredictionExample(testGameState);
  dangerDetectionExample(testGameState);
  customPredictionExample(testGameState);
  
  // 模拟游戏循环
  console.log('\n=== 游戏循环集成示例 ===');
  for (let frame = 0; frame < 3; frame++) {
    const frameData = gameLoopIntegrationExample(testGameState, 0.016);
    console.log(`帧 ${frame + 1}:`, frameData);
    
    // 模拟时间推进
    testGameState.elapsed += 0.016;
  }
  
  console.log('\n✅ 所有预测示例完成');
}

// 性能测试示例
export function performanceTestExample(gameState: GameState) {
  console.log('\n=== 性能测试示例 ===');
  
  const iterations = 1000;
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    predictNextGameState(gameState, 0.5);
  }
  
  const endTime = Date.now();
  const avgTime = (endTime - startTime) / iterations;
  
  console.log(`预测系统性能:`);
  console.log(`  总迭代次数: ${iterations}`);
  console.log(`  总耗时: ${endTime - startTime}ms`);
  console.log(`  平均单次预测耗时: ${avgTime.toFixed(3)}ms`);
  console.log(`  每秒可执行预测次数: ${Math.round(1000 / avgTime)}`);
}
