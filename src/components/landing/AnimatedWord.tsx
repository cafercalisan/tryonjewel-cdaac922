import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface AnimatedWordProps {
  words: string[];
  interval?: number;
  className?: string;
}

export function AnimatedWord({ words, interval = 3000, className = '' }: AnimatedWordProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <span className={`relative inline-block ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ 
            opacity: 0, 
            y: 30,
            filter: 'blur(8px)',
            scale: 0.9
          }}
          animate={{ 
            opacity: 1, 
            y: 0,
            filter: 'blur(0px)',
            scale: 1
          }}
          exit={{ 
            opacity: 0, 
            y: -30,
            filter: 'blur(8px)',
            scale: 0.9
          }}
          transition={{ 
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1]
          }}
          className="inline-block italic text-primary font-serif"
          style={{
            textShadow: '0 0 40px hsl(var(--primary) / 0.3)'
          }}
        >
          {words[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
