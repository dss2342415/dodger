import React, { useState } from "react";
import { TutorialPage } from "./components/TutorialPage";
import { MainMenu } from "./components/MainMenu";
import { PvAIGame } from "./components/PvAIGame";
import { TurnBasedGame } from "./components/TurnBasedGame";

type GameMode = 'tutorial' | 'menu' | 'pvai' | 'turnbased';

export default function App() {
  const [currentMode, setCurrentMode] = useState<GameMode>('tutorial');

  const handleTutorialComplete = () => {
    setCurrentMode('menu');
  };

  const handleSelectMode = (mode: 'pvai' | 'turnbased') => {
    setCurrentMode(mode);
  };

  const handleBack = () => {
    setCurrentMode('menu');
  };

  return (
    <div className="w-full min-h-screen">
      {currentMode === 'tutorial' && (
        <TutorialPage onComplete={handleTutorialComplete} />
      )}
      {currentMode === 'menu' && (
        <MainMenu onSelectMode={handleSelectMode} />
      )}
      {currentMode === 'pvai' && (
        <PvAIGame onBack={handleBack} />
      )}
      {currentMode === 'turnbased' && (
        <TurnBasedGame onBack={handleBack} />
      )}
    </div>
  );
}