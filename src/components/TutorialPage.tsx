import React, { useState } from "react";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { AnimatedBackground } from "./ui/AnimatedBackground";

interface TutorialPageProps {
  onComplete: () => void;
}

const tutorialPages = [
  {
    title: "Welcome to My AI Game Buddy",
    content: "This is an avoidance game that offers two different game modes: ⚔️ Me versus AI and 💪 Me with AI."
  },
  {
    title: "Game Element Explanation",
    content: "🔴 Red Enemy - Normal tracking enemy, will move directly towards the player\n🟣 Purple Enemy - Intelligent enemy, will predict the player's movement path\n🔵 Blue Circle - Player character, controlled by you or AI\n💖 Pink Heart - Item, collect to earn score rewards"
  },
  {
    title: "Game Instructions",
    content: "In the game, if the player is touched by an enemy, they will be attacked.\nTo avoid enemy attacks, players can control their character's movement using the arrow keys or WASD keys."
  },
  {
    title: "Game Modes",
    content: "D - You and the AI take turns playing, and the game only ends if you die within 5 seconds."
  },
  {
    title: "Game Mode ⚔️ Me versus AI",
    content: "In this mode, you and the AI play on the same field — each starting with 3 HP. \n Watch for randomly spawning items to heal up.\n You control the left side of the screen, while the AI handles the right."
  },
  {
    title: "Game Mode 💪 Me with AI",
    content: "In this mode, you can cooperate with the AI, and you both exist as players simultaneously. \n The player's initial health is only 1, and there are no items, so please act cautiously! \n However, as long as either party survives for more than 5 seconds, the other player can take control in this game."
  }
];

export function TutorialPage({ onComplete }: TutorialPageProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < tutorialPages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen geometric-bg">
      {/* 原有的几何图形背景 */}
      <div className="geometric-shapes" style={{ zIndex: 0 }}></div>
      
      {/* 动态球体效果层 - 与主界面一致 */}
      <AnimatedBackground className="opacity-100" intensity={2.0} />
      
      {/* 半透明覆盖层 - 与主界面一致 */}
      <div className="absolute inset-0 bg-black/20" style={{ zIndex: 2 }} />
      
      <div className="relative min-h-screen flex items-center justify-center p-4" style={{ zIndex: 10 }}>
        {/* 主要内容区域 */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4">
          {/* 页面指示器 */}
          <div className="flex justify-center mb-6">
            <div className="flex space-x-2">
              {tutorialPages.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentPage 
                      ? 'bg-purple-600 scale-110' 
                      : index < currentPage
                        ? 'bg-purple-400'
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="text-center mb-8 min-h-[200px] flex flex-col justify-center">
            <h1 className="text-xl mb-6 text-white font-bold">
              {tutorialPages[currentPage].title}
            </h1>
            <div className="text-lg text-white leading-relaxed">
              {currentPage === 0 ? (
                <>
                  This is an avoidance game that offers two different game modes: 
                  <br />
                  ⚔️ Me versus AI & 💪 Me with AI.
                  <br />
                  <br />
                </>
              ) : currentPage === 1 ? (
                <div className="text-left max-w-md mx-auto space-y-3">
                  <div>🔴 <span className="font-semibold text-red-500">Red Enemy</span> - A basic enemy that moves along a set path and is considered an attack when it touches the player.</div>
                  <div>🟣 <span className="font-semibold text-purple-500">Purple Enemy</span> - An advanced enemy that may track the player's movement path and is considered an attack when it touches the player.</div>
                  <div>🔵 <span className="font-semibold text-blue-500">Blue Circle</span> - The player character, controlled by you or the AI.</div>
                  <div>❤️ <span className="font-semibold text-red-500">Red Heart</span> - The player's health, which decreases when attacked by enemies. If health reaches zero, the game is over.</div>
                  <div>💚 <span className="font-semibold text-green-500">Green Heart</span> - A healing item that can restore the player's lost health when collected.</div>
                  <br />
                </div>
              ) : currentPage === 3 ? (
                <div className="flex flex-col items-center">
                  <img 
                    src="/menu.png" 
                    alt="Game Mode Interface" 
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-md mb-4"
                  />
                  <br />
                  <p className="text-lg text-white">
                    Game Modes: 
                    <br />
                    ⚔️ Me versus AI & 💪 Me with AI
                  </p>
                  <br />
                  <br />
                </div>
              ) : currentPage === 4 ? (
                <div className="flex flex-col items-center">
                  <img 
                    src="/player_vs_ai.png" 
                    alt="Player vs AI Mode" 
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-md mb-4"
                  />
                  <br />
                  <p className="text-lg text-white">
                    In this mode, you can compete against the AI
                    <br />
                    Initially both sides have 3 health points each.
                    <br / >
                    You can recover lost health through randomly appearing items
                    <br />
                    The left interface is controlled by you, the right interface is AI Player.
                  </p>
                  <br />
                  <br />
                </div>
              ) : currentPage === 5 ? (
                <div className="flex flex-col items-center">
                  <img 
                    src="/player_with_ai.png" 
                    alt="Cooperative Mode" 
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-md mb-4"
                  />
                  <br />
                  <p className="text-lg text-white">
                    In this mode, you can cooperate with the AI, both existing as players
                    <br />
                    Players start with only 1 health point and no items, so please act carefully!
                    <br />
                    As long as either side survives for more than 5 seconds, the other player can take control
                  </p>
                  <br />
                  <br />
                </div>
              ) : (
                <>
                  {tutorialPages[currentPage].content}
                  <br />
                  <br />
                </>
              )}
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex justify-between items-center">
            {/* 上一页按钮 */}
            <Button
              onClick={handlePrevious}
              disabled={currentPage === 0}
              variant="outline"
              className="flex items-center gap-2 px-6 py-3"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {/* Skip button */}
            <Button
              onClick={handleSkip}
              variant="ghost"
              className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white"
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </Button>

            {/* Next/Complete button */}
            <Button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {currentPage === tutorialPages.length - 1 ? (
                <>
                  Start Game
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          {/* 页面计数 */}
          <div className="text-center mt-6 text-sm text-white/70">
            {currentPage + 1} / {tutorialPages.length}
          </div>
        </div>

        {/* 装饰性的浮动元素 */}
        <div className="absolute top-20 left-10 w-16 h-16 bg-purple-400/20 rounded-full animate-bounce" />
        <div className="absolute bottom-20 right-10 w-20 h-20 bg-yellow-400/20 rounded-lg rotate-12 animate-pulse" />
        <div className="absolute top-1/2 left-5 w-8 h-8 bg-pink-400/30 rounded-full animate-pulse" />
        <div className="absolute top-1/4 right-20 w-12 h-12 bg-cyan-400/25 rotate-45 animate-bounce" />
      </div>
    </div>
  );
}