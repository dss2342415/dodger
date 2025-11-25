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
      className="w-full h-screen p-3 md:p-4 lg:p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 relative overflow-hidden"
    >
      {/* 动态背景效果 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-purple-900/20" />
      <div className="absolute inset-0 bg-grid-slate-700/25 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
      
      <div className="relative z-10 h-full flex flex-col">
        <div className="max-w-5xl mx-auto h-full flex flex-col w-full px-3 md:px-6">
          {/* 顶部栏 - 15% */}
          <div className="flex items-center justify-between overflow-visible relative mb-6" style={{ height: '15%' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-2xl">🔄</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  轮换模式
                </h1>
                <p className="text-sm text-slate-400 mt-1">人机轮换挑战</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-600 text-white hover:from-slate-600 hover:to-slate-500 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-slate-500/50"
            >
              <span className="flex items-center gap-2">
                <span>←</span>
                <span>返回主菜单</span>
              </span>
            </button>
          </div>
          
          {/* 游戏区域 - 60% */}
          <div className="mb-6" style={{ height: '60%' }}>
            <div className="h-full rounded-3xl overflow-hidden ring-2 ring-slate-600/30 shadow-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-slate-600/50 relative flex flex-col">
              {/* 增强的游戏状态栏 */}
              <div className="px-6 py-4 flex items-center gap-4 bg-gradient-to-r from-slate-800/90 to-slate-900/90 border-b border-slate-600/30">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                    currentPlayer === "human" 
                      ? "bg-gradient-to-br from-cyan-500 to-blue-600" 
                      : "bg-gradient-to-br from-purple-500 to-indigo-600"
                  }`}>
                    <span className="text-white font-bold text-lg">
                      {currentPlayer === "human" ? "👤" : "🤖"}
                    </span>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${
                      currentPlayer === "human" ? "text-cyan-300" : "text-purple-300"
                    }`}>
                      {currentPlayer === "human" ? "玩家回合" : "AI回合"}
                    </div>
                    <div className="text-sm text-slate-400">
                      用时: <span className="font-mono font-semibold text-amber-400">{currentTurnTime.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
                
                {canSwitch && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-300 text-sm font-semibold">可以轮换</span>
                  </div>
                )}
                
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                    <span className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                  </div>
                </div>
              </div>
              
              {/* 游戏画布区域 */}
              <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur">
                <div className="absolute inset-0 p-6 flex justify-center items-center">
                  <div className="relative">
                    <canvas ref={canvasRef} className="rounded-2xl shadow-2xl ring-2 ring-slate-600/20" style={{ display: 'block' }} />
                    {/* 画布装饰边框 */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-sm opacity-75" />
                  </div>
                </div>
                
                {/* 增强的游戏结束覆盖层 */}
                {gameOver && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-slate-600/50 rounded-3xl p-8 text-center shadow-2xl transform scale-105 ring-4 ring-blue-500/20">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <span className="text-3xl">🎯</span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        游戏结束
                      </h3>
                      <div className="space-y-3">
                        <div className="text-xl font-bold text-amber-300">
                          总用时: <span className="text-yellow-300 font-mono">{totalTime.toFixed(2)}</span> 秒
                        </div>
                        <div className="text-lg text-slate-300">
                          完成轮次: <span className="text-blue-300 font-semibold">{turnHistory.length}</span> 轮
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 控制面板区域 - 25% */}
          <div style={{ height: '25%', overflow: 'auto' }}>
            <div className="h-full rounded-3xl ring-2 ring-slate-600/30 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-600/50 p-4 shadow-2xl flex flex-col">
              {/* 控制按钮区域 */}
              <div className="space-y-3 mb-4">
                {!running ? (
                  <button
                    onClick={onStartGame}
                    className="w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-base flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">▶️</span>
                    <span>开始游戏</span>
                  </button>
                ) : gameOver ? (
                  <button
                    onClick={onStartGame}
                    className="w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold shadow-xl hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-base flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">🔄</span>
                    <span>重新开始</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={onStopGame}
                      className="w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-xl hover:from-red-600 hover:to-rose-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-base flex items-center justify-center gap-2"
                    >
                      <span className="text-xl">⏹️</span>
                      <span>结束游戏</span>
                    </button>
                    
                    {canSwitch && (
                      <button
                        onClick={onSwitchPlayer}
                        className="w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-base flex items-center justify-center gap-2 ring-2 ring-purple-400/20 animate-pulse"
                      >
                        <span className="text-xl">🔄</span>
                        <span>切换到{currentPlayer === "human" ? "AI" : "玩家"}</span>
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
                
                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50">
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
              
              {/* 游戏记录区域 */}
              <div className="flex-1 min-h-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                    <span className="text-sm">📋</span>
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                    游戏记录
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 border-2 border-slate-600/30 rounded-2xl p-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur max-h-32">
                  {turnHistory.length === 0 ? (
                    <div className="text-slate-400 italic text-sm p-3 text-center">暂无记录</div>
                  ) : (
                    <>
                      {/* 历史轮次 */}
                      {turnHistory.map((turn, index) => {
                        const cumulativeTime = turnHistory.slice(0, index + 1).reduce((sum, t) => sum + t.duration, 0);
                        return (
                          <div key={index} className="bg-gradient-to-r from-slate-700/40 to-slate-800/40 rounded-xl p-3 space-y-2 border border-slate-600/30 shadow-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-300 font-medium">第 {index + 1} 轮</span>
                              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                turn.qualified ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              }`}>
                                {turn.qualified ? "✓ 合格" : "✗ 未达标"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`font-semibold ${
                                turn.player === "human" ? "text-cyan-300" : "text-purple-300"
                              }`}>
                                {turn.player === "human" ? "👤 玩家" : "🤖 AI"}
                              </span>
                              <span className="text-amber-300 font-mono font-bold">{turn.duration.toFixed(1)}s</span>
                            </div>
                            <div className="text-sm text-slate-400">
                              累计时间: <span className="text-slate-300 font-mono">{cumulativeTime.toFixed(1)}s</span>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* 当前轮次 */}
                      {running && !gameOver && (
                        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-3 space-y-2 border-2 border-blue-400/30 shadow-lg animate-pulse">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-300 font-medium">第 {turnHistory.length + 1} 轮</span>
                            <span className="text-yellow-400 font-bold animate-bounce">⏳ 进行中</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`font-semibold ${
                              currentPlayer === "human" ? "text-cyan-300" : "text-purple-300"
                            }`}>
                              {currentPlayer === "human" ? "👤 玩家" : "🤖 AI"}
                            </span>
                            <span className="text-amber-300 font-mono font-bold">{currentTurnTime.toFixed(1)}s</span>
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
      </div>
    </div>
  );
}