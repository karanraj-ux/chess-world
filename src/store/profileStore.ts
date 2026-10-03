import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProfileState {
  username: string;
  userId: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  elo: number;
  powersUsed: {
    bribe: number;
    assassinate: number;
    protect: number;
    bunker: number;
    bait: number;
    bounty: number;
  };
  setUsername: (name: string) => void;
  recordMatch: (result: 'win' | 'loss' | 'draw') => void;
  recordPowerUse: (power: keyof ProfileState['powersUsed']) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      username: `Player_${Math.floor(Math.random() * 10000)}`,
      userId: `usr_${generateId()}`,
      wins: 0,
      losses: 0,
      draws: 0,
      matchesPlayed: 0,
      elo: 1200,
      powersUsed: { bribe: 0, assassinate: 0, protect: 0, bunker: 0, bait: 0, bounty: 0 },
      setUsername: (name) => set({ username: name }),
      recordPowerUse: (power) => set((state) => ({
        powersUsed: { ...state.powersUsed, [power]: state.powersUsed[power] + 1 }
      })),
      recordMatch: (result) => set((state) => {
        let eloChange = 0;
        if (result === 'win') eloChange = 25;
        if (result === 'loss') eloChange = -20;
        
        return {
          matchesPlayed: state.matchesPlayed + 1,
          wins: state.wins + (result === 'win' ? 1 : 0),
          losses: state.losses + (result === 'loss' ? 1 : 0),
          draws: state.draws + (result === 'draw' ? 1 : 0),
          elo: Math.max(0, state.elo + eloChange),
        };
      }),
    }),
    {
      name: 'chess-profile-storage',
    }
  )
);
