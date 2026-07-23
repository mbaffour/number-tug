import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'mixed'
type Difficulty = 'easy' | 'medium' | 'hard'
type GameMode = 'solo' | 'local' | 'cpu'
type ArenaTheme = 'tug' | 'race'
type PlayerId = 'one' | 'two'
type Phase = 'setup' | 'playing' | 'gameOver'
type FeedbackKind = 'correct' | 'wrong' | 'timeout' | 'win'
type SoundKind = FeedbackKind | 'start' | 'tap' | 'test' | 'music' | 'boost'

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

const gameModes: Array<{ id: GameMode; label: string }> = [
  { id: 'solo', label: 'Solo' },
  { id: 'local', label: 'Two Players' },
  { id: 'cpu', label: 'Vs CPU' },
]

const arenaThemes: Array<{ id: ArenaTheme; label: string }> = [
  { id: 'tug', label: 'Tug' },
  { id: 'race', label: 'Car Race' },
]

const faceOptions = ['😄', '😎', '🤓', '🥳', '🙂', '😃', '🤠', '😇']
const burstPieces = ['+', '−', '×', '÷', '★', '?']
const playerKeys: Record<PlayerId, string[]> = {
  one: ['a', 's', 'd', 'f'],
  two: ['j', 'k', 'l', ';'],
}
const cpuProfile: PlayerProfile = { name: 'CPU', face: '🤖' }
const goalProfile: PlayerProfile = { name: 'Goal', face: '🎯' }

let sharedAudioContext: AudioContext | null = null
let musicLoop: number | null = null

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

type Records = {
  soloBest: number
  bestStreak: number
}

const emptyRecords: Records = { soloBest: 0, bestStreak: 0 }
const recordsStorageKey = 'number-tug:records'

function loadRecords(): Records {
  if (typeof window === 'undefined') return emptyRecords
  try {
    const raw = window.localStorage.getItem(recordsStorageKey)
    if (!raw) return emptyRecords
    const parsed = JSON.parse(raw) as Partial<Records>
    return {
      soloBest: Number(parsed.soloBest) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    }
  } catch {
    return emptyRecords
  }
}

function saveRecords(records: Records) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(recordsStorageKey, JSON.stringify(records))
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

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

function getCpuDelay(difficulty: Difficulty) {
  const ranges = {
    easy: [4100, 6800],
    medium: [2500, 4700],
    hard: [1400, 3000],
  } satisfies Record<Difficulty, [number, number]>
  const [min, max] = ranges[difficulty]
  return randomInt(min, max)
}

function getCpuAccuracy(difficulty: Difficulty) {
  return difficulty === 'easy' ? 0.7 : difficulty === 'medium' ? 0.82 : 0.92
}

function triggerHaptic(enabled: boolean, pattern: number | number[]) {
  if (!enabled || typeof navigator === 'undefined') return
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContextClass =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext
  if (!AudioContextClass) return null

  sharedAudioContext ??= new AudioContextClass()
  return sharedAudioContext
}

function unlockAudio(enabled: boolean) {
  if (!enabled) return false
  const context = getAudioContext()
  if (!context) return false
  if (context.state === 'suspended') {
    void context.resume()
  }
  return true
}

function playSound(enabled: boolean, kind: SoundKind) {
  if (!unlockAudio(enabled)) return false

  const context = sharedAudioContext
  if (!context) return false

  const gain = context.createGain()
  gain.connect(context.destination)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(
    kind === 'music' ? 0.045 : 0.28,
    context.currentTime + 0.015,
  )
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + (kind === 'music' ? 1.4 : 0.42),
  )

  const patterns: Record<SoundKind, number[]> = {
    correct: [523, 659, 784],
    wrong: [220, 165],
    timeout: [247, 196],
    win: [523, 659, 784, 1046],
    start: [392, 523],
    tap: [330],
    test: [392, 523, 659, 784],
    music: [196, 247, 294, 330, 294, 247],
    boost: [165, 220, 330, 440],
  }

  patterns[kind].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    oscillator.type =
      kind === 'wrong' || kind === 'timeout'
        ? 'triangle'
        : kind === 'boost'
          ? 'sawtooth'
        : kind === 'music'
          ? 'sine'
          : 'square'
    oscillator.frequency.setValueAtTime(
      frequency,
      context.currentTime + index * (kind === 'music' ? 0.18 : 0.075),
    )
    oscillator.connect(gain)
    oscillator.start(
      context.currentTime + index * (kind === 'music' ? 0.18 : 0.075),
    )
    oscillator.stop(
      context.currentTime +
        index * (kind === 'music' ? 0.18 : 0.075) +
        (kind === 'music' ? 0.2 : 0.13),
    )
  })

  return true
}

