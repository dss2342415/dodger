import { useRef, useEffect } from 'react';

/**
 * Custom hook for managing keyboard input
 */
export function useKeyboardInput() {
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
    
    return () => { 
      window.removeEventListener('keydown', onDown); 
      window.removeEventListener('keyup', onUp); 
    };
  }, []);
  
  return keysRef;
}

/**
 * Custom hook for device pixel ratio
 */
export function useDevicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

/**
 * Custom hook for managing game canvas references
 */
export function useGameCanvas() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  return {
    wrapperRef,
    canvasRef
  };
}

/**
 * Custom hook for managing game state
 */
export function useGameState<T>(initialState: T) {
  const stateRef = useRef<T>(initialState);
  
  const setState = (newState: T | ((prevState: T) => T)) => {
    if (typeof newState === 'function') {
      stateRef.current = (newState as (prevState: T) => T)(stateRef.current);
    } else {
      stateRef.current = newState;
    }
  };
  
  return [stateRef, setState] as const;
}