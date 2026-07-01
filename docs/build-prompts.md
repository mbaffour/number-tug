# Number Tug Build Prompts

Use these prompts to keep future iterations focused.

## Product Prompt

Build a same-device two-player arithmetic game called Number Tug. The game should feel like tug of war: two players answer the same math problem at the same time, and the fastest correct answer pulls a center marker toward their side. Wrong answers should create a small penalty. The game must work on iPad and phone touch screens with large buttons, readable math, and a layout two people can use at once.

## Game Rules Prompt

Create a 10-round tug-of-war arithmetic game with these modes: Add, Subtract, Multiply, Divide, Mixed. Create three difficulties: Easy, Medium, Hard. Difficulty should control number ranges, timer length, and pull strength. Each round shows one question with four answer choices. If Player 1 answers correctly first, pull left. If Player 2 answers correctly first, pull right. End the game when the rope reaches one side or after 10 rounds, then declare a winner by rope position or score.

## UI Prompt

Design a playful but clean web game interface with teal for Player 1 and coral for Player 2. Put a rope and pull marker in the center, scores and timer at the top, mode and difficulty controls at the bottom, and mirrored answer stations for each player. Buttons must be thumb-sized. On a phone in portrait orientation, rotate Player 2's answer station so two people can play from opposite ends of the device.

## Asset Prompt

Create a wide 16:10 illustrated game arena background for an arithmetic tug-of-war game. Use teal hills on the left, coral hills on the right, flags near both edges, warm paper texture, and an empty center where code-native UI can sit. Do not include text, numbers, characters, UI panels, or a rope.

## Engineering Prompt

Implement the game as a React and Vite app. Keep game state local in React. Generate arithmetic questions with integer answers and four unique answer choices. Use accessible buttons, `aria-live` feedback for game events, responsive CSS for tablets and phones, and a GitHub Pages deploy script using `gh-pages -d dist`.
