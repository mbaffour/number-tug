import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'mixed'
type Difficulty = 'easy' | 'medium' | 'hard'
type PlayerId = 'one' | 'two'
type Phase = 'setup' | 'playing' | 'gameOver'

type Question = {
  prompt: string
  answer: number
  choices: number[]
  operation: Exclude<Operation, 'mixed'>
}

type Feedback = {
  player: PlayerId
  kind: 'correct' | 'wrong'
  text: string
}

const operations: Array<{ id: Operation; label: string }> = [
  { id: 'add', label: 'Add' },
  { id: 'subtract', label: 'Subtract' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'divide', label: 'Divide' },
  { id: 'mixed', label: 'Mixed' },
]

const difficulties: Array<{ id: Difficulty; label: string }> = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
]

const settings = {
  easy: { max: 12, multiplyMax: 6, seconds: 18, pull: 16 },
  medium: { max: 30, multiplyMax: 10, seconds: 14, pull: 20 },
  hard: { max: 99, multiplyMax: 12, seconds: 10, pull: 24 },
} satisfies Record<
  Difficulty,
  { max: number; multiplyMax: number; seconds: number; pull: number }
>

const totalRounds = 10
const ropeLimit = 100

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function chooseOperation(mode: Operation): Exclude<Operation, 'mixed'> {
  if (mode !== 'mixed') return mode
  return shuffle(['add', 'subtract', 'multiply', 'divide'] as const)[0]
}

function makeChoices(answer: number, difficulty: Difficulty) {
  const spread = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 18
  const choices = new Set<number>([answer])

  while (choices.size < 4) {
    const offset = randomInt(1, spread) * (Math.random() > 0.5 ? 1 : -1)
    choices.add(Math.max(0, answer + offset))
  }

  return shuffle([...choices])
}

function makeQuestion(mode: Operation, difficulty: Difficulty): Question {
  const level = settings[difficulty]
  const operation = chooseOperation(mode)
  let a = randomInt(1, level.max)
  let b = randomInt(1, level.max)
  let answer = 0
  let prompt = ''

  if (operation === 'add') {
    answer = a + b
    prompt = `${a} + ${b}`
  }

  if (operation === 'subtract') {
    if (b > a) [a, b] = [b, a]
    answer = a - b
    prompt = `${a} - ${b}`
  }

  if (operation === 'multiply') {
    a = randomInt(2, level.multiplyMax)
    b = randomInt(2, level.multiplyMax)
    answer = a * b
    prompt = `${a} × ${b}`
  }

  if (operation === 'divide') {
    b = randomInt(2, level.multiplyMax)
    answer = randomInt(2, level.multiplyMax)
    a = b * answer
    prompt = `${a} ÷ ${b}`
  }

  return {
    prompt,
    answer,
    choices: makeChoices(answer, difficulty),
    operation,
  }
}

function clampPull(value: number) {
  return Math.max(-ropeLimit, Math.min(ropeLimit, value))
}

function playerName(player: PlayerId) {
  return player === 'one' ? 'Player 1' : 'Player 2'
}

