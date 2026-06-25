import { motion } from 'framer-motion';
import clsx from 'clsx';

const variants = {
  primary: 'bg-signal text-void hover:opacity-90 border-none',
  ghost: 'bg-transparent text-ink border-border hover:border-ink',
  danger: 'bg-transparent text-error border-error/30 hover:border-error',
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  ...props 
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={clsx(
        'rounded-btn font-medium transition-all duration-150 border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
