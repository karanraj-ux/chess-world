import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Trophy, X, ShieldAlert, Target, Flame } from 'lucide-react';
import { useProfileStore } from '../store/profileStore';

interface ProfileViewProps {
  onClose: () => void;
}

export function ProfileView({ onClose }: ProfileViewProps) {
  const profile = useProfileStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.username);

  const handleSave = () => {
    if (editName.trim()) {
      profile.setUsername(editName.trim());
    }
    setIsEditing(false);
  };

  const winRate = profile.matchesPlayed > 0 
    ? Math.round((profile.wins / profile.matchesPlayed) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-stone-100/80 backdrop-blur-sm pointer-events-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <h2 className="text-lg font-bold text-stone-800 uppercase tracking-widest flex items-center gap-2">
            <User className="w-5 h-5 text-amber-500" /> Player Profile
          </h2>
          <button onClick={onClose} className="p-2 text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-stone-100 border-2 border-amber-500/30 flex items-center justify-center">
              <User className="w-8 h-8 text-amber-500/50" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-white border border-amber-500/50 rounded p-2 text-stone-800 outline-none"
                    maxLength={15}
                    autoFocus
                  />
                  <button onClick={handleSave} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded font-bold">
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between group">
                  <div>
                    <h3 className="text-2xl font-bold text-stone-800">{profile.username}</h3>
                    <p className="text-xs text-stone-500 font-mono">ID: {profile.userId}</p>
                  </div>
                  <button onClick={() => setIsEditing(true)} className="text-xs uppercase text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/80 border border-stone-200 rounded-xl p-4 flex flex-col items-center justify-center gap-1">
              <span className="text-xs uppercase tracking-widest text-stone-500">Matches</span>
              <span className="text-3xl font-mono text-stone-800">{profile.matchesPlayed}</span>
            </div>
            <div className="bg-white/80 border border-stone-200 rounded-xl p-4 flex flex-col items-center justify-center gap-1">
              <span className="text-xs uppercase tracking-widest text-stone-500">Win Rate</span>
              <span className="text-3xl font-mono text-stone-800">{winRate}%</span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 bg-stone-50 border border-green-500/20 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase text-green-500/50 font-bold mb-1">Wins</div>
              <div className="text-xl font-bold text-green-500">{profile.wins}</div>
            </div>
            <div className="flex-1 bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase text-stone-500 font-bold mb-1">Draws</div>
              <div className="text-xl font-bold text-stone-600">{profile.draws}</div>
            </div>
            <div className="flex-1 bg-stone-50 border border-red-500/20 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase text-red-500/50 font-bold mb-1">Losses</div>
              <div className="text-xl font-bold text-red-500">{profile.losses}</div>
            </div>
          </div>
          
          {/* Power Stats */}
          <div className="bg-white/80 border border-stone-200 rounded-xl p-4 mt-2">
            <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3 text-center">Dark Arts Usage</h4>
            <div className="grid grid-cols-5 gap-2">
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider mb-1">Bribe</span>
                 <span className="text-lg font-mono text-stone-800">{profile.powersUsed.bribe}</span>
              </div>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider mb-1">Kill</span>
                 <span className="text-lg font-mono text-stone-800">{profile.powersUsed.assassinate}</span>
              </div>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-blue-500/70 font-bold uppercase tracking-wider mb-1">Shield</span>
                 <span className="text-lg font-mono text-stone-800">{profile.powersUsed.protect}</span>
              </div>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-orange-500/70 font-bold uppercase tracking-wider mb-1">Bunker</span>
                 <span className="text-lg font-mono text-stone-800">{profile.powersUsed.bunker}</span>
              </div>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-fuchsia-500/70 font-bold uppercase tracking-wider mb-1">Bait</span>
                 <span className="text-lg font-mono text-stone-800">{profile.powersUsed.bait}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-xs uppercase text-stone-600 font-bold tracking-wider">Sovereign Rating</div>
                <div className="text-sm text-stone-500">Based on recent matches</div>
              </div>
            </div>
            <div className="text-2xl font-black text-amber-500 font-mono">
              {profile.elo}
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