function startMusic(enabled: boolean) {
  if (!enabled || typeof window === 'undefined' || musicLoop !== null) return
  playSound(true, 'music')
  musicLoop = window.setInterval(() => playSound(true, 'music'), 2300)
}

function stopMusic() {
  if (typeof window === 'undefined' || musicLoop === null) return
  window.clearInterval(musicLoop)
  musicLoop = null
}

function closeAudio() {
  stopMusic()
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    void sharedAudioContext.close()
  }
  sharedAudioContext = null
}

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('solo')
  const [arenaTheme, setArenaTheme] = useState<ArenaTheme>('tug')
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
  const [wrongChoice, setWrongChoice] = useState<number | null>(null)
  const [revealedAnswer, setRevealedAnswer] = useState<number | null>(null)
  const [cpuAttemptedRound, setCpuAttemptedRound] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const [musicOn, setMusicOn] = useState(true)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [impact, setImpact] = useState<FeedbackKind | null>(null)
  const [burst, setBurst] = useState<Burst | null>(null)
  const [profiles, setProfiles] = useState<Record<PlayerId, PlayerProfile>>({
    one: { name: 'Player 1', face: '😄' },
    two: { name: 'Player 2', face: '😎' },
  })
  const [records, setRecords] = useState<Records>(loadRecords)
  const [peakStreak, setPeakStreak] = useState(0)

  const getDisplayName = useCallback(
    (player: PlayerId) =>
      gameMode === 'cpu' && player === 'two'
        ? cpuProfile.name
        : gameMode === 'solo' && player === 'two'
          ? goalProfile.name
        : profiles[player].name.trim() || defaultName(player),
    [gameMode, profiles],
  )

  const winner = useMemo(() => {
    if (gameMode === 'solo') {
      if (pull <= -ropeLimit) return `${getDisplayName('one')} cleared Solo Run`
      return `Solo complete: ${scores.one}/${totalRounds} correct`
    }
    if (pull <= -ropeLimit) return `${getDisplayName('one')} wins by rope pull`
    if (pull >= ropeLimit) return `${getDisplayName('two')} wins by rope pull`
    if (scores.one > scores.two) return `${getDisplayName('one')} wins by score`
    if (scores.two > scores.one) return `${getDisplayName('two')} wins by score`
    return 'Tie game'
  }, [gameMode, getDisplayName, pull, scores])

  const makeImpact = useCallback(
    (kind: FeedbackKind) => {
      setImpact(kind)
      playSound(soundOn, kind === 'correct' && arenaTheme === 'race' ? 'boost' : kind)
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
    [arenaTheme, hapticsOn, soundOn],
  )

  const advanceRound = useCallback(
    (message?: string) => {
      if (message) {
        setFeedback({ kind: 'timeout', text: `${message} Answer: ${question.answer}` })
        setStreaks({ one: 0, two: 0 })
        setRevealedAnswer(question.answer)
        setRoundResolved(true)
        if (gameMode === 'solo') {
          setPull((current) => clampPull(current + 8))
        }
        makeImpact('timeout')
        window.setTimeout(() => advanceRound(), 700)
        return
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
        setWrongChoice(null)
        setRevealedAnswer(null)
        return currentRound + 1
      })
    },
    [difficulty, gameMode, makeImpact, mode, question.answer],
  )

  useEffect(() => {
    if (phase !== 'playing' || roundResolved) return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1
        advanceRound('Time ran out. Streaks reset.')
        return settings[difficulty].seconds
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [advanceRound, difficulty, phase, roundResolved])

  useEffect(() => {
    if (phase === 'playing' && soundOn && musicOn) {
      startMusic(true)
    } else {
      stopMusic()
    }

    return () => stopMusic()
  }, [musicOn, phase, soundOn])

  useEffect(() => {
    if (phase === 'setup') {
      setQuestion(makeQuestion(mode, difficulty))
      setSecondsLeft(settings[difficulty].seconds)
    }
  }, [difficulty, mode, phase])

  useEffect(() => closeAudio, [])

  useEffect(() => {
    if (phase !== 'gameOver') return
    setRecords((current) => {
      const next: Records = {
        soloBest:
          gameMode === 'solo'
            ? Math.max(current.soloBest, scores.one)
            : current.soloBest,
        bestStreak: Math.max(current.bestStreak, peakStreak),
      }
      if (
        next.soloBest === current.soloBest &&
        next.bestStreak === current.bestStreak
      ) {
        return current
      }
      saveRecords(next)
      return next
    })
  }, [gameMode, peakStreak, phase, scores.one])

  function resetRecords() {
    setRecords(emptyRecords)
    saveRecords(emptyRecords)
  }

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
    unlockAudio(soundOn)
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
    setWrongChoice(null)
    setRevealedAnswer(null)
    setCpuAttemptedRound(0)
    setBurst(null)
    setPeakStreak(0)
  }

  function testGameFeel() {
    const audioReady = playSound(soundOn, 'test')
    const hapticsReady =
      hapticsOn &&
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'

    triggerHaptic(hapticsOn, [30, 40, 30])
    const audioStatus = audioReady
      ? 'Sound test played.'
      : soundOn
        ? 'Sound is blocked or unavailable; tap Test again or press Start.'
        : 'Sound is turned off.'
    const hapticStatus = hapticsOn
      ? hapticsReady
        ? 'Haptics requested.'
        : 'Haptics are not supported on this device/browser.'
      : 'Haptics are turned off.'

    setFeedback({
      kind: audioReady ? 'correct' : 'wrong',
      text: `${audioStatus} ${hapticStatus}`,
    })
  }

  const answerQuestion = useCallback(
    (player: PlayerId, choice: number) => {
      if (phase !== 'playing' || roundResolved) return

      playSound(soundOn, 'tap')
      const direction = player === 'one' ? -1 : 1

      if (choice !== question.answer) {
        setPull((current) => clampPull(current - direction * 5))
        setStreaks((current) => ({ ...current, [player]: 0 }))
        setWrongChoice(choice)
        setFeedback({
          player,
          kind: 'wrong',
          text: `${getDisplayName(player)} missed -5 pull. Try again.`,
        })
        makeImpact('wrong')
        window.setTimeout(() => setWrongChoice(null), 360)
        return
      }

      setRoundResolved(true)
      setRevealedAnswer(question.answer)
      const elapsed = (Date.now() - questionStartedAt) / 1000
      const nextStreak = streaks[player] + 1
      const speedBonus = Math.max(
        0,
        Math.ceil((settings[difficulty].seconds - elapsed) / 4),
      )
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
      setPeakStreak((current) => Math.max(current, nextStreak))
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
    },
    [
      advanceRound,
      difficulty,
      getDisplayName,
      makeImpact,
      phase,
      question.answer,
      questionStartedAt,
      roundResolved,
      soundOn,
      streaks,
    ],
  )

  useEffect(() => {
    if (phase !== 'playing') return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const playerOneIndex = playerKeys.one.indexOf(key)
      const playerTwoIndex = playerKeys.two.indexOf(key)

      if (playerOneIndex >= 0) {
        event.preventDefault()
        answerQuestion('one', question.choices[playerOneIndex])
        return
      }

      if (gameMode === 'local' && playerTwoIndex >= 0) {
        event.preventDefault()
        answerQuestion('two', question.choices[playerTwoIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answerQuestion, gameMode, phase, question.choices])

  useEffect(() => {
    if (
      gameMode !== 'cpu' ||
      phase !== 'playing' ||
      roundResolved ||
      cpuAttemptedRound === round
    ) {
      return
    }

    const delay = getCpuDelay(difficulty)
    const timeout = window.setTimeout(() => {
      setCpuAttemptedRound(round)
      const shouldAnswerCorrectly = Math.random() < getCpuAccuracy(difficulty)
      const wrongChoices = question.choices.filter(
        (choice) => choice !== question.answer,
      )
      const cpuChoice = shouldAnswerCorrectly
        ? question.answer
        : wrongChoices[randomInt(0, wrongChoices.length - 1)] ?? question.answer

      answerQuestion('two', cpuChoice)
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [
    answerQuestion,
    cpuAttemptedRound,
    difficulty,
    gameMode,
    phase,
    question.answer,
    question.choices,
    round,
    roundResolved,
  ])

  const markerPosition = `${50 + pull / 2}%`
  const roundSeconds = settings[difficulty].seconds
  const timerProgress = Math.max(0, Math.min(100, (secondsLeft / roundSeconds) * 100))
  const canChangeSettings = phase !== 'playing'
  const playerTwoProfile =
    gameMode === 'cpu'
      ? cpuProfile
      : gameMode === 'solo'
        ? goalProfile
        : profiles.two
  const playerTwoSetupLabel =
    gameMode === 'cpu' ? 'CPU' : gameMode === 'solo' ? 'Goal' : defaultName('two')
  const keyHint =
    gameMode === 'solo'
      ? 'Solo keys: use A S D F or tap the left answers.'
      : gameMode === 'cpu'
      ? 'Computer keys: Player 1 uses A S D F. CPU answers automatically.'
      : 'Computer keys: Player 1 uses A S D F. Player 2 uses J K L ;.'
  const waitingHint =
    gameMode === 'solo'
      ? arenaTheme === 'race'
        ? 'Answer quickly to keep your car ahead.'
        : 'Tap the answer before the rope slips.'
      : gameMode === 'cpu'
        ? arenaTheme === 'race'
          ? 'Outrun the CPU to the finish line.'
          : 'Beat the CPU to the answer.'
        : arenaTheme === 'race'
          ? 'First correct answer gets the turbo boost.'
          : 'Tap the answer before your opponent.'
  const boardClassName = `game-board ${arenaTheme}-theme${impact ? ` impact-${impact}` : ''}`

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
              <i aria-hidden="true" className="timer-meter">
                <i style={{ width: `${timerProgress}%` }}></i>
              </i>
            </div>
            <div>
              <span>Score</span>
              <strong>
                {gameMode === 'solo' ? scores.one : `${scores.one} - ${scores.two}`}
              </strong>
            </div>
          </div>

          <div className="top-actions" aria-label="Game feel controls">
            <ToggleButton active={soundOn} onToggle={setSoundOn}>
              Sound
            </ToggleButton>
            <ToggleButton active={musicOn} onToggle={setMusicOn}>
              Music
            </ToggleButton>
            <ToggleButton active={hapticsOn} onToggle={setHapticsOn}>
              Haptics
            </ToggleButton>
            <button
              className="toggle-button test-button"
              type="button"
              onClick={testGameFeel}
            >
              Test
            </button>
          </div>
        </header>

        <section className="arena">
          <PlayerPanel
            accent="teal"
            choices={question.choices}
            disabled={roundResolved || phase !== 'playing'}
            keyLabels={playerKeys.one.map((key) => key.toUpperCase())}
            label={getDisplayName('one')}
            onAnswer={(choice) => answerQuestion('one', choice)}
            profile={profiles.one}
            score={scores.one}
            streak={streaks.one}
            wrongChoice={wrongChoice}
            revealedAnswer={revealedAnswer}
          />

          <div className="center-stage">
            {arenaTheme === 'race' ? (
              <RaceTrack
                burst={burst}
                pull={pull}
                playerOne={profiles.one}
                playerTwo={playerTwoProfile}
              />
            ) : (
              <TugTrack burst={burst} markerPosition={markerPosition} pull={pull} />
            )}

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
                : feedback?.text ?? waitingHint}
            </div>
            <p className="key-hint">{keyHint}</p>
          </div>

          {gameMode === 'solo' ? (
            <SoloGoalPanel score={scores.one} streak={streaks.one} />
          ) : (
            <PlayerPanel
              accent="coral"
              choices={question.choices}
              disabled={roundResolved || phase !== 'playing' || gameMode === 'cpu'}
              isCpu={gameMode === 'cpu'}
              keyLabels={
                gameMode === 'local'
                  ? playerKeys.two.map((key) => key.toUpperCase())
                  : undefined
              }
              label={getDisplayName('two')}
              onAnswer={(choice) => answerQuestion('two', choice)}
              profile={playerTwoProfile}
              score={scores.two}
              streak={streaks.two}
              wrongChoice={wrongChoice}
              revealedAnswer={revealedAnswer}
            />
          )}
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
              disabled={
                !canChangeSettings || gameMode === 'cpu' || gameMode === 'solo'
              }
              player="two"
              profile={playerTwoProfile}
              title={playerTwoSetupLabel}
              updateProfile={updateProfile}
            />
          </div>

          <Scoreboard
            records={records}
            onReset={resetRecords}
            resetDisabled={records.soloBest === 0 && records.bestStreak === 0}
          />

          <SegmentedControl
            disabled={!canChangeSettings}
            label="Game"
            onChange={setGameMode}
            options={gameModes}
            value={gameMode}
          />
          <SegmentedControl
            disabled={!canChangeSettings}
            label="Arena"
            onChange={setArenaTheme}
            options={arenaThemes}
            value={arenaTheme}
          />
          <SegmentedControl
            disabled={!canChangeSettings}
            label="Math"
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

function TugTrack({
  burst,
  markerPosition,
  pull,
}: {
  burst: Burst | null
  markerPosition: string
  pull: number
}) {
  return (
    <div className="rope-wrap" aria-label="Tug of war progress">
      <div className="rope"></div>
      <div className="track">
        <span className="track-fill one"></span>
        <span className="track-fill two"></span>
      </div>
      <div className="marker" style={{ left: markerPosition }}>
        <span>{Math.abs(pull)}</span>
      </div>
      <MathBurst burst={burst} />
    </div>
  )
}

function RaceTrack({
  burst,
  pull,
  playerOne,
  playerTwo,
}: {
  burst: Burst | null
  pull: number
  playerOne: PlayerProfile
  playerTwo: PlayerProfile
}) {
  return (
    <div className="race-track" aria-label="Car race progress">
      <span className="finish-line" aria-hidden="true"></span>
      <div className="race-lane lane-one">
        <span className="lane-label">P1</span>
        <div className="race-car teal-car" style={{ left: `${50 - pull / 2}%` }}>
          <span>{playerOne.face}</span>
        </div>
      </div>
      <div className="race-lane lane-two">
        <span className="lane-label">P2</span>
        <div className="race-car coral-car" style={{ left: `${50 + pull / 2}%` }}>
          <span>{playerTwo.face}</span>
        </div>
      </div>
      <MathBurst burst={burst} />
    </div>
  )
}

function MathBurst({ burst }: { burst: Burst | null }) {
  if (!burst) return null

  return (
    <div className={`math-burst ${burst.player}`} key={burst.id} aria-hidden="true">
      <strong>{burst.text}</strong>
      {burstPieces.map((piece, index) => (
        <span key={`${piece}-${index}`}>{piece}</span>
      ))}
    </div>
  )
}

function PlayerPanel({
  accent,
  choices,
  disabled,
  isCpu = false,
  keyLabels,
  label,
  onAnswer,
  profile,
  score,
  streak,
  wrongChoice,
  revealedAnswer,
}: {
  accent: 'teal' | 'coral'
  choices: number[]
  disabled: boolean
  isCpu?: boolean
  keyLabels?: string[]
  label: string
  onAnswer: (choice: number) => void
  profile: PlayerProfile
  score: number
  streak: number
  wrongChoice: number | null
  revealedAnswer: number | null
}) {
  return (
    <section
      className={`player-panel ${accent}${isCpu ? ' cpu-player' : ''}`}
      aria-label={`${label} area`}
    >
      <div className="player-banner">
        <span className="avatar" aria-hidden="true">
          {profile.face}
        </span>
        <div>
          <h2>{label}</h2>
          <p>
            Score {score}
            {streak > 1 ? ` - Streak ${streak}` : ''}
            {isCpu ? ' - Auto' : ''}
          </p>
        </div>
      </div>

      <div className="answer-grid">
        {choices.map((choice, index) => (
          <button
            aria-label={`${label} answer ${choice}`}
            className={`${wrongChoice === choice ? 'answer-wrong' : ''}${revealedAnswer === choice ? ' answer-revealed' : ''}`}
            disabled={disabled}
            key={choice}
            type="button"
            onClick={() => onAnswer(choice)}
          >
            {keyLabels?.[index] && (
              <span className="keycap" aria-hidden="true">
                {keyLabels[index]}
              </span>
            )}
            <span>{choice}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SoloGoalPanel({ score, streak }: { score: number; streak: number }) {
  return (
    <section className="player-panel coral solo-goal" aria-label="Solo goal">
      <div className="player-banner">
        <span className="avatar" aria-hidden="true">
          {goalProfile.face}
        </span>
        <div>
          <h2>Solo Run</h2>
          <p>
            Score {score}/{totalRounds}
            {streak > 1 ? ` - Streak ${streak}` : ''}
          </p>
        </div>
      </div>

      <div className="solo-stats">
        <div>
          <span>Correct</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>{streak}</strong>
        </div>
        <div>
          <span>Goal</span>
          <strong>{totalRounds}</strong>
        </div>
      </div>
    </section>
  )
}

function Scoreboard({
  records,
  onReset,
  resetDisabled,
}: {
  records: Records
  onReset: () => void
  resetDisabled: boolean
}) {
  return (
    <section className="scoreboard" aria-label="Personal bests">
      <div className="scoreboard-head">
        <span>Best</span>
        <button
          className="toggle-button"
          disabled={resetDisabled}
          type="button"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
      <div className="scoreboard-stats">
        <div>
          <span>Solo</span>
          <strong>
            {records.soloBest}/{totalRounds}
          </strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>{records.bestStreak}</strong>
        </div>
      </div>
    </section>
  )
}

function ProfileEditor({
  disabled,
  player,
  profile,
  title,
  updateProfile,
}: {
  disabled: boolean
  player: PlayerId
  profile: PlayerProfile
  title?: string
  updateProfile: (player: PlayerId, patch: Partial<PlayerProfile>) => void
}) {
  const displayTitle = title ?? defaultName(player)

  return (
    <section className={`profile-card ${player}`}>
      <label>
        <span>{displayTitle} name</span>
        <input
          aria-label={`${displayTitle} name`}
          disabled={disabled}
          maxLength={14}
          value={profile.name}
          onChange={(event) =>
            updateProfile(player, { name: event.currentTarget.value })
          }
        />
      </label>
      <div className="face-row" aria-label={`${displayTitle} face`}>
        {disabled && !faceOptions.includes(profile.face) ? (
          <span className="locked-face" aria-hidden="true">
            {profile.face}
          </span>
        ) : (
          faceOptions.map((face) => (
            <button
              aria-label={`${displayTitle} face ${face}`}
              aria-pressed={profile.face === face}
              className={profile.face === face ? 'selected' : ''}
              disabled={disabled}
              key={face}
              type="button"
              onClick={() => updateProfile(player, { face })}
            >
              {face}
            </button>
          ))
        )}
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
