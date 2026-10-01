import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WobbleButton from '../components/WobbleButton';
import Mascot from '../components/Mascot';

const SplashScreen = ({ onStart }) => {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const title1 = "BELAJAR".split("");
  const title2 = "MATEMATIKA".split("");

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#FDF8F0] overflow-hidden">
      {/* Liquid blob background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#4A90D9] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-[pulse_6s_ease-in-out_infinite]"></div>
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#F0883E] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-[pulse_8s_ease-in-out_infinite] delay-1000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-[pulse_7s_ease-in-out_infinite] delay-2000"></div>
      
      {/* Film grain noise overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')]"></div>

      <div className="z-10 flex flex-col items-center text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-[#2C2C2C] mb-2 flex space-x-2">
          {title1.map((char, index) => (
            <motion.span
              key={`title1-${index}`}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 200, damping: 10 }}
            >
              {char}
            </motion.span>
          ))}
        </h1>
        <h1 className="text-5xl md:text-7xl font-bold text-[#4A90D9] mb-6 flex space-x-2">
          {title2.map((char, index) => (
            <motion.span
              key={`title2-${index}`}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.04, type: 'spring', stiffness: 200, damping: 10 }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-xl text-[#888] mb-12 font-medium"
        >
          Pendamping untuk anak hebat ✨
        </motion.p>

        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <WobbleButton onClick={onStart} variant="primary">
              Mulai Belajar &rarr;
            </WobbleButton>
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-10 left-10 z-20">
        <motion.div
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Mascot state="happy" />
        </motion.div>
      </div>
    </div>
  );
};

export default SplashScreen;
