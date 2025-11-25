// Game constants and configuration
export const GAME_CONFIG = {
  PLAYER_RADIUS: 12,
  PLAYER_SPEED: 300,
  MAX_LIVES: 3,
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 675,
  ASPECT_RATIO: 16/9, // 网页友好的比例
  
  // Turn-based specific
  TURNBASED_LIVES: 1,
  TURNBASED_SWITCH_THRESHOLD: 5.0,
  HIT_IFRAMES_DURATION: 1.2,
  AI_DECISION_FREQUENCY: 0.015, // 从0.02进一步降低到0.015，极大提高AI反应速度
  
  CANVAS: {
    MIN_WIDTH: 640,
    MIN_HEIGHT: 420,
    ASPECT_RATIO: 16/9
  },
  SPAWN: {
    COOLDOWN_NORMAL: 0.25,
    COOLDOWN_EARLY: 0.15,
    PICKUP_COOLDOWN_BASE: 3.0,
    PICKUP_COOLDOWN_RANDOM: 2.2
  },
  VISUAL: {
    GRID_SIZE: 40,
    HEART_SIZE: 12,
    LIVES_HEART_SIZE: 10,
    LIVES_GAP: 22,
    PADDING: 12
  },
  COLORS: {
    PLAYER_HUMAN: '#22d3ee',    // 玩家颜色（青色）
    PLAYER_AI: '#3c74ff',       // AI玩家颜色（亮蓝色）
    PLAYER_AI_GREEN: '#3c74ff',  // 统一AI颜色为亮蓝色
    PICKUP: '#22c55e',
    ENEMY_NORMAL: '#fb7185',
    ENEMY_TRACKER: '#8b5cf6',
    LIFE_HEART: '#f43f5e',
    TEXT: '#e2e8f0',
    DANGER_ZONE: '#ef4444'
  }
};

export const ENEMY_TYPES = {
  NORMAL: 'normal',
  SPRINTER: 'sprinter', 
  HEAVY: 'heavy',
  ZIGZAG: 'zigzag',
  TRACKER: 'tracker'
} as const;

export const COLORS = {
  BACKGROUND: {
    START: '#0b1220',
    END: '#0a0f1a'
  },
  GRID: '#64748b',
  PLAYER: '#22d3ee',        // 玩家颜色（青色）
  PLAYER_AI: '#3c74ff',     // AI玩家颜色（亮蓝色）
  PICKUP: '#22c55e',
  ENEMY_NORMAL: '#fb7185',
  ENEMY_TRACKER: '#8b5cf6',
  LIFE_HEART: '#f43f5e',
  TEXT: '#e2e8f0',
  DANGER_ZONE: '#ef4444'
};