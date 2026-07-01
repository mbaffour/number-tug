# Number Tug

Number Tug is a same-device, two-player arithmetic tug-of-war game. Each player gets mirrored answer buttons, and the first correct answer pulls the rope toward their side. Wrong answers nudge the rope away.

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
