import { StateMark } from '../components/StateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import type { ChecklistLine } from './checklistLines.ts';

export function ChecklistSection({ lines }: { readonly lines: readonly ChecklistLine[] }) {
  const text = useText();
  return (
    <section className="section" aria-labelledby="checklist-title">
      <h2 id="checklist-title" className="section-title">
        {text.publication.checklistTitle}
      </h2>
      <ul className="row-list">
        {lines.map((line) => (
          <ChecklistItem key={line.key} line={line} />
        ))}
      </ul>
    </section>
  );
}

// The word carries the state, the square only repeats it (design.md, gesture 4).
function ChecklistItem({ line }: { readonly line: ChecklistLine }) {
  const text = useText();
  return (
    <li className="row checklist-line">
      <span className="checklist-name">{line.name}</span>
      <StateMark tone={line.isMet ? 'free' : 'danger'} label={line.isMet ? text.publication.met : text.publication.unmet} />
      <span className="checklist-detail muted">{line.detail}</span>
    </li>
  );
}
