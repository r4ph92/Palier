// A number, with its percent sign when it has one: "15 %" in French, "15%" in English.
const FIGURE = /(\d+(?:\s?%)?)/;

// The sentence stays in the text font; each number in it is set as a tabular mono figure (design.md, signature move 3).
export function FiguresInText({ text }: { readonly text: string }) {
  const parts = text.split(FIGURE);
  return <>{parts.map((part, index) => (isFigurePart(index) ? <span key={index} className="figure">{part}</span> : part))}</>;
}

// Splitting on a captured pattern puts each match at an odd index, between the text around it.
function isFigurePart(index: number): boolean {
  return index % 2 === 1;
}
