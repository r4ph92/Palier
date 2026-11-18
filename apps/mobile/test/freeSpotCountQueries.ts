import { screen, waitFor } from '@testing-library/react-native';
import { asSeen } from './visibleText';

type HostElement = ReturnType<typeof screen.getByTestId>;

function textOf(node: HostElement | string): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('');
}

function compact(text: string): string {
  return asSeen(text).replaceAll(' ', '');
}

// The count is a number and its label in two Texts at large text sizes, so no single Text holds "10 places libres".
export function queryFreeSpotCount(text: string): HostElement | null {
  return screen.queryAllByTestId('free-spot-count').find((count) => compact(textOf(count)) === compact(text)) ?? null;
}

export function getFreeSpotCount(text: string): HostElement {
  const count = queryFreeSpotCount(text);
  if (count === null) {
    throw new Error(`No free spot count reads "${text}"`);
  }
  return count;
}

export function findFreeSpotCount(text: string): Promise<HostElement> {
  return waitFor(() => getFreeSpotCount(text));
}
