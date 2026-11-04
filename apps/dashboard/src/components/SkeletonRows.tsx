import { useDelayElapsed } from './useDelayElapsed.ts';

const SKELETON_DELAY_MILLISECONDS = 300;

interface SkeletonRowsProps {
  readonly count: number;
  readonly label: string;
}

// design.md: loading shows sunken rows at the list's row height; the status text stays for screen readers only.
export function SkeletonRows({ count, label }: SkeletonRowsProps) {
  const showsRows = useDelayElapsed(SKELETON_DELAY_MILLISECONDS);
  return (
    <div role="status">
      <span className="visually-hidden">{label}</span>
      {showsRows ? (
        <ul className="row-list" aria-hidden="true">
          {Array.from({ length: count }, (_, index) => (
            <li key={index} className="row skeleton-row" />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
