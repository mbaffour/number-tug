# Number Tug

Number Tug is a same-device, two-player arithmetic tug-of-war game. Each player gets mirrored answer buttons, and the first correct answer pulls the rope toward their side. Wrong answers nudge the rope away.

## Ways To Play

- Two Players: both players can click/tap their answer side, or share one keyboard.
- Vs CPU: Player 1 answers while the computer controls Player 2.

## Computer Controls

- Player 1 uses `A`, `S`, `D`, `F` for the four answer buttons on the left.
- Player 2 uses `J`, `K`, `L`, `;` for the four answer buttons on the right.
- In Vs CPU mode, Player 1 still uses `A`, `S`, `D`, `F`; the CPU answers automatically.

## Modes

- Add
- Subtract
- Multiply
- Divide
- Mixed

## Difficulties

- Easy: slower timer, smaller numbers
- Medium: quicker timer, larger numbers
- Hard: fast timer, larger ranges, stronger pulls

## Fun Features

- Players can choose their names and face avatars before the match starts.
- Fast correct answers pull harder.
- Back-to-back correct answers build a streak bonus.
- Sound effects can be toggled on or off.
- Haptics use the browser Vibration API when the device supports it, with visual and sound feedback as the fallback.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Host on GitHub Pages

1. Create a GitHub repository for this folder.
2. Push the code to GitHub.
3. Run:

```bash
npm run deploy
```

The app uses `base: './'` in `vite.config.ts`, so built assets work from a GitHub Pages project URL.

## Build Prompts

The prompts that shaped this version live in `docs/build-prompts.md`.

## Research Notes

The game-feel notes behind the latest version live in `docs/fun-game-patterns.md`.
