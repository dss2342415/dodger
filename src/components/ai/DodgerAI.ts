// 高级躲避游戏AI系统 - 优化生存时间的神经网络实现

export interface GameState {
  width: number;
  height: number;
  player: { x: number; y: number; r: number; speed: number };
  playerVel: { x: number; y: number };
  hazards: Array<{
    x: number; y: number; r: number;
    dirX: number; dirY: number;
    baseSpeed: number;
    kind: string;
    t: number;
    life: number;
    turnRate?: number;
    zigFreq?: number;
    zigAmp?: number;
  }>;
  pickups: Array<{
    x: number; y: number; r: number;
    life: number; maxLife: number;
    type: string;
  }>;
  elapsed: number;
  lives: number;
  maxLives: number;
}

interface Experience {
  state: number[];
  action: number;
  reward: number;
  nextState: number[] | null;
  done: boolean;
  priority: number;
}

export interface Episode {
  steps: EpisodeStep[];
  finalScore: number;
  seedUsed?: number;
}

export interface EpisodeStep {
  state: number[];
  action: number;
  reward: number;
  features?: any;
}

// 神经网络层定义
class NeuralLayer {
  weights: number[][];
  biases: number[];
  inputSize: number;
  outputSize: number;
  private lastInitTime: number = 0; // 添加上次初始化时间
  private initCooldown: number = 2000; // 初始化冷却时间2秒

  constructor(inputSize: number, outputSize: number) {
    console.log(`🏗️ 创建神经层: ${inputSize} → ${outputSize}`);
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.lastInitTime = Date.now();
    
    try {
      this.weights = this.initializeWeights(inputSize, outputSize);
      this.biases = new Array(outputSize).fill(0).map(() => (Math.random() - 0.5) * 0.2);
      
      // 验证初始化结果
      if (!this.weights || this.weights.length !== outputSize) {
        throw new Error(`权重矩阵创建失败: 期望${outputSize}行，实际${this.weights?.length || 0}行`);
      }
      
      for (let i = 0; i < Math.min(3, this.weights.length); i++) { // 检查前3行
        if (!Array.isArray(this.weights[i]) || this.weights[i].length !== inputSize) {
          throw new Error(`权重矩阵行${i}创建失败: 期望${inputSize}列，实际${this.weights[i]?.length || 0}列`);
        }
      }
      
      console.log(`✅ 神经层创建成功: ${inputSize} → ${outputSize}, 权重矩阵: ${this.weights.length}x${this.weights[0]?.length || 0}`);
    } catch (error) {
      console.error(`❌ 神经层创建失败: ${inputSize} → ${outputSize}`, error);
      // 重试一次
      this.weights = this.initializeWeights(inputSize, outputSize);
      this.biases = new Array(outputSize).fill(0).map(() => (Math.random() - 0.5) * 0.2);
    }
  }

  private initializeWeights(inputSize: number, outputSize: number): number[][] {
    if (inputSize <= 0 || outputSize <= 0) {
      throw new Error(`无效的层维度: ${inputSize} → ${outputSize}`);
    }
    
    // Xavier初始化，适合tanh激活函数
    const scale = Math.sqrt(6 / (inputSize + outputSize));
    const weights: number[][] = [];
    
    try {
      for (let i = 0; i < outputSize; i++) {
        weights[i] = [];
        for (let j = 0; j < inputSize; j++) {
          weights[i][j] = (Math.random() - 0.5) * 2 * scale;
        }
        
        // 验证每一行
        if (weights[i].length !== inputSize) {
          throw new Error(`权重行${i}长度错误: 期望${inputSize}，实际${weights[i].length}`);
        }
      }
      
      // 最终验证
      if (weights.length !== outputSize) {
        throw new Error(`权重矩阵行数错误: 期望${outputSize}，实际${weights.length}`);
      }
      
      console.log(`📊 权重矩阵初始化完成: ${inputSize}x${outputSize}`);
      return weights;
    } catch (error) {
      console.error('❌ 权重初始化失败:', error);
      // 简单回退方案
      const fallbackWeights: number[][] = [];
      for (let i = 0; i < outputSize; i++) {
        fallbackWeights[i] = new Array(inputSize).fill(0).map(() => (Math.random() - 0.5) * 0.1);
      }
      return fallbackWeights;
    }
  }

  forward(inputs: number[]): number[] {
    // 安全检查：确保权重矩阵已正确初始化
    if (!this.weights || !Array.isArray(this.weights) || this.weights.length !== this.outputSize) {
      const currentTime = Date.now();
      // 检查冷却时间，避免频繁重新初始化
      if (currentTime - this.lastInitTime > this.initCooldown) {
        console.error('❌ 权重矩阵未初始化，重新初始化权重');
        this.weights = this.initializeWeights(this.inputSize, this.outputSize);
        this.biases = new Array(this.outputSize).fill(0).map(() => (Math.random() - 0.5) * 0.2);
        this.lastInitTime = currentTime;
      } else {
        // 在冷却期间，返回零值而不是重新初始化
        console.warn(`⚠️ 权重矩阵问题，但仍在冷却期内，返回零值`);
        return new Array(this.outputSize).fill(0);
      }
    }

    // 添加调试信息
    if (inputs.length !== this.inputSize) {
      console.warn(`⚠️ 输入维度不匹配: 期望${this.inputSize}, 实际${inputs.length}`);
      // 维度不匹配时返回零值
      return new Array(this.outputSize).fill(0);
    }

    const outputs: number[] = [];
    for (let i = 0; i < this.outputSize; i++) {
      // 检查每一行的权重是否存在
      if (!Array.isArray(this.weights[i]) || this.weights[i].length !== this.inputSize) {
        const currentTime = Date.now();
        // 检查冷却时间
        if (currentTime - this.lastInitTime > this.initCooldown) {
          console.error(`❌ 权重行 ${i} 未初始化，重新初始化整个权重矩阵`);
          this.weights = this.initializeWeights(this.inputSize, this.outputSize);
          this.biases = new Array(this.outputSize).fill(0).map(() => (Math.random() - 0.5) * 0.2);
          this.lastInitTime = currentTime;
          // 重新开始整个计算过程
          i = -1; // 下一次循环时i会变成0
          continue;
        } else {
          console.warn(`⚠️ 权重行${i}问题，但仍在冷却期内，填充零值`);
          outputs[i] = 0;
          continue;
        }
      }
      
      let sum = this.biases[i] || 0; // 安全访问偏置
      for (let j = 0; j < this.inputSize; j++) {
        sum += (inputs[j] || 0) * (this.weights[i][j] || 0); // 安全访问权重
      }
      outputs[i] = sum;
    }
    
    // 最终安全检查：确保输出维度正确
    if (outputs.length !== this.outputSize) {
      console.error(`❌ 输出维度错误: 期望${this.outputSize}, 实际${outputs.length}, 强制补齐`);
      while (outputs.length < this.outputSize) {
        outputs.push(0);
      }
      outputs.length = this.outputSize; // 截断多余的元素
    }
    
    return outputs;
  }
}

// 激活函数
class ActivationFunctions {
  static tanh(x: number): number {
    return Math.tanh(x);
  }

  static tanhDerivative(x: number): number {
    const t = Math.tanh(x);
    return 1 - t * t;
  }

  static softmax(inputs: number[], temperature: number = 1.0): number[] {
    const maxInput = Math.max(...inputs);
    const expInputs = inputs.map(x => Math.exp((x - maxInput) / temperature));
    const sumExp = expInputs.reduce((sum, exp) => sum + exp, 0);
    return expInputs.map(exp => exp / sumExp);
  }

  static leakyRelu(x: number): number {
    return x > 0 ? x : 0.01 * x;
  }

  static leakyReluDerivative(x: number): number {
    return x > 0 ? 1 : 0.01;
  }
}

// 经验回放缓冲区

class ExperienceBuffer {
  private buffer: Experience[] = [];
  private maxSize: number;
  private position: number = 0;

  constructor(maxSize: number = 50000) {
    this.maxSize = maxSize;
  }

  add(experience: Experience): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(experience);
    } else {
      this.buffer[this.position] = experience;
      this.position = (this.position + 1) % this.maxSize;
    }
  }

  sample(batchSize: number): Experience[] {
    if (this.buffer.length < batchSize) {
      return [...this.buffer];
    }

    // 优先级采样：优先选择高奖励的经验
    const sorted = [...this.buffer].sort((a, b) => b.priority - a.priority);
    const samples: Experience[] = [];
    
    // 80%来自高优先级，20%随机采样
    const highPriorityCount = Math.floor(batchSize * 0.8);
    for (let i = 0; i < highPriorityCount && i < sorted.length; i++) {
      samples.push(sorted[i]);
    }
    
    const remainingCount = batchSize - samples.length;
    for (let i = 0; i < remainingCount; i++) {
      const randomIndex = Math.floor(Math.random() * this.buffer.length);
      samples.push(this.buffer[randomIndex]);
    }
    
    return samples;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
    this.position = 0;
  }
}

// 权重管理器 - 最多存储10个权重
class WeightManager {
  private weights: Array<{
    id: string;
    timestamp: number;
    performance: number;
    data: any;
  }> = [];
  private maxWeights: number = 10;

