import clsx from 'clsx';

const variants = {
  active: 'bg-signal-dim text-signal',
  neutral: 'bg-surface-raised text-muted',
};

export default function Badge({ children, variant = 'neutral', className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-badge font-mono text-xs',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