function App() {
  const [mode, setMode] = useState<Operation>('add')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [phase, setPhase] = useState<Phase>('setup')
  const [round, setRound] = useState(1)
  const [scores, setScores] = useState({ one: 0, two: 0 })
  const [pull, setPull] = useState(0)
  const [question, setQuestion] = useState(() => makeQuestion(mode, difficulty))
  const [secondsLeft, setSecondsLeft] = useState(settings[difficulty].seconds)
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now())
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [roundResolved, setRoundResolved] = useState(false)

  const winner = useMemo(() => {
    if (pull <= -ropeLimit) return 'Player 1 wins by rope pull'
    if (pull >= ropeLimit) return 'Player 2 wins by rope pull'
    if (scores.one > scores.two) return 'Player 1 wins by score'
    if (scores.two > scores.one) return 'Player 2 wins by score'
    return 'Tie game'
  }, [pull, scores])

  const advanceRound = useCallback(
    (message?: string) => {
      if (message) {
        setFeedback({ player: 'one', kind: 'wrong', text: message })
      }

      setRound((currentRound) => {
        if (currentRound >= totalRounds) {
          setPhase('gameOver')
          return currentRound
        }

        setQuestion(makeQuestion(mode, difficulty))
        setSecondsLeft(settings[difficulty].seconds)
        setQuestionStartedAt(Date.now())
        setRoundResolved(false)
        return currentRound + 1
      })
    },
    [difficulty, mode],
  )

  useEffect(() => {
    if (phase !== 'playing') return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1
        advanceRound('Time ran out. New pull.')
        return settings[difficulty].seconds
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [advanceRound, difficulty, phase])

  useEffect(() => {
    if (phase === 'setup') {
      setQuestion(makeQuestion(mode, difficulty))
      setSecondsLeft(settings[difficulty].seconds)
    }
  }, [difficulty, mode, phase])

  function startGame() {
    setPhase('playing')
    setRound(1)
    setScores({ one: 0, two: 0 })
    setPull(0)
    setQuestion(makeQuestion(mode, difficulty))
    setSecondsLeft(settings[difficulty].seconds)
    setQuestionStartedAt(Date.now())
    setFeedback(null)
    setRoundResolved(false)
  }

  function answerQuestion(player: PlayerId, choice: number) {
    if (phase !== 'playing' || roundResolved) return

    const direction = player === 'one' ? -1 : 1

    if (choice !== question.answer) {
      setPull((current) => clampPull(current - direction * 5))
      setFeedback({
        player,
        kind: 'wrong',
        text: `${playerName(player)} guessed ${choice}`,
      })
      return
    }

    setRoundResolved(true)
    const elapsed = (Date.now() - questionStartedAt) / 1000
    const speedBonus = Math.max(0, Math.ceil((secondsLeft - elapsed) / 4))
    const gain = settings[difficulty].pull + speedBonus

    setScores((current) => ({
      ...current,
      [player]: current[player] + 1,
    }))
    setPull((current) => {
      const nextPull = clampPull(current + direction * gain)
      if (Math.abs(nextPull) >= ropeLimit) {
        window.setTimeout(() => setPhase('gameOver'), 220)
      }
      return nextPull
    })
    setFeedback({
      player,
      kind: 'correct',
      text: `${playerName(player)} pulls +${gain}`,
    })
    window.setTimeout(() => advanceRound(), 320)
  }

  const markerPosition = `${50 + pull / 2}%`
  const canChangeSettings = phase !== 'playing'

  return (
    <main className="game-shell">
      <section className="game-board" aria-label="Number Tug game board">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            <div>
              <h1>Number Tug</h1>
              <p>Quickest pull wins</p>
            </div>
          </div>

          <div className="status-strip" aria-live="polite">
            <div>
              <span>Round</span>
              <strong>
                {round}/{totalRounds}
              </strong>
            </div>
            <div className="timer">
              <span>Time</span>
              <strong>{secondsLeft}s</strong>
            </div>
            <div>
              <span>Score</span>
              <strong>
                {scores.one} - {scores.two}
              </strong>
            </div>
          </div>
        </header>

        <section className="arena">
          <PlayerPanel
            accent="teal"
            choices={question.choices}
            label="Player 1"
            onAnswer={(choice) => answerQuestion('one', choice)}
            score={scores.one}
          />

          <div className="center-stage">
            <div className="rope-wrap" aria-label="Tug of war progress">
              <div className="rope"></div>
              <div className="track">
                <span className="track-fill one"></span>
                <span className="track-fill two"></span>
              </div>
              <div className="marker" style={{ left: markerPosition }}>
                <span>{Math.abs(pull)}</span>
              </div>
            </div>

            <div className="question-card">
              <span className="operation-label">{question.operation}</span>
              <strong>{question.prompt} = ?</strong>
            </div>

            <div
              className={`feedback ${feedback?.kind ?? ''}`}
              aria-live="polite"
            >
              {phase === 'gameOver'
                ? winner
                : feedback?.text ?? 'Tap the answer before your opponent.'}
            </div>
          </div>

          <PlayerPanel
            accent="coral"
            choices={question.choices}
            label="Player 2"
            onAnswer={(choice) => answerQuestion('two', choice)}
            score={scores.two}
          />
        </section>

        <footer className="control-dock">
          <SegmentedControl
            disabled={!canChangeSettings}
            label="Mode"
            onChange={setMode}
            options={operations}
            value={mode}
          />
          <SegmentedControl
            disabled={!canChangeSettings}
            label="Difficulty"
            onChange={setDifficulty}
            options={difficulties}
            value={difficulty}
          />
          <button className="start-button" type="button" onClick={startGame}>
            {phase === 'setup' ? 'Start' : 'Restart'}
          </button>
        </footer>
      </section>
    </main>
  )
}

function PlayerPanel({
  accent,
  choices,
  label,
  onAnswer,
  score,
}: {
  accent: 'teal' | 'coral'
  choices: number[]
  label: string
  onAnswer: (choice: number) => void
  score: number
}) {
  return (
    <section className={`player-panel ${accent}`} aria-label={`${label} area`}>
      <div className="player-banner">
        <span className="avatar" aria-hidden="true">
          {label.endsWith('1') ? '1' : '2'}
        </span>
        <div>
          <h2>{label}</h2>
          <p>Score {score}</p>
        </div>
      </div>

      <div className="answer-grid">
        {choices.map((choice) => (
          <button key={choice} type="button" onClick={() => onAnswer(choice)}>
            {choice}
          </button>
        ))}
      </div>
    </section>
  )
}

function SegmentedControl<T extends string>({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: T) => void
  options: Array<{ id: T; label: string }>
  value: T
}) {
  return (
    <fieldset className="segmented" disabled={disabled}>
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            aria-pressed={option.id === value}
            className={option.id === value ? 'selected' : ''}
            key={option.id}
            onClick={() => onChange(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default App