  saveWeights(performance: number, networkData: any): string {
    const id = `weights_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const weightEntry = {
      id,
      timestamp: Date.now(),
      performance,
      data: JSON.parse(JSON.stringify(networkData)) // 深拷贝
    };

    this.weights.push(weightEntry);
    
    // 如果超过最大数量，删除表现最差的权重
    if (this.weights.length > this.maxWeights) {
      this.weights.sort((a, b) => b.performance - a.performance);
      this.weights = this.weights.slice(0, this.maxWeights);
    }

    this.saveToLocalStorage();
    return id;
  }

  getBestWeights(): any | null {
    if (this.weights.length === 0) return null;
    const best = this.weights.reduce((best, current) => 
      current.performance > best.performance ? current : best
    );
    return best.data;
  }

  getAllWeights(): Array<{id: string, performance: number, timestamp: number}> {
    return this.weights.map(w => ({
      id: w.id,
      performance: w.performance,
      timestamp: w.timestamp
    }));
  }

  loadWeights(id: string): any | null {
    const weight = this.weights.find(w => w.id === id);
    return weight ? weight.data : null;
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('dodger_ai_weights_v2', JSON.stringify(this.weights));
    } catch (e) {
      console.warn('无法保存权重到本地存储:', e);
    }
  }

  loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('dodger_ai_weights_v2');
      if (saved) {
        this.weights = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('无法从本地存储加载权重:', e);
      this.weights = [];
    }
  }
}

// 主AI类
export class AdvancedDodgerAI {
  // 网络架构
  private inputLayer: NeuralLayer;
  private hiddenLayer1: NeuralLayer;
  private hiddenLayer2: NeuralLayer;
  private hiddenLayer3: NeuralLayer;
  private valueHead: NeuralLayer; // 价值估计
  private policyHead: NeuralLayer; // 策略输出

  // 训练相关
  private experienceBuffer: ExperienceBuffer;
  private weightManager: WeightManager;
  private learningRate: number = 0.001;
  private explorationRate: number = 0.1;
  private temperature: number = 1.0;
  
  // 统计信息
  private episodeCount: number = 0;
  private totalReward: number = 0;
  private bestPerformance: number = 0;
  private averagePerformance: number = 0;

  // 特征缓存
  private lastFeatures: number[] = [];
  private lastAction: number = 0;
  
  // 中心定位监控
  private centerTracker = {
    lastCenterDistance: 0,
    timeAwayFromCenter: 0,
    totalCenterTime: 0,
    forceBackToCenterCount: 0,
    lastForceTime: 0
  };
  
  // 防止边界反复移动的记忆系统
  private recentPositions: Array<{x: number; y: number; time: number}> = [];
  private borderAvoidanceMemory: Array<{direction: [number, number]; penalty: number; time: number}> = [];
  private maxMemorySize = 10;
  
  // 动作空间：9个离散动作
  private readonly ACTION_COUNT = 9;
  
  constructor() {
    console.log('🧠 开始初始化DodgerAI...');
    
    // 超大规模网络架构：200输入 -> 1024 -> 1536 -> 1024 -> 768 -> 512 -> 分叉为价值(1)和策略(9)
    // 支持完整的敌人群体信息和基于距离的权重训练
    console.log('📐 创建神经网络层...');
    this.inputLayer = new NeuralLayer(200, 1024); // 大幅增加到200维输入，支持完整敌人信息
    this.hiddenLayer1 = new NeuralLayer(1024, 1536); // 1536神经元处理复杂的群体行为
    this.hiddenLayer2 = new NeuralLayer(1536, 1024); // 1024神经元进行特征整合
    this.hiddenLayer3 = new NeuralLayer(1024, 768); // 768神经元用于高级决策
    this.valueHead = new NeuralLayer(768, 1); // 更强的价值估计能力
    this.policyHead = new NeuralLayer(768, this.ACTION_COUNT); // 更精确的策略输出
    
    console.log('💾 初始化经验缓冲区...');
    this.experienceBuffer = new ExperienceBuffer();
    this.weightManager = new WeightManager();
    this.weightManager.loadFromLocalStorage();
    
    // 先确保基础权重初始化完成
    console.log('🔧 确保权重初始化...');
    this.ensureWeightsInitialized();
    
    // 然后尝试加载最佳权重
    console.log('📥 加载最佳权重...');
    this.loadBestWeights();
    
    // 最后验证网络完整性
    console.log('✅ 验证网络完整性...');
    this.validateNetworkIntegrity();
    
    console.log('🧠 DodgerAI初始化完成 - 确定性物理预测系统已启用');
  }

  // 超级特征提取 - 200维特征向量，集成确定性物理预测
  extractFeatures(gameState: GameState, difficulty: number): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 基础特征 (8维) - 增强游戏状态信息
    features.push(player.x / width); // 归一化位置
    features.push(player.y / height);
    features.push(Math.hypot(gameState.playerVel.x, gameState.playerVel.y) / player.speed); // 归一化速度
    features.push(gameState.playerVel.x / player.speed); // X方向速度
    features.push(gameState.playerVel.y / player.speed); // Y方向速度
    features.push(Math.min(difficulty, 5) / 5); // 归一化难度
    features.push(gameState.elapsed / 200); // 归一化游戏时间
    features.push(Math.min(gameState.lives / gameState.maxLives, 1.0)); // 生命比例
    
    // 确定性物理预测特征 (12维) - 基于敌人物理规律的精确预测
    const physicsFeatures = this.analyzePredictiveContext(gameState);
    features.push(...physicsFeatures);
    
    // 中心倾向性和位置特征 (10维) - 强化中心定位策略
    const centerFeatures = this.analyzeCenterPositioning(gameState);
    features.push(...centerFeatures);
    
    // 所有敌人信息 (120维) - 支持最多20个敌人，每个敌人6维信息
    const allEnemyFeatures = this.extractAllEnemyInformation(gameState);
    features.push(...allEnemyFeatures);
    
    // 道具详细位置信息 (20维) - 保持5个道具信息
    const pickupPositionFeatures = this.extractPickupPositions(gameState);
    features.push(...pickupPositionFeatures);
    
    // 全局威胁分析 (15维) - 优化的威胁评估
    const globalThreatFeatures = this.analyzeGlobalThreats(gameState);
    features.push(...globalThreatFeatures);
    
    // 边界和安全分析 (15维) - 加强安全区域分析
    const safetyBoundaryFeatures = this.analyzeSafetyAndBoundary(gameState);
    features.push(...safetyBoundaryFeatures);
    
    // 确保特征数量正确 (总共200维: 8+12+10+120+20+15+15=200)
    while (features.length < 200) {
      features.push(0);
    }
    
    return features.slice(0, 200);
  }
  
  // 中心倾向性和位置分析 (10维) - 强化AI在中心区域活动的策略
  private analyzeCenterPositioning(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    
    // 到中心的距离和方向
    const toCenterX = centerX - player.x;
    const toCenterY = centerY - player.y;
    const distanceToCenter = Math.hypot(toCenterX, toCenterY);
    const maxDistance = Math.hypot(gameState.width / 2, gameState.height / 2);
    
    // 增强中心距离信号 - 使用平方函数增强远离中心的惩罚
    const normalizedDistance = distanceToCenter / maxDistance;
    const distancePenalty = Math.pow(normalizedDistance, 1.5); // 非线性惩罚
    features.push(distancePenalty); // 距离中心的惩罚信号
    
    // 增强中心方向信号 - 放大方向分量
    features.push((toCenterX / maxDistance) * 2.0); // 放大2倍的中心方向X
    features.push((toCenterY / maxDistance) * 2.0); // 放大2倍的中心方向Y
    
    // 强化中心区域舒适度评估 - 更严格的舒适区域
    const comfortRadius = maxDistance * 0.4; // 缩小舒适区域到40%
    const centerComfort = Math.max(0, 1 - distanceToCenter / comfortRadius); 
    const enhancedComfort = Math.pow(centerComfort, 0.8); // 增强舒适度信号
    features.push(enhancedComfort * 3.0); // 放大3倍的舒适度奖励
    
    // 强化边界压力评估 - 更早的边界警告
    const edgeMargin = 150; // 增大边界警告范围
    const leftPressure = Math.max(0, (edgeMargin - player.x) / edgeMargin);
    const rightPressure = Math.max(0, (player.x - (gameState.width - edgeMargin)) / edgeMargin);
    const topPressure = Math.max(0, (edgeMargin - player.y) / edgeMargin);
    const bottomPressure = Math.max(0, (player.y - (gameState.height - edgeMargin)) / edgeMargin);
    
    // 使用指数函数放大边界压力
    features.push(Math.pow(leftPressure, 0.7) * 2.5);   // 强化左边界压力
    features.push(Math.pow(rightPressure, 0.7) * 2.5);  // 强化右边界压力
    features.push(Math.pow(topPressure, 0.7) * 2.5);    // 强化上边界压力
    features.push(Math.pow(bottomPressure, 0.7) * 2.5); // 强化下边界压力
    
    // 总边界压力 - 综合边界威胁
    const totalBoundaryPressure = leftPressure + rightPressure + topPressure + bottomPressure;
    features.push(Math.pow(totalBoundaryPressure, 1.2) * 3.0); // 非线性放大总边界压力
    
    // 中心区域的相对安全性评估 - 更保守的中心安全评估
    let centerSafety = 1.0;
    const centerDangerRadius = 180; // 增大中心危险感知范围
    for (const hazard of gameState.hazards) {
      const hazardToCenter = Math.hypot(hazard.x - centerX, hazard.y - centerY);
      if (hazardToCenter < centerDangerRadius) { 
        const threatToCenter = Math.max(0.1, hazardToCenter / centerDangerRadius);
        centerSafety *= threatToCenter;
      }
    }
    features.push(centerSafety * 2.0); // 放大中心安全性信号
    
    return features;
  }

  // 提取所有敌人的完整信息 (120维) - 支持最多20个敌人
  private extractAllEnemyInformation(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    const maxEnemies = 20; // 调整为20个敌人以适应新的特征分配
    
    // 计算每个敌人到玩家的距离，用于权重计算
    const enemiesWithDistance = gameState.hazards.map(hazard => ({
      ...hazard,
      distance: Math.hypot(hazard.x - player.x, hazard.y - player.y),
      weight: 0 // 将在后面计算
    }));
    
    // 按距离排序，近的敌人优先
    enemiesWithDistance.sort((a, b) => a.distance - b.distance);
    
    // 计算基于距离的权重（用于训练权重调整）
    const maxDistance = Math.hypot(width, height);
    for (let i = 0; i < enemiesWithDistance.length; i++) {
      const enemy = enemiesWithDistance[i];
      // 距离越近权重越高，使用指数衰减
      enemy.weight = Math.exp(-enemy.distance / (maxDistance * 0.3));
    }
    
    // 提取每个敌人的6维特征信息
    for (let i = 0; i < maxEnemies; i++) {
      if (i < enemiesWithDistance.length) {
        const enemy = enemiesWithDistance[i];
        
        // 当前位置 (归一化)
        features.push(enemy.x / width);
        features.push(enemy.y / height);
        
        // 下一帧预测位置 (基于速度和方向)
        const nextX = enemy.x + enemy.dirX * enemy.baseSpeed;
        const nextY = enemy.y + enemy.dirY * enemy.baseSpeed;
        features.push(Math.max(0, Math.min(1, nextX / width)));
        features.push(Math.max(0, Math.min(1, nextY / height)));
        
        // 敌人属性
        features.push(enemy.r / 50); // 归一化半径 (假设最大半径50)
        features.push(enemy.weight); // 基于距离的权重
      } else {
        // 没有敌人时填充0
        features.push(0, 0, 0, 0, 0, 0);
      }
    }
    
    return features;
  }

  // 全局威胁分析 (12维) - 优化的威胁评估
  private analyzeGlobalThreats(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const hazards = gameState.hazards;
    
    if (hazards.length === 0) {
      return new Array(12).fill(0);
    }
    
    // 距离威胁分析
    const distances = hazards.map(h => Math.hypot(h.x - player.x, h.y - player.y));
    const minDistance = Math.min(...distances);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const maxDistance = Math.max(...distances);
    
    features.push(Math.tanh(minDistance / 100)); // 最近距离
    features.push(Math.tanh(avgDistance / 100)); // 平均距离
    features.push(Math.tanh(maxDistance / 100)); // 最远距离
    
    // 威胁密度分析
    const nearbyThreats = hazards.filter(h => 
      Math.hypot(h.x - player.x, h.y - player.y) < 150
    );
    features.push(nearbyThreats.length / Math.max(1, hazards.length)); // 近距离威胁比例
    
    // 方向威胁分析 (4个主要方向)
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 左右上下
    for (const [dx, dy] of directions) {
      let threat = 0;
      for (const hazard of hazards) {
        const toHazard = {
          x: hazard.x - player.x,
          y: hazard.y - player.y
        };
        const distance = Math.hypot(toHazard.x, toHazard.y);
        if (distance > 0) {
          const dotProduct = (toHazard.x * dx + toHazard.y * dy) / distance;
          if (dotProduct > 0.5) {
            threat += Math.exp(-distance / 80) * dotProduct;
          }
        }
      }
      features.push(Math.tanh(threat));
    }
    
    // 预计碰撞时间分析
    let minTimeToCollision = Infinity;
    for (const hazard of hazards) {
      const relX = hazard.x - player.x;
      const relY = hazard.y - player.y;
      const relVX = hazard.dirX * hazard.baseSpeed - gameState.playerVel.x;
      const relVY = hazard.dirY * hazard.baseSpeed - gameState.playerVel.y;
      
      const a = relVX * relVX + relVY * relVY;
      const b = 2 * (relX * relVX + relY * relVY);
      const c = relX * relX + relY * relY - Math.pow(hazard.r + player.r, 2);
      
      if (a > 0) {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
          const t = (-b - Math.sqrt(discriminant)) / (2 * a);
          if (t > 0 && t < minTimeToCollision) {
            minTimeToCollision = t;
          }
        }
      }
    }
    features.push(Math.tanh(minTimeToCollision / 3)); // 归一化碰撞时间
    
    // 追踪型敌人威胁
    const trackers = hazards.filter(h => h.kind === 'tracker');
    let trackerThreat = 0;
    for (const tracker of trackers) {
      const distance = Math.hypot(tracker.x - player.x, tracker.y - player.y);
      trackerThreat += Math.exp(-distance / 100);
    }
    features.push(Math.tanh(trackerThreat));
    
    // 敌人聚集度分析
    if (hazards.length > 1) {
      const centerX = hazards.reduce((sum, h) => sum + h.x, 0) / hazards.length;
      const centerY = hazards.reduce((sum, h) => sum + h.y, 0) / hazards.length;
      const avgDistanceFromCenter = hazards.reduce((sum, h) => 
        sum + Math.hypot(h.x - centerX, h.y - centerY), 0) / hazards.length;
      features.push(Math.tanh(avgDistanceFromCenter / 200));
    } else {
      features.push(0);
    }
    
    return features;
  }

  // 安全和边界分析 (10维) - 精简但保持关键信息
  private analyzeSafetyAndBoundary(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 边界距离分析 (4维)
    features.push(player.x / width); // 左边界距离
    features.push((width - player.x) / width); // 右边界距离
    features.push(player.y / height); // 上边界距离
    features.push((height - player.y) / height); // 下边界距离
    
    // 安全区域分析 (4维) - 将屏幕分为2x2网格
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const centerX = (i + 0.5) * width / 2;
        const centerY = (j + 0.5) * height / 2;
        
        let safety = 1.0;
        for (const hazard of gameState.hazards) {
          const distance = Math.hypot(hazard.x - centerX, hazard.y - centerY);
          safety *= Math.min(1, distance / (hazard.r + 80));
        }
        features.push(Math.tanh(safety));
      }
    }
    
    // 最安全方向 (2维)
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let bestSafetyScore = -1;
    let bestDirection = [0, 0];
    
    for (const [dx, dy] of directions) {
      const checkX = player.x + dx * 100;
      const checkY = player.y + dy * 100;
      
      // 检查边界
      if (checkX < 0 || checkX > width || checkY < 0 || checkY > height) {
        continue;
      }
      
      let safetyScore = 1.0;
      for (const hazard of gameState.hazards) {
        const distance = Math.hypot(hazard.x - checkX, hazard.y - checkY);
        safetyScore *= Math.min(1, distance / (hazard.r + 50));
      }
      
      if (safetyScore > bestSafetyScore) {
        bestSafetyScore = safetyScore;
        bestDirection = [dx, dy];
      }
    }
    
    features.push(bestDirection[0]); // 最安全方向X
    features.push(bestDirection[1]); // 最安全方向Y
    
    return features;
  }

  // 提取敌人详细位置信息 (40维) - 最多记录10个最近的敌人
  private extractEnemyPositions(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 按距离排序，取最近的10个敌人
    const sortedHazards = gameState.hazards
      .map(hazard => ({
        ...hazard,
        distance: Math.hypot(hazard.x - player.x, hazard.y - player.y)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
    
    for (let i = 0; i < 10; i++) {
      if (i < sortedHazards.length) {
        const hazard = sortedHazards[i];
        
        // 当前位置 (归一化)
        features.push(hazard.x / width);
        features.push(hazard.y / height);
        
        // 下一帧预测位置 (基于速度和方向)
        const nextX = hazard.x + hazard.dirX * hazard.baseSpeed;
        const nextY = hazard.y + hazard.dirY * hazard.baseSpeed;
        features.push(Math.max(0, Math.min(1, nextX / width))); // 限制在[0,1]范围
        features.push(Math.max(0, Math.min(1, nextY / height))); // 限制在[0,1]范围
      } else {
        // 没有敌人时填充0
        features.push(0, 0, 0, 0);
      }
    }
    
    return features;
  }

  // 提取道具详细位置信息 (20维) - 最多记录5个道具
  private extractPickupPositions(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 按距离和紧急度排序
    const sortedPickups = gameState.pickups
      .map(pickup => ({
        ...pickup,
        distance: Math.hypot(pickup.x - player.x, pickup.y - player.y),
        urgency: (pickup.maxLife - pickup.life) / pickup.maxLife // 紧急度
      }))
      .sort((a, b) => {
        // 优先考虑紧急的和近距离的道具
        const scoreA = a.urgency * 2 + (1 - a.distance / Math.hypot(width, height));
        const scoreB = b.urgency * 2 + (1 - b.distance / Math.hypot(width, height));
        return scoreB - scoreA;
      })
      .slice(0, 5);
    
    for (let i = 0; i < 5; i++) {
      if (i < sortedPickups.length) {
        const pickup = sortedPickups[i];
        
        // 位置信息 (归一化)
        features.push(pickup.x / width);
        features.push(pickup.y / height);
        
        // 剩余生命时间 (归一化)
        features.push(pickup.life / pickup.maxLife);
        
        // 道具类型编码 (简单的one-hot编码)
        features.push(pickup.type === 'heart' ? 1 : 0);
      } else {
        // 没有道具时填充0
        features.push(0, 0, 0, 0);
      }
    }
    
    return features;
  }

  private analyzeThreat(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const hazards = gameState.hazards;
    
    if (hazards.length === 0) {
      return new Array(20).fill(0);
    }
    
    // 最近威胁分析
    const distances = hazards.map(h => Math.hypot(h.x - player.x, h.y - player.y));
    const minDistance = Math.min(...distances);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    features.push(Math.tanh(minDistance / 100)); // 最近距离
    features.push(Math.tanh(avgDistance / 100)); // 平均距离
    
    // 方向威胁分析 (8方向)
    const directions = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    
    for (const [dx, dy] of directions) {
      let threat = 0;
      for (const hazard of hazards) {
        const toHazard = {
          x: hazard.x - player.x,
          y: hazard.y - player.y
        };
        const distance = Math.hypot(toHazard.x, toHazard.y);
        if (distance > 0) {
          const dotProduct = (toHazard.x * dx + toHazard.y * dy) / distance;
          if (dotProduct > 0.5) { // 威胁在这个方向
            threat += Math.exp(-distance / 50) * dotProduct;
          }
        }
      }
      features.push(Math.tanh(threat));
    }
    
    // 追踪型敌人特殊分析
    const trackers = hazards.filter(h => h.kind === 'tracker');
    let trackerThreat = 0;
    for (const tracker of trackers) {
      const distance = Math.hypot(tracker.x - player.x, tracker.y - player.y);
      trackerThreat += Math.exp(-distance / 100);
    }
    features.push(Math.tanh(trackerThreat));
    
    // 时间到碰撞分析
    let minTimeToCollision = Infinity;
    for (const hazard of hazards) {
      const relX = hazard.x - player.x;
      const relY = hazard.y - player.y;
      const relVX = hazard.dirX * hazard.baseSpeed - gameState.playerVel.x;
      const relVY = hazard.dirY * hazard.baseSpeed - gameState.playerVel.y;
      
      const a = relVX * relVX + relVY * relVY;
      const b = 2 * (relX * relVX + relY * relVY);
      const c = relX * relX + relY * relY - Math.pow(hazard.r + player.r, 2);
      
      if (a > 0) {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
          const t = (-b - Math.sqrt(discriminant)) / (2 * a);
          if (t > 0 && t < minTimeToCollision) {
            minTimeToCollision = t;
          }
        }
      }
    }
    
    features.push(Math.tanh(minTimeToCollision / 5)); // 归一化时间到碰撞
    
    return features;
  }

  private analyzeSafety(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 将屏幕分为4x4网格，分析每个区域的安全度
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const centerX = (i + 0.5) * width / 4;
        const centerY = (j + 0.5) * height / 4;
        
        let safety = 1.0;
        for (const hazard of gameState.hazards) {
          const distance = Math.hypot(hazard.x - centerX, hazard.y - centerY);
          safety *= Math.min(1, distance / (hazard.r + 50));
        }
        
        features.push(Math.tanh(safety));
      }
    }
    
    return features;
  }

  private analyzePickups(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    
    if (gameState.pickups.length === 0) {
      return new Array(8).fill(0);
    }
    
    // 最近道具分析
    const pickupDistances = gameState.pickups.map(p => 
      Math.hypot(p.x - player.x, p.y - player.y)
    );
    const minPickupDistance = Math.min(...pickupDistances);
    features.push(Math.tanh(minPickupDistance / 100));
    
    // 最有价值道具分析（考虑距离和剩余时间）
    let bestValue = 0;
    let bestDirection = { x: 0, y: 0 };
    
    for (const pickup of gameState.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      const urgency = (pickup.maxLife - pickup.life) / pickup.maxLife;
      const value = (1 / (1 + distance / 50)) * (0.5 + 0.5 * urgency);
      
      if (value > bestValue) {
        bestValue = value;
        const norm = Math.max(1, distance);
        bestDirection.x = (pickup.x - player.x) / norm;
        bestDirection.y = (pickup.y - player.y) / norm;
      }
    }
    
    features.push(Math.tanh(bestValue));
    features.push(bestDirection.x);
    features.push(bestDirection.y);
    
    // 道具紧急度分析
    let urgentPickups = 0;
    for (const pickup of gameState.pickups) {
      if (pickup.life < 2) {
        urgentPickups++;
      }
    }
    features.push(Math.tanh(urgentPickups / 5));
    
    // 健康状态分析
    const healthNeed = (gameState.maxLives - gameState.lives) / gameState.maxLives;
    features.push(healthNeed);
    
    // 道具可达性分析
    let accessiblePickups = 0;
    for (const pickup of gameState.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      const timeToReach = distance / player.speed;
      if (timeToReach < pickup.life * 0.8) {
        accessiblePickups++;
      }
    }
    features.push(Math.tanh(accessiblePickups / 5));
    
    // 保留一个位置以备未来扩展
    features.push(0);
    
    return features;
  }

  private analyzeBoundary(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 到边界的距离
    const leftDist = player.x / width;
    const rightDist = (width - player.x) / width;
    const topDist = player.y / height;
    const bottomDist = (height - player.y) / height;
    
    features.push(leftDist);
    features.push(rightDist);
    features.push(topDist);
    features.push(bottomDist);
    
    return features;
  }

  private analyzeHistory(gameState: GameState): number[] {
    const features: number[] = [];
    
    // 基于上次动作的特征
    features.push(Math.sin(this.lastAction * Math.PI / 4)); // 动作的周期性特征
    features.push(Math.cos(this.lastAction * Math.PI / 4));
    
    // 动作持续性
    features.push(this.lastAction === 0 ? 1 : 0); // 是否保持静止
    
    // 位置变化
    const velocityMagnitude = Math.hypot(gameState.playerVel.x, gameState.playerVel.y);
    features.push(Math.tanh(velocityMagnitude / gameState.player.speed));
    
    return features;
  }

  // 增强历史分析 (6维)
  private analyzeEnhancedHistory(gameState: GameState): number[] {
    const features: number[] = [];
    
    // 基于上次动作的特征
    features.push(Math.sin(this.lastAction * Math.PI / 4)); // 动作的周期性特征
    features.push(Math.cos(this.lastAction * Math.PI / 4));
    
    // 动作持续性和模式
    features.push(this.lastAction === 0 ? 1 : 0); // 是否保持静止
    features.push(this.lastAction > 4 ? 1 : 0); // 是否为对角线移动
    
    // 位置和速度变化
    const velocityMagnitude = Math.hypot(gameState.playerVel.x, gameState.playerVel.y);
    features.push(Math.tanh(velocityMagnitude / gameState.player.speed));
    
    // 移动效率 - 当前速度与最大速度的比例
    features.push(velocityMagnitude / gameState.player.speed);
    
    return features;
  }

  // 全局态势分析 (8维)
  private analyzeGlobalSituation(gameState: GameState): number[] {
    const features: number[] = [];
    
    // 敌人密度分析
    const totalEnemyArea = gameState.hazards.reduce((sum, h) => sum + Math.PI * h.r * h.r, 0);
    const mapArea = gameState.width * gameState.height;
    features.push(totalEnemyArea / mapArea); // 敌人覆盖率
    
    // 敌人分布均匀性
    let spreadMetric = 0;
    if (gameState.hazards.length > 1) {
      const avgX = gameState.hazards.reduce((sum, h) => sum + h.x, 0) / gameState.hazards.length;
      const avgY = gameState.hazards.reduce((sum, h) => sum + h.y, 0) / gameState.hazards.length;
      const variance = gameState.hazards.reduce((sum, h) => 
        sum + Math.pow(h.x - avgX, 2) + Math.pow(h.y - avgY, 2), 0) / gameState.hazards.length;
      spreadMetric = Math.tanh(variance / 10000); // 归一化方差
    }
    features.push(spreadMetric);
    
    // 游戏压力指标
    const gameStress = Math.min(1.0, 
      (gameState.hazards.length / 30) * (1 - gameState.lives / gameState.maxLives) * (gameState.elapsed / 100)
    );
    features.push(gameStress);
    
    // 道具可获得性
    const pickupAccessibility = gameState.pickups.length > 0 ? 
      gameState.pickups.filter(p => p.life > 2).length / gameState.pickups.length : 0;
    features.push(pickupAccessibility);
    
    // 地图控制度 - 玩家相对于中心的位置
    const centerControl = 1 - 2 * Math.sqrt(
      Math.pow((gameState.player.x - gameState.width/2) / gameState.width, 2) +
      Math.pow((gameState.player.y - gameState.height/2) / gameState.height, 2)
    );
    features.push(Math.max(0, centerControl));
    
    // 敌人类型多样性
    const enemyTypes = new Set(gameState.hazards.map(h => h.kind));
    features.push(enemyTypes.size / 5); // 假设最多5种敌人类型
    
    // 威胁压力梯度
    let threatGradient = 0;
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(hazard.x - gameState.player.x, hazard.y - gameState.player.y);
      threatGradient += 1 / (1 + distance / 50);
    }
    features.push(Math.tanh(threatGradient / 5));
    
    // 逃生路线数量评估
    const escapeRoutes = this.countEscapeRoutes(gameState);
    features.push(escapeRoutes / 8); // 8个方向
    
    return features;
  }

  // 确定性物理预测分析 - 基于敌人物理规律的精确未来位置预测 (12维)
  private analyzePredictiveContext(gameState: GameState): number[] {
    const features: number[] = [];
    const player = gameState.player;
    
    // 多时间点精确威胁预测: 0.5s, 1.0s, 2.0s, 3.0s
    const timeHorizons = [0.5, 1.0, 2.0, 3.0];
    
    for (const timeHorizon of timeHorizons) {
      let totalThreat = 0;
      let criticalThreats = 0;
      let centerPushingThreats = 0; // 推向中心的威胁
      
      for (const hazard of gameState.hazards) {
        // 使用确定性物理规律精确预测敌人位置
        const predictedPos = this.predictEnemyPositionPhysics(hazard, gameState, timeHorizon);
        
        // 计算预测位置的威胁强度
        const threatDistance = Math.hypot(predictedPos.x - player.x, predictedPos.y - player.y);
        const safeDistance = hazard.r + player.r + 50; // 安全边距
        
        if (threatDistance < safeDistance * 2.5) {
          const threatIntensity = Math.max(0, (safeDistance * 2.5 - threatDistance) / (safeDistance * 2.5));
          totalThreat += threatIntensity;
          
          if (threatDistance < safeDistance * 1.2) {
            criticalThreats += 1; // 危险威胁计数
          }
          
          // 计算敌人是否会推动玩家向中心移动
          const centerX = gameState.width / 2;
          const centerY = gameState.height / 2;
          const playerToCenter = {
            x: centerX - player.x,
            y: centerY - player.y
          };
          const playerToCenterDist = Math.hypot(playerToCenter.x, playerToCenter.y);
          
          if (playerToCenterDist > 0) {
            const enemyToPlayer = {
              x: player.x - predictedPos.x,
              y: player.y - predictedPos.y
            };
            const enemyToPlayerDist = Math.hypot(enemyToPlayer.x, enemyToPlayer.y);
            
            if (enemyToPlayerDist > 0) {
              // 计算敌人威胁方向与玩家到中心方向的对齐度
              const alignment = (enemyToPlayer.x * playerToCenter.x + enemyToPlayer.y * playerToCenter.y) / 
                               (enemyToPlayerDist * playerToCenterDist);
              
              if (alignment > 0.3) { // 敌人威胁方向与中心方向基本一致
                centerPushingThreats += alignment * threatIntensity;
              }
            }
          }
        }
      }
      
      // 归一化威胁指标
      const hazardCount = Math.max(1, gameState.hazards.length);
      features.push(Math.tanh(totalThreat / hazardCount)); // 总威胁强度
      features.push(Math.min(1, criticalThreats / hazardCount)); // 危险威胁比例
      features.push(Math.tanh(centerPushingThreats / hazardCount)); // 中心推动威胁
    }
    
    return features; // 4个时间点 × 3个指标 = 12维
  }
  
  // 确定性物理规律敌人位置预测
  private predictEnemyPositionPhysics(hazard: any, gameState: GameState, deltaTime: number): {x: number, y: number} {
    let x = hazard.x;
    let y = hazard.y;
    let dirX = hazard.dirX;
    let dirY = hazard.dirY;
    let t = hazard.t + deltaTime;
    
    // 根据敌人类型使用不同的物理预测算法
    switch (hazard.kind) {
      case 'tracker':
        // 追踪型：计算转向后的预测位置
        const targetDirX = (gameState.player.x - x) / Math.hypot(gameState.player.x - x, gameState.player.y - y || 1);
        const targetDirY = (gameState.player.y - y) / Math.hypot(gameState.player.x - x, gameState.player.y - y || 1);
        
        const dot = dirX * targetDirX + dirY * targetDirY;
        const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
        const maxTurn = (hazard.turnRate ?? Math.PI) * deltaTime;
        
        if (theta > 1e-4) {
          const k = Math.min(1, maxTurn / theta);
          dirX = (1 - k) * dirX + k * targetDirX;
          dirY = (1 - k) * dirY + k * targetDirY;
          const n = Math.hypot(dirX, dirY) || 1;
          dirX /= n;
          dirY /= n;
        }
        
        // 更新位置
        x += dirX * hazard.baseSpeed * deltaTime;
        y += dirY * hazard.baseSpeed * deltaTime;
        break;
        
      case 'zigzag':
        // 锯齿型：基础运动 + 垂直震荡
        let effVX = dirX * hazard.baseSpeed;
        let effVY = dirY * hazard.baseSpeed;
        
        // 计算垂直于运动方向的震荡
        const perpX = -dirY;
        const perpY = dirX;
        const oscillation = Math.sin(t * hazard.zigFreq) * hazard.zigAmp;
        
        effVX += perpX * oscillation;
        effVY += perpY * oscillation;
        
        x += effVX * deltaTime;
        y += effVY * deltaTime;
        break;
        
      case 'normal':
      case 'sprinter':  
      case 'heavy':
      default:
        // 直线运动类型：简单的线性预测
        x += dirX * hazard.baseSpeed * deltaTime;
        y += dirY * hazard.baseSpeed * deltaTime;
        break;
    }
    
    return { x, y };
  }

  // 辅助方法：计算逃生路线数量
  private countEscapeRoutes(gameState: GameState): number {
    const directions = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    
    let safeRoutes = 0;
    for (const [dx, dy] of directions) {
      let routeSafe = true;
      for (let step = 1; step <= 5; step++) {
        const checkX = gameState.player.x + dx * gameState.player.speed * step * 0.2;
        const checkY = gameState.player.y + dy * gameState.player.speed * step * 0.2;
        
        // 检查边界
        if (checkX < 0 || checkX > gameState.width || checkY < 0 || checkY > gameState.height) {
          routeSafe = false;
          break;
        }
        
        // 检查敌人威胁
        for (const hazard of gameState.hazards) {
          const distance = Math.hypot(hazard.x - checkX, hazard.y - checkY);
          if (distance < hazard.r + gameState.player.r + 20) {
            routeSafe = false;
            break;
          }
        }
        if (!routeSafe) break;
      }
      if (routeSafe) safeRoutes++;
    }
    
    return safeRoutes;
  }

  // 辅助方法：预测安全点
  private predictSafeSpots(gameState: GameState): number {
    let safeSpots = 0;
    const gridSize = 50;
    
    for (let x = gridSize; x < gameState.width - gridSize; x += gridSize) {
      for (let y = gridSize; y < gameState.height - gridSize; y += gridSize) {
        let spotSafe = true;
        
        for (const hazard of gameState.hazards) {
          const futureX = hazard.x + hazard.dirX * hazard.baseSpeed * 2.0;
          const futureY = hazard.y + hazard.dirY * hazard.baseSpeed * 2.0;
          const distance = Math.hypot(futureX - x, futureY - y);
          
          if (distance < hazard.r + 30) {
            spotSafe = false;
            break;
          }
        }
        
        if (spotSafe) safeSpots++;
      }
    }
    
    return safeSpots;
  }

  // 辅助方法：计算局部威胁密度
  private calculateLocalThreatDensity(gameState: GameState): number {
    const localRadius = 100;
    let localThreats = 0;
    
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(hazard.x - gameState.player.x, hazard.y - gameState.player.y);
      if (distance < localRadius) {
        localThreats += (localRadius - distance) / localRadius;
      }
    }
    
    return Math.tanh(localThreats / 5);
  }

  // 辅助方法：估算生存时间
  private estimateSurvivalTime(gameState: GameState): number {
    let minTimeToCollision = Infinity;
    
    for (const hazard of gameState.hazards) {
      const relativeX = hazard.x - gameState.player.x;
      const relativeY = hazard.y - gameState.player.y;
      const relativeVelX = hazard.dirX * hazard.baseSpeed;
      const relativeVelY = hazard.dirY * hazard.baseSpeed;
      
      const distance = Math.hypot(relativeX, relativeY);
      const approachSpeed = -(relativeX * relativeVelX + relativeY * relativeVelY) / distance;
      
      if (approachSpeed > 0) {
        const timeToCollision = (distance - hazard.r - gameState.player.r) / approachSpeed;
        minTimeToCollision = Math.min(minTimeToCollision, timeToCollision);
      }
    }
    
    return minTimeToCollision === Infinity ? 10 : Math.max(0, minTimeToCollision);
  }

  // 辅助方法：计算行动时间窗口
  private calculateActionWindow(gameState: GameState): number {
    const nearbyThreats = gameState.hazards.filter(h => 
      Math.hypot(h.x - gameState.player.x, h.y - gameState.player.y) < 150
    );
    
    if (nearbyThreats.length === 0) return 1.0;
    
    const avgThreatSpeed = nearbyThreats.reduce((sum, h) => sum + h.baseSpeed, 0) / nearbyThreats.length;
    const avgDistance = nearbyThreats.reduce((sum, h) => 
      sum + Math.hypot(h.x - gameState.player.x, h.y - gameState.player.y), 0) / nearbyThreats.length;
    
    return Math.max(0.1, Math.min(1.0, avgDistance / (avgThreatSpeed * 2)));
  }

  private analyzeDynamics(gameState: GameState): number[] {
    const features: number[] = [];
    
    // 加速度分析（基于速度变化）
    const currentSpeed = Math.hypot(gameState.playerVel.x, gameState.playerVel.y);
    features.push(Math.tanh(currentSpeed / gameState.player.speed));
    
    // 运动趋势
    features.push(Math.tanh(gameState.playerVel.x / gameState.player.speed));
    features.push(Math.tanh(gameState.playerVel.y / gameState.player.speed));
    
    // 系统熵（混乱程度）
    let entropy = 0;
    for (const hazard of gameState.hazards) {
      const speed = Math.hypot(hazard.dirX * hazard.baseSpeed, hazard.dirY * hazard.baseSpeed);
      entropy += speed;
    }
    features.push(Math.tanh(entropy / 1000));
    
    return features;
  }

  // 前向传播
  private forward(inputs: number[]): { value: number; policy: number[] } {
    // 输入检查
    if (!inputs || inputs.length !== 200) {
      console.error('❌ 输入特征维度错误:', inputs?.length || 'undefined');
      // 返回安全的默认值
      return {
        value: 0,
        policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT)
      };
    }

    try {
      // 第一层 (200 → 1024)
      let hidden1 = this.inputLayer.forward(inputs);
      if (hidden1.length !== 1024) {
        console.error(`❌ inputLayer维度错误: 期望1024，实际${hidden1.length}`);
        // 非训练模式下不强制重新初始化，直接返回默认值
        return { value: 0, policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT) };
      }
      hidden1 = hidden1.map(x => ActivationFunctions.tanh(x));
      
      // 第二层 (1024 → 1536)
      let hidden2 = this.hiddenLayer1.forward(hidden1);
      if (hidden2.length !== 1536) {
        console.error(`❌ hiddenLayer1维度错误: 期望1536，实际${hidden2.length}`);
        return { value: 0, policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT) };
      }
      hidden2 = hidden2.map(x => ActivationFunctions.tanh(x));
      
      // 第三层 (1536 → 1024)
      let hidden3 = this.hiddenLayer2.forward(hidden2);
      if (hidden3.length !== 1024) {
        console.error(`❌ hiddenLayer2维度错误: 期望1024，实际${hidden3.length}`);
        return { value: 0, policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT) };
      }
      hidden3 = hidden3.map(x => ActivationFunctions.tanh(x));
      
      // 第四层 (1024 → 768)
      let hidden4 = this.hiddenLayer3.forward(hidden3);
      if (hidden4.length !== 768) {
        console.error(`❌ hiddenLayer3维度错误: 期望768，实际${hidden4.length}`);
        return { value: 0, policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT) };
      }
      hidden4 = hidden4.map(x => ActivationFunctions.tanh(x));
      
      // 价值头 (768 → 1)
      const valueOutput = this.valueHead.forward(hidden4);
      if (valueOutput.length !== 1) {
        console.error(`❌ valueHead维度错误: 期望1，实际${valueOutput.length}`);
        return { value: 0, policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT) };
      }
      const value = ActivationFunctions.tanh(valueOutput[0] || 0);
      
      // 策略头 (768 → ACTION_COUNT)
      const policyOutput = this.policyHead.forward(hidden4);
      if (policyOutput.length !== this.ACTION_COUNT) {
        console.error(`❌ policyHead维度错误: 期望${this.ACTION_COUNT}，实际${policyOutput.length}`);
        return { value: 0, policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT) };
      }
      const policy = ActivationFunctions.softmax(policyOutput, this.temperature);
      
      return { value, policy };
    } catch (error) {
      console.error('❌ 前向传播错误:', error);
      // 只在严重错误时才考虑重新初始化，并且要谨慎
      console.warn('⚠️ 网络可能需要重新初始化，但在非训练模式下保持稳定');
      // 返回安全的默认值而不是强制重新初始化
      return {
        value: 0,
        policy: new Array(this.ACTION_COUNT).fill(1/this.ACTION_COUNT)
      };
    }
  }

  // 决策函数 - 智能威胁分析和精准规避系统
  decide(gameState: GameState, difficulty: number, training: boolean = false): {
    mvx: number; mvy: number; action: number; speed: number; hBias: number[]; hStrength: number;
  } {
    const features = this.extractFeatures(gameState, difficulty);
    this.lastFeatures = features;
    
    const { policy } = this.forward(features);
    
    // 实时威胁分析
    const threatAnalysis = this.analyzeRealTimeThreat(gameState);
    const pickupAnalysis = this.analyzePickupOpportunity(gameState);
    
    // 生命值检查
    const currentHealth = gameState.lives / gameState.maxLives;
    const isLowHealth = currentHealth <= 0.6;
    const isCriticalHealth = currentHealth <= 0.3;
    
    let action: number;
    
    // 🚨 紧急威胁处理 - 最高优先级
    if (threatAnalysis.immediateDanger) {
      console.log('🚨 检测到紧急威胁！执行紧急规避');
      action = this.getEmergencyAvoidanceAction(gameState, threatAnalysis);
    }
    // ⚠️ 高威胁情况下的预测性规避
    else if (threatAnalysis.highRisk) {
      console.log('⚠️ 高风险环境，使用预测性规避');
      action = this.getPredictiveAvoidanceAction(gameState, threatAnalysis);
    }
    // 💎 增强智能道具拾取 - 更积极的策略
    else if (pickupAnalysis.bestPickup && (
      pickupAnalysis.urgency > 0.5 ||  // 降低拾取阈值，更积极
      (currentHealth <= 0.6 && pickupAnalysis.urgency > 0.3) ||  // 血量低时更积极
      (currentHealth <= 0.3 && pickupAnalysis.urgency > 0.1)     // 血量极低时几乎总是拾取
    )) {
      console.log(`💎 发现道具，紧急度${pickupAnalysis.urgency.toFixed(2)}，血量${(currentHealth*100).toFixed(0)}%，执行智能拾取`);
      action = this.getSmartPickupAction(gameState, pickupAnalysis, threatAnalysis);
    }
    // 常规决策逻辑
    else {
      // 智能中心定位策略
      action = this.getIntelligentCenterAction(gameState, policy, threatAnalysis);
      
      // 根据威胁级别调整策略
      if (threatAnalysis.predictedDanger) {
        // 在有预测威胁时优先选择移动动作
        const movementActions = policy
          .map((prob, idx) => ({ idx, prob }))
          .filter(act => act.idx !== 0) // 排除静止动作
          .sort((a, b) => b.prob - a.prob);
        
        if (movementActions.length > 0) {
          action = movementActions[0].idx;
        }
      }
      
      // 训练时的探索策略
      if (training && Math.random() < this.explorationRate) {
        action = Math.floor(Math.random() * 8) + 1; // 避免选择静止动作
      }
    }
    
    // 最终安全检查
    action = this.applyAdvancedSafetyChecks(gameState, action, threatAnalysis);
    
    // 更新中心监控统计
    this.updateCenterTracking(gameState, action);
    
    // 边界规避检查
    action = this.applyBoundaryAvoidance(gameState, action);
    
    // 应用反复移动惩罚记忆系统
    action = this.applyAntiOscillationMemory(gameState, action);
    
    this.lastAction = action;
    
    // 动作映射：9个离散动作
    const actionMap = [
      { mvx: 0, mvy: 0 },     // 0: 静止
      { mvx: -1, mvy: 0 },    // 1: 左
      { mvx: 1, mvy: 0 },     // 2: 右
      { mvx: 0, mvy: -1 },    // 3: 上
      { mvx: 0, mvy: 1 },     // 4: 下
      { mvx: -1, mvy: -1 },   // 5: 左上
      { mvx: 1, mvy: -1 },    // 6: 右上
      { mvx: -1, mvy: 1 },    // 7: 左下
      { mvx: 1, mvy: 1 }      // 8: 右下
    ];
    
    const movement = actionMap[action];
    
    // 超高速动态速度控制
    const speed = this.calculateUltraFastSpeed(gameState, features, action, isLowHealth, isCriticalHealth);
    
    // 获取增强的启发式偏差
    const hBias = this.getUltraResponseBias(gameState, isLowHealth, isCriticalHealth);
    const hStrength = 0.5; // 大幅增加启发式强度，提高反应速度
    
    return {
      mvx: movement.mvx,
      mvy: movement.mvy,
      action,
      speed,
      hBias,
      hStrength
    };
  }

  // 应用反复移动惩罚记忆系统 - 防止边界附近的反复移动
  private applyAntiOscillationMemory(gameState: GameState, action: number): number {
    const player = gameState.player;
    const currentTime = Date.now();
    
    // 更新位置记忆
    this.updatePositionMemory(player.x, player.y, currentTime);
    
    // 检查是否在边界附近
    const nearBoundary = player.x < 150 || player.x > gameState.width - 150 || 
                        player.y < 150 || player.y > gameState.height - 150;
    
    if (!nearBoundary) {
      return action; // 不在边界附近，无需特殊处理
    }
    
    // 动作映射
    const actionVecs: [number, number][] = [
      [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];
    
    const currentActionVec = actionVecs[action];
    
    // 检查是否会造成反复移动
    if (this.isOscillatingMovement(currentActionVec, currentTime)) {
      // 寻找替代动作
      const alternatives = this.findAlternativeActions(gameState, action);
      if (alternatives.length > 0) {
        // 选择最安全的替代动作
        return alternatives[0];
      }
    }
    
    // 更新边界规避记忆
    this.updateBorderAvoidanceMemory(currentActionVec, currentTime);
    
    return action;
  }

  // 更新位置记忆
  private updatePositionMemory(x: number, y: number, time: number): void {
    this.recentPositions.push({x, y, time});
    
    // 清理过期记忆（保留最近3秒的记录）
    const cutoffTime = time - 3000;
    this.recentPositions = this.recentPositions.filter(pos => pos.time > cutoffTime);
    
    // 限制记忆大小
    if (this.recentPositions.length > this.maxMemorySize) {
      this.recentPositions = this.recentPositions.slice(-this.maxMemorySize);
    }
  }

  // 检查是否为反复移动
  private isOscillatingMovement(actionVec: [number, number], currentTime: number): boolean {
    if (this.recentPositions.length < 4) return false;
    
    // 检查最近的位置是否形成来回移动模式
    const recentPositions = this.recentPositions.slice(-6);
    const threshold = 30; // 位置变化阈值
    
    let oscillationCount = 0;
    for (let i = 1; i < recentPositions.length - 1; i++) {
      const prev = recentPositions[i - 1];
      const curr = recentPositions[i];
      const next = recentPositions[i + 1];
      
      // 检查是否有来回移动的模式
      const dist1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const dist2 = Math.hypot(next.x - curr.x, next.y - curr.y);
      const totalDist = Math.hypot(next.x - prev.x, next.y - prev.y);
      
      if (dist1 > threshold && dist2 > threshold && totalDist < threshold * 0.5) {
        oscillationCount++;
      }
    }
    
    return oscillationCount >= 2;
  }

  // 寻找替代动作
  private findAlternativeActions(gameState: GameState, originalAction: number): number[] {
    const alternatives: {action: number; safety: number}[] = [];
    
    for (let a = 1; a < 9; a++) { // 跳过静止动作
      if (a === originalAction) continue;
      
      const actionVecs: [number, number][] = [
        [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [1, -1], [-1, 1], [1, 1]
      ];
      
      const safety = this.evaluateDirectionSafety(gameState, actionVecs[a]);
      alternatives.push({action: a, safety});
    }
    
    // 按安全性排序
    alternatives.sort((a, b) => b.safety - a.safety);
    
    // 返回前3个最安全的动作
    return alternatives.slice(0, 3).map(alt => alt.action);
  }

  // 更新边界规避记忆
  private updateBorderAvoidanceMemory(actionVec: [number, number], time: number): void {
    // 记录可能造成问题的移动方向
    this.borderAvoidanceMemory.push({
      direction: actionVec,
      penalty: 0.5,
      time: time
    });
    
    // 清理过期记忆
    const cutoffTime = time - 5000;
    this.borderAvoidanceMemory = this.borderAvoidanceMemory.filter(mem => mem.time > cutoffTime);
    
    // 限制记忆大小
    if (this.borderAvoidanceMemory.length > this.maxMemorySize) {
      this.borderAvoidanceMemory = this.borderAvoidanceMemory.slice(-this.maxMemorySize);
    }
  }

  // 获取道具导向的动作选择
  private getPickupOrientedAction(gameState: GameState, policy: number[], isCriticalHealth: boolean): number {
    const player = gameState.player;
    const pickups = gameState.pickups;
    
    if (pickups.length === 0) return -1;
    
    // 找到最优道具
    let bestPickup = null;
    let bestScore = -1;
    
    for (const pickup of pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      const urgency = (pickup.maxLife - pickup.life) / pickup.maxLife;
      
      // 计算道具评分：距离越近、越紧急越好
      let score = 1 / (1 + distance / 100) + urgency * 2;
      
      // 血量道具在低血量时额外加分
      if (pickup.type === 'heart' && isCriticalHealth) {
        score *= 3; // 危急状态下血量道具优先级极高
      }
      
      // 检查安全性：避免为了道具冲向危险区域
      let safety = this.calculatePickupSafety(gameState, pickup);
      score *= safety;
      
      if (score > bestScore) {
        bestScore = score;
        bestPickup = pickup;
      }
    }
    
    if (!bestPickup || bestScore < 0.1) return -1;
    
    // 计算朝向最优道具的方向
    const dx = bestPickup.x - player.x;
    const dy = bestPickup.y - player.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance < 10) return 0; // 已经很近了，停止
    
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // 选择最匹配的动作
    const actionVectors = [
      [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
      [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707]
    ];
    
    let bestAction = 0;
    let bestDot = -2;
    
    for (let i = 1; i < actionVectors.length; i++) { // 跳过静止动作
      const dot = actionVectors[i][0] * dirX + actionVectors[i][1] * dirY;
      if (dot > bestDot) {
        bestDot = dot;
        bestAction = i;
      }
    }
    
    return bestAction;
  }

  // 计算道具拾取的安全性
  private calculatePickupSafety(gameState: GameState, pickup: any): number {
    let safety = 1.0;
    
    // 检查道具周围的威胁
    for (const hazard of gameState.hazards) {
      const distanceToPickup = Math.hypot(hazard.x - pickup.x, hazard.y - pickup.y);
      const threatRadius = hazard.r + 30; // 威胁半径
      
      if (distanceToPickup < threatRadius) {
        safety *= 0.3; // 危险区域的道具安全性很低
      } else if (distanceToPickup < threatRadius * 2) {
        safety *= 0.7; // 中等风险
      }
    }
    
    return Math.max(0.1, safety);
  }

  // 常规动作选择
  private getRegularAction(policy: number[], training: boolean): number {
    if (training && Math.random() < this.explorationRate) {
      // 探索：随机选择动作
      return Math.floor(Math.random() * this.ACTION_COUNT);
    } else {
      // 利用：选择概率最高的动作
      return policy.indexOf(Math.max(...policy));
    }
  }

  // 边界规避机制 - 强制禁止在边界停留
  private applyBoundaryAvoidance(gameState: GameState, action: number): number {
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 设置不同层级的边界阈值
    const urgentBoundary = 60;   // 紧急边界
    const warningBoundary = 120; // 警告边界
    const safeBoundary = 200;    // 安全边界
    
    // 检查边界距离
    const distToLeft = player.x;
    const distToRight = width - player.x;
    const distToTop = player.y;
    const distToBottom = height - player.y;
    const minBoundaryDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    
    // 计算到中心的方向
    const toCenterX = centerX - player.x;
    const toCenterY = centerY - player.y;
    const distToCenter = Math.hypot(toCenterX, toCenterY);
    
    // 动作映射
    const actionMap = [
      { mvx: 0, mvy: 0 },     // 0: 静止
      { mvx: -1, mvy: 0 },    // 1: 左
      { mvx: 1, mvy: 0 },     // 2: 右
      { mvx: 0, mvy: -1 },    // 3: 上
      { mvx: 0, mvy: 1 },     // 4: 下
      { mvx: -1, mvy: -1 },   // 5: 左上
      { mvx: 1, mvy: -1 },    // 6: 右上
      { mvx: -1, mvy: 1 },    // 7: 左下
      { mvx: 1, mvy: 1 }      // 8: 右下
    ];
    
    // 检查当前动作是否会使AI远离中心或接近边界
    const currentAction = actionMap[action];
    const futureX = player.x + currentAction.mvx * 60;
    const futureY = player.y + currentAction.mvy * 60;
    const futureBoundaryDist = Math.min(
      futureX, width - futureX, futureY, height - futureY
    );
    
    // 紧急边界处理 - 强制回中心
    if (minBoundaryDist < urgentBoundary) {
      console.log(`🚨 紧急边界规避: 距离边界${minBoundaryDist.toFixed(1)}px`);
      // 强制选择最佳回中心动作
      return this.getBestCenterAction(gameState);
    }
    
    // 警告边界处理 - 阻止继续远离中心
    if (minBoundaryDist < warningBoundary) {
      // 如果当前动作会让AI更远离中心或更接近边界，则纠正
      if (futureBoundaryDist < minBoundaryDist || 
          Math.hypot(futureX - centerX, futureY - centerY) > distToCenter) {
        console.log(`⚠️ 警告边界纠正: 纠正远离中心的动作`);
        return this.getBestCenterAction(gameState);
      }
    }
    
    // 安全边界处理 - 增强中心倾向
    if (minBoundaryDist < safeBoundary && distToCenter > width * 0.25) {
      // 30% 概率强制向中心移动
      if (Math.random() < 0.3) {
        console.log(`📍 中心引导: 距离中心${distToCenter.toFixed(1)}px`);
        return this.getBestCenterAction(gameState);
      }
    }
    
    return action;
  }

  // 获取最佳回中心动作
  private getBestCenterAction(gameState: GameState): number {
    const player = gameState.player;
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const toCenterX = centerX - player.x;
    const toCenterY = centerY - player.y;
    
    // 计算归一化方向
    const distance = Math.hypot(toCenterX, toCenterY);
    if (distance < 10) return 0; // 已经在中心附近
    
    const dirX = toCenterX / distance;
    const dirY = toCenterY / distance;
    
    // 选择最接近中心方向的动作
    let bestAction = 0;
    let bestScore = -Infinity;
    
    const actionVectors = [
      [0, 0],           // 0: 静止
      [-1, 0], [1, 0],  // 1-2: 左右
      [0, -1], [0, 1],  // 3-4: 上下
      [-0.707, -0.707], [0.707, -0.707],  // 5-6: 对角
      [-0.707, 0.707], [0.707, 0.707]     // 7-8: 对角
    ];
    
    for (let i = 1; i < actionVectors.length; i++) { // 跳过静止动作
      const [vx, vy] = actionVectors[i];
      // 计算动作向量与中心方向的点积（相似度）
      const score = vx * dirX + vy * dirY;
      
      // 检查这个动作是否安全（不会撞到障碍物）
      const futureX = player.x + vx * 80;
      const futureY = player.y + vy * 80;
      
      // 简单的安全检查
      let isSafe = true;
      for (const hazard of gameState.hazards) {
        const distToHazard = Math.hypot(futureX - hazard.x, futureY - hazard.y);
        if (distToHazard < hazard.r + player.r + 60) {
          isSafe = false;
          break;
        }
      }
      
      if (isSafe && score > bestScore) {
        bestScore = score;
        bestAction = i;
      }
    }
    
    return bestAction || 1; // 如果没有安全动作，默认向左
  }

  // 实时威胁分析 - 精确评估当前和未来危险
  private analyzeRealTimeThreat(gameState: GameState): {
    immediateDanger: boolean;
    highRisk: boolean;
    predictedDanger: boolean;
    dangerLevel: number;
    predictedDangerLevel: number;
    nearestThreat: any;
    escapeDirections: number[];
  } {
    const player = gameState.player;
    let maxThreatLevel = 0;
    let predictedMaxThreat = 0;
    let nearestThreat = null;
    let minDistance = Infinity;
    
    // 分析所有敌人的当前和预测威胁
    for (const hazard of gameState.hazards) {
      // 当前威胁评估
      const currentDistance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      const combinedRadius = hazard.r + player.r;
      
      if (currentDistance < minDistance) {
        minDistance = currentDistance;
        nearestThreat = hazard;
      }
      
      // 立即危险检测（高精度）
      if (currentDistance < combinedRadius + 30) {
        maxThreatLevel = Math.max(maxThreatLevel, 1.0);
      } else if (currentDistance < combinedRadius + 80) {
        const threatLevel = Math.exp(-(currentDistance - combinedRadius) / 40);
        maxThreatLevel = Math.max(maxThreatLevel, threatLevel);
      }
      
      // 预测性威胁分析（0.5秒后的位置）
      const futurePos = this.predictEnemyPositionPhysics(hazard, gameState, 0.5);
      const predictedDistance = Math.hypot(futurePos.x - player.x, futurePos.y - player.y);
      
      if (predictedDistance < combinedRadius + 50) {
        const predictedThreat = Math.exp(-(predictedDistance - combinedRadius) / 35);
        predictedMaxThreat = Math.max(predictedMaxThreat, predictedThreat);
      }
      
      // 考虑敌人的移动方向和速度
      const hazardVelocity = Math.hypot(hazard.dirX * hazard.baseSpeed, hazard.dirY * hazard.baseSpeed);
      if (hazardVelocity > 0) {
        // 计算敌人朝向玩家的程度
        const toPlayerX = player.x - hazard.x;
        const toPlayerY = player.y - hazard.y;
        const toPlayerDist = Math.hypot(toPlayerX, toPlayerY);
        
        if (toPlayerDist > 0) {
          const dotProduct = (hazard.dirX * toPlayerX + hazard.dirY * toPlayerY) / toPlayerDist;
          if (dotProduct > 0.5 && currentDistance < 200) {
            // 敌人正在朝玩家方向移动
            maxThreatLevel = Math.max(maxThreatLevel, 0.7 * dotProduct);
          }
        }
      }
    }
    
    // 计算逃生方向
    const escapeDirections = this.calculateEscapeDirections(gameState, nearestThreat);
    
    return {
      immediateDanger: maxThreatLevel > 0.8,
      highRisk: maxThreatLevel > 0.5,
      predictedDanger: predictedMaxThreat > 0.6,
      dangerLevel: maxThreatLevel,
      predictedDangerLevel: predictedMaxThreat,
      nearestThreat,
      escapeDirections
    };
  }

  // 计算最佳逃生方向
  private calculateEscapeDirections(gameState: GameState, nearestThreat: any): number[] {
    const player = gameState.player;
    const safeDirections: number[] = [];
    
    // 8个基本方向
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1],  // 直线方向
      [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707]  // 对角方向
    ];
    
    for (let i = 0; i < directions.length; i++) {
      const [dx, dy] = directions[i];
      const futureX = player.x + dx * 100; // 预测100像素后的位置
      const futureY = player.y + dy * 100;
      
      // 检查边界
      if (futureX < 50 || futureX > gameState.width - 50 || 
          futureY < 50 || futureY > gameState.height - 50) {
        continue;
      }
      
      // 检查与所有敌人的碰撞
      let isSafe = true;
      for (const hazard of gameState.hazards) {
        const distance = Math.hypot(futureX - hazard.x, futureY - hazard.y);
        if (distance < hazard.r + player.r + 60) {
          isSafe = false;
          break;
        }
      }
      
      if (isSafe) {
        safeDirections.push(i + 1); // 动作编号1-8
      }
    }
    
    return safeDirections;
  }

  // 增强智能道具拾取分析系统
  private analyzePickupOpportunity(gameState: GameState): {
    shouldPursue: boolean;
    bestPickup: any;
    safePath: boolean;
    urgency: number;
    estimatedTime: number;
    strategyType: string;
    riskLevel: number;
  } {
    const player = gameState.player;
    const currentHealth = gameState.lives / gameState.maxLives;
    let bestPickup = null;
    let bestScore = 0;
    let bestStrategy = 'none';
    let bestRiskLevel = 0;
    
    // 分析全局威胁环境
    const globalThreatLevel = this.calculateGlobalThreatLevel(gameState);
    const threatDensity = this.calculateThreatDensity(gameState);
    
    for (const pickup of gameState.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      
      // 1. 基础距离评分（改进）
      let score = this.calculateDistanceScore(distance);
      
      // 2. 道具类型价值评估（增强）
      const typeMultiplier = this.calculatePickupTypeValue(pickup, currentHealth, gameState);
      score *= typeMultiplier;
      
      // 3. 路径安全性综合评估
      const pathSafety = this.evaluateAdvancedPathSafety(gameState, pickup);
      score *= pathSafety.safetyScore;
      
      // 4. 时机评估
      const timingScore = this.evaluatePickupTiming(gameState, pickup, globalThreatLevel);
      score *= timingScore;
      
      // 5. 竞争分析（其他威胁是否也在靠近这个道具）
      const competitionFactor = this.analyzePickupCompetition(gameState, pickup);
      score *= competitionFactor;
      
      // 6. 战略价值评估
      const strategicValue = this.calculateStrategicValue(gameState, pickup, currentHealth);
      score *= strategicValue;
      
      if (score > bestScore) {
        bestScore = score;
        bestPickup = pickup;
        bestStrategy = this.determinePickupStrategy(pickup, currentHealth, pathSafety, globalThreatLevel);
        bestRiskLevel = 1 - pathSafety.safetyScore;
      }
    }
    
    // 智能决策逻辑（大幅增强）
    const shouldPursue = this.shouldPursuePickup(bestPickup, bestScore, currentHealth, globalThreatLevel, threatDensity);
    
    const distance = bestPickup ? Math.hypot(bestPickup.x - player.x, bestPickup.y - player.y) : 0;
    const estimatedTime = this.calculateEstimatedReachTime(gameState, bestPickup);
    const urgency = this.calculatePickupUrgency(bestPickup, currentHealth, bestScore, globalThreatLevel);
    
    return {
      shouldPursue,
      bestPickup,
      safePath: bestPickup ? this.evaluateAdvancedPathSafety(gameState, bestPickup).safetyScore > 0.6 : false,
      urgency,
      estimatedTime,
      strategyType: bestStrategy,
      riskLevel: bestRiskLevel
    };
  }

  // 计算距离评分（改进的非线性函数）
  private calculateDistanceScore(distance: number): number {
    // 使用更智能的距离评分函数
    if (distance < 50) return 1.0;           // 极近距离，最高评分
    if (distance < 100) return 0.9;          // 近距离，高评分
    if (distance < 200) return 0.7;          // 中距离，中等评分
    if (distance < 300) return 0.4;          // 远距离，低评分
    return Math.max(0.1, 1 / (1 + distance / 150)); // 极远距离，最低评分
  }

  // 道具类型价值评估（增强版）
  private calculatePickupTypeValue(pickup: any, currentHealth: number, gameState: GameState): number {
    const player = gameState.player;
    
    switch (pickup.type) {
      case 'health':
        if (currentHealth <= 0.2) return 3.0;      // 极低血量，血包是救命稻草
        if (currentHealth <= 0.4) return 2.5;      // 低血量，血包非常重要
        if (currentHealth <= 0.6) return 1.8;      // 中低血量，血包重要
        if (currentHealth <= 0.8) return 1.2;      // 中等血量，血包有用
        return 0.6;                                 // 高血量，血包价值较低
        
      case 'shield':
        const hasShield = player.shield && player.shield > 0;
        if (!hasShield && currentHealth <= 0.5) return 2.2;  // 低血量无护盾，极需要
        if (!hasShield) return 1.8;                          // 无护盾，很需要
        if (hasShield && player.shield < 50) return 1.3;     // 护盾不足，需要
        return 0.8;                                           // 护盾充足，价值较低
        
      case 'speed':
        const currentSpeed = player.speed || 1;
        if (currentSpeed < 1.2) return 1.5;        // 速度慢，需要提升
        if (currentSpeed < 1.5) return 1.2;        // 速度中等，有用
        return 0.9;                                 // 速度快，价值一般
        
      case 'points':
        return 0.7;                                 // 分数道具，一般价值
        
      case 'power':
        return 1.4;                                 // 能量道具，较高价值
        
      default:
        return 1.0;                                 // 未知道具，默认价值
    }
  }

  // 高级路径安全性评估
  private evaluateAdvancedPathSafety(gameState: GameState, pickup: any): {
    safetyScore: number;
    criticalThreats: any[];
    alternativePaths: number;
  } {
    const player = gameState.player;
    const pathSteps = 15; // 增加路径预测步数
    let safetyScore = 1.0;
    const criticalThreats: any[] = [];
    
    // 计算直线路径上的威胁
    for (let step = 1; step <= pathSteps; step++) {
      const progress = step / pathSteps;
      const checkX = player.x + (pickup.x - player.x) * progress;
      const checkY = player.y + (pickup.y - player.y) * progress;
      
      let stepDanger = 0;
      
      for (const hazard of gameState.hazards) {
        // 预测敌人在这个时间点的位置
        const timeStep = progress * 1.0; // 1秒的预测时间
        const predictedPos = this.predictEnemyPositionPhysics(hazard, gameState, timeStep);
        
        const distance = Math.hypot(checkX - predictedPos.x, checkY - predictedPos.y);
        const dangerRadius = hazard.r + player.r + 80; // 增加安全边距
        
        if (distance < dangerRadius) {
          const dangerIntensity = 1 - (distance / dangerRadius);
          stepDanger = Math.max(stepDanger, dangerIntensity);
          
          if (dangerIntensity > 0.7) {
            criticalThreats.push({
              hazard,
              predictedPos,
              dangerLevel: dangerIntensity,
              timeStep
            });
          }
        }
      }
      
      // 应用威胁到安全评分
      safetyScore *= (1 - stepDanger * 0.8);
    }
    
    // 计算备选路径数量
    const alternativePaths = this.calculateAlternativePathCount(gameState, pickup);
    
    return {
      safetyScore: Math.max(0, safetyScore),
      criticalThreats,
      alternativePaths
    };
  }

  // 时机评估
  private evaluatePickupTiming(gameState: GameState, pickup: any, globalThreatLevel: number): number {
    const player = gameState.player;
    
    // 1. 威胁密度评估
    if (globalThreatLevel > 0.8) return 0.4;  // 高威胁环境，时机不佳
    if (globalThreatLevel > 0.6) return 0.7;  // 中高威胁，需谨慎
    if (globalThreatLevel < 0.3) return 1.2;  // 低威胁，时机很好
    
    // 2. 距离中心评估
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const playerDistToCenter = Math.hypot(player.x - centerX, player.y - centerY);
    const pickupDistToCenter = Math.hypot(pickup.x - centerX, pickup.y - centerY);
    
    // 如果道具在边缘而玩家在中心，时机不佳
    if (playerDistToCenter < 150 && pickupDistToCenter > 200) return 0.6;
    
    // 3. 周围威胁变化趋势
    const threatTrend = this.analyzeThreatTrend(gameState, pickup);
    
    return Math.max(0.3, Math.min(1.5, 1.0 + threatTrend));
  }

  // 竞争分析
  private analyzePickupCompetition(gameState: GameState, pickup: any): number {
    let competitionFactor = 1.0;
    
    // 检查是否有敌人也在朝这个道具移动
    for (const hazard of gameState.hazards) {
      const hazardToPickup = Math.hypot(pickup.x - hazard.x, pickup.y - hazard.y);
      
      if (hazardToPickup < 200) { // 敌人在道具附近
        // 检查敌人是否朝道具方向移动
        const dirToPickup = {
          x: (pickup.x - hazard.x) / hazardToPickup,
          y: (pickup.y - hazard.y) / hazardToPickup
        };
        
        const hazardDir = { x: hazard.dirX || 0, y: hazard.dirY || 0 };
        const alignment = dirToPickup.x * hazardDir.x + dirToPickup.y * hazardDir.y;
        
        if (alignment > 0.5) { // 敌人朝道具移动
          competitionFactor *= 0.7; // 降低道具价值
        }
      }
    }
    
    return competitionFactor;
  }

  // 战略价值评估
  private calculateStrategicValue(gameState: GameState, pickup: any, currentHealth: number): number {
    const player = gameState.player;
    let strategicValue = 1.0;
    
    // 1. 位置战略价值
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const pickupDistToCenter = Math.hypot(pickup.x - centerX, pickup.y - centerY);
    const maxDistToCenter = Math.hypot(gameState.width / 2, gameState.height / 2);
    const centerRatio = pickupDistToCenter / maxDistToCenter;
    
    // 靠近中心的道具价值更高
    strategicValue *= (1.2 - centerRatio * 0.4);
    
    // 2. 逃生路线价值
    const escapeRoutes = this.calculateEscapeRoutesFromPosition(gameState, pickup);
    strategicValue *= (0.8 + escapeRoutes * 0.1);
    
    // 3. 链式拾取机会
    const nearbyPickups = this.findNearbyPickups(gameState, pickup, 150);
    if (nearbyPickups.length > 0) {
      strategicValue *= 1.3; // 能连续拾取多个道具
    }
    
    return strategicValue;
  }

  // 确定拾取策略
  private determinePickupStrategy(pickup: any, currentHealth: number, pathSafety: any, globalThreatLevel: number): string {
    if (currentHealth <= 0.3 && pickup.type === 'health') {
      return 'emergency_health';
    }
    
    if (pathSafety.safetyScore > 0.8 && globalThreatLevel < 0.4) {
      return 'safe_opportunity';
    }
    
    if (pathSafety.criticalThreats.length > 0) {
      return 'risky_dash';
    }
    
    if (pickup.type === 'shield' && currentHealth > 0.6) {
      return 'defensive_preparation';
    }
    
    return 'calculated_risk';
  }

  // 智能决策是否拾取 - 增强版
  private shouldPursuePickup(pickup: any, score: number, currentHealth: number, globalThreatLevel: number, threatDensity: number): boolean {
    if (!pickup) return false;
    
    // 紧急情况：极低血量必须拾取血包，更积极的阈值
    if (currentHealth <= 0.33 && (pickup.type === 'health' || pickup.type === 'heart') && score > 0.2) {
      console.log(`🚨 紧急血包拾取：血量${(currentHealth*100).toFixed(0)}%，评分${score.toFixed(2)}`);
      return true;
    }
    
    // 中低血量：更积极地拾取血包
    if (currentHealth <= 0.6 && (pickup.type === 'health' || pickup.type === 'heart') && score > 0.3) {
      console.log(`⚠️ 低血量拾取：血量${(currentHealth*100).toFixed(0)}%，评分${score.toFixed(2)}`);
      return true;
    }
    
    // 高威胁环境：只拾取关键道具
    if (globalThreatLevel > 0.7) {
      const shouldPursue = score > 1.0 && (pickup.type === 'health' || pickup.type === 'heart' || pickup.type === 'shield');
      if (shouldPursue) {
        console.log(`⚡ 高威胁拾取：威胁${globalThreatLevel.toFixed(2)}，评分${score.toFixed(2)}`);
      }
      return shouldPursue;
    }
    
    // 中等威胁环境：平衡策略，更积极
    if (globalThreatLevel > 0.4) {
      const shouldPursue = score > 0.6; // 降低阈值
      if (shouldPursue) {
        console.log(`🎯 中威胁拾取：威胁${globalThreatLevel.toFixed(2)}，评分${score.toFixed(2)}`);
      }
      return shouldPursue;
    }
    
    // 低威胁环境：积极拾取，进一步降低阈值
    if (globalThreatLevel < 0.3) {
      const shouldPursue = score > 0.3; // 更积极
      if (shouldPursue) {
        console.log(`🌟 低威胁拾取：威胁${globalThreatLevel.toFixed(2)}，评分${score.toFixed(2)}`);
      }
      return shouldPursue;
    }
    
    // 默认策略：中等积极性
    const shouldPursue = score > 0.5; // 降低默认阈值
    if (shouldPursue) {
      console.log(`📦 默认拾取：威胁${globalThreatLevel.toFixed(2)}，评分${score.toFixed(2)}`);
    }
    return shouldPursue;
  }

  // 计算全局威胁级别
  private calculateGlobalThreatLevel(gameState: GameState): number {
    const player = gameState.player;
    let totalThreat = 0;
    let threatCount = 0;
    
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      const threatRadius = 200; // 威胁影响半径
      
      if (distance < threatRadius) {
        const threatIntensity = 1 - (distance / threatRadius);
        totalThreat += threatIntensity;
        threatCount++;
      }
    }
    
    return threatCount > 0 ? totalThreat / threatCount : 0;
  }

  // 计算威胁密度
  private calculateThreatDensity(gameState: GameState): number {
    const totalArea = gameState.width * gameState.height;
    const hazardArea = gameState.hazards.reduce((sum, h) => sum + Math.PI * h.r * h.r, 0);
    return hazardArea / totalArea;
  }

  // 计算预计到达时间
  private calculateEstimatedReachTime(gameState: GameState, pickup: any): number {
    if (!pickup) return 0;
    
    const player = gameState.player;
    const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    const playerSpeed = player.speed || 1;
    
    return distance / (playerSpeed * 60); // 转换为秒
  }

  // 计算道具拾取紧急程度
  private calculatePickupUrgency(pickup: any, currentHealth: number, score: number, globalThreatLevel: number): number {
    if (!pickup) return 0;
    
    let urgency = 0;
    
    // 根据血量计算紧急程度
    if (pickup.type === 'health') {
      if (currentHealth <= 0.2) urgency = 1.0;      // 极度紧急
      else if (currentHealth <= 0.4) urgency = 0.8; // 很紧急
      else if (currentHealth <= 0.6) urgency = 0.5; // 一般紧急
      else urgency = 0.2;                           // 不太紧急
    } else {
      urgency = Math.min(0.7, score * 0.8);
    }
    
    // 威胁环境调整
    urgency *= (1 - globalThreatLevel * 0.3);
    
    return Math.max(0, Math.min(1, urgency));
  }

  // 分析威胁趋势
  private analyzeThreatTrend(gameState: GameState, pickup: any): number {
    // 简化实现：检查威胁是否朝向道具区域移动
    let trendScore = 0;
    let threatCount = 0;
    
    for (const hazard of gameState.hazards) {
      const hazardToPickup = Math.hypot(pickup.x - hazard.x, pickup.y - hazard.y);
      
      if (hazardToPickup < 300) { // 在道具影响范围内的威胁
        const dirToPickup = {
          x: (pickup.x - hazard.x) / hazardToPickup,
          y: (pickup.y - hazard.y) / hazardToPickup
        };
        
        const hazardDir = { x: hazard.dirX || 0, y: hazard.dirY || 0 };
        const alignment = dirToPickup.x * hazardDir.x + dirToPickup.y * hazardDir.y;
        
        trendScore += alignment;
        threatCount++;
      }
    }
    
    return threatCount > 0 ? -trendScore / threatCount : 0; // 负值表示威胁增加
  }

  // 计算从某位置的逃生路线数量
  private calculateEscapeRoutesFromPosition(gameState: GameState, position: any): number {
    const directions = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]
    ];
    
    let safeRoutes = 0;
    
    for (const [dx, dy] of directions) {
      const checkX = position.x + dx * 100;
      const checkY = position.y + dy * 100;
      
      // 边界检查
      if (checkX < 50 || checkX > gameState.width - 50 || 
          checkY < 50 || checkY > gameState.height - 50) {
        continue;
      }
      
      // 威胁检查
      let routeSafe = true;
      for (const hazard of gameState.hazards) {
        const distance = Math.hypot(checkX - hazard.x, checkY - hazard.y);
        if (distance < hazard.r + 80) {
          routeSafe = false;
          break;
        }
      }
      
      if (routeSafe) safeRoutes++;
    }
    
    return safeRoutes;
  }

  // 寻找附近的其他道具
  private findNearbyPickups(gameState: GameState, centerPickup: any, radius: number): any[] {
    return gameState.pickups.filter(pickup => {
      if (pickup === centerPickup) return false;
      const distance = Math.hypot(pickup.x - centerPickup.x, pickup.y - centerPickup.y);
      return distance <= radius;
    });
  }

  // 计算备选路径数量
  private calculateAlternativePathCount(gameState: GameState, pickup: any): number {
    const player = gameState.player;
    const directPath = { dx: pickup.x - player.x, dy: pickup.y - player.y };
    const distance = Math.hypot(directPath.dx, directPath.dy);
    
    if (distance === 0) return 0;
    
    // 检查左右偏移路径
    const normalX = directPath.dx / distance;
    const normalY = directPath.dy / distance;
    const perpX = -normalY;
    const perpY = normalX;
    
    let alternativePaths = 0;
    
    // 检查左偏移路径
    const leftPath = {
      x: player.x + perpX * 50,
      y: player.y + perpY * 50
    };
    if (this.isPathSafe(gameState, leftPath, pickup)) alternativePaths++;
    
    // 检查右偏移路径
    const rightPath = {
      x: player.x - perpX * 50,
      y: player.y - perpY * 50
    };
    if (this.isPathSafe(gameState, rightPath, pickup)) alternativePaths++;
    
    return alternativePaths;
  }

  // 检查路径是否安全
  private isPathSafe(gameState: GameState, start: any, end: any): boolean {
    const steps = 10;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const checkX = start.x + (end.x - start.x) * t;
      const checkY = start.y + (end.y - start.y) * t;
      
      // 边界检查
      if (checkX < 30 || checkX > gameState.width - 30 || 
          checkY < 30 || checkY > gameState.height - 30) {
        return false;
      }
      
      // 威胁检查
      for (const hazard of gameState.hazards) {
        const distance = Math.hypot(checkX - hazard.x, checkY - hazard.y);
        if (distance < hazard.r + gameState.player.r + 60) {
          return false;
        }
      }
    }
    
    return true;
  }

  // 评估拾取道具路径的安全性
  private evaluatePickupPathSafety(gameState: GameState, pickup: any): number {
    const player = gameState.player;
    const steps = 10; // 路径分析步数
    let safetyScore = 1.0;
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pathX = player.x + (pickup.x - player.x) * t;
      const pathY = player.y + (pickup.y - player.y) * t;
      
      // 检查路径上每个点的安全性
      for (const hazard of gameState.hazards) {
        const futureHazard = this.predictEnemyPositionPhysics(hazard, gameState, t * 0.5);
        const distance = Math.hypot(pathX - futureHazard.x, pathY - futureHazard.y);
        const safeDistance = hazard.r + player.r + 40;
        
        if (distance < safeDistance) {
          safetyScore *= Math.max(0.2, distance / safeDistance);
        }
      }
    }
    
    return safetyScore;
  }

  // 紧急威胁规避动作
  private getEmergencyAvoidanceAction(gameState: GameState, threatAnalysis: any): number {
    // 优先使用预计算的逃生方向
    if (threatAnalysis.escapeDirections.length > 0) {
      // 选择最远离威胁的方向
      let bestAction = threatAnalysis.escapeDirections[0];
      let maxDistance = 0;
      
      for (const actionId of threatAnalysis.escapeDirections) {
        const actionVectors = [
          [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
          [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707]
        ];
        
        const [dx, dy] = actionVectors[actionId];
        const futureX = gameState.player.x + dx * 120;
        const futureY = gameState.player.y + dy * 120;
        
        let minThreatDist = Infinity;
        for (const hazard of gameState.hazards) {
          const dist = Math.hypot(futureX - hazard.x, futureY - hazard.y);
          minThreatDist = Math.min(minThreatDist, dist);
        }
        
        if (minThreatDist > maxDistance) {
          maxDistance = minThreatDist;
          bestAction = actionId;
        }
      }
      
      return bestAction;
    }
    
    // 备用方案：选择远离最近威胁的方向
    if (threatAnalysis.nearestThreat) {
      const threat = threatAnalysis.nearestThreat;
      const player = gameState.player;
      const awayX = player.x - threat.x;
      const awayY = player.y - threat.y;
      const distance = Math.hypot(awayX, awayY);
      
      if (distance > 0) {
        const normalizedX = awayX / distance;
        const normalizedY = awayY / distance;
        
        // 选择最接近逃离方向的动作
        return this.getActionForDirection(normalizedX, normalizedY);
      }
    }
    
    return 1; // 默认向左移动
  }

  // 增强智能道具拾取动作
  private getSmartPickupAction(gameState: GameState, pickupAnalysis: any, threatAnalysis: any): number {
    if (!pickupAnalysis.bestPickup) return 0;
    
    const player = gameState.player;
    const pickup = pickupAnalysis.bestPickup;
    const strategy = pickupAnalysis.strategyType;
    
    // 计算基础朝向道具的方向
    const toPickupX = pickup.x - player.x;
    const toPickupY = pickup.y - player.y;
    const distance = Math.hypot(toPickupX, toPickupY);
    
    if (distance < 25) return 0; // 已经很近了，停止移动
    
    const normalizedX = toPickupX / distance;
    const normalizedY = toPickupY / distance;
    
    // 根据策略类型选择不同的拾取方法
    switch (strategy) {
      case 'emergency_health':
        return this.getEmergencyPickupAction(gameState, pickup, normalizedX, normalizedY);
        
      case 'safe_opportunity':
        return this.getSafePickupAction(gameState, pickup, normalizedX, normalizedY);
        
      case 'risky_dash':
        return this.getRiskyDashAction(gameState, pickup, normalizedX, normalizedY, threatAnalysis);
        
      case 'defensive_preparation':
        return this.getDefensivePickupAction(gameState, pickup, normalizedX, normalizedY);
        
      default:
        return this.getCalculatedRiskAction(gameState, pickup, normalizedX, normalizedY, threatAnalysis);
    }
  }

  // 紧急血包拾取
  private getEmergencyPickupAction(gameState: GameState, pickup: any, dirX: number, dirY: number): number {
    // 紧急情况下，直接冲向血包，只避开最近的致命威胁
    const player = gameState.player;
    let adjustedDirX = dirX;
    let adjustedDirY = dirY;
    
    // 检查直线路径上的致命威胁
    for (const hazard of gameState.hazards) {
      const hazardDistance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      
      if (hazardDistance < 120) { // 非常近的威胁
        // 计算微调方向以避开威胁
        const avoidX = player.x - hazard.x;
        const avoidY = player.y - hazard.y;
        const avoidDist = Math.hypot(avoidX, avoidY);
        
        if (avoidDist > 0) {
          const avoidNormX = avoidX / avoidDist;
          const avoidNormY = avoidY / avoidDist;
          
          // 混合原方向和避开方向
          adjustedDirX = dirX * 0.7 + avoidNormX * 0.3;
          adjustedDirY = dirY * 0.7 + avoidNormY * 0.3;
        }
      }
    }
    
    return this.getActionForDirection(adjustedDirX, adjustedDirY);
  }

  // 安全机会拾取
  private getSafePickupAction(gameState: GameState, pickup: any, dirX: number, dirY: number): number {
    // 在安全环境下，可以选择更优的路径
    const alternativePaths = this.findAlternativePickupPaths(gameState, pickup);
    
    if (alternativePaths.length > 0) {
      // 选择最安全的路径
      const bestPath = alternativePaths.reduce((best, path) => 
        path.safety > best.safety ? path : best
      );
      
      return this.getActionForDirection(bestPath.dirX, bestPath.dirY);
    }
    
    // 没有更好的路径，直接前往
    return this.getActionForDirection(dirX, dirY);
  }

  // 冒险冲刺拾取
  private getRiskyDashAction(gameState: GameState, pickup: any, dirX: number, dirY: number, threatAnalysis: any): number {
    // 在威胁环境中，需要智能地穿越危险区域
    const player = gameState.player;
    
    // 寻找威胁间隙
    const safeCorridor = this.findSafeCorridor(gameState, player, pickup);
    
    if (safeCorridor) {
      return this.getActionForDirection(safeCorridor.dirX, safeCorridor.dirY);
    }
    
    // 没有安全通道，选择风险最小的直线路径
    const threats = threatAnalysis.criticalThreats || [];
    let bestDirX = dirX;
    let bestDirY = dirY;
    let minRisk = Infinity;
    
    // 尝试多个轻微偏移的方向
    for (let angle = -Math.PI/4; angle <= Math.PI/4; angle += Math.PI/8) {
      const testDirX = dirX * Math.cos(angle) - dirY * Math.sin(angle);
      const testDirY = dirX * Math.sin(angle) + dirY * Math.cos(angle);
      
      const risk = this.calculatePathRisk(gameState, player, testDirX, testDirY, 100);
      
      if (risk < minRisk) {
        minRisk = risk;
        bestDirX = testDirX;
        bestDirY = testDirY;
      }
    }
    
    return this.getActionForDirection(bestDirX, bestDirY);
  }

  // 防御性拾取
  private getDefensivePickupAction(gameState: GameState, pickup: any, dirX: number, dirY: number): number {
    // 谨慎接近，确保随时可以撤退
    const player = gameState.player;
    
    // 检查退路
    const retreatRoutes = this.calculateEscapeRoutesFromPosition(gameState, pickup);
    
    if (retreatRoutes < 2) {
      // 退路不足，先移动到更安全的位置再拾取
      const saferPosition = this.findSaferApproachPosition(gameState, pickup);
      
      if (saferPosition) {
        const toSaferX = saferPosition.x - player.x;
        const toSaferY = saferPosition.y - player.y;
        const saferDist = Math.hypot(toSaferX, toSaferY);
        
        if (saferDist > 0) {
          return this.getActionForDirection(toSaferX / saferDist, toSaferY / saferDist);
        }
      }
    }
    
    // 退路充足，谨慎前进
    return this.getActionForDirection(dirX * 0.8, dirY * 0.8);
  }

  // 计算风险拾取
  private getCalculatedRiskAction(gameState: GameState, pickup: any, dirX: number, dirY: number, threatAnalysis: any): number {
    // 平衡风险和收益的拾取策略
    const pathRisk = this.calculatePathRisk(gameState, gameState.player, dirX, dirY, 80);
    
    if (pathRisk > 0.7) {
      // 风险太高，寻找绕行路径
      const detourPath = this.findDetourPath(gameState, pickup);
      
      if (detourPath) {
        return this.getActionForDirection(detourPath.dirX, detourPath.dirY);
      }
      
      // 没有绕行路径，等待更好的时机
      return 0; // 暂停移动
    }
    
    // 风险可接受，直接前往
    return this.getActionForDirection(dirX, dirY);
  }

  // 寻找替代拾取路径
  private findAlternativePickupPaths(gameState: GameState, pickup: any): Array<{dirX: number, dirY: number, safety: number}> {
    const player = gameState.player;
    const paths: Array<{dirX: number, dirY: number, safety: number}> = [];
    
    // 尝试不同的接近角度
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const approachX = pickup.x + Math.cos(angle) * 60;
      const approachY = pickup.y + Math.sin(angle) * 60;
      
      // 检查这个接近点是否在边界内
      if (approachX < 50 || approachX > gameState.width - 50 || 
          approachY < 50 || approachY > gameState.height - 50) {
        continue;
      }
      
      const dirX = approachX - player.x;
      const dirY = approachY - player.y;
      const distance = Math.hypot(dirX, dirY);
      
      if (distance > 0) {
        const normalizedDirX = dirX / distance;
        const normalizedDirY = dirY / distance;
        const safety = 1 - this.calculatePathRisk(gameState, player, normalizedDirX, normalizedDirY, distance);
        
        paths.push({
          dirX: normalizedDirX,
          dirY: normalizedDirY,
          safety
        });
      }
    }
    
    return paths.sort((a, b) => b.safety - a.safety);
  }

  // 寻找安全通道
  private findSafeCorridor(gameState: GameState, start: any, end: any): {dirX: number, dirY: number} | null {
    const corridorWidth = 80; // 通道最小宽度
    
    // 简化实现：检查是否存在足够宽的通道
    const directX = end.x - start.x;
    const directY = end.y - start.y;
    const directDist = Math.hypot(directX, directY);
    
    if (directDist === 0) return null;
    
    const normalizedX = directX / directDist;
    const normalizedY = directY / directDist;
    
    // 检查垂直方向的通道宽度
    const perpX = -normalizedY;
    const perpY = normalizedX;
    
    let hasWideCorridor = true;
    const checkPoints = 5;
    
    for (let i = 1; i < checkPoints; i++) {
      const checkRatio = i / checkPoints;
      const checkX = start.x + directX * checkRatio;
      const checkY = start.y + directY * checkRatio;
      
      // 检查这个点左右两侧的空间
      let leftClear = true;
      let rightClear = true;
      
      for (const hazard of gameState.hazards) {
        const leftX = checkX + perpX * corridorWidth / 2;
        const leftY = checkY + perpY * corridorWidth / 2;
        const rightX = checkX - perpX * corridorWidth / 2;
        const rightY = checkY - perpY * corridorWidth / 2;
        
        const leftDist = Math.hypot(leftX - hazard.x, leftY - hazard.y);
        const rightDist = Math.hypot(rightX - hazard.x, rightY - hazard.y);
        
        if (leftDist < hazard.r + 30) leftClear = false;
        if (rightDist < hazard.r + 30) rightClear = false;
      }
      
      if (!leftClear || !rightClear) {
        hasWideCorridor = false;
        break;
      }
    }
    
    return hasWideCorridor ? { dirX: normalizedX, dirY: normalizedY } : null;
  }

  // 计算路径风险
  private calculatePathRisk(gameState: GameState, start: any, dirX: number, dirY: number, distance: number): number {
    let totalRisk = 0;
    const steps = 10;
    
    for (let i = 1; i <= steps; i++) {
      const stepDist = (distance * i) / steps;
      const checkX = start.x + dirX * stepDist;
      const checkY = start.y + dirY * stepDist;
      
      let stepRisk = 0;
      
      for (const hazard of gameState.hazards) {
        const hazardDist = Math.hypot(checkX - hazard.x, checkY - hazard.y);
        const riskRadius = hazard.r + 100; // 风险评估半径
        
        if (hazardDist < riskRadius) {
          stepRisk = Math.max(stepRisk, 1 - (hazardDist / riskRadius));
        }
      }
      
      totalRisk += stepRisk;
    }
    
    return totalRisk / steps;
  }

  // 寻找更安全的接近位置
  private findSaferApproachPosition(gameState: GameState, pickup: any): {x: number, y: number} | null {
    const candidates: Array<{x: number, y: number, safety: number}> = [];
    
    // 生成候选位置
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      const x = pickup.x + Math.cos(angle) * 120;
      const y = pickup.y + Math.sin(angle) * 120;
      
      // 边界检查
      if (x < 60 || x > gameState.width - 60 || y < 60 || y > gameState.height - 60) {
        continue;
      }
      
      // 计算安全性
      let safety = 1.0;
      for (const hazard of gameState.hazards) {
        const distance = Math.hypot(x - hazard.x, y - hazard.y);
        const safeDistance = hazard.r + 80;
        
        if (distance < safeDistance) {
          safety *= distance / safeDistance;
        }
      }
      
      candidates.push({ x, y, safety });
    }
    
    if (candidates.length === 0) return null;
    
    // 选择最安全的位置
    const bestCandidate = candidates.reduce((best, candidate) =>
      candidate.safety > best.safety ? candidate : best
    );
    
    return bestCandidate.safety > 0.6 ? bestCandidate : null;
  }

  // 寻找绕行路径
  private findDetourPath(gameState: GameState, pickup: any): {dirX: number, dirY: number} | null {
    const player = gameState.player;
    
    // 尝试绕行路径
    const detourAngles = [Math.PI/3, -Math.PI/3, Math.PI/2, -Math.PI/2];
    
    for (const angle of detourAngles) {
      const rotatedX = Math.cos(angle);
      const rotatedY = Math.sin(angle);
      
      const detourX = player.x + rotatedX * 100;
      const detourY = player.y + rotatedY * 100;
      
      // 检查绕行点是否安全
      if (this.isPositionSafe(gameState, detourX, detourY)) {
        const dirX = detourX - player.x;
        const dirY = detourY - player.y;
        const distance = Math.hypot(dirX, dirY);
        
        if (distance > 0) {
          return {
            dirX: dirX / distance,
            dirY: dirY / distance
          };
        }
      }
    }
    
    return null;
  }

  // 检查位置是否安全
  private isPositionSafe(gameState: GameState, x: number, y: number): boolean {
    // 边界检查
    if (x < 50 || x > gameState.width - 50 || y < 50 || y > gameState.height - 50) {
      return false;
    }
    
    // 威胁检查
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(x - hazard.x, y - hazard.y);
      if (distance < hazard.r + gameState.player.r + 70) {
        return false;
      }
    }
    
    return true;
  }

  // 预测性威胁规避动作
  private getPredictiveAvoidanceAction(gameState: GameState, threatAnalysis: any): number {
    // 基于预测的威胁位置选择规避动作
    const player = gameState.player;
    let safestDirection = { x: 0, y: 0 };
    let maxSafety = 0;
    
    // 评估8个方向的安全性
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707]
    ];
    
    for (let i = 0; i < directions.length; i++) {
      const [dx, dy] = directions[i];
      const futureX = player.x + dx * 100;
      const futureY = player.y + dy * 100;
      
      // 检查边界
      if (futureX < 80 || futureX > gameState.width - 80 || 
          futureY < 80 || futureY > gameState.height - 80) {
        continue;
      }
      
      let safety = 1.0;
      
      // 评估与所有预测敌人位置的安全性
      for (const hazard of gameState.hazards) {
        const predictedPos = this.predictEnemyPositionPhysics(hazard, gameState, 0.7);
        const distance = Math.hypot(futureX - predictedPos.x, futureY - predictedPos.y);
        const safeDistance = hazard.r + player.r + 70;
        
        if (distance < safeDistance) {
          safety *= Math.max(0.1, distance / safeDistance);
        }
      }
      
      if (safety > maxSafety) {
        maxSafety = safety;
        safestDirection = { x: dx, y: dy };
      }
    }
    
    return this.getActionForDirection(safestDirection.x, safestDirection.y);
  }

  // 智能中心定位动作
  private getIntelligentCenterAction(gameState: GameState, policy: number[], threatAnalysis: any): number {
    const player = gameState.player;
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const distanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);
    const maxDistance = Math.hypot(gameState.width / 2, gameState.height / 2);
    const distanceRatio = distanceToCenter / maxDistance;
    
    // 如果距离中心很远，强制回中心
    if (distanceRatio > 0.6) {
      const toCenterX = centerX - player.x;
      const toCenterY = centerY - player.y;
      const distance = Math.hypot(toCenterX, toCenterY);
      
      if (distance > 0) {
        return this.getActionForDirection(toCenterX / distance, toCenterY / distance);
      }
    }
    
    // 否则使用神经网络的策略，但偏向于移动动作
    const sortedActions = policy
      .map((prob, idx) => ({ idx, prob }))
      .sort((a, b) => b.prob - a.prob);
    
    // 优先选择移动动作
    for (const action of sortedActions) {
      if (action.idx !== 0) { // 不是静止动作
        return action.idx;
      }
    }
    
    return sortedActions[0].idx; // 备用方案
  }

  // 根据方向向量获取对应的动作ID
  private getActionForDirection(dx: number, dy: number): number {
    // 将方向向量映射到最接近的8个方向之一
    const angle = Math.atan2(dy, dx);
    const angleStep = Math.PI / 4; // 45度步长
    const actionIndex = Math.round(angle / angleStep);
    
    // 映射到动作ID
    const actionMap = [2, 6, 3, 5, 1, 7, 4, 8]; // 右，右上，上，左上，左，左下，下，右下
    return actionMap[(actionIndex + 8) % 8] || 1;
  }

  // 高级安全检查
  private applyAdvancedSafetyChecks(gameState: GameState, action: number, threatAnalysis: any): number {
    const player = gameState.player;
    
    // 检查动作是否会导致撞墙
    const actionVectors = [
      [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
      [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707]
    ];
    
    const [dx, dy] = actionVectors[action];
    const futureX = player.x + dx * 80;
    const futureY = player.y + dy * 80;
    
    // 边界检查
    if (futureX < 40 || futureX > gameState.width - 40 || 
        futureY < 40 || futureY > gameState.height - 40) {
      // 选择远离边界的动作
      return this.getBestCenterAction(gameState);
    }
    
    // 检查是否会与敌人碰撞
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(futureX - hazard.x, futureY - hazard.y);
      if (distance < hazard.r + player.r + 30) {
        // 如果原动作危险，使用紧急规避
        if (threatAnalysis.escapeDirections.length > 0) {
          return threatAnalysis.escapeDirections[0];
        }
      }
    }
    
    return action;
  }

  // 更新中心追踪统计
  private updateCenterTracking(gameState: GameState, action: number): void {
    const player = gameState.player;
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const distanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);
    const maxDistance = Math.hypot(gameState.width / 2, gameState.height / 2);
    const distanceRatio = distanceToCenter / maxDistance;
    
    // 更新统计
    this.centerTracker.lastCenterDistance = distanceRatio;
    
    if (distanceRatio > 0.5) {
      this.centerTracker.timeAwayFromCenter++;
    } else {
      this.centerTracker.totalCenterTime++;
    }
    
    // 检查是否执行了强制回中心动作
    const currentTime = Date.now();
    if (currentTime - this.centerTracker.lastForceTime < 1000) { // 1秒内
      // 检查动作是否朝向中心
      const actionMap = [
        [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
        [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707]
      ];
      
      const [mvx, mvy] = actionMap[action];
      const toCenterX = centerX - player.x;
      const toCenterY = centerY - player.y;
      const normalizedToCenter = [toCenterX, toCenterY];
      const length = Math.hypot(toCenterX, toCenterY);
      if (length > 0) {
        normalizedToCenter[0] /= length;
        normalizedToCenter[1] /= length;
      }
      
      const dotProduct = mvx * normalizedToCenter[0] + mvy * normalizedToCenter[1];
      if (dotProduct > 0.3) { // 大致朝向中心
        this.centerTracker.forceBackToCenterCount++;
      }
    }
    
    // 每100步打印一次统计
    if ((this.centerTracker.timeAwayFromCenter + this.centerTracker.totalCenterTime) % 100 === 0) {
      const totalTime = this.centerTracker.timeAwayFromCenter + this.centerTracker.totalCenterTime;
      const centerPercentage = (this.centerTracker.totalCenterTime / totalTime * 100).toFixed(1);
      console.log(`📊 中心统计: ${centerPercentage}%时间在中心, 强制回中心${this.centerTracker.forceBackToCenterCount}次`);
    }
  }

  // 平衡速度计算 - 降低速度但提升躲避精度
  private calculateUltraFastSpeed(gameState: GameState, features: number[], action: number, isLowHealth: boolean, isCriticalHealth: boolean): number {
    // 适中的基础速度 - 平衡速度和控制精度
    let baseSpeed = isCriticalHealth ? 3.2 : (isLowHealth ? 2.6 : 2.0); // 降低基础速度以提升精度
    
    // 威胁检测和加速
    let maxThreatLevel = 0;
    let nearbyThreats = 0;
    let trackerThreats = 0;
    let immediateDanger = false;
    
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(hazard.x - gameState.player.x, hazard.y - gameState.player.y);
      
      // 立即危险检测
      if (distance < hazard.r + gameState.player.r + 40) {
        immediateDanger = true;
      }
      
      if (distance < 250) { // 威胁感知范围
        const threatLevel = Math.exp(-distance / 70); // 调整威胁计算敏感度
        maxThreatLevel = Math.max(maxThreatLevel, threatLevel);
        
        if (distance < 120) {
          nearbyThreats++;
        }
        
        // 特别处理追踪敌人
        if (hazard.kind === 'tracker' && distance < 200) {
          trackerThreats++;
        }
      }
    }
    
    // 威胁加速 - 更精确的加速
    if (immediateDanger) {
      baseSpeed += 2.0; // 立即危险时急速
    }
    baseSpeed += maxThreatLevel * 1.8; // 适度威胁加速
    baseSpeed += nearbyThreats * 0.6; // 适度近距离威胁加速
    baseSpeed += trackerThreats * 1.5; // 适度追踪敌人加速
    
    // 边界紧急脱离加速
    const player = gameState.player;
    const boundaryDistance = Math.min(
      player.x,
      gameState.width - player.x,
      player.y,
      gameState.height - player.y
    );
    
    if (boundaryDistance < 100) {
      const boundaryUrgency = (100 - boundaryDistance) / 100;
      baseSpeed += boundaryUrgency * 1.5; // 适度边界脱离加速
    }
    
    // 道具拾取时适度提速
    if (isLowHealth && gameState.pickups.length > 0) {
      const nearestPickup = this.findNearestSafePickup(gameState);
      if (nearestPickup) {
        baseSpeed += isCriticalHealth ? 0.8 : 0.5; // 适度道具拾取加速
      }
    }
    
    // 移动动作奖励
    if (action !== 0) {
      baseSpeed += 0.3; // 小幅移动奖励
    }
    
    // 静止时的处理 - 更智能的静止判断
    if (action === 0) {
      if (this.isSafeToStay(gameState)) {
        baseSpeed = 0; // 安全时允许静止
      } else {
        baseSpeed = Math.max(1.8, baseSpeed); // 不安全时强制移动
      }
    }
    
    // 设置合理的速度范围 - 降低最大速度以提升控制精度
    return Math.max(1.0, Math.min(5.0, baseSpeed)); // 最大速度降低到5.0以提升精度
  }

  // 寻找最近的安全道具
  private findNearestSafePickup(gameState: GameState): any | null {
    const player = gameState.player;
    let nearestPickup = null;
    let minDistance = Infinity;
    
    for (const pickup of gameState.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      
      // 检查道具是否安全
      const safety = this.calculatePickupSafety(gameState, pickup);
      
      if (safety > 0.4 && distance < minDistance) {
        minDistance = distance;
        nearestPickup = pickup;
      }
    }
    
    return nearestPickup;
  }

  // 判断是否安全静止
  private isSafeToStay(gameState: GameState): boolean {
    const player = gameState.player;
    
    // 检查最近威胁距离
    let nearestThreat = Infinity;
    for (const hazard of gameState.hazards) {
      const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      nearestThreat = Math.min(nearestThreat, distance);
    }
    
    // 检查边界距离
    const boundaryDistance = Math.min(
      player.x,
      gameState.width - player.x,
      player.y,
      gameState.height - player.y
    );
    
    // 检查健康状态
    const currentHealth = gameState.lives / gameState.maxLives;
    const isLowHealth = currentHealth <= 0.6;
    
    // 只有在威胁远、边界远、血量充足时才安全
    return nearestThreat > 180 && boundaryDistance > 120 && !isLowHealth;
  }

  // 智能躲避与道具拾取启发式偏差系统
  private getUltraResponseBias(gameState: GameState, isLowHealth: boolean, isCriticalHealth: boolean): number[] {
    const player = gameState.player;
    const hazards = gameState.hazards;
    const pickups = gameState.pickups;
    const width = gameState.width;
    const height = gameState.height;

    // 动作向量定义
    const actionVecs: [number, number][] = [
      [0, 0],           // 0: 停止
      [-1, 0], [1, 0],  // 1-2: 左右
      [0, -1], [0, 1],  // 3-4: 上下
      [-0.707, -0.707], [0.707, -0.707],  // 5-6: 对角
      [-0.707, 0.707], [0.707, 0.707]     // 7-8: 对角
    ];

    const hBias = new Array(9).fill(0);
    
    // 1. 智能威胁规避分析
    const avoidanceAnalysis = this.calculateSmartAvoidance(gameState);
    
    // 2. 主动道具拾取分析
    const pickupAnalysis = this.calculatePickupStrategy(gameState, isLowHealth, isCriticalHealth);
    
    // 3. 边界安全分析 - 增强中心倾向性
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 计算到中心的距离和方向
    const distanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);
    const maxDistanceToCenter = Math.hypot(width / 2, height / 2);
    const centerBias = Math.min(1.0, distanceToCenter / (maxDistanceToCenter * 0.6)); // 距离中心60%范围外开始增强
    
    const toCenterX = (centerX - player.x) / Math.max(1, Math.abs(centerX - player.x));
    const toCenterY = (centerY - player.y) / Math.max(1, Math.abs(centerY - player.y));
    
    const edgeDistance = Math.min(
      player.x, width - player.x,
      player.y, height - player.y
    );
    
    // 强化边界压力计算
    const boundaryPressure = this.calculateBoundaryPressureEnhanced(gameState, centerBias);

    // 4. 为每个动作计算综合偏差 - 整合边界智能规避
    for (let a = 0; a < 9; a++) {
      let bonus = 0;
      
      // 智能威胁规避奖励 - 使用预测性躲避
      bonus += this.calculateAvoidanceScore(actionVecs[a], avoidanceAnalysis) * 5.0;
      
      // 智能边界规避与强化中心倾向 - 抑制不必要的边界接近
      const isTowardBoundary = !this.isForceTowardBoundary(gameState, actionVecs[a]);
      if (!isTowardBoundary) {
        // 检查是否指向边界
        const player = gameState.player;
        const futureX = player.x + actionVecs[a][0] * 80;
        const futureY = player.y + actionVecs[a][1] * 80;
        
        if (futureX < 150 || futureX > width - 150 || 
            futureY < 150 || futureY > height - 150) {
          bonus -= 5.0; // 强烈惩罚不必要的边界接近
        }
      }
      
      // 强化中心引力系统 - 主动吸引AI回到中心
      if (boundaryPressure.centerAttraction.strength > 0.1) {
        const centerAlignment = actionVecs[a][0] * boundaryPressure.centerAttraction.x + 
                               actionVecs[a][1] * boundaryPressure.centerAttraction.y;
        if (centerAlignment > 0) {
          const centerBonus = centerAlignment * boundaryPressure.centerAttraction.strength * 4.0;
          bonus += centerBonus;
        }
      }
      
      // 边界压力响应 - 当被迫接近边界时的安全移动
      if (boundaryPressure.intensity > 0.2) {
        const boundaryAlignment = actionVecs[a][0] * boundaryPressure.x + 
                                 actionVecs[a][1] * boundaryPressure.y;
        bonus += boundaryAlignment * boundaryPressure.intensity * 3.5;
      }
      
      // 距离中心的额外奖励 - 鼓励保持在中心区域
      const player = gameState.player;
      const centerX = width / 2;
      const centerY = height / 2;
      const currentDistanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);
      const futureX = player.x + actionVecs[a][0] * 60;
      const futureY = player.y + actionVecs[a][1] * 60;
      const futureDistanceToCenter = Math.hypot(futureX - centerX, futureY - centerY);
      
      if (futureDistanceToCenter < currentDistanceToCenter) {
        // 向中心移动的动作获得奖励
        const centerImprovement = (currentDistanceToCenter - futureDistanceToCenter) / Math.max(1, currentDistanceToCenter);
        bonus += centerImprovement * 2.0;
      }
      
      // 主动道具拾取奖励 - 失血状态下大幅增强
      if (pickupAnalysis.shouldSeek) {
        const pickupAlignment = actionVecs[a][0] * pickupAnalysis.directionX + actionVecs[a][1] * pickupAnalysis.directionY;
        let pickupBonus = pickupAlignment * pickupAnalysis.urgency * 3.5; // 提升基础奖励
        
        // 失血状态下额外增强道具拾取奖励
        if (isCriticalHealth) {
          pickupBonus *= 2.0; // 危急状态下双倍奖励
        } else if (isLowHealth) {
          pickupBonus *= 1.5; // 低血量状态下额外奖励
        }
        
        bonus += pickupBonus;
      }
      
      // 移动连贯性奖励
      if (a !== 0) {
        bonus += 1.5; // 鼓励持续移动
      }
      
      // 智能静止惩罚
      if (a === 0) {
        if (this.isSafeToStay(gameState)) {
          bonus += 0; // 安全时不惩罚静止
        } else {
          bonus -= 6.0; // 不安全时强烈惩罚静止
        }
      }
      
      hBias[a] = bonus;
    }

    return hBias;
  }

  // 计算智能威胁规避策略 - 考虑敌人大小和边界安全
  private calculateSmartAvoidance(gameState: GameState): {
    mainThreatX: number;
    mainThreatY: number;
    escapeRoutes: { direction: [number, number]; safety: number }[];
    urgency: number;
    boundaryPressure: { x: number; y: number; intensity: number };
  } {
    const player = gameState.player;
    const hazards = gameState.hazards;
    const width = gameState.width;
    const height = gameState.height;
    
    let mainThreatX = 0;
    let mainThreatY = 0;
    let maxUrgency = 0;
    let totalWeight = 0;
    
    // 分析主要威胁方向 - 考虑敌人大小
    for (const hazard of hazards) {
      const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      if (distance > 0 && distance < 300) {
        // 考虑敌人的移动预测和大小
        const futureX = hazard.x + hazard.dirX * hazard.baseSpeed * 3;
        const futureY = hazard.y + hazard.dirY * hazard.baseSpeed * 3;
        const futureDistance = Math.hypot(futureX - player.x, futureY - player.y);
        
        // 基于敌人大小调整威胁感知距离
        const effectiveRadius = hazard.r + player.r + 40; // 安全边距
        const threatDistance = Math.min(distance, futureDistance);
        
        let weight = Math.exp(-threatDistance / (60 + hazard.r * 0.5)); // 大敌人影响范围更广
        
        // 根据敌人大小调整威胁权重
        const sizeMultiplier = 1 + (hazard.r - 15) / 30; // 假设标准敌人半径15
        weight *= Math.max(0.5, sizeMultiplier);
        
        // 追踪敌人特殊处理
        if (hazard.kind === 'tracker') {
          weight *= 2.5;
        }
        
        // 快速敌人增加威胁
        if (hazard.baseSpeed > 2.0) {
          weight *= 1.5;
        }
        
        const dirX = (hazard.x - player.x) / distance;
        const dirY = (hazard.y - player.y) / distance;
        
        mainThreatX += dirX * weight;
        mainThreatY += dirY * weight;
        totalWeight += weight;
        
        // 基于距离和敌人大小计算紧急程度
        const minSafeDistance = effectiveRadius + 20;
        const urgency = Math.max(0, (minSafeDistance - threatDistance) / minSafeDistance);
        maxUrgency = Math.max(maxUrgency, urgency);
      }
    }
    
    if (totalWeight > 0) {
      mainThreatX /= totalWeight;
      mainThreatY /= totalWeight;
    }
    
    // 计算边界压力
    const boundaryPressure = this.calculateBoundaryPressureEnhanced(gameState, 1.0);
    
    // 计算逃脱路线 - 考虑边界限制
    const escapeRoutes = this.calculateEscapeRoutes(gameState, mainThreatX, mainThreatY, boundaryPressure);
    
    return {
      mainThreatX,
      mainThreatY,
      escapeRoutes,
      urgency: maxUrgency,
      boundaryPressure
    };
  }

  // 计算主动道具拾取策略 - 失血状态下增强拾取意愿，特别强化绿色道具
  private calculatePickupStrategy(gameState: GameState, isLowHealth: boolean, isCriticalHealth: boolean): {
    shouldSeek: boolean;
    directionX: number;
    directionY: number;
    urgency: number;
  } {
    const player = gameState.player;
    const pickups = gameState.pickups;
    
    // 默认不寻找道具
    let result = {
      shouldSeek: false,
      directionX: 0,
      directionY: 0,
      urgency: 0
    };
    
    // 失血状态下或有高价值道具时大幅增强道具寻找意愿
    if (pickups.length === 0) {
      return result;
    }
    
    let bestPickup = null;
    let bestScore = -1;
    
    for (const pickup of pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      const safety = this.calculatePickupSafetyEnhanced(gameState, pickup);
      const urgency = (pickup.maxLife - pickup.life) / pickup.maxLife;
      
      // 计算道具价值分数 - 大幅强化绿色道具（heart类型）的拾取策略
      let score = safety / (1 + distance / 180) + urgency * 1.5; // 基础分数提升
      
      // 绿色道具（血量道具）的超强化策略
      if (pickup.type === 'heart') {
        if (isCriticalHealth) {
          score *= 8.0; // 危急时绿色道具超高价值
        } else if (isLowHealth) {
          score *= 6.0; // 低血量时绿色道具极高价值
        } else {
          score *= 3.0; // 即使满血也要积极收集绿色道具
        }
        
        // 绿色道具距离奖励 - 越近价值越高
        const distanceBonus = Math.max(0, (200 - distance) / 200); 
        score += distanceBonus * 2.0;
        
        // 绿色道具紧急度特殊处理
        if (urgency > 0.7) { // 即将消失的绿色道具
          score *= 2.5; // 额外紧急加成
        }
      } else {
        // 其他道具在失血时也增加价值，但不如绿色道具
        if (isCriticalHealth) {
          score *= 3.0;
        } else if (isLowHealth) {
          score *= 2.5;
        } else {
          score *= 1.2; // 健康时也稍微提升其他道具价值
        }
      }
      
      // 失血状态下降低安全性要求，特别是对绿色道具
      let minSafetyThreshold;
      if (pickup.type === 'heart') {
        // 绿色道具安全要求更宽松
        minSafetyThreshold = isCriticalHealth ? 0.08 : (isLowHealth ? 0.15 : 0.25);
      } else {
        // 其他道具保持相对严格的安全要求
        minSafetyThreshold = isCriticalHealth ? 0.15 : (isLowHealth ? 0.25 : 0.35);
      }
      
      if (safety > minSafetyThreshold && score > bestScore) {
        bestScore = score;
        bestPickup = pickup;
      }
    }
    
    // 决定是否主动寻找道具 - 绿色道具降低寻找阈值
    if (bestPickup) {
      const distance = Math.hypot(bestPickup.x - player.x, bestPickup.y - player.y);
      
      // 绿色道具寻找阈值更低，更积极
      let seekThreshold;
      if (bestPickup.type === 'heart') {
        seekThreshold = isCriticalHealth ? 0.2 : (isLowHealth ? 0.3 : 0.5);
      } else {
        seekThreshold = isCriticalHealth ? 0.4 : (isLowHealth ? 0.6 : 1.0);
      }
      
      const shouldSeek = bestScore > seekThreshold;
      
      if (shouldSeek && distance > 0) {
        result.shouldSeek = true;
        result.directionX = (bestPickup.x - player.x) / distance;
        result.directionY = (bestPickup.y - player.y) / distance;
        result.urgency = Math.min(4.0, bestScore); // 提升最大紧急程度到4.0
      }
    }
    
    return result;
  }

  // 增强版道具安全性计算 - 特别优化绿色道具拾取时机
  private calculatePickupSafetyEnhanced(gameState: GameState, pickup: any): number {
    const player = gameState.player;
    const hazards = gameState.hazards;
    
    let safety = 1.0;
    
    // 绿色道具使用更宽松的安全评估
    const isHeartPickup = pickup.type === 'heart';
    const safetyMultiplier = isHeartPickup ? 0.75 : 1.0; // 绿色道具安全要求降低25%
    
    // 检查道具周围的敌人威胁 - 更精确的预测，绿色道具特殊处理
    for (const hazard of hazards) {
      const distance = Math.hypot(hazard.x - pickup.x, hazard.y - pickup.y);
      // 绿色道具威胁感知半径更小，允许更接近敌人
      const threatRadius = (hazard.r + (isHeartPickup ? 60 : 70)) * safetyMultiplier;
      
      if (distance < threatRadius) {
        // 预测敌人移动到道具附近的时间 - 使用训练模型中的预测方法
        const timeToReach = distance / Math.max(hazard.baseSpeed, 0.1);
        const playerTimeToReach = Math.hypot(player.x - pickup.x, player.y - pickup.y) / 3.0;
        
        // 绿色道具允许更激进的时机判断
        const timeThreshold = isHeartPickup ? 1.2 : 1.5;
        
        if (timeToReach < playerTimeToReach * timeThreshold) {
          // 敌人可能在玩家到达前到达道具附近
          const threat = 1 - (distance / threatRadius);
          // 绿色道具威胁惩罚减少
          const threatPenalty = isHeartPickup ? 0.7 : 0.9;
          safety *= (1 - threat * threatPenalty);
        }
      }
    }
    
    // 检查从玩家到道具的路径安全性 - 绿色道具路径要求更宽松
    const pathSteps = 8;
    const dx = (pickup.x - player.x) / pathSteps;
    const dy = (pickup.y - player.y) / pathSteps;
    
    for (let step = 1; step <= pathSteps; step++) {
      const checkX = player.x + dx * step;
      const checkY = player.y + dy * step;
      
      for (const hazard of hazards) {
        // 预测敌人在这个时间点的位置 - 与训练模型保持一致
        const futureHazardX = hazard.x + hazard.dirX * hazard.baseSpeed * step * 0.3;
        const futureHazardY = hazard.y + hazard.dirY * hazard.baseSpeed * step * 0.3;
        const distance = Math.hypot(futureHazardX - checkX, futureHazardY - checkY);
        
        // 绿色道具最小安全距离更小
        const baseSafeDistance = hazard.r + player.r + 40;
        const minSafeDistance = baseSafeDistance * (isHeartPickup ? 0.8 : 1.0);
        
        if (distance < minSafeDistance) {
          // 绿色道具路径威胁惩罚减少
          const pathThreatPenalty = isHeartPickup ? 0.6 : 0.4;
          safety *= pathThreatPenalty;
        } else if (distance < minSafeDistance * 1.8) {
          // 绿色道具路径风险惩罚减少
          const pathRiskPenalty = isHeartPickup ? 0.85 : 0.7;
          safety *= pathRiskPenalty;
        }
      }
    }
    
    // 绿色道具最低安全值提升，允许更激进的拾取
    const minSafety = isHeartPickup ? 0.08 : 0.05;
    return Math.max(minSafety, safety);
  }

  // 计算增强边界压力 - 强化中心倾向性
  private calculateBoundaryPressureEnhanced(gameState: GameState, centerBias: number): { 
    x: number; y: number; intensity: number; centerAttraction: { x: number; y: number; strength: number } 
  } {
    const player = gameState.player;
    const width = gameState.width;
    const height = gameState.height;
    
    // 定义多级安全边界距离
    const comfortZone = 200; // 舒适区距离
    const safeMargin = 150; // 安全边界距离
    
    // 计算到各边界的距离
    const leftDist = player.x;
    const rightDist = width - player.x;
    const topDist = player.y;
    const bottomDist = height - player.y;
    
    const minEdgeDistance = Math.min(leftDist, rightDist, topDist, bottomDist);
    
    let pressureX = 0;
    let pressureY = 0;
    let maxIntensity = 0;
    
    // 增强的边界压力计算
    if (leftDist < comfortZone) {
      const intensity = Math.pow((comfortZone - leftDist) / comfortZone, 1.5); // 非线性增长
      pressureX = intensity * (1 + centerBias * 0.5); // 中心偏向增强
      maxIntensity = Math.max(maxIntensity, intensity);
    } else if (rightDist < comfortZone) {
      const intensity = Math.pow((comfortZone - rightDist) / comfortZone, 1.5);
      pressureX = -intensity * (1 + centerBias * 0.5);
      maxIntensity = Math.max(maxIntensity, intensity);
    }
    
    if (topDist < comfortZone) {
      const intensity = Math.pow((comfortZone - topDist) / comfortZone, 1.5);
      pressureY = intensity * (1 + centerBias * 0.5);
      maxIntensity = Math.max(maxIntensity, intensity);
    } else if (bottomDist < comfortZone) {
      const intensity = Math.pow((comfortZone - bottomDist) / comfortZone, 1.5);
      pressureY = -intensity * (1 + centerBias * 0.5);
      maxIntensity = Math.max(maxIntensity, intensity);
    }
    
    // 计算中心引力
    const centerX = width / 2;
    const centerY = height / 2;
    const distanceToCenter = Math.hypot(player.x - centerX, player.y - centerY);
    const maxRadius = Math.min(width, height) * 0.3; // 中心区域半径
    
    let centerAttractionStrength = 0;
    let centerAttractionX = 0;
    let centerAttractionY = 0;
    
    if (distanceToCenter > maxRadius) {
      // 距离中心越远，引力越强
      centerAttractionStrength = Math.min(1.0, (distanceToCenter - maxRadius) / maxRadius);
      centerAttractionStrength = Math.pow(centerAttractionStrength, 1.2); // 非线性增强
      
      if (distanceToCenter > 0) {
        centerAttractionX = (centerX - player.x) / distanceToCenter;
        centerAttractionY = (centerY - player.y) / distanceToCenter;
      }
    }
    
    // 如果在边界区域，强制增强中心引力
    if (minEdgeDistance < safeMargin) {
      centerAttractionStrength = Math.max(centerAttractionStrength, 0.8);
      if (distanceToCenter > 0) {
        centerAttractionX = (centerX - player.x) / distanceToCenter;
        centerAttractionY = (centerY - player.y) / distanceToCenter;
      }
    }
    
    return {
      x: pressureX,
      y: pressureY,
      intensity: maxIntensity,
      centerAttraction: {
        x: centerAttractionX,
        y: centerAttractionY,
        strength: centerAttractionStrength
      }
    };
  }

  // 检查是否被迫到边界 - 防止边界附近反复移动
  private isForceTowardBoundary(gameState: GameState, direction: [number, number]): boolean {
    const player = gameState.player;
    const hazards = gameState.hazards;
    const width = gameState.width;
    const height = gameState.height;
    
    // 检查这个方向是否指向边界
    const futureX = player.x + direction[0] * 100;
    const futureY = player.y + direction[1] * 100;
    
    const isTowardBoundary = futureX < 100 || futureX > width - 100 || 
                            futureY < 100 || futureY > height - 100;
    
    if (!isTowardBoundary) return false; // 不指向边界，无需检查
    
    // 如果已经在边界附近，需要更严格的条件才能继续靠近边界
    const currentNearBoundary = player.x < 120 || player.x > width - 120 || 
                               player.y < 120 || player.y > height - 120;
    
    if (currentNearBoundary) {
      // 在边界附近时，只有在极度危险的情况下才允许继续靠近边界
      let immediateDangerCount = 0;
      let totalThreatWeight = 0;
      
      for (const hazard of hazards) {
        const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
        const criticalDistance = hazard.r + player.r + 40;
        
        if (distance < criticalDistance) {
          immediateDangerCount++;
          totalThreatWeight += (criticalDistance - distance) / criticalDistance;
        }
      }
      
      // 需要至少2个紧急威胁才能继续靠近边界
      return immediateDangerCount >= 2 && totalThreatWeight > 1.5;
    }
    
    // 检查其他非边界方向是否都有威胁
    const alternativeDirections = [
      [-1, 0], [1, 0], [0, -1], [0, 1], // 四个主方向
      [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707], [0.707, 0.707] // 四个对角方向
    ];
    
    let safeAlternatives = 0;
    let moderatelySafeAlternatives = 0;
    
    for (const altDir of alternativeDirections) {
      // 跳过当前方向
      if (Math.abs(altDir[0] - direction[0]) < 0.1 && Math.abs(altDir[1] - direction[1]) < 0.1) {
        continue;
      }
      
      // 检查这个替代方向是否指向边界
      const altFutureX = player.x + altDir[0] * 100;
      const altFutureY = player.y + altDir[1] * 100;
      const altTowardBoundary = altFutureX < 100 || altFutureX > width - 100 || 
                               altFutureY < 100 || altFutureY > height - 100;
      
      if (altTowardBoundary) continue; // 跳过也指向边界的方向
      
      // 检查这个方向的安全性（需要更严格的安全标准）
      let dangerLevel = 0;
      for (const hazard of hazards) {
        const checkX = player.x + altDir[0] * 80; // 增加检查距离
        const checkY = player.y + altDir[1] * 80;
        const distanceToCheck = Math.hypot(hazard.x - checkX, hazard.y - checkY);
        const safeDistance = hazard.r + player.r + 50; // 增加安全距离要求
        
        if (distanceToCheck < safeDistance) {
          dangerLevel += (safeDistance - distanceToCheck) / safeDistance;
        }
      }
      
      if (dangerLevel === 0) {
        safeAlternatives++; // 完全安全的方向
      } else if (dangerLevel < 0.5) {
        moderatelySafeAlternatives++; // 相对安全的方向
      }
    }
    
    // 只有当完全安全的方向为0，且相对安全的方向也很少时，才允许向边界移动
    return safeAlternatives === 0 && moderatelySafeAlternatives <= 1;
  }
    
  // 计算逃脱路线 - 考虑边界限制和敌人大小
  private calculateEscapeRoutes(gameState: GameState, threatX: number, threatY: number, boundaryPressure: any): { direction: [number, number]; safety: number }[] {
    const routes = [];
    
    // 主要逃脱方向：与威胁相反
    const escapeX = -threatX;
    const escapeY = -threatY;
    
    // 侧向逃脱方向
    const leftX = -threatY;
    const leftY = threatX;
    const rightX = threatY;
    const rightY = -threatX;
    
    // 边界安全方向 - 远离边界
    const boundaryEscapeX = boundaryPressure.x;
    const boundaryEscapeY = boundaryPressure.y;
    
    // 评估每个方向的安全性
    const directions = [
      [escapeX, escapeY], // 直接逃脱
      [leftX, leftY],     // 左侧逃脱  
      [rightX, rightY],   // 右侧逃脱
    ];
    
    // 如果有边界压力，添加边界逃脱方向
    if (boundaryPressure.intensity > 0.3) {
      directions.push([boundaryEscapeX, boundaryEscapeY]);
    }
    
    for (const dir of directions) {
      let safety = this.evaluateDirectionSafety(gameState, dir as [number, number]);
      
      // 检查是否向边界移动
      const isTowardBoundary = !this.isForceTowardBoundary(gameState, dir as [number, number]);
      if (!isTowardBoundary) {
        // 如果不是被迫向边界，且方向指向边界，大幅降低安全性
        const player = gameState.player;
        const futureX = player.x + dir[0] * 80;
        const futureY = player.y + dir[1] * 80;
        const width = gameState.width;
        const height = gameState.height;
        
        if (futureX < 100 || futureX > width - 100 || 
            futureY < 100 || futureY > height - 100) {
          safety *= 0.2; // 大幅降低向边界移动的安全性
        }
      }
      
      routes.push({
        direction: dir as [number, number],
        safety
      });
    }
    
    return routes.sort((a, b) => b.safety - a.safety);
  }

  // 计算规避动作得分
  private calculateAvoidanceScore(actionVec: [number, number], avoidanceAnalysis: any): number {
    let maxScore = 0;
    
    // 检查与最佳逃脱路线的匹配度
    for (const route of avoidanceAnalysis.escapeRoutes) {
      const alignment = actionVec[0] * route.direction[0] + actionVec[1] * route.direction[1];
      if (alignment > 0) {
        const score = alignment * route.safety * avoidanceAnalysis.urgency;
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return maxScore;
  }

  // 评估方向安全性 - 完美躲避算法，基于精确预测
  private evaluateDirectionSafety(gameState: GameState, direction: [number, number]): number {
    const player = gameState.player;
    let safety = 1.0;
    
    // 精确模拟未来移动轨迹，实现完美躲避
    const simulationSteps = 8; // 增加模拟步数，更精确预测
    const moveDistance = 30; // 每步移动距离
    
    for (let step = 1; step <= simulationSteps; step++) {
      const futureX = player.x + direction[0] * moveDistance * step;
      const futureY = player.y + direction[1] * moveDistance * step;
      
      // 检查边界 - 更严格的边界检查
      if (futureX < 60 || futureX > gameState.width - 60 || 
          futureY < 60 || futureY > gameState.height - 60) {
        safety *= 0.3; // 边界风险极高
        break;
      }
      
      // 精确预测每个敌人的未来位置
      for (const hazard of gameState.hazards) {
        // 多步预测敌人位置，考虑其移动模式
        const stepTime = step * 0.5; // 假设每步0.5时间单位
        let predictedHazardX = hazard.x;
        let predictedHazardY = hazard.y;
        
        // 根据敌人类型进行不同的预测
        if (hazard.kind === 'tracker') {
          // 追踪敌人会调整方向追向玩家
          const currentPlayerDirection = [
            futureX - hazard.x,
            futureY - hazard.y
          ];
          const distance = Math.hypot(currentPlayerDirection[0], currentPlayerDirection[1]);
          if (distance > 0) {
            const normalizedDir = [currentPlayerDirection[0] / distance, currentPlayerDirection[1] / distance];
            predictedHazardX = hazard.x + normalizedDir[0] * hazard.baseSpeed * stepTime;
            predictedHazardY = hazard.y + normalizedDir[1] * hazard.baseSpeed * stepTime;
          }
        } else {
          // 普通敌人按直线移动
          predictedHazardX = hazard.x + hazard.dirX * hazard.baseSpeed * stepTime;
          predictedHazardY = hazard.y + hazard.dirY * hazard.baseSpeed * stepTime;
        }
        
        // 计算预测碰撞
        const futureDistance = Math.hypot(predictedHazardX - futureX, predictedHazardY - futureY);
        
        // 基于敌人大小和速度的精确安全距离计算
        const baseMinSafeDistance = hazard.r + player.r + 35;
        const speedBonus = hazard.baseSpeed > 2.0 ? 15 : 0; // 快速敌人需要更大安全距离
        const sizeBonus = (hazard.r - 15) > 0 ? (hazard.r - 15) * 1.2 : 0; // 大敌人额外安全距离
        const minSafeDistance = baseMinSafeDistance + speedBonus + sizeBonus;
        
        // 计算碰撞风险
        if (futureDistance < minSafeDistance) {
          // 计算精确的危险程度
          const dangerLevel = (minSafeDistance - futureDistance) / minSafeDistance;
          
          // 根据敌人类型调整风险权重
          let riskMultiplier = 1.0;
          if (hazard.kind === 'tracker') {
            riskMultiplier = 1.5; // 追踪敌人风险更高
          }
          if (hazard.baseSpeed > 2.5) {
            riskMultiplier *= 1.3; // 快速敌人额外风险
          }
          
          // 根据时间步调整风险（越近期的碰撞风险越高）
          const timeWeight = Math.max(0.5, 1.0 - (step - 1) * 0.1);
          
          const finalRisk = dangerLevel * riskMultiplier * timeWeight;
          safety *= Math.max(0.05, 1 - finalRisk * 0.8);
          
        } else if (futureDistance < minSafeDistance * 2.0) {
          // 中等风险区域
          const riskLevel = (minSafeDistance * 2.0 - futureDistance) / minSafeDistance;
          safety *= Math.max(0.4, 1 - riskLevel * 0.3);
        }
      }
      
      // 如果当前步骤安全性已经很低，提前终止模拟
      if (safety < 0.1) {
        break;
      }
    }
    
    return Math.max(0.01, safety);
  }

  // 获取强制朝向中心的动作
  private getForcedCenterAction(gameState: GameState, actionVectors: number[][]): number {
    const player = gameState.player;
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const toCenterX = centerX - player.x;
    const toCenterY = centerY - player.y;
    const toCenterDist = Math.hypot(toCenterX, toCenterY);
    
    if (toCenterDist === 0) return 1; // 已在中心，随便选个动作
    
    const dirX = toCenterX / toCenterDist;
    const dirY = toCenterY / toCenterDist;
    
    let bestAction = 1;
    let bestDot = -2;
    
    for (let i = 1; i < actionVectors.length; i++) {
      const dot = actionVectors[i][0] * dirX + actionVectors[i][1] * dirY;
      if (dot > bestDot) {
        bestDot = dot;
        bestAction = i;
      }
    }
    
    return bestAction;
  }

  // 获取安全的朝向中心动作
  private getSafeCenterAction(gameState: GameState, actionVectors: number[][], nearLeft: boolean, nearRight: boolean, nearTop: boolean, nearBottom: boolean): number {
    const safeActions = [];
    
    for (let i = 1; i < actionVectors.length; i++) {
      const vector = actionVectors[i];
      let isSafe = true;
      
      if (nearLeft && vector[0] < 0) isSafe = false;
      if (nearRight && vector[0] > 0) isSafe = false;
      if (nearTop && vector[1] < 0) isSafe = false;
      if (nearBottom && vector[1] > 0) isSafe = false;
      
      if (isSafe) {
        safeActions.push(i);
      }
    }
    
    if (safeActions.length === 0) return 1; // 如果没有安全动作，默认向左
    
    // 从安全动作中选择最朝向中心的
    const player = gameState.player;
    const centerX = gameState.width / 2;
    const centerY = gameState.height / 2;
    const toCenterX = centerX - player.x;
    const toCenterY = centerY - player.y;
    const toCenterDist = Math.hypot(toCenterX, toCenterY);
    
    if (toCenterDist === 0) return safeActions[0];
    
    const dirX = toCenterX / toCenterDist;
    const dirY = toCenterY / toCenterDist;
    
    let bestSafeAction = safeActions[0];
    let bestDot = -2;
    
    for (const safeAction of safeActions) {
      const vector = actionVectors[safeAction];
      const dot = vector[0] * dirX + vector[1] * dirY;
      if (dot > bestDot) {
        bestDot = dot;
        bestSafeAction = safeAction;
      }
    }
    
    return bestSafeAction;
  }

  // 超级增强动态速度计算 - 极大提升移动速度和响应能力
  private calculateEnhancedDynamicSpeed(gameState: GameState, features: number[], action: number, isLowHealth: boolean, isCriticalHealth: boolean): number {
    // 大幅提升基础速度 - 从2.0提升到3.5
    let baseSpeed = isCriticalHealth ? 3.5 : (isLowHealth ? 2.8 : 2.2); // 大幅提升基础速度
    
    // 分析威胁情况并进行大幅加速
    if (features.length > 10) {
      const minThreatDistance = features[8] || 1.0;
      const nearbyThreatRatio = features[11] || 0.0;
      
      // 威胁越近速度越快 - 增强反应
      const threatLevel = 1 - minThreatDistance;
      baseSpeed += threatLevel * 2.5; // 从1.8增加到2.5
      
      // 基于近距离威胁比例加速 - 增强群体威胁响应
      baseSpeed += nearbyThreatRatio * 1.8; // 从1.2增加到1.8
    }
    
    // 计算邻近敌人权重加速 - 增强对追踪敌人的响应
    let totalNearbyWeight = 0;
    let weightCount = 0;
    let maxNearbyWeight = 0;
    
    for (let i = 0; i < 25; i++) { // 检查25个敌人
      const weightIndex = 8 + i * 6 + 5;
      if (weightIndex < features.length) {
        const weight = features[weightIndex];
        if (weight > 0.03) { // 进一步降低阈值，更敏感
          totalNearbyWeight += weight;
          maxNearbyWeight = Math.max(maxNearbyWeight, weight);
          weightCount++;
        }
      }
    }
    
    if (weightCount > 0) {
      const avgNearbyWeight = totalNearbyWeight / weightCount;
      baseSpeed += avgNearbyWeight * 2.8; // 从2.0增加到2.8
      baseSpeed += maxNearbyWeight * 1.5; // 最强威胁额外加速
    }
    
    // 追踪敌人特殊加速 - 检查是否有追踪型敌人
    let trackerThreat = 0;
    for (const hazard of gameState.hazards) {
      if (hazard.kind === 'tracker') {
        const distance = Math.hypot(hazard.x - gameState.player.x, hazard.y - gameState.player.y);
        if (distance < 200) { // 追踪敌人在200像素内时
          trackerThreat += Math.exp(-distance / 80); // 指数衰减威胁
        }
      }
    }
    baseSpeed += trackerThreat * 2.0; // 追踪敌人高速逃脱
    
    // 道具拾取紧急性加速
    if (isLowHealth && gameState.pickups.length > 0) {
      let nearestSafePickup = null;
      let minDistance = Infinity;
      
      for (const pickup of gameState.pickups) {
        const distance = Math.hypot(pickup.x - gameState.player.x, pickup.y - gameState.player.y);
        const safety = this.calculatePickupSafety(gameState, pickup);
        
        if (safety > 0.3 && distance < minDistance) {
          minDistance = distance;
          nearestSafePickup = pickup;
        }
      }
      
      if (nearestSafePickup) {
        baseSpeed += isCriticalHealth ? 1.5 : 0.8; // 道具拾取加速
      }
    }
    
    // 边界规避加速 - 在边界附近时提高速度快速脱离
    const player = gameState.player;
    const boundaryDistance = Math.min(
      player.x,
      gameState.width - player.x,
      player.y,
      gameState.height - player.y
    );
    
    if (boundaryDistance < 100) { // 增加边界感知范围
      const boundaryUrgency = (100 - boundaryDistance) / 100;
      baseSpeed += boundaryUrgency * 2.0; // 从1.5增加到2.0
    }
    
    // 移动持续性奖励 - 鼓励连续移动而非静止
    if (action !== 0) {
      baseSpeed += 0.3; // 移动动作额外速度奖励
    }
    
    // 禁止静止时速度为0（除非在绝对安全区域）
    if (action === 0) {
      // 检查是否在相对安全的位置
      let nearestThreat = Infinity;
      for (const hazard of gameState.hazards) {
        const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
        nearestThreat = Math.min(nearestThreat, distance);
      }
      
      // 更严格的静止条件：只有在距离威胁非常远且远离边界时才允许静止
      if (nearestThreat > 180 && boundaryDistance > 120 && !isLowHealth) {
        baseSpeed = 0;
      } else {
        baseSpeed = Math.max(1.5, baseSpeed); // 提高强制最低速度从1.0到1.5
      }
    }
    
    // 设置速度范围，大幅提升上限 - 从4.0提升到6.0
    return Math.max(1.0, Math.min(6.0, baseSpeed)); // 最大速度提升到6.0
  }

  // 增强的启发式偏差 - 考虑生命状态、道具拾取和智能绕过敌人
  private getEnhancedHeuristicBias(gameState: GameState, isLowHealth: boolean, isCriticalHealth: boolean): number[] {
    const player = gameState.player;
    const hazards = gameState.hazards;
    const pickups = gameState.pickups;
    const width = gameState.width;
    const height = gameState.height;

    // 动作向量定义
    const actionVecs: [number, number][] = [
      [0, 0],           // 0: 停止
      [-1, 0], [1, 0],  // 1-2: 左右
      [0, -1], [0, 1],  // 3-4: 上下
      [-0.707, -0.707], [0.707, -0.707],  // 5-6: 对角
      [-0.707, 0.707], [0.707, 0.707]     // 7-8: 对角
    ];

    const hBias = new Array(9).fill(0);
    
    // 1. 智能敌人绕过分析 - 核心新功能
    const avoidanceVectors = this.calculateSmartAvoidanceVectors(gameState);
    
    // 2. 威胁规避分析 - 增强版
    let totalThreatX = 0;
    let totalThreatY = 0;
    let threatWeight = 0;
    let maxThreatWeight = 0;

    for (const hazard of hazards) {
      const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      if (distance > 0 && distance < 250) { // 增加威胁感知范围到250
        let weight = Math.exp(-distance / 70); // 更敏感的权重计算
        
        // 追踪敌人和快速敌人增加权重
        if (hazard.kind === 'tracker') {
          weight *= 2.5; // 追踪敌人高威胁权重
        } else if (hazard.baseSpeed > 2.0) {
          weight *= 1.8; // 快速敌人增加权重
        }
        
        const dirX = (hazard.x - player.x) / distance;
        const dirY = (hazard.y - player.y) / distance;
        
        totalThreatX += dirX * weight;
        totalThreatY += dirY * weight;
        threatWeight += weight;
        maxThreatWeight = Math.max(maxThreatWeight, weight);
      }
    }

    if (threatWeight > 0) {
      totalThreatX /= threatWeight;
      totalThreatY /= threatWeight;
    }

    // 3. 道具拾取导向（低血量时）
    let pickupBiasX = 0;
    let pickupBiasY = 0;
    
    if (isLowHealth && pickups.length > 0) {
      let bestPickup = null;
      let bestScore = -1;
      
      for (const pickup of pickups) {
        const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
        const safety = this.calculatePickupSafety(gameState, pickup);
        const urgency = (pickup.maxLife - pickup.life) / pickup.maxLife;
        
        let score = safety / (1 + distance / 100) + urgency;
        if (pickup.type === 'heart') {
          score *= isCriticalHealth ? 5 : 3; // 血量道具高优先级
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestPickup = pickup;
        }
      }
      
      if (bestPickup && bestScore > 0.3) {
        const distance = Math.hypot(bestPickup.x - player.x, bestPickup.y - player.y);
        if (distance > 0) {
          pickupBiasX = (bestPickup.x - player.x) / distance;
          pickupBiasY = (bestPickup.y - player.y) / distance;
        }
      }
    }

    // 4. 边界规避强化
    const centerX = width / 2;
    const centerY = height / 2;
    const toCenterX = (centerX - player.x) / width;
    const toCenterY = (centerY - player.y) / height;
    
    const edgeDistance = Math.min(
      player.x, width - player.x,
      player.y, height - player.y
    );
    
    const boundaryPressure = edgeDistance < 100 ? (100 - edgeDistance) / 100 : 0; // 增加边界压力范围

    // 5. 为每个动作计算综合偏差
    for (let a = 0; a < 9; a++) {
      let bonus = 0;
      
      // 智能绕过敌人奖励 - 新核心功能
      const avoidanceBonus = this.calculateAvoidanceBonus(actionVecs[a], avoidanceVectors, hazards, player);
      bonus += avoidanceBonus * 4.0; // 高权重智能绕过
      
      // 威胁规避奖励（权重增加）
      const threatAvoidance = -actionVecs[a][0] * totalThreatX - actionVecs[a][1] * totalThreatY;
      bonus += threatAvoidance * (isCriticalHealth ? 5.0 : 4.0); // 增加威胁规避权重
      
      // 侧向移动奖励（避免直线逃跑）
      if (maxThreatWeight > 0.3) { // 有强威胁时
        const perpendicular = this.calculatePerpendicularMovement(actionVecs[a], totalThreatX, totalThreatY);
        bonus += perpendicular * 2.0; // 鼓励侧向移动
      }
      
      // 道具拾取奖励（低血量时）
      if (isLowHealth) {
        const pickupAlignment = actionVecs[a][0] * pickupBiasX + actionVecs[a][1] * pickupBiasY;
        bonus += pickupAlignment * (isCriticalHealth ? 3.0 : 2.0);
      }
      
      // 边界规避奖励（强化）
      if (boundaryPressure > 0) {
        const towardCenter = actionVecs[a][0] * toCenterX + actionVecs[a][1] * toCenterY;
        bonus += towardCenter * boundaryPressure * 4.0; // 增加边界规避权重
      }
      
      // 移动连贯性奖励
      if (a !== 0) {
        bonus += 0.5; // 鼓励持续移动
      }
      
      // 强烈惩罚静止动作（除非在极安全位置）
      if (a === 0) {
        let nearestThreat = Infinity;
        for (const hazard of hazards) {
          const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
          nearestThreat = Math.min(nearestThreat, distance);
        }
        
        if (nearestThreat < 180 || edgeDistance < 120 || isLowHealth) {
          bonus -= 4.0; // 大幅惩罚静止
        }
      }
      
      hBias[a] = bonus;
    }

    return hBias;
  }

  // 计算智能绕过向量 - 新核心功能
  private calculateSmartAvoidanceVectors(gameState: GameState): {direction: [number, number], strength: number}[] {
    const player = gameState.player;
    const hazards = gameState.hazards;
    const avoidanceVectors: {direction: [number, number], strength: number}[] = [];
    
    for (const hazard of hazards) {
      const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      if (distance > 0 && distance < 200) {
        // 计算敌人的未来位置（预测2-3帧）
        const futureX = hazard.x + hazard.dirX * hazard.baseSpeed * 2.5;
        const futureY = hazard.y + hazard.dirY * hazard.baseSpeed * 2.5;
        
        // 计算从未来位置的规避向量
        const toPlayer = {
          x: player.x - futureX,
          y: player.y - futureY
        };
        const dist = Math.hypot(toPlayer.x, toPlayer.y);
        
        if (dist > 0) {
          // 计算两个侧向绕过方向
          const normalizedDir = {x: toPlayer.x / dist, y: toPlayer.y / dist};
          
          // 左侧绕过向量（逆时针90度旋转）
          const leftBypass: [number, number] = [-normalizedDir.y, normalizedDir.x];
          // 右侧绕过向量（顺时针90度旋转）
          const rightBypass: [number, number] = [normalizedDir.y, -normalizedDir.x];
          
          const strength = Math.exp(-distance / 80) * (hazard.kind === 'tracker' ? 2.0 : 1.0);
          
          avoidanceVectors.push({direction: leftBypass, strength});
          avoidanceVectors.push({direction: rightBypass, strength});
        }
      }
    }
    
    return avoidanceVectors;
  }

  // 计算规避动作奖励
  private calculateAvoidanceBonus(actionVec: [number, number], avoidanceVectors: {direction: [number, number], strength: number}[], hazards: any[], player: any): number {
    let maxBonus = 0;
    
    for (const avoidance of avoidanceVectors) {
      // 计算动作向量与绕过向量的对齐度
      const alignment = actionVec[0] * avoidance.direction[0] + actionVec[1] * avoidance.direction[1];
      
      if (alignment > 0) {
        // 检查这个方向是否安全（不会撞到其他敌人）
        const safetyScore = this.calculateDirectionSafety(actionVec, hazards, player);
        const bonus = alignment * avoidance.strength * safetyScore;
        maxBonus = Math.max(maxBonus, bonus);
      }
    }
    
    return maxBonus;
  }

  // 计算方向安全性
  private calculateDirectionSafety(direction: [number, number], hazards: any[], player: any): number {
    // 在这个方向上模拟移动几步，检查是否安全
    let safety = 1.0;
    const steps = 5;
    const speed = 3.0; // 假设移动速度
    
    for (let step = 1; step <= steps; step++) {
      const futureX = player.x + direction[0] * speed * step * 0.2;
      const futureY = player.y + direction[1] * speed * step * 0.2;
      
      for (const hazard of hazards) {
        // 预测敌人的未来位置
        const hazardFutureX = hazard.x + hazard.dirX * hazard.baseSpeed * step * 0.2;
        const hazardFutureY = hazard.y + hazard.dirY * hazard.baseSpeed * step * 0.2;
        
        const distance = Math.hypot(hazardFutureX - futureX, hazardFutureY - futureY);
        const minSafeDistance = hazard.r + player.r + 15; // 安全距离缓冲
        
        if (distance < minSafeDistance) {
          safety *= 0.3; // 降低安全性
        } else if (distance < minSafeDistance * 2) {
          safety *= 0.7; // 中等风险
        }
      }
    }
    
    return Math.max(0.1, safety);
  }

  // 计算垂直移动（侧向移动）
  private calculatePerpendicularMovement(actionVec: [number, number], threatX: number, threatY: number): number {
    // 计算动作向量与威胁向量的垂直分量
    const dot = actionVec[0] * threatX + actionVec[1] * threatY;
    const cross = actionVec[0] * threatY - actionVec[1] * threatX;
    
    // 垂直分量越大，侧向移动越多
    return Math.abs(cross) * (1 - Math.abs(dot)); // 减少直线移动的影响
  }

  // 旧版速度计算方法 - 保持兼容性但使用增强逻辑
  private calculateDynamicSpeed(gameState: GameState, features: number[], action: number): number {
    // 调用增强版本的速度计算
    const currentHealth = gameState.lives / gameState.maxLives;
    const isLowHealth = currentHealth <= 0.6;
    const isCriticalHealth = currentHealth <= 0.3;
    
    return this.calculateEnhancedDynamicSpeed(gameState, features, action, isLowHealth, isCriticalHealth);
  }

  // 添加训练经验 - 支持基于距离的权重调整
  addExperience(state: number[], action: number, reward: number, nextState: number[] | null, done: boolean): void {
    // 计算优先级，基于距离权重和奖励
    let priority = Math.abs(reward) + (done ? 2 : 0);
    
    // 从特征中提取敌人权重信息来调整优先级
    if (state.length >= 158) { // 确保有足够的特征
      // 提取前10个敌人的权重信息 (每个敌人6维，第6维是权重)
      let totalNearbyWeight = 0;
      let weightCount = 0;
      
      for (let i = 0; i < 25; i++) { // 25个敌人
        const weightIndex = 8 + i * 6 + 5; // 基础特征8维 + 敌人信息第6维(权重)
        if (weightIndex < state.length) {
          const weight = state[weightIndex];
          if (weight > 0.1) { // 只考虑有意义的权重
            totalNearbyWeight += weight;
            weightCount++;
          }
        }
      }
      
      // 如果有邻近敌人，增加训练优先级
      if (weightCount > 0) {
        const avgNearbyWeight = totalNearbyWeight / weightCount;
        priority *= (1 + avgNearbyWeight * 2); // 邻近敌人增加优先级
      }
    }
    
    this.experienceBuffer.add({
      state,
      action,
      reward,
      nextState,
      done,
      priority
    });
  }

  // 训练网络
  train(): void {
    if (this.experienceBuffer.size() < 100) {
      return; // 经验不足，暂不训练
    }
    
    const batchSize = Math.min(64, this.experienceBuffer.size());
    const experiences = this.experienceBuffer.sample(batchSize);
    
    for (const exp of experiences) {
      const target = this.calculateTarget(exp);
      this.updateWeights(exp.state, exp.action, target);
    }
    
    // 调整探索率
    this.explorationRate = Math.max(0.01, this.explorationRate * 0.995);
  }

  private calculateTarget(experience: Experience): number {
    let target = experience.reward;
    
    if (!experience.done && experience.nextState) {
      const { value: nextValue } = this.forward(experience.nextState);
      target += 0.99 * nextValue; // 折扣因子
    }
    
    return target;
  }

  private updateWeights(state: number[], action: number, target: number): void {
    // 简化的梯度更新（实际应用中建议使用更复杂的优化算法）
    const { value, policy } = this.forward(state);
    const valueError = target - value;
    const policyError = new Array(this.ACTION_COUNT).fill(0);
    policyError[action] = valueError;
    
    // 这里应该实现反向传播，由于代码复杂度，使用简化版本
    this.applyGradients(valueError, policyError, state);
  }

  private applyGradients(valueError: number, policyError: number[], state: number[]): void {
    // 简化的权重更新
    const lr = this.learningRate;
    
    // 更新价值头的权重（简化版本）
    for (let i = 0; i < this.valueHead.biases.length; i++) {
      this.valueHead.biases[i] += lr * valueError;
    }
    
    // 更新策略头的权重（简化版本）
    for (let i = 0; i < this.policyHead.biases.length; i++) {
      this.policyHead.biases[i] += lr * policyError[i];
    }
    
    // 注意：这是极简化的版本，实际实现需要完整的反向传播
  }

  // Episode管理
  beginEpisode(): void {
    this.lastFeatures = [];
    this.lastAction = 0;
  }

  endEpisode(finalScore: number): void {
    this.episodeCount++;
    this.totalReward += finalScore;
    this.averagePerformance = this.totalReward / this.episodeCount;
    
    if (finalScore > this.bestPerformance) {
      this.bestPerformance = finalScore;
      // 保存新的最佳权重
      this.saveCurrentWeights(finalScore);
    }
    
    // 定期训练
    if (this.episodeCount % 10 === 0) {
      this.train();
    }
    
    // 定期保存权重
    if (this.episodeCount % 50 === 0) {
      this.saveCurrentWeights(this.averagePerformance);
    }
  }

  private saveCurrentWeights(performance: number): void {
    const networkData = {
      inputLayer: { weights: this.inputLayer.weights, biases: this.inputLayer.biases },
      hiddenLayer1: { weights: this.hiddenLayer1.weights, biases: this.hiddenLayer1.biases },
      hiddenLayer2: { weights: this.hiddenLayer2.weights, biases: this.hiddenLayer2.biases },
      hiddenLayer3: { weights: this.hiddenLayer3.weights, biases: this.hiddenLayer3.biases },
      valueHead: { weights: this.valueHead.weights, biases: this.valueHead.biases },
      policyHead: { weights: this.policyHead.weights, biases: this.policyHead.biases },
      metadata: {
        episodes: this.episodeCount,
        averagePerformance: this.averagePerformance,
        explorationRate: this.explorationRate
      }
    };
    
    this.weightManager.saveWeights(performance, networkData);
  }

  private loadBestWeights(): void {
    const bestWeights = this.weightManager.getBestWeights();
    if (bestWeights) {
      this.loadWeights(bestWeights);
    } else {
      // 如果没有找到最佳权重，确保权重已正确初始化
      this.ensureWeightsInitialized();
    }
  }

  private ensureWeightsInitialized(): void {
    // 检查并重新初始化任何未定义的权重
    console.log('🔍 检查神经网络层...');
    
    if (!this.inputLayer || !this.inputLayer.weights || !Array.isArray(this.inputLayer.weights) || 
        this.inputLayer.weights.length !== 1024) {
      console.warn('🔧 重新初始化输入层权重');
      this.inputLayer = new NeuralLayer(200, 1024);
    }
    
    if (!this.hiddenLayer1 || !this.hiddenLayer1.weights || !Array.isArray(this.hiddenLayer1.weights) || 
        this.hiddenLayer1.weights.length !== 1536) {
      console.warn('🔧 重新初始化隐藏层1权重');
      this.hiddenLayer1 = new NeuralLayer(1024, 1536);
    }
    
    if (!this.hiddenLayer2 || !this.hiddenLayer2.weights || !Array.isArray(this.hiddenLayer2.weights) || 
        this.hiddenLayer2.weights.length !== 1024) {
      console.warn('🔧 重新初始化隐藏层2权重');
      this.hiddenLayer2 = new NeuralLayer(1536, 1024);
    }
    
    if (!this.hiddenLayer3 || !this.hiddenLayer3.weights || !Array.isArray(this.hiddenLayer3.weights) || 
        this.hiddenLayer3.weights.length !== 768) {
      console.warn('🔧 重新初始化隐藏层3权重');
      this.hiddenLayer3 = new NeuralLayer(1024, 768);
    }
    
    if (!this.valueHead || !this.valueHead.weights || !Array.isArray(this.valueHead.weights) || 
        this.valueHead.weights.length !== 1) {
      console.warn('🔧 重新初始化价值头权重');
      this.valueHead = new NeuralLayer(768, 1);
    }
    
    if (!this.policyHead || !this.policyHead.weights || !Array.isArray(this.policyHead.weights) || 
        this.policyHead.weights.length !== this.ACTION_COUNT) {
      console.warn('🔧 重新初始化策略头权重');
      this.policyHead = new NeuralLayer(768, this.ACTION_COUNT);
    }
    
    console.log('✅ 神经网络权重初始化完成');
  }

  private validateNetworkIntegrity(): void {
    const layers = [
      { name: 'inputLayer', layer: this.inputLayer, expectedInput: 200, expectedOutput: 1024 },
      { name: 'hiddenLayer1', layer: this.hiddenLayer1, expectedInput: 1024, expectedOutput: 1536 },
      { name: 'hiddenLayer2', layer: this.hiddenLayer2, expectedInput: 1536, expectedOutput: 1024 },
      { name: 'hiddenLayer3', layer: this.hiddenLayer3, expectedInput: 1024, expectedOutput: 768 },
      { name: 'valueHead', layer: this.valueHead, expectedInput: 768, expectedOutput: 1 },
      { name: 'policyHead', layer: this.policyHead, expectedInput: 768, expectedOutput: this.ACTION_COUNT }
    ];

    let integrityPassed = true;
    let needsReinitialize = false;
    
    for (const { name, layer, expectedInput, expectedOutput } of layers) {
      // 检查层是否存在
      if (!layer) {
        console.error(`❌ ${name}: 层对象不存在`);
        needsReinitialize = true;
        continue;
      }

      // 检查权重是否存在
      if (!layer.weights || !Array.isArray(layer.weights)) {
        console.warn(`⚠️ ${name}: 权重未初始化，将重新创建`);
        integrityPassed = false;
        continue;
      }
      
      // 检查输出维度
      if (layer.weights.length !== expectedOutput) {
        console.warn(`⚠️ ${name}: 输出维度错误 (期望${expectedOutput}, 实际${layer.weights.length})`);
        integrityPassed = false;
        continue;
      }
      
      // 检查每一行的输入维度
      let rowErrors = 0;
      for (let i = 0; i < Math.min(layer.weights.length, 5); i++) { // 只检查前5行以提高性能
        if (!Array.isArray(layer.weights[i]) || layer.weights[i].length !== expectedInput) {
          rowErrors++;
          if (rowErrors === 1) { // 只打印第一个错误
            console.warn(`⚠️ ${name}: 输入维度错误在行${i} (期望${expectedInput}, 实际${layer.weights[i]?.length || 'undefined'})`);
          }
        }
      }
      
      if (rowErrors > 0) {
        integrityPassed = false;
      } else {
        console.log(`✅ ${name}: 验证通过 (${expectedInput}→${expectedOutput})`);
      }
    }
    
    if (needsReinitialize) {
      console.error('❌ 神经网络严重损坏，强制重新初始化');
      this.forceReinitializeNetwork();
    } else if (!integrityPassed) {
      console.warn('⚠️ 神经网络部分问题，尝试修复');
      this.ensureWeightsInitialized(); // 只修复而不完全重新初始化
      console.log('🔧 网络修复完成');
    } else {
      console.log('✅ 神经网络完整性验证通过');
    }
  }

  private forceReinitializeNetwork(): void {
    console.log('🔄 强制重新初始化神经网络...');
    this.inputLayer = new NeuralLayer(200, 1024);
    this.hiddenLayer1 = new NeuralLayer(1024, 1536);
    this.hiddenLayer2 = new NeuralLayer(1536, 1024);
    this.hiddenLayer3 = new NeuralLayer(1024, 768);
    this.valueHead = new NeuralLayer(768, 1);
    this.policyHead = new NeuralLayer(768, this.ACTION_COUNT);
    console.log('✅ 神经网络强制重新初始化完成');
  }

  private loadWeights(data: any): void {
    try {
      // 验证数据结构
      if (!data || typeof data !== 'object') {
        throw new Error('权重数据无效');
      }

      // 安全加载每一层的权重
      if (data.inputLayer && data.inputLayer.weights && Array.isArray(data.inputLayer.weights)) {
        this.inputLayer.weights = data.inputLayer.weights;
        this.inputLayer.biases = data.inputLayer.biases;
      }
      if (data.hiddenLayer1 && data.hiddenLayer1.weights && Array.isArray(data.hiddenLayer1.weights)) {
        this.hiddenLayer1.weights = data.hiddenLayer1.weights;
        this.hiddenLayer1.biases = data.hiddenLayer1.biases;
      }
      if (data.hiddenLayer2 && data.hiddenLayer2.weights && Array.isArray(data.hiddenLayer2.weights)) {
        this.hiddenLayer2.weights = data.hiddenLayer2.weights;
        this.hiddenLayer2.biases = data.hiddenLayer2.biases;
      }
      if (data.hiddenLayer3 && data.hiddenLayer3.weights && Array.isArray(data.hiddenLayer3.weights)) {
        this.hiddenLayer3.weights = data.hiddenLayer3.weights;
        this.hiddenLayer3.biases = data.hiddenLayer3.biases;
      }
      if (data.valueHead && data.valueHead.weights && Array.isArray(data.valueHead.weights)) {
        this.valueHead.weights = data.valueHead.weights;
        this.valueHead.biases = data.valueHead.biases;
      }
      if (data.policyHead && data.policyHead.weights && Array.isArray(data.policyHead.weights)) {
        this.policyHead.weights = data.policyHead.weights;
        this.policyHead.biases = data.policyHead.biases;
      }
      
      if (data.metadata) {
        this.episodeCount = data.metadata.episodes || 0;
        this.averagePerformance = data.metadata.averagePerformance || 0;
        this.explorationRate = data.metadata.explorationRate || 0.1;
      }
      
      // 确保所有权重都正确初始化
      this.ensureWeightsInitialized();
      
      console.log('✅ 权重加载成功');
    } catch (e) {
      console.warn('❌ 权重加载失败:', e);
      // 加载失败时重新初始化所有权重
      this.ensureWeightsInitialized();
    }
  }

  // 获取统计信息
  getStats(): {
    episodes: number;
    averageScore: number;
    bestScore: number;
    explorationRate: number;
    experienceCount: number;
    weightCount: number;
  } {
    return {
      episodes: this.episodeCount,
      averageScore: this.averagePerformance,
      bestScore: this.bestPerformance,
      explorationRate: this.explorationRate,
      experienceCount: this.experienceBuffer.size(),
      weightCount: this.weightManager.getAllWeights().length
    };
  }

  // 权重管理接口
  exportWeights(): string {
    const networkData = {
      inputLayer: { weights: this.inputLayer.weights, biases: this.inputLayer.biases },
      hiddenLayer1: { weights: this.hiddenLayer1.weights, biases: this.hiddenLayer1.biases },
      hiddenLayer2: { weights: this.hiddenLayer2.weights, biases: this.hiddenLayer2.biases },
      hiddenLayer3: { weights: this.hiddenLayer3.weights, biases: this.hiddenLayer3.biases },
      valueHead: { weights: this.valueHead.weights, biases: this.valueHead.biases },
      policyHead: { weights: this.policyHead.weights, biases: this.policyHead.biases },
      metadata: {
        episodes: this.episodeCount,
        averagePerformance: this.averagePerformance,
        bestPerformance: this.bestPerformance,
        explorationRate: this.explorationRate,
        version: '2.0'
      }
    };
    
    return JSON.stringify(networkData, null, 2);
  }

  importWeights(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.metadata && parsed.metadata.version) {
        this.loadWeights(parsed);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  getWeightsList(): Array<{id: string, performance: number, timestamp: number}> {
    return this.weightManager.getAllWeights();
  }

  loadSpecificWeights(id: string): boolean {
    const weights = this.weightManager.loadWeights(id);
    if (weights) {
      this.loadWeights(weights);
      return true;
    }
    return false;
  }

  // 为了向后兼容，添加addTrainingStep方法
  addTrainingStep(features: number[], action: number, reward: number, hBias: number[], hStrength: number): void {
    // 存储经验用于重放学习
    if (this.lastFeatures) {
      this.experienceBuffer.add({
        state: this.lastFeatures,
        action: this.lastAction,
        reward: reward,
        nextState: features,
        done: false,
        priority: Math.abs(reward) + 0.1
      });
    }
    
    this.lastFeatures = features;
    this.lastAction = action;
  }

  // 为了向后兼容，添加composeThreatVector方法
  composeThreatVector(playerX: number, playerY: number, hazards: any[], width: number, height: number): { nhx: number, nhy: number, nhd: number } {
    let totalThreatX = 0;
    let totalThreatY = 0;
    let threatCount = 0;
    let minDistance = Infinity;

    for (const hazard of hazards) {
      const dx = hazard.x - playerX;
      const dy = hazard.y - playerY;
      const distance = Math.hypot(dx, dy);
      
      if (distance < minDistance) {
        minDistance = distance;
      }
      
      if (distance < 100 && distance > 0) { // 只考虑近距离威胁
        const threat = 1 / (1 + distance / 50);
        totalThreatX += (dx / distance) * threat;
        totalThreatY += (dy / distance) * threat;
        threatCount++;
      }
    }

    if (threatCount > 0) {
      totalThreatX /= threatCount;
      totalThreatY /= threatCount;
    }

    // 计算危险度：基于最近距离
    const screenDiagonal = Math.hypot(width, height);
    const normalizedDistance = Math.min(minDistance / screenDiagonal, 1);
    const dangerLevel = 1 - normalizedDistance; // 0=安全, 1=危险

    return {
      nhx: Math.tanh(totalThreatX),
      nhy: Math.tanh(totalThreatY),
      nhd: dangerLevel
    };
  }

  // 向后兼容方法：获取启发式偏置
  getHeuristicBias(state: GameState): number[] {
    const player = state.player;
    const hazards = state.hazards;
    const width = state.width;
    const height = state.height;

    // 8方向移动 + 停止的动作向量
    const actionVecs: [number, number][] = [
      [0,0],      // 0: 停止
      [-1,0],     // 1: 左
      [1,0],      // 2: 右  
      [0,-1],     // 3: 上
      [0,1],      // 4: 下
      [-0.707,-0.707], // 5: 左上
      [0.707,-0.707],  // 6: 右上
      [-0.707,0.707],  // 7: 左下
      [0.707,0.707]    // 8: 右下
    ];

    const hBias = new Array(9).fill(0); // 9个动作
    
    // 计算威胁向量
    let totalThreatX = 0;
    let totalThreatY = 0;
    let threatWeight = 0;

    for (const hazard of hazards) {
      const distance = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      if (distance > 0 && distance < 150) {
        const weight = 1 / (1 + distance / 50);
        const dirX = (hazard.x - player.x) / distance;
        const dirY = (hazard.y - player.y) / distance;
        
        totalThreatX += dirX * weight;
        totalThreatY += dirY * weight;
        threatWeight += weight;
      }
    }

    if (threatWeight > 0) {
      totalThreatX /= threatWeight;
      totalThreatY /= threatWeight;
    }

    // 为每个动作计算启发式奖励
    for (let a = 0; a < 9; a++) {
      let bonus = 0;
      
      // 威胁规避：远离威胁方向移动获得奖励
      const threatAvoidance = -actionVecs[a][0] * totalThreatX - actionVecs[a][1] * totalThreatY;
      bonus += 2.0 * threatAvoidance;
      
      // 边界避免：朝向中心移动获得奖励
      const centerX = (width / 2 - player.x) / width;
      const centerY = (height / 2 - player.y) / height;
      const edgeDistance = Math.min(
        Math.min(player.x, width - player.x),
        Math.min(player.y, height - player.y)
      );
      
      if (edgeDistance < 50) {
        const towardCenter = actionVecs[a][0] * centerX + actionVecs[a][1] * centerY;
        bonus += 1.5 * towardCenter;
      }
      
      // 停止惩罚
      if (a === 0) {
        bonus -= 1.0;
      }
      
      hBias[a] = bonus;
    }

    return hBias;
  }

  // 向后兼容方法：最近心形位置
  nearestHeart(px: number, py: number, pickups: any[], width: number, height: number) {
    let best: any = null;
    let bd = Infinity;

    for (const p of pickups) {
      if (p.type === 'heart') {
        const dx = p.x - px;
        const dy = p.y - py;
        const d = Math.hypot(dx, dy);
        if (d < bd) { 
          bd = d; 
          best = p; 
        }
      }
    }

    return best ? {
      p: best,
      dx: (best.x - px) / width,
      dy: (best.y - py) / height,
    } : { 
      p: null, 
      dx: 0, 
      dy: 0 
    };
  }

  // 向后兼容方法：重置权重
  resetWeights(): void {
    // 重新初始化所有网络层，匹配超大规模架构
    this.inputLayer = new NeuralLayer(200, 1024);
    this.hiddenLayer1 = new NeuralLayer(1024, 1536);
    this.hiddenLayer2 = new NeuralLayer(1536, 1024);
    this.hiddenLayer3 = new NeuralLayer(1024, 768);
    this.valueHead = new NeuralLayer(768, 1);
    this.policyHead = new NeuralLayer(768, 9);

    // 重置训练状态
    this.episodeCount = 0;
    this.experienceBuffer.clear();
    this.explorationRate = 0.3;
    this.averagePerformance = 0;
    this.bestPerformance = 0;
    
    console.log("🚀 AI权重已重置 - 超大规模架构: 200→1024→1536→1024→768→(1|9)");
    console.log("⚡ 支持所有敌人信息输入和基于距离的训练权重调整");
    console.log("🏃‍♂️ AI最大移动速度大幅提升至6.0 - 极速躲避追踪敌人");
    console.log("🧠 新增智能绕过敌人机制 - 侧向移动避免直线冲撞");
    console.log("🎯 增强威胁预测和安全路径计算");
  }

  // 向后兼容方法：获取训练指标
  getMetrics() {
    const bufferSize = this.experienceBuffer.size();
    const recentExperiences = bufferSize > 0 ? this.experienceBuffer.sample(Math.min(20, bufferSize)) : [];
    
    return {
      episodes: this.episodeCount,
      avgScore: this.averagePerformance,
      globalBestScore: this.bestPerformance,
      currentDifficulty: 1,
      epsilon: this.explorationRate,
      recentScores: recentExperiences.map(exp => exp.reward),
      avgReward: recentExperiences.length > 0 ? 
        recentExperiences.reduce((sum, exp) => sum + exp.reward, 0) / recentExperiences.length : 0,
      episodesAtCurrentDifficulty: this.episodeCount,
      avgSurvivalTime: this.averagePerformance * 0.1, // 估算生存时间
      maxSurvivalTime: this.bestPerformance * 0.1,
    };
  }

  // 向后兼容方法：加载存储的权重
  loadFromStorage(): boolean {
    try {
      const saved = localStorage.getItem('dodger_ai_weights');
      if (saved) {
        this.importWeights(saved);
        console.log("已从本地存储加载AI权重");
        return true;
      }
    } catch (error) {
      console.warn("无法从本地存储加载权重:", error);
    }
    return false;
  }

  // 从预设JSON文件加载权重
  async loadFromPresetFile(): Promise<boolean> {
    try {
      // 只尝试 public 目录下的路径，适配 vercel 部署
      const paths = [
        '/Dodger_AI_weights.json'
      ];
      
      let response = null;
      for (const path of paths) {
        try {
          const resp = await fetch(path);
          if (resp.ok) {
            response = resp;
            console.log(`找到权重文件: ${path}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个路径
        }
      }
      
      if (!response || !response.ok) {
        console.warn("无法加载预设权重文件，已尝试多个路径");
        return false;
      }
      
      const weightsData = await response.text();
      this.importWeights(weightsData);
      console.log("✅ 已从预设权重文件加载AI权重");
      return true;
    } catch (error) {
      console.warn("无法从预设权重文件加载权重:", error);
      return false;
    }
  }

  // 向后兼容方法：获取训练状态
  getTrainingState() {
    return {
      episodes: this.episodeCount,
      averagePerformance: this.averagePerformance,
      bestPerformance: this.bestPerformance,
      explorationRate: this.explorationRate,
      bufferSize: this.experienceBuffer.size()
    };
  }

  // 向后兼容方法：从回合数据训练
  trainFromEpisodes(episodes: Episode[]): void {
    for (const episode of episodes) {
      this.beginEpisode();
      for (const step of episode.steps) {
        // 将步骤转换为经验并添加到缓冲区
        const experience: Experience = {
          state: step.features,
          action: step.action,
          reward: step.reward,
          nextState: null,
          done: false,
          priority: Math.abs(step.reward)
        };
        this.experienceBuffer.add(experience);
      }
      this.endEpisode(episode.finalScore);
    }
    
    // 执行批量训练
    if (this.experienceBuffer.size() > 32) {
      this.train();
    }
  }
}

// 向后兼容类型别名
export type DodgerAI = AdvancedDodgerAI;

// 工厂函数
export function createAdvancedDodgerAI(): AdvancedDodgerAI {
  return new AdvancedDodgerAI();
}

// 创建推理AI实例（不进行训练）
export function createInferenceAI(): AdvancedDodgerAI {
  const ai = new AdvancedDodgerAI();
  // 尝试加载最佳权重
  const weightsList = ai.getWeightsList();
  if (weightsList.length > 0) {
    // 加载性能最好的权重
    const bestWeights = weightsList.reduce((best, current) => 
      current.performance > best.performance ? current : best
    );
    ai.loadSpecificWeights(bestWeights.id);
  }
  return ai;
}// 导出权重管理函数
export function downloadAIWeights(ai: AdvancedDodgerAI): void {
  const weights = ai.exportWeights();
  const blob = new Blob([weights], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-weights-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}