import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'mixed'
type Difficulty = 'easy' | 'medium' | 'hard'
type PlayerId = 'one' | 'two'
type Phase = 'setup' | 'playing' | 'gameOver'
type FeedbackKind = 'correct' | 'wrong' | 'timeout' | 'win'

type Question = {
  prompt: string
  answer: number
  choices: number[]
  operation: Exclude<Operation, 'mixed'>
}

type PlayerProfile = {
  name: string
  face: string
}

type Feedback = {
  player?: PlayerId
  kind: FeedbackKind
  text: string
}

type Burst = {
  id: number
  player: PlayerId
  text: string
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
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

const faceOptions = ['😄', '😎', '🤓', '🥳', '🙂', '😃', '🤠', '😇']
const burstPieces = ['+', '−', '×', '÷', '★', '?']

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

function defaultName(player: PlayerId) {
  return player === 'one' ? 'Player 1' : 'Player 2'
}

function triggerHaptic(enabled: boolean, pattern: number | number[]) {
  if (!enabled || typeof navigator === 'undefined') return
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}

function playSound(enabled: boolean, kind: FeedbackKind | 'start' | 'tap') {
  if (!enabled || typeof window === 'undefined') return

  const AudioContextClass =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const gain = context.createGain()
  gain.connect(context.destination)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34)

  const patterns: Record<string, number[]> = {
    correct: [523, 659, 784],
    wrong: [220, 165],
    timeout: [247, 196],
    win: [523, 659, 784, 1046],
    start: [392, 523],
    tap: [330],
  }

  patterns[kind].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    oscillator.type = kind === 'wrong' || kind === 'timeout' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(
      frequency,
      context.currentTime + index * 0.075,
    )
    oscillator.connect(gain)
    oscillator.start(context.currentTime + index * 0.075)
    oscillator.stop(context.currentTime + index * 0.075 + 0.12)
  })

  window.setTimeout(() => {
    void context.close()
  }, 460)
}

