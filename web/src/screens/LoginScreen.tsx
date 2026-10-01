import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WobbleButton from '../components/WobbleButton';
import JiggleCard from '../components/JiggleCard';
import { fadeUp, containerVariants } from '../utils/springs';

interface Profile {
  name: string;
  emoji?: string;
}

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [name, setName] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('math-profiles');
    if (saved) {
      try {
        setProfiles(JSON.parse(saved) as Profile[]);
      } catch (e) {
        console.error("Failed to parse profiles", e);
      }
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;

    // Maintain max 4 profiles
    const newProfiles = profiles.filter(p => p.name !== name.trim());
    newProfiles.unshift({ name: name.trim(), emoji: '👧' });
    const toSave = newProfiles.slice(0, 4);
    localStorage.setItem('math-profiles', JSON.stringify(toSave));

    onLogin(name.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDF8F0] p-6">
      <motion.div
        className="w-full max-w-md flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.h1
          variants={fadeUp}
          className="text-4xl font-bold text-[#2C2C2C] mb-8 text-center"
        >
          Siapa namamu?
        </motion.h1>

        <motion.form
          variants={fadeUp}
          onSubmit={handleSubmit}
          className="w-full flex flex-col items-center"
        >
          <motion.input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ketik namamu di sini"
            animate={{ scale: isFocused ? 1.02 : 1 }}
            className={`w-full text-center text-2xl p-4 rounded-2xl border-4 outline-none transition-colors mb-6 text-[#2C2C2C] ${
              isFocused ? 'border-[#4A90D9]' : 'border-gray-200'
            }`}
          />
          <WobbleButton onClick={() => handleSubmit()} variant="primary" disabled={!name.trim()}>
            Ayo Mulai! &rarr;
          </WobbleButton>
        </motion.form>

        {profiles.length > 0 && (
          <motion.div variants={fadeUp} className="w-full mt-12">
            <h2 className="text-[#888] text-center mb-4 font-semibold text-lg">Atau pilih:</h2>
            <div className="grid grid-cols-2 gap-4">
              {profiles.map((profile, i) => (
                <JiggleCard
                  key={i}
                  onClick={() => onLogin(profile.name)}
                  className="flex items-center space-x-3 p-4 bg-white rounded-xl shadow-sm cursor-pointer border-2 border-transparent hover:border-[#4A90D9]"
                >
                  <span className="text-3xl">{profile.emoji ?? '👦'}</span>
                  <span className="text-lg font-bold text-[#2C2C2C] truncate">{profile.name}</span>
                </JiggleCard>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default LoginScreen;
