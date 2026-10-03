import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { cn } from '../lib/utils';
import { AlertTriangle, Flame, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CompanionOverlay() {
  const { aiCommentary, isTilted, isAiThinking, currentView } = useGameStore();
  const [isVisible, setIsVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (currentView !== 'playing') {
      setIsVisible(false);
      return;
    }
    setIsVisible(true);
    setDisplayedText(aiCommentary);
  }, [aiCommentary, currentView]);

  if (!isVisible) return null;

  return (
    <div className="companion-dock">
      <AnimatePresence mode="wait">
        <motion.div
          key={aiCommentary + (isAiThinking ? "thinking" : "")}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "companion-inner p-1.5 sm:p-3 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] border backdrop-blur-md flex items-center gap-2 sm:gap-3 relative overflow-hidden",
            isTilted 
              ? "bg-red-950/90 border-red-800 shadow-[0_0_30px_rgba(220,38,38,0.3)]" 
              : "bg-white/90 backdrop-blur-md/90 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)]"
          )}
        >
          {isTilted && (
            <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
          )}
          
          <div className={cn(
            "companion-icon w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 border",
            isTilted ? "bg-red-900 border-red-500" : "bg-purple-900/50 border-purple-500/50"
          )}>
            {isTilted ? (
              <AlertTriangle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-500 animate-bounce" />
            ) : (
              <Bot className={cn("w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-400", isAiThinking && "animate-pulse")} />
            )}
          </div>
          
          <div className="companion-text flex-1 min-w-0 pt-0.5">
            <h3 className={cn(
              "companion-label text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 sm:mb-1", 
              isTilted ? "text-red-400" : "text-purple-400"
            )}>
              {isTilted ? "SYSTEM TILTED" : "Sovereign AI Companion"}
            </h3>
            <p className={cn(
              "text-xs sm:text-base font-medium leading-tight sm:leading-snug drop-shadow-sm truncate sm:whitespace-normal", 
              isTilted ? "text-red-100 font-bold" : "text-stone-800"
            )}>
              {isAiThinking ? (
                <span className="text-purple-300 animate-pulse">Calculating your demise...</span>
              ) : (
                `"${displayedText}"`
              )}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
