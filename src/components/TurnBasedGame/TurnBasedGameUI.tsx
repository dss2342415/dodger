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
    <div ref={wrapperRef} className="w-full h-screen p-1 md:p-2 geometric-bg text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 geometric-shapes" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 h-full flex flex-col">
        <div className="max-w-7xl mx-auto h-full flex flex-col w-full px-4 md:px-8">
          {/* 顶部按钮区域 */}
          <div className="flex items-center justify-end overflow-visible relative pr-8" style={{ height: '12%' }}>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-lg font-semibold shadow transition-colors"
            >
              Back to Menu
            </button>
          </div>

          {/* 游戏区域 - 扩大游戏界面，触碰容器边界，圆角设计 */}
          <div className="flex justify-center items-center px-4 md:px-8" style={{ height: '58%' }}>
            <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 flex items-center gap-4 bg-slate-900/50 border-b border-slate-800 flex-shrink-0">
                <span className="text-lg font-bold text-cyan-300">
                  {currentPlayer === "human" ? "Player Turn" : "AI Turn"}
                </span>
                <div className="ml-auto flex gap-1.5 opacity-90">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                </div>
              </div>
              <div className="flex-1 relative bg-slate-950/60 backdrop-blur ring-1 ring-slate-800 min-h-0">
                <div className="absolute inset-0 p-3 flex justify-center items-center">
                  <canvas 
                    ref={canvasRef} 
                    className="rounded-xl shadow-2xl ring-2 ring-slate-700/30" 
                    style={{ 
                      display: 'block',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto'
                    }} 
                  />
                </div>
                
                {/* 游戏结束覆盖层 */}
                {gameOver && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 text-center shadow-2xl">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700 flex items-center justify-center shadow-lg">
                        <span className="text-lg font-bold text-slate-200">END</span>
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-slate-200">
                        Game Over
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="text-lg font-bold text-slate-200">
                          Total Time: <span className="text-white font-mono">{totalTime.toFixed(2)}</span> seconds
                        </div>
                        <div className="text-slate-300">
                          Completed Turns: <span className="text-slate-200 font-semibold">{turnHistory.length}</span> rounds
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 间隙区域 */}
          <div style={{ height: '3%' }}></div>

          {/* 控制信息区 - 调整高度以适应新布局，圆角设计 */}
          <div className="rounded-2xl ring-1 ring-slate-800 bg-slate-950/60 shadow-2xl mx-4 md:mx-8" style={{ height: '27%', overflow: 'auto' }}>
            <div className="h-full flex flex-col gap-4 p-8">
              {/* 控制按钮和状态 */}
              <div className="flex flex-wrap items-center justify-between gap-3 transform scale-40 -mt-8">
                <div className="flex gap-2">
                  {!running ? (
                    <button onClick={onStartGame} className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow hover:from-green-600 hover:to-green-700 transition-colors text-lg">
                      Start Game
                    </button>
                  ) : (
                    gameOver ? (
                      <button onClick={onStartGame} className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow hover:from-blue-600 hover:to-blue-700 transition-colors text-lg">
                        Restart Game
                      </button>
                    ) : (
                      <button onClick={onStopGame} className="px-6 py-3 rounded-lg bg-rose-400 text-slate-900 font-semibold shadow hover:brightness-110 transition-colors text-lg">
                        End Game
                      </button>
                    )
                  )}
                  
                  {canSwitch && (
                    <button
                      onClick={onSwitchPlayer}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold shadow hover:from-indigo-600 hover:to-indigo-700 transition-colors text-lg"
                    >
                      Switch to {currentPlayer === "human" ? "AI" : "Player"}
                    </button>
                  )}
                </div>
                
                {/* 游戏状态显示 */}
                <div className="flex items-center gap-4 text-sm">
                  {gameOver ? (
                    <div className="text-green-400 font-semibold">
                      Game Over - Total Time: {totalTime.toFixed(1)}s
                    </div>
                  ) : running ? (
                    <>
                      <div className="text-cyan-300 font-semibold">
                        Current: {currentPlayer === "human" ? "Player Turn" : "AI Turn"}
                      </div>
                      <div className="text-orange-400 font-bold">
                        Time: {currentTurnTime.toFixed(1)}s
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400">
                      Click Start Game
                    </div>
                  )}
                </div>
              </div>

              {/* 游戏信息面板 - 显示当前状态和每轮玩家信息 */}
              <div className="transform scale-90 -mt-6">
                {/* 当前游戏状态 */}
                <div className="bg-slate-800/50 rounded-2xl p-4 shadow-lg mb-4">
                  <h3 className="text-base font-semibold text-slate-300 mb-3 text-center">Current Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {/* Current Player */}
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Current Player</div>
                      <div className={`font-semibold text-lg ${
                        currentPlayer === "human" ? "text-cyan-400" : "text-blue-400"
                      }`}>
                        {currentPlayer === "human" ? "Player" : "AI"}
                      </div>
                    </div>
                    
                    {/* Current Turn Time */}
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Turn Time</div>
                      <div className="text-orange-400 font-semibold text-lg font-mono">
                        {currentTurnTime.toFixed(1)}s
                      </div>
                    </div>
                    
                    {/* Total Time */}
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Total Time</div>
                      <div className="text-green-400 font-semibold text-lg font-mono">
                        {running && !gameOver ? (
                          // Game in progress: history time + current turn time
                          turnHistory.length > 0 
                            ? (turnHistory.reduce((sum, turn) => sum + turn.duration, 0) + currentTurnTime).toFixed(1)
                            : currentTurnTime.toFixed(1)
                        ) : gameOver ? (
                          // Game over: use final total time
                          totalTime.toFixed(1)
                        ) : (
                          // Game not started
                          "0.0"
                        )}s
                      </div>
                    </div>
                  </div>
                </div>

                {/* Turn History Records */}
                <div className="bg-slate-800/30 rounded-2xl p-4 shadow-lg">
                  <h3 className="text-base font-semibold text-slate-300 mb-3 text-center">Turn History</h3>
                  <div className="max-h-32 overflow-y-auto">
                    {turnHistory.length === 0 && !running ? (
                      <div className="text-slate-500 text-center py-2 text-sm">No records yet</div>
                    ) : (
                      <div className="space-y-2">
                        {/* Completed turns */}
                        {turnHistory.map((turn, index) => {
                          const cumulativeTime = turnHistory.slice(0, index + 1).reduce((sum, t) => sum + t.duration, 0);
                          return (
                            <div key={index} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2 text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-slate-400 font-mono text-xs">Turn {index + 1}</span>
                                <span className={`font-semibold ${
                                  turn.player === "human" ? "text-cyan-400" : "text-blue-400"
                                }`}>
                                  {turn.player === "human" ? "Player" : "AI"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-orange-400 font-mono">
                                  {turn.duration.toFixed(1)}s
                                </span>
                                <span className="text-green-400 font-mono">
                                  Total: {cumulativeTime.toFixed(1)}s
                                </span>
                                <span className={`${turn.qualified ? "text-green-400" : "text-red-400"}`}>
                                  {turn.qualified ? "✓" : "✗"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Current turn in progress */}
                        {running && !gameOver && (
                          <div className="flex items-center justify-between bg-slate-600/50 rounded-lg px-3 py-2 text-sm border border-slate-500/30">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-300 font-mono text-xs">Turn {turnHistory.length + 1}</span>
                              <span className={`font-semibold ${
                                currentPlayer === "human" ? "text-cyan-400" : "text-blue-400"
                              }`}>
                                {currentPlayer === "human" ? "Player" : "AI"}
                              </span>
                              <span className="text-yellow-400 text-xs animate-pulse">In Progress</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-orange-400 font-mono">
                                {currentTurnTime.toFixed(1)}s
                              </span>
                              <span className="text-green-400 font-mono">
                                Total: {turnHistory.length > 0 
                                  ? (turnHistory.reduce((sum, turn) => sum + turn.duration, 0) + currentTurnTime).toFixed(1)
                                  : currentTurnTime.toFixed(1)}s
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 隐藏的文件输入 */}
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}