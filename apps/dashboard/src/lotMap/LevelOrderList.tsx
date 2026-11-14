import type { DashboardMapLevel } from '@palier/shared-types';
import { useEffect, useRef, type RefObject } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useLevelOrder, type LevelMove, type LevelOrderTarget, type MoveDirection } from './useLevelOrder.ts';

type ButtonRefs = RefObject<Map<string, HTMLButtonElement>>;

const OTHER_DIRECTION: Readonly<Record<MoveDirection, MoveDirection>> = { up: 'down', down: 'up' };

function buttonKey(levelId: string, direction: MoveDirection): string {
  return `${levelId}-${direction}`;
}

export function LevelOrderList(target: LevelOrderTarget) {
  const order = useLevelOrder(target);
  const buttons: ButtonRefs = useRef(new Map());
  const count = target.levels.length;
  useFocusOnMovedLevel(buttons, order.lastMove, target.levels);
  return (
    <>
      <ol className="row-list" aria-busy={order.saving}>
        {target.levels.map((level, index) => (
          <LevelRow key={level.id} level={level} position={{ index, count }} saving={order.saving} buttons={buttons} onMove={order.move} />
        ))}
      </ol>
      <MovedStatus move={order.lastMove} levels={target.levels} />
      {order.error === null ? null : <ErrorNotice code={order.error} takesFocus />}
    </>
  );
}

// The moved level's button keeps focus; at the top or the bottom that button is disabled, so focus goes to the other one.
function useFocusOnMovedLevel(buttons: ButtonRefs, move: LevelMove | null, levels: readonly DashboardMapLevel[]): void {
  useEffect(() => {
    if (move === null) {
      return;
    }
    const moved = buttons.current.get(buttonKey(move.levelId, move.direction));
    const other = buttons.current.get(buttonKey(move.levelId, OTHER_DIRECTION[move.direction]));
    const focused = moved?.disabled === true ? other : moved;
    focused?.focus();
  }, [buttons, move, levels]);
}

interface LevelRowProps {
  readonly level: DashboardMapLevel;
  readonly position: { readonly index: number; readonly count: number };
  readonly saving: boolean;
  readonly buttons: ButtonRefs;
  readonly onMove: (move: LevelMove) => Promise<void>;
}

// A lone level has nowhere to move, so it shows no move button at all.
function LevelRow({ level, position, saving, buttons, onMove }: LevelRowProps) {
  const { language } = useLanguage();
  const moveButton = { level, saving, buttons, onMove };
  return (
    <li className="row level-row">
      <span className="level-position">{formatCount(position.index + 1, language)}</span>
      <span className="row-name">{level.code}</span>
      {position.count < 2 ? null : (
        <span className="level-moves">
          <MoveButton {...moveButton} direction="up" isAtEnd={position.index === 0} />
          <MoveButton {...moveButton} direction="down" isAtEnd={position.index === position.count - 1} />
        </span>
      )}
    </li>
  );
}

interface MoveButtonProps extends Omit<LevelRowProps, 'position'> {
  readonly direction: MoveDirection;
  readonly isAtEnd: boolean;
}

// A short visible verb, the level's code in the accessible name; disabled at an end, aria-disabled while saving so the pressed button keeps focus.
function MoveButton({ level, saving, buttons, onMove, direction, isAtEnd }: MoveButtonProps) {
  const { text } = useLanguage();
  const register = registrationOf(buttons, buttonKey(level.id, direction));
  const move = () => {
    if (saving) {
      return;
    }
    void onMove({ levelId: level.id, direction });
  };
  const labels = direction === 'up' ? text.map.moveUp : text.map.moveDown;
  return (
    <button type="button" className="text-button" ref={register} disabled={isAtEnd} aria-disabled={saving} aria-label={interpolate(labels.name, { code: level.code })} onClick={move}>
      {labels.shown}
    </button>
  );
}

// Rows add their buttons as they mount and remove them as they unmount, so focus can follow a moved level.
function registrationOf(buttons: ButtonRefs, key: string) {
  return (element: HTMLButtonElement | null) => {
    if (element === null) {
      buttons.current.delete(key);
      return;
    }
    buttons.current.set(key, element);
  };
}

// Always in the page, so a screen reader announces each new position as it changes.
function MovedStatus({ move, levels }: { readonly move: LevelMove | null; readonly levels: readonly DashboardMapLevel[] }) {
  const { text, language } = useLanguage();
  const index = levels.findIndex(({ id }) => id === move?.levelId);
  const level = levels[index];
  const values = { code: level?.code ?? '', position: formatCount(index + 1, language), count: formatCount(levels.length, language) };
  return (
    <p role="status" className="muted">
      {level === undefined ? null : interpolate(text.map.moved, values)}
    </p>
  );
}
