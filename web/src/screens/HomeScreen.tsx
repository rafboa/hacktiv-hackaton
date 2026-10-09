import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import CornerBar from '../components/CornerBar';
import JiggleCard from '../components/JiggleCard';
import useTTS from '../hooks/useTTS';
import useLangflow from '../hooks/useLangflow';
import { containerVariants, slideUp } from '../utils/springs';

interface Mode {
  id: string;
  label: string;
  title: string;
  icon: string;
  locked: boolean;
  color: string;
}

const modes: Mode[] = [
  { id: 'addition', label: 'Practice 01', title: 'Penjumlahan', icon: '➕', locked: false, color: 'bg-blue-100 text-[#4A90D9]' },
  { id: 'subtraction', label: 'Practice 02', title: 'Pengurangan', icon: '➖', locked: false, color: 'bg-orange-100 text-[#F0883E]' },
  { id: 'word', label: 'Practice 03', title: 'Soal Cerita', icon: '📖', locked: false, color: 'bg-green-100 text-[#34C759]' },
  { id: 'mixed', label: 'Practice 04', title: 'Campuran', icon: '🎯', locked: true, color: 'bg-gray-200 text-gray-500' }
];

interface HomeScreenProps {
  playerName: string;
  onSelectMode: (modeId: string) => void;
  onLogout: () => void;
}

const HomeScreen = ({ playerName, onSelectMode, onLogout }: HomeScreenProps) => {
  const { speak, isSupported } = useTTS();
  const { connected: langflowConnected } = useLangflow();

  useEffect(() => {
    if (isSupported) {
      speak(`Hai ${playerName}! Mau belajar apa?`);
    }
  }, [playerName, speak, isSupported]);

  return (
    <div className="min-h-screen bg-[#FDF8F0] flex flex-col">
      <CornerBar playerName={playerName} currentQuestion={0} totalQuestions={0} onMenuAction={(action) => { if (action === 'menu' || action === 'finish') onLogout(); }} />

      <main className="flex-1 px-6 py-10 flex flex-col max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <h1 className="text-3xl md:text-5xl font-bold text-[#2C2C2C] mb-2">
            Hai <span className="text-[#4A90D9]">{playerName}</span>!
          </h1>
          <p className="text-xl text-[#888] font-medium">Mau belajar apa hari ini?</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`w-2.5 h-2.5 rounded-full ${langflowConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-xs font-medium text-[#888]">
              {langflowConnected ? 'AI Langflow terhubung' : 'Mode offline — soal lokal'}
            </span>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {modes.map((mode) => (
            <motion.div key={mode.id} variants={slideUp}>
              <JiggleCard
                disabled={mode.locked}
                onClick={() => !mode.locked && onSelectMode(mode.id)}
                className={`p-6 rounded-3xl shadow-sm border-4 ${
                  mode.locked ? 'opacity-50 grayscale border-transparent bg-gray-50' : 'bg-white border-transparent hover:border-[#34C759] cursor-pointer'
                } flex items-center space-x-6 relative overflow-hidden`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${mode.color}`}>
                  {mode.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#888] uppercase tracking-wider">{mode.label}</span>
                  <span className="text-2xl font-bold text-[#2C2C2C]">{mode.title}</span>
                </div>
                {mode.locked && (
                  <div className="absolute top-4 right-4 text-gray-400 text-xl">
                    🔒
                  </div>
                )}
              </JiggleCard>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
};

export default HomeScreen;