function App() {
  const [mode, setMode] = useState<Operation>('add')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [phase, setPhase] = useState<Phase>('setup')
  const [round, setRound] = useState(1)
  const [scores, setScores] = useState({ one: 0, two: 0 })
  const [streaks, setStreaks] = useState({ one: 0, two: 0 })
  const [pull, setPull] = useState(0)
  const [question, setQuestion] = useState(() => makeQuestion(mode, difficulty))
  const [secondsLeft, setSecondsLeft] = useState(settings[difficulty].seconds)
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now())
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [roundResolved, setRoundResolved] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [impact, setImpact] = useState<FeedbackKind | null>(null)
  const [burst, setBurst] = useState<Burst | null>(null)
  const [profiles, setProfiles] = useState<Record<PlayerId, PlayerProfile>>({
    one: { name: 'Player 1', face: '😄' },
    two: { name: 'Player 2', face: '😎' },
  })

  const getDisplayName = useCallback(
    (player: PlayerId) => profiles[player].name.trim() || defaultName(player),
    [profiles],
  )

  const winner = useMemo(() => {
    if (pull <= -ropeLimit) return `${getDisplayName('one')} wins by rope pull`
    if (pull >= ropeLimit) return `${getDisplayName('two')} wins by rope pull`
    if (scores.one > scores.two) return `${getDisplayName('one')} wins by score`
    if (scores.two > scores.one) return `${getDisplayName('two')} wins by score`
    return 'Tie game'
  }, [getDisplayName, pull, scores])

  const makeImpact = useCallback(
    (kind: FeedbackKind) => {
      setImpact(kind)
      playSound(soundOn, kind)
      triggerHaptic(
        hapticsOn,
        kind === 'correct' || kind === 'win'
          ? [18, 35, 18]
          : kind === 'wrong'
            ? 70
            : [35, 45],
      )
      window.setTimeout(() => setImpact(null), 420)
    },
    [hapticsOn, soundOn],
  )

  const advanceRound = useCallback(
    (message?: string) => {
      if (message) {
        setFeedback({ kind: 'timeout', text: message })
        setStreaks({ one: 0, two: 0 })
        makeImpact('timeout')
      }

      setRound((currentRound) => {
        if (currentRound >= totalRounds) {
          setPhase('gameOver')
          makeImpact('win')
          return currentRound
        }

        setQuestion(makeQuestion(mode, difficulty))
        setSecondsLeft(settings[difficulty].seconds)
        setQuestionStartedAt(Date.now())
        setRoundResolved(false)
        return currentRound + 1
      })
    },
    [difficulty, makeImpact, mode],
  )

  useEffect(() => {
    if (phase !== 'playing') return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1
        advanceRound('Time ran out. Streaks reset.')
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

  function updateProfile(player: PlayerId, patch: Partial<PlayerProfile>) {
    setProfiles((current) => ({
      ...current,
      [player]: {
        ...current[player],
        ...patch,
      },
    }))
  }

  function startGame() {
    playSound(soundOn, 'start')
    triggerHaptic(hapticsOn, [20, 30, 20])
    setPhase('playing')
    setRound(1)
    setScores({ one: 0, two: 0 })
    setStreaks({ one: 0, two: 0 })
    setPull(0)
    setQuestion(makeQuestion(mode, difficulty))
    setSecondsLeft(settings[difficulty].seconds)
    setQuestionStartedAt(Date.now())
    setFeedback(null)
    setRoundResolved(false)
    setBurst(null)
  }

  function answerQuestion(player: PlayerId, choice: number) {
    if (phase !== 'playing' || roundResolved) return

    playSound(soundOn, 'tap')
    const direction = player === 'one' ? -1 : 1

    if (choice !== question.answer) {
      setPull((current) => clampPull(current - direction * 5))
      setStreaks((current) => ({ ...current, [player]: 0 }))
      setFeedback({
        player,
        kind: 'wrong',
        text: `${getDisplayName(player)} guessed ${choice}`,
      })
      makeImpact('wrong')
      return
    }

    setRoundResolved(true)
    const elapsed = (Date.now() - questionStartedAt) / 1000
    const nextStreak = streaks[player] + 1
    const speedBonus = Math.max(0, Math.ceil((secondsLeft - elapsed) / 4))
    const streakBonus = nextStreak >= 2 ? Math.min(10, nextStreak * 2) : 0
    const gain = settings[difficulty].pull + speedBonus + streakBonus
    const feedbackText =
      streakBonus > 0
        ? `${getDisplayName(player)} pulls +${gain} - ${nextStreak} streak`
        : `${getDisplayName(player)} pulls +${gain}`

    setScores((current) => ({
      ...current,
      [player]: current[player] + 1,
    }))
    setStreaks((current) => ({
      ...current,
      [player]: nextStreak,
    }))
    setPull((current) => {
      const nextPull = clampPull(current + direction * gain)
      if (Math.abs(nextPull) >= ropeLimit) {
        window.setTimeout(() => {
          setPhase('gameOver')
          makeImpact('win')
        }, 220)
      }
      return nextPull
    })
    setFeedback({
      player,
      kind: 'correct',
      text: feedbackText,
    })
    setBurst({
      id: Date.now(),
      player,
      text: streakBonus > 0 ? `+${gain} streak` : `+${gain}`,
    })
    makeImpact('correct')
    window.setTimeout(() => advanceRound(), 520)
  }

  const markerPosition = `${50 + pull / 2}%`
  const canChangeSettings = phase !== 'playing'
  const boardClassName = `game-board${impact ? ` impact-${impact}` : ''}`

  return (
    <main className="game-shell">
      <section className={boardClassName} aria-label="Number Tug game board">
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

          <div className="top-actions" aria-label="Game feel controls">
            <ToggleButton active={soundOn} onToggle={setSoundOn}>
              Sound
            </ToggleButton>
            <ToggleButton active={hapticsOn} onToggle={setHapticsOn}>
              Haptics
            </ToggleButton>
          </div>
        </header>

        <section className="arena">
          <PlayerPanel
            accent="teal"
            choices={question.choices}
            disabled={roundResolved || phase !== 'playing'}
            label={getDisplayName('one')}
            onAnswer={(choice) => answerQuestion('one', choice)}
            profile={profiles.one}
            score={scores.one}
            streak={streaks.one}
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
              {burst && (
                <div
                  className={`math-burst ${burst.player}`}
                  key={burst.id}
                  aria-hidden="true"
                >
                  <strong>{burst.text}</strong>
                  {burstPieces.map((piece, index) => (
                    <span key={`${piece}-${index}`}>{piece}</span>
                  ))}
                </div>
              )}
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
            disabled={roundResolved || phase !== 'playing'}
            label={getDisplayName('two')}
            onAnswer={(choice) => answerQuestion('two', choice)}
            profile={profiles.two}
            score={scores.two}
            streak={streaks.two}
          />
        </section>

        <footer className="control-dock">
          <div className="profile-setup" aria-label="Player setup">
            <ProfileEditor
              disabled={!canChangeSettings}
              player="one"
              profile={profiles.one}
              updateProfile={updateProfile}
            />
            <ProfileEditor
              disabled={!canChangeSettings}
              player="two"
              profile={profiles.two}
              updateProfile={updateProfile}
            />
          </div>

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
  disabled,
  label,
  onAnswer,
  profile,
  score,
  streak,
}: {
  accent: 'teal' | 'coral'
  choices: number[]
  disabled: boolean
  label: string
  onAnswer: (choice: number) => void
  profile: PlayerProfile
  score: number
  streak: number
}) {
  return (
    <section className={`player-panel ${accent}`} aria-label={`${label} area`}>
      <div className="player-banner">
        <span className="avatar" aria-hidden="true">
          {profile.face}
        </span>
        <div>
          <h2>{label}</h2>
          <p>
            Score {score}
            {streak > 1 ? ` - Streak ${streak}` : ''}
          </p>
        </div>
      </div>

      <div className="answer-grid">
        {choices.map((choice) => (
          <button
            disabled={disabled}
            key={choice}
            type="button"
            onClick={() => onAnswer(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
    </section>
  )
}

function ProfileEditor({
  disabled,
  player,
  profile,
  updateProfile,
}: {
  disabled: boolean
  player: PlayerId
  profile: PlayerProfile
  updateProfile: (player: PlayerId, patch: Partial<PlayerProfile>) => void
}) {
  return (
    <section className={`profile-card ${player}`}>
      <label>
        <span>{defaultName(player)} name</span>
        <input
          aria-label={`${defaultName(player)} name`}
          disabled={disabled}
          maxLength={14}
          value={profile.name}
          onChange={(event) =>
            updateProfile(player, { name: event.currentTarget.value })
          }
        />
      </label>
      <div className="face-row" aria-label={`${defaultName(player)} face`}>
        {faceOptions.map((face) => (
          <button
            aria-label={`${defaultName(player)} face ${face}`}
            aria-pressed={profile.face === face}
            className={profile.face === face ? 'selected' : ''}
            disabled={disabled}
            key={face}
            type="button"
            onClick={() => updateProfile(player, { face })}
          >
            {face}
          </button>
        ))}
      </div>
    </section>
  )
}

function ToggleButton({
  active,
  children,
  onToggle,
}: {
  active: boolean
  children: string
  onToggle: (active: boolean) => void
}) {
  return (
    <button
      aria-pressed={active}
      className={`toggle-button ${active ? 'active' : ''}`}
      type="button"
      onClick={() => onToggle(!active)}
    >
      {children} {active ? 'On' : 'Off'}
    </button>
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
