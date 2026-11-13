import type { DashboardMapLevel } from '@palier/shared-types';
import { useEffect, useState } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useLevelOrder, type LevelMove, type LevelOrderTarget, type MoveDirection } from './useLevelOrder.ts';

type ButtonRefs = Map<string, HTMLButtonElement>;

const OTHER_DIRECTION: Readonly<Record<MoveDirection, MoveDirection>> = { up: 'down', down: 'up' };

function buttonKey(levelId: string, direction: MoveDirection): string {
  return `${levelId}-${direction}`;
}

export function LevelOrderList(target: LevelOrderTarget) {
  const order = useLevelOrder(target);
  // A registry the rows fill as they mount, kept for the page's life; never read to render.
  const [buttons] = useState<ButtonRefs>(() => new Map());
  useFocusOnMovedLevel(buttons, order.lastMove, target.levels);
  return (
    <>
      <ol className="row-list" aria-busy={order.saving}>
        {target.levels.map((level, index) => (
          <LevelRow key={level.id} level={level} position={{ index, count: target.levels.length }} saving={order.saving} buttons={buttons} onMove={order.move} />
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
    const moved = buttons.get(buttonKey(move.levelId, move.direction));
    const other = buttons.get(buttonKey(move.levelId, OTHER_DIRECTION[move.direction]));
    (moved?.disabled === true ? other : moved)?.focus();
  }, [buttons, move, levels]);
}

interface LevelRowProps {
  readonly level: DashboardMapLevel;
  readonly position: { readonly index: number; readonly count: number };
  readonly saving: boolean;
  readonly buttons: ButtonRefs;
  readonly onMove: (move: LevelMove) => Promise<void>;
}

function LevelRow({ level, position, saving, buttons, onMove }: LevelRowProps) {
  const { text, language } = useLanguage();
  const moveButton = { level, saving, buttons, onMove };
  return (
    <li className="row level-row">
      <span className="level-position">{formatCount(position.index + 1, language)}</span>
      <span className="row-name">{level.code}</span>
      <span className="level-moves">
        <MoveButton {...moveButton} direction="up" label={text.map.moveUp} isAtEnd={position.index === 0} />
        <MoveButton {...moveButton} direction="down" label={text.map.moveDown} isAtEnd={position.index === position.count - 1} />
      </span>
    </li>
  );
}

interface MoveButtonProps extends Omit<LevelRowProps, 'position'> {
  readonly direction: MoveDirection;
  readonly label: string;
  readonly isAtEnd: boolean;
}

// disabled at an end, where the move makes no sense; aria-disabled while saving, so the pressed button keeps focus.
function MoveButton({ level, saving, buttons, onMove, direction, label, isAtEnd }: MoveButtonProps) {
  const key = buttonKey(level.id, direction);
  const register = (element: HTMLButtonElement | null) => void (element === null ? buttons.delete(key) : buttons.set(key, element));
  const move = () => void (saving ? undefined : onMove({ levelId: level.id, direction }));
  return (
    <button type="button" className="text-button" ref={register} disabled={isAtEnd} aria-disabled={saving} onClick={move}>
      {interpolate(label, { code: level.code })}
    </button>
  );
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
