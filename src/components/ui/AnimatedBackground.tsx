import { useRef, useEffect } from 'react';

interface AnimatedBackgroundProps {
  className?: string;
  intensity?: number;
}

// 游戏中的颜色配置
const GAME_COLORS = {
  PLAYER: '#22d3ee',       // 青色 - 玩家
  PLAYER_AI: '#3c74ff',    // 亮蓝色 - AI玩家
  ENEMY_NORMAL: '#fb7185', // 橙红色 - 普通敌人  
  ENEMY_TRACKER: '#8b5cf6' // 紫色 - 追踪敌人
};

export function AnimatedBackground({ 
  className = '', 
  intensity = 1 
}: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    const animate = (currentTime: number) => {
      if (startTimeRef.current === 0) {
        startTimeRef.current = currentTime;
      }

      const elapsed = (currentTime - startTimeRef.current) / 1000;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Get canvas dimensions
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      // Draw animated balls with game colors
      drawAnimatedGameBalls(ctx, width, height, elapsed, intensity);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const drawAnimatedGameBalls = (ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number, intensity: number) => {
      // 青色球 - 大幅度全屏移动（玩家色彩）- 放大3倍
      ctx.globalAlpha = 0.25 * intensity;
      for (let i = 0; i < 4; i++) {
        const t = elapsed * 0.15 + i * 1.6;
        // 大范围移动，真正的全屏移动
        const x = (width * -0.15) + (width * 1.3) * ((Math.sin(t * 0.8 + i * 0.7) + 1) / 2);
        const y = (height * -0.15) + (height * 1.3) * ((Math.cos(t * 0.6 + i * 0.9) + 1) / 2);
        const size = (25 + Math.sin(t * 1.8) * 10) * 3; // 放大3倍
        
        // 绘制青色球
        ctx.fillStyle = GAME_COLORS.PLAYER; // 青色
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // 添加青色光晕效果
        ctx.globalAlpha = 0.08 * intensity;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2.5);
        gradient.addColorStop(0, GAME_COLORS.PLAYER + '80');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.25 * intensity;
      }
      
      // 橙红色球 - 小幅度移动（普通敌人色彩）- 放大3倍
      ctx.globalAlpha = 0.3 * intensity;
      for (let i = 0; i < 8; i++) {
        const t = elapsed * 0.5 + i * 0.8;
        // 小范围移动，在屏幕中心区域
        const centerX = width * (0.2 + (i % 3) * 0.3);
        const centerY = height * (0.2 + Math.floor(i / 3) * 0.3);
        const moveRange = Math.min(width, height) * 0.12;
        const x = centerX + moveRange * Math.sin(t * 1.2 + i * 1.5);
        const y = centerY + moveRange * Math.cos(t * 0.9 + i * 1.2);
        const size = (12 + Math.sin(t * 2.5 + i) * 5) * 3; // 放大3倍
        
        ctx.fillStyle = GAME_COLORS.ENEMY_NORMAL; // 橙红色
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // 添加橙色微光
        ctx.globalAlpha = 0.12 * intensity;
        ctx.fillStyle = GAME_COLORS.ENEMY_NORMAL + '60'; // 更透明
        ctx.beginPath();
        ctx.arc(x, y, size * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3 * intensity;
      }
      
      // 紫色球 - 小幅度移动（追踪敌人色彩）- 放大3倍
      ctx.globalAlpha = 0.28 * intensity;
      for (let i = 0; i < 6; i++) {
        const t = elapsed * 0.4 + i * 1.1;
        // 小范围移动，分布在屏幕各个区域
        const baseX = width * (0.15 + (i % 3) * 0.35);
        const baseY = height * (0.15 + Math.floor(i / 3) * 0.35);
        const moveRange = Math.min(width, height) * 0.1;
        const x = baseX + moveRange * Math.sin(t * 1.1 + i * 0.8);
        const y = baseY + moveRange * Math.cos(t * 0.8 + i * 1.3);
        const size = (15 + Math.sin(t * 2.2 + i) * 6) * 3; // 放大3倍
        
        ctx.fillStyle = GAME_COLORS.ENEMY_TRACKER; // 紫色
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // 添加紫色辉光
        ctx.globalAlpha = 0.10 * intensity;
        ctx.fillStyle = GAME_COLORS.ENEMY_TRACKER + '70'; // 更透明
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.28 * intensity;
      }
      
      // 额外的小尺寸装饰球 - 增强视觉层次 - 放大3倍
      ctx.globalAlpha = 0.15 * intensity;
      for (let i = 0; i < 12; i++) {
        const t = elapsed * 0.7 + i * 0.5;
        const x = width * (0.05 + 0.9 * ((Math.sin(t * 0.6 + i * 0.4) + 1) / 2));
        const y = height * (0.05 + 0.9 * ((Math.cos(t * 0.4 + i * 0.6) + 1) / 2));
        const size = (5 + Math.sin(t * 4) * 2) * 3; // 放大3倍
        
        // 随机选择三种颜色
        const colorIndex = Math.floor(t + i) % 3;
        const colors = [GAME_COLORS.PLAYER, GAME_COLORS.ENEMY_NORMAL, GAME_COLORS.ENEMY_TRACKER];
        
        ctx.fillStyle = colors[colorIndex];
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
    };

    // Initial setup
    resizeCanvas();
    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      resizeCanvas();
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ 
        mixBlendMode: 'multiply',
        zIndex: 1,
        backgroundColor: 'transparent'
      }}
    />
  );
}
