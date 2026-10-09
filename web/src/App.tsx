import { useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './App.css'

// Screens
import SplashScreen from './screens/SplashScreen'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import QuestionScreen from './screens/QuestionScreen'
import SummaryScreen from './screens/SummaryScreen'

// Utils
import { sampleQuestions } from './utils/sampleQuestions'

type Screen = 'splash' | 'login' | 'home' | 'question' | 'summary'
type Mode = 'addition' | 'subtraction' | 'story' | 'mixed' | null

interface QuestionResult {
  questionIndex: number;
  correct: boolean;
  attempts: number;
  hintsUsed: number;
}

/**
 * App — Main application controller
 *
 * Flow: Splash → Login → Home → Question → Summary → (Home)
 *
 * State machine manages screen transitions with AnimatePresence
 * for smooth enter/exit animations between screens.
 */

// Screen transition variants
const screenVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

function App() {
  // ══ App State ══
  const [screen, setScreen] = useState<Screen>('splash')
  const [playerName, setPlayerName] = useState('')
  const [selectedMode, setSelectedMode] = useState<Mode>(null)
  const [results, setResults] = useState<QuestionResult[]>([])

  // ══ Screen Handlers ══

  // Splash → Login
  const handleStart = useCallback(() => {
    setScreen('login')
  }, [])

  // Login → Home
  const handleLogin = useCallback((name: string) => {
    setPlayerName(name)
    setScreen('home')
  }, [])

  // Home → Question (select a practice mode)
  const handleSelectMode = useCallback((mode: string) => {
    setSelectedMode(mode as Mode)
    setScreen('question')
  }, [])

  // Home → Logout
  const handleLogout = useCallback(() => {
    setPlayerName('')
    setScreen('login')
  }, [])

  // Question → Summary
  const handleFinish = useCallback((questionResults: QuestionResult[]) => {
    setResults(questionResults)
    setScreen('summary')
  }, [])

  // Summary → Home (play again)
  const handleRestart = useCallback(() => {
    setResults([])
    setScreen('home')
  }, [])

  // Summary → Home
  const handleGoHome = useCallback(() => {
    setResults([])
    setScreen('home')
  }, [])

  // Corner bar menu action handler (shared across screens)
  const handleMenuAction = useCallback((action: string) => {
    switch (action) {
      case 'home':
        setResults([])
        setScreen('home')
        break
      case 'restart':
        setResults([])
        setScreen('question')
        break
      case 'finish':
        setScreen('summary')
        break
      default:
        break
    }
  }, [])

  // ══ Filter questions by mode ══
  const getQuestionsForMode = useCallback((mode: Mode) => {
    switch (mode) {
      case 'addition':
        return sampleQuestions.filter(q => q.question.includes('+'))
      case 'subtraction':
        return sampleQuestions.filter(q => q.question.includes('-'))
      case 'story':
        // Use a mix for story mode
        return sampleQuestions.slice(0, 5)
      case 'mixed':
      default:
        return sampleQuestions
    }
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: 'var(--bg-cream)' }}>
      {/* Film grain noise overlay — always present */}
      <div className="noise-overlay" />

      {/* Screen router with enter/exit animations */}
      <AnimatePresence mode="wait">
        {screen === 'splash' && (
          <motion.div
            key="splash"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SplashScreen onStart={handleStart} />
          </motion.div>
        )}

        {screen === 'login' && (
          <motion.div
            key="login"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <LoginScreen onLogin={handleLogin} />
          </motion.div>
        )}

        {screen === 'home' && (
          <motion.div
            key="home"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <HomeScreen
              playerName={playerName}
              onSelectMode={handleSelectMode}
              onLogout={handleLogout}
            />
          </motion.div>
        )}

        {screen === 'question' && (
          <motion.div
            key="question"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <QuestionScreen
              playerName={playerName}
              questions={getQuestionsForMode(selectedMode)}
              onFinish={handleFinish}
              onHome={handleGoHome}
            />
          </motion.div>
        )}

        {screen === 'summary' && (
          <motion.div
            key="summary"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SummaryScreen
              playerName={playerName}
              results={results}
              totalQuestions={getQuestionsForMode(selectedMode).length}
              onRestart={handleRestart}
              onHome={handleGoHome}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
