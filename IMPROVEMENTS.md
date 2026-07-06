# Improvements

This document summarizes the maintenance fixes and new features added to Number Tug.

## Fixes

- **Tightened the CPU effect dependencies** (`src/App.tsx`). The auto-play effect
  for the CPU depended on the whole `question` object, which gets a new identity
  every round. It now depends on the stable fields it actually reads
  (`question.answer` and `question.choices`), while keeping the existing
  `cpuAttemptedRound === round` guard that prevents the CPU from answering twice
  in one round.
- **Cleaned up module-level audio globals** (`src/App.tsx`). The shared
  `AudioContext` and the background-music `setInterval` were created at module
  scope and never released. Added a `closeAudio()` helper that clears the music
  loop and closes the `AudioContext`, and an unmount effect
  (`useEffect(() => closeAudio, [])`) so the interval is cleared and the audio
  context is closed when the app unmounts. `stopMusic()` already clears the
  interval; `closeAudio()` also releases the context.

## New features

Both features are additive, fully typed, and degrade gracefully (they no-op
where `window`/`localStorage` is unavailable and swallow storage errors such as
private-mode quota failures). Existing gameplay is unchanged.

- **Persistent personal bests (localStorage) with a scoreboard.** A small
  `Scoreboard` panel in the control dock shows the best Solo score
  (`X/10`) and the best answer streak achieved. Records are loaded once on
  mount, updated when a game ends, and persisted under the
  `number-tug:records` localStorage key. A **Reset** button clears them.
  - Storage helpers: `loadRecords()` / `saveRecords()` and the `Records` type.
  - State + wiring: `records` state, the game-over persistence effect, and the
    `Scoreboard` component (`resetRecords` handler + `.scoreboard*` styles in
    `src/App.css`).
- **Streak record tracking (solo "streak"/time-attack goal).** The game now
  tracks the peak streak reached during a run (`peakStreak`, updated in
  `answerQuestion`, reset in `startGame`) and persists the all-time best streak
  as `records.bestStreak`. This gives solo players a persistent target to beat
  across sessions without changing the core round loop.

## Notes / not done

- `node_modules` is not installed in this environment, so `tsc --noEmit` could
  not be run. Types were kept consistent with the existing codebase and the TSX
  was syntax-checked by transpilation. Run `npm install && npm run build`
  locally to confirm a clean type-check/build.
- A full separate "time attack" phase (a distinct countdown-only game mode) was
  intentionally not added, since it would require reworking the round loop and
  carries higher risk of breaking existing behavior. The streak-record feature
  above delivers the same "beat your best" value additively and safely.
