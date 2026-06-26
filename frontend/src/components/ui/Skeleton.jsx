import { clsx } from 'clsx';

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-md bg-surface-raised',
        className
      )}
      {...props}
    />
  );
}
