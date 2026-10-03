export function generateBark(action: string, details: string): string {
  const isWhite = details.toLowerCase().includes('white') || details.toLowerCase().startsWith('w ');
  const player = isWhite ? 'White' : 'Black';
  
  if (action === "Bribe") {
    const barks = [
      `${player} bought an enemy piece! Money talks.`,
      `A sneaky bribe! ${player} stole a piece.`,
      `Ouch! ${player} just used dirty money to take a piece.`,
    ];
    return barks[Math.floor(Math.random() * barks.length)];
  }

  if (action === "Assassination") {
    const barks = [
      `Boom! ${player} assassinated a piece.`,
      `Target eliminated by ${player}. Pure ruthlessness!`,
      `No mercy! ${player} took out a piece instantly.`,
    ];
    return barks[Math.floor(Math.random() * barks.length)];
  }

  if (action === "Syndicate Edict") {
    const barks = [
      `3-in-a-row! ${player} completed a Tic-Tac-Toe line for massive points!`,
      `Tic-Tac-Toe! ${player} gets a huge +100 bonus!`,
      `Wow! ${player} lined up 3 pieces in the center!`,
    ];
    return barks[Math.floor(Math.random() * barks.length)];
  }

  if (action === "Tampering Detected") {
    const barks = [
      "Wait, what just happened? My calculations are off...",
      "Who touched the board?! This is rigged!",
      "A glitch in the matrix... someone is cheating.",
      "I swear that piece wasn't there a second ago. Unfair!",
      "Are you messing with the pieces while I'm frozen? Disgusting."
    ];
    return barks[Math.floor(Math.random() * barks.length)];
  }

  if (action === "Standard Move" && details.includes("capturing")) {
    const barks = [
      `Nice capture by ${player}!`,
      `${player} takes out an enemy!`,
      `A clean hit by ${player}.`,
    ];
    return barks[Math.floor(Math.random() * barks.length)];
  }

  if (action === "Standard Move") {
    const barks = [
      `${player} moves quietly...`,
      `A strategic step by ${player}.`,
      `${player} is planning something...`,
      `Good move by ${player}.`,
    ];
    return barks[Math.floor(Math.random() * barks.length)];
  }

  return "The game continues...";
}
