# Number Tug

Number Tug is a same-device arithmetic tug-of-war game. Players race through arithmetic questions, and the quickest correct answer pulls the rope toward their side. Wrong answers and timeouts nudge the rope away.

## Ways To Play

- Solo: one player clears ten questions against the rope.
- Two Players: both players can click/tap their answer side, or share one keyboard.
- Vs CPU: Player 1 answers while the computer controls Player 2.

## Computer Controls

- Player 1 uses `A`, `S`, `D`, `F` for the four answer buttons on the left.
- Player 2 uses `J`, `K`, `L`, `;` for the four answer buttons on the right.
- In Solo mode, Player 1 uses `A`, `S`, `D`, `F`.
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
- Sound effects and match music can be toggled separately.
- The Test button unlocks and checks sound/haptic feedback before a game starts.
- Haptics use the browser Vibration API when the device supports it. Many desktop browsers and iOS/iPadOS browsers do not expose vibration, so the game falls back to visual and sound feedback.

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
