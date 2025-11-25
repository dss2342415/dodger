import React from "react";
import { TurnRecord, Player } from "../game/TurnBasedGameLogic";
import { GAME_CONFIG } from "../game/GameConstants";

interface TurnBasedGameUIProps {
  running: boolean;
  gameOver: boolean;
  currentPlayer: Player;
  currentTurnTime: number;
  finalTotalTime: number;
  turnHistory: TurnRecord[];
  hasCustomWeights: boolean;
  onBack: () => void;
  onStartGame: () => void;
  onStopGame: () => void;
  onSwitchPlayer: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  fileRef: React.RefObject<HTMLInputElement>;
  wrapperRef: React.RefObject<HTMLDivElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TurnBasedGameUI({
  running,
  gameOver,
  currentPlayer,
  currentTurnTime,
  finalTotalTime,
  turnHistory,
  hasCustomWeights,
  onBack,
  onStartGame,
  onStopGame,
  onSwitchPlayer,
  canvasRef,
  fileRef,
  wrapperRef,
  onFileChange,
}: TurnBasedGameUIProps) {
  const canSwitch = running && !gameOver && currentTurnTime >= GAME_CONFIG.TURNBASED_SWITCH_THRESHOLD;
  const totalTime = gameOver 
    ? (turnHistory.length > 0 
        ? turnHistory.reduce((sum, turn) => sum + turn.duration, 0)
        : finalTotalTime) 
    : 0;

  return (
    <div
      ref={wrapperRef}
      className="w-full h-screen geometric-bg text-slate-100 relative overflow-hidden"
    >
      <div className="absolute inset-0 geometric-shapes" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 h-full flex">
        {/* 游戏区域 - 占据大部分空间 */}
        <div className="flex-1 flex flex-col p-2">
          {/* 顶部简化状态栏 */}
          <div className="flex items-center gap-4 mb-2 h-8 flex-shrink-0">
            <div className="text-sm font-semibold text-slate-300">
              轮换模式
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={currentPlayer === "human" ? "text-cyan-300" : "text-blue-400"}>
                {currentPlayer === "human" ? "玩家" : "AI"}
              </span>
              <span className="text-slate-400">-</span>
              <span className="text-slate-200 font-mono">{currentTurnTime.toFixed(1)}s</span>
              {canSwitch && (
                <span className="text-green-400 text-xs font-medium ml-2">可切换</span>
              )}
            </div>
            <div className="flex-1" />
            <button
              onClick={onBack}
              className="px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-600 text-sm font-medium shadow transition-colors"
            >
              返回主菜单
            </button>
          </div>
          
          {/* 游戏画布 - 占据剩余空间 */}
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden ring-1 ring-slate-700/50 shadow-2xl relative">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur flex items-center justify-center p-4">
              <canvas ref={canvasRef} className="rounded shadow-lg" style={{ display: 'block' }} />
            </div>
            
            {/* 游戏结束覆盖层 */}
            {gameOver && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center">
                <div className="bg-slate-800 border border-slate-600 rounded-2xl p-8 text-center shadow-2xl">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-bold text-slate-200">END</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 text-slate-200">
                    游戏结束
                  </h3>
                  <div className="space-y-3">
                    <div className="text-xl font-bold text-slate-200">
                      总用时: <span className="text-white font-mono">{totalTime.toFixed(2)}</span> 秒
                    </div>
                    <div className="text-lg text-slate-300">
                      完成轮次: <span className="text-slate-200 font-semibold">{turnHistory.length}</span> 轮
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 右侧控制面板 - 固定宽度 */}
        <div className="w-64 p-2 flex flex-col gap-2">
          {/* 控制按钮区域 */}
          <div className="rounded-lg ring-1 ring-slate-800 bg-slate-950/60 shadow-lg p-4">
            <div className="space-y-3">
              {!running ? (
                <button
                  onClick={onStartGame}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow hover:from-green-600 hover:to-green-700 transition-colors"
                >
                  开始游戏
                </button>
              ) : gameOver ? (
                <button
                  onClick={onStartGame}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow hover:from-blue-600 hover:to-blue-700 transition-colors"
                >
                  重新开始
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={onStopGame}
                    className="w-full px-4 py-2 rounded-lg bg-rose-400 text-slate-900 font-semibold shadow hover:brightness-110 transition-colors"
                  >
                    结束游戏
                  </button>
                  
                  {canSwitch && (
                    <button
                      onClick={onSwitchPlayer}
                      className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-colors"
                    >
                      切换到{currentPlayer === "human" ? "AI" : "玩家"}
                    </button>
                  )}
                </div>
              )}
              
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={onFileChange}
              />
              
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-800 border border-slate-700">
                {hasCustomWeights ? (
                  <>
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-300 font-medium text-sm">AI权重已加载</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    <span className="text-amber-300 font-medium text-sm">使用默认权重</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* 游戏记录区域 */}
          <div className="flex-1 rounded-lg ring-1 ring-slate-800 bg-slate-950/60 shadow-lg p-4 min-h-0">
            <h3 className="text-lg font-bold text-slate-200 mb-3">游戏记录</h3>
            <div className="h-full overflow-y-auto space-y-2">
              {turnHistory.length === 0 ? (
                <div className="text-slate-400 italic text-sm p-3 text-center">暂无记录</div>
              ) : (
                <>
                  {/* 历史轮次 */}
                  {turnHistory.map((turn, index) => {
                    const cumulativeTime = turnHistory.slice(0, index + 1).reduce((sum, t) => sum + t.duration, 0);
                    return (
                      <div key={index} className="bg-slate-800 rounded p-3 space-y-2 border border-slate-700 shadow">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 font-medium">第 {index + 1} 轮</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            turn.qualified ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {turn.qualified ? "✓ 合格" : "✗ 未达标"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`font-semibold ${
                            turn.player === "human" ? "text-cyan-300" : "text-blue-400"
                          }`}>
                            {turn.player === "human" ? "玩家" : "AI"}
                          </span>
                          <span className="text-slate-200 font-mono font-bold">{turn.duration.toFixed(1)}s</span>
                        </div>
                        <div className="text-sm text-slate-400">
                          累计时间: <span className="text-slate-300 font-mono">{cumulativeTime.toFixed(1)}s</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 当前轮次 */}
                  {running && !gameOver && (
                    <div className="bg-slate-700/50 rounded p-3 space-y-2 border border-slate-600 shadow">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 font-medium">第 {turnHistory.length + 1} 轮</span>
                        <span className="text-yellow-400 font-bold">进行中</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${
                          currentPlayer === "human" ? "text-cyan-300" : "text-blue-400"
                        }`}>
                          {currentPlayer === "human" ? "玩家" : "AI"}
                        </span>
                        <span className="text-slate-200 font-mono font-bold">{currentTurnTime.toFixed(1)}s</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}