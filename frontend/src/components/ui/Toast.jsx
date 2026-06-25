import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

const variants = {
  success: 'border-l-signal',
  error: 'border-l-error',
  info: 'border-l-muted',
};

export default function Toast({ message, type = 'info', duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={clsx(
            'fixed bottom-4 right-4 px-4 py-3 bg-surface border border-border rounded-card border-l-4',
            variants[type]
          )}
        >
          <span className="text-sm text-ink">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
