import { useEffect, useState } from 'react';

export function useElapsed(milliseconds: number): boolean {
  const [isElapsed, setIsElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsElapsed(true), milliseconds);
    return () => clearTimeout(timer);
  }, [milliseconds]);
  return isElapsed;
}
