import { RefObject } from 'react';

export function createGameLoop(
  canvasRef: RefObject<HTMLCanvasElement>,
  updateCallback: (dt: number) => void,
  drawCallback: () => void,
  shouldContinue: () => boolean
) {
  let reqRef: number | null = null;
  let lastTsRef = 0;

  const loop = (ts: number) => {
    const dt = Math.min(0.05, (ts - lastTsRef) / 1000 || 0);
    lastTsRef = ts;
    
    if (shouldContinue()) {
      updateCallback(dt);
    }
    
    drawCallback();
    
    if (shouldContinue()) {
      reqRef = requestAnimationFrame(loop);
    }
  };

  const startLoop = () => {
    lastTsRef = performance.now();
    reqRef = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (reqRef) {
      cancelAnimationFrame(reqRef);
      reqRef = null;
    }
  };

  return { startLoop, stopLoop };
}

export function setupCanvasResize(
  wrapperRef: RefObject<HTMLDivElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  gameStateWidth: { current: number },
  gameStateHeight: { current: number },
  dpr: number,
  minWidth: number = 640,
  minHeight: number = 420,
  aspectRatio: number = 16/9
) {
  const handleResize = () => {
    const wrap = wrapperRef.current;
    const cvs = canvasRef.current;
    if (!wrap || !cvs) return;

    const rect = cvs.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    const currentAspectRatio = displayWidth / displayHeight;
    let gameWidth, gameHeight;

    if (currentAspectRatio > aspectRatio) {
      gameHeight = Math.max(minHeight, displayHeight);
      gameWidth = gameHeight * currentAspectRatio;
    } else {
      gameWidth = Math.max(minWidth, displayWidth);
      gameHeight = gameWidth / currentAspectRatio;
    }

    gameStateWidth.current = gameWidth;
    gameStateHeight.current = gameHeight;

    cvs.width = Math.floor(displayWidth * dpr);
    cvs.height = Math.floor(displayHeight * dpr);

    cvs.style.width = `${displayWidth}px`;
    cvs.style.height = `${displayHeight}px`;

    const ctx = cvs.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.scale(displayWidth / gameWidth, displayHeight / gameHeight);
    }
  };

  return handleResize;
}