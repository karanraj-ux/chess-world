-> start

=== start ===
The era of standard chess has ended.
Here, kings rule with wealth and raw power.
+ [Show me] -> explain_tic_tac_toe

=== explain_tic_tac_toe ===
Align 3 pieces in a row (Tic-Tac-Toe style).
This unlocks your Sovereign Powers.
+ [Powers?] -> explain_powers

=== explain_powers ===
- ASSASSINATE an enemy instantly.
- BRIBE a piece to join your side.
- EDICT them to skip a turn.
+ [How do I afford it?] -> explain_economy

=== explain_economy ===
Capture pieces and survive turns to build wealth.
Use it to outmaneuver your rival. The throne awaits.
+ [Play Solo (Easy)] -> mode_solo_easy
+ [Play Solo (Hard)] -> mode_solo_hard
+ [Local Duel] -> mode_local

=== mode_solo_easy ===
# MODE: pve
# DIFF: easy
The AI is ready for a gentle spar.
-> END

=== mode_solo_hard ===
# MODE: pve
# DIFF: hard
The AI will show no mercy.
-> END

=== mode_local ===
# MODE: pvp
# DIFF: hard
A local duel. May the best strategist win.
-> END
