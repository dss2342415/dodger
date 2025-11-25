import React from 'react';
import { AnimatedBackground } from './ui/AnimatedBackground';

interface MainMenuProps {
  onSelectMode: (mode: 'pvai' | 'turnbased') => void;
}

export function MainMenu({ onSelectMode }: MainMenuProps) {
  return (
    <div className="w-full h-screen relative overflow-hidden text-slate-100 geometric-bg flex items-center justify-center">
      {/* 原有的几何图形背景 */}
      <div className="absolute inset-0 geometric-shapes" style={{ zIndex: 0 }} />
      
      {/* 动态球体效果层 */}
      <AnimatedBackground className="opacity-100" intensity={2.0} />
      
      {/* 原有的半透明覆盖层 */}
      <div className="absolute inset-0 bg-black/20" style={{ zIndex: 2 }} />

      <div className="relative w-full" style={{ zIndex: 10 }}>
        <div className="max-w-6xl mx-auto p-8 text-center">
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 mb-6">
              my AI game buddy
            </h1>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* 人机对战 */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-purple-400/50">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-pink-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-100">⚔️ Me versus AI</h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  The screen is split left and right, showing both your gameplay and the AI’s simultaneously!
                </p>
                <button
                  onClick={() => onSelectMode('pvai')}
                  className="w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:brightness-110"
                >
                  Challenge the AI
                </button>
              </div>
            </div>

            {/* 轮换模式 */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-orange-400/50">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-red-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-100">💪 Me with AI</h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  The player and the trained AI take turns playing, doing their best to survive!
                </p>
                <button
                  onClick={() => onSelectMode('turnbased')}
                  className="w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:brightness-110"
                >
                  collabotate with AI
                </button>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}