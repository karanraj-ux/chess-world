import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Play, Swords, User, ShieldAlert, GraduationCap, Sparkles } from 'lucide-react';
import { ProfileView } from './ProfileView';

interface MainMenuProps {
  onSelect: (action: 'play_classic' | 'play_troublemaker' | 'play_local' | 'play_multiplayer' | 'tutorial' | 'about') => void;
}

export function MainMenu({ onSelect }: MainMenuProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showSovereignSubMenu, setShowSovereignSubMenu] = useState(false);
  const [showClassicSubMenu, setShowClassicSubMenu] = useState(false);

  const tileVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8 bg-stone-50 text-stone-800 overflow-y-auto overflow-x-hidden font-sans pointer-events-auto">
      
      {/* Background Soft Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-100/50 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-stone-200/50 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-5xl z-10 flex flex-col gap-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          className="flex justify-between items-end px-2"
        >
          <div>
            <h1 className="text-4xl sm:text-6xl font-serif text-stone-900 tracking-tight leading-none mb-2">
              Sovereign.
            </h1>
            <p className="text-stone-500 font-medium tracking-widest uppercase text-xs sm:text-sm">
              Chess, Wealth, & Chaos
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onSelect('tutorial')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 font-bold uppercase tracking-wider text-xs backdrop-blur-md transition-all"
            >
              <GraduationCap className="w-4 h-4 text-amber-600" /> Tutorial
            </button>
            <button 
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/60 hover:bg-white border border-stone-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] text-stone-700 font-bold uppercase tracking-wider text-xs backdrop-blur-md"
            >
              <User className="w-4 h-4" /> Profile
            </button>
          </div>
        </motion.div>

        {/* Bento Box Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 sm:gap-6 md:h-[60vh] md:min-h-[400px]"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          animate="visible"
        >
          {/* Sovereign Mode Tile (Large) */}
          <motion.div 
            variants={tileVariants}
            className="md:col-span-2 md:row-span-2 relative group rounded-[2rem] overflow-hidden bg-white/40 border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-transform hover:scale-[1.01] flex flex-col justify-end p-8 sm:p-10 cursor-pointer"
            onClick={() => setShowSovereignSubMenu(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-orange-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <AnimatePresence mode="wait">
              {!showSovereignSubMenu ? (
                <motion.div key="sovereign-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 flex flex-col items-start h-full justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
                    <Crown className="w-8 h-8 text-orange-900" />
                  </div>
                  <div>
                    <h2 className="text-3xl sm:text-5xl font-serif text-stone-900 mb-2">Sovereign Mode</h2>
                    <p className="text-stone-500 text-lg max-w-sm">Bribe guards. Assassinate Knights. Trap the Queen. Checkmate the King.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="sovereign-sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full h-full flex flex-col justify-center gap-3">
                  <h3 className="text-2xl font-serif text-stone-900 mb-2">Choose Your Path</h3>
                  <button onClick={(e) => { e.stopPropagation(); onSelect('play_troublemaker'); }} className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-bold uppercase tracking-wider transition-colors shadow-xl">
                    Play vs AI
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSelect('play_multiplayer'); }} className="w-full py-3.5 bg-white hover:bg-stone-50 text-stone-900 rounded-2xl font-bold uppercase tracking-wider transition-colors shadow-sm border border-stone-200">
                    Online Multiplayer
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSelect('tutorial'); }} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-2xl font-bold uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" /> Sovereign Academy (Tutorial)
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowSovereignSubMenu(false); }} className="w-full py-2 text-stone-400 hover:text-stone-600 font-bold uppercase tracking-wider transition-colors">
                    Back
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Classic Mode Tile */}
          <motion.div 
            variants={tileVariants}
            className="relative group rounded-[2rem] overflow-hidden bg-white/60 border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:scale-[1.02] flex flex-col justify-center p-6 sm:p-8 cursor-pointer"
            onClick={() => setShowClassicSubMenu(true)}
          >
            <AnimatePresence mode="wait">
              {!showClassicSubMenu ? (
                <motion.div key="classic-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center mb-4">
                    <ShieldAlert className="w-6 h-6 text-stone-700" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-serif text-stone-900 mb-2">Classic Chess</h2>
                  <p className="text-stone-500 text-sm">No powers. Just pain.</p>
                </motion.div>
              ) : (
                <motion.div key="classic-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full flex flex-col gap-3">
                  <button onClick={(e) => { e.stopPropagation(); onSelect('play_classic'); }} className="w-full py-3 bg-stone-800 text-white rounded-xl font-bold uppercase tracking-wider text-sm">Vs AI</button>
                  <button onClick={(e) => { e.stopPropagation(); onSelect('play_multiplayer'); }} className="w-full py-3 bg-white text-stone-800 border border-stone-200 rounded-xl font-bold uppercase tracking-wider text-sm">Online</button>
                  <button onClick={(e) => { e.stopPropagation(); setShowClassicSubMenu(false); }} className="w-full py-2 text-stone-400 text-sm font-bold uppercase mt-1">Back</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Local Duel Tile */}
          <motion.div 
            variants={tileVariants}
            className="relative group rounded-[2rem] overflow-hidden bg-white/60 border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:scale-[1.02] flex flex-col justify-center p-6 sm:p-8 cursor-pointer"
            onClick={() => onSelect('play_local')}
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center mb-4">
                <Swords className="w-6 h-6 text-stone-700" />
              </div>
              <h2 className="text-xl sm:text-2xl font-serif text-stone-900 mb-2">Local Duel</h2>
              <p className="text-stone-500 text-sm">Pass & play.</p>
            </div>
          </motion.div>
          
        </motion.div>
      </div>

      <AnimatePresence>
        {showProfile && <ProfileView onClose={() => setShowProfile(false)} />}
      </AnimatePresence>
    </div>
  );
}
