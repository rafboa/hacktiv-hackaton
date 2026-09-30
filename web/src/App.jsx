import { useState } from 'react'
import { motion } from 'framer-motion'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID'; // Bahasa Indonesia
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Browser Anda tidak mendukung fitur suara.");
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center p-8 text-slate-800">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Pendamping Belajar Matematika
      </h1>
      
      <div className="flex gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-16 h-16 bg-blue-500 rounded-lg shadow-md cursor-pointer flex items-center justify-center text-white font-bold text-2xl"
            onClick={() => speak(`Satu balok ditekan`)}
          >
            {i + 1}
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <button 
          onClick={() => speak("Halo, mari kita belajar penjumlahan!")}
          className="px-6 py-3 bg-green-500 text-white font-bold rounded-full shadow-lg hover:bg-green-600 transition-colors"
        >
          Tes Suara (Web Speech API)
        </button>
      </div>

      <p className="mt-8 text-gray-500 max-w-md text-center">
        Project web (React + Vite + Tailwind + Framer Motion) siap digunakan! Agent AI akan memandu lewat suara.
      </p>
    </div>
  )
}

export default App
