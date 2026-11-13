const WHITESPACE = /\s+/g;

function normalized(text: string | null): string {
  return (text ?? '').replace(WHITESPACE, ' ').trim();
}

// A count line is a paragraph whose figure sits in its own span, so the sentence is matched on the paragraph's whole text.
export function lineOf(sentence: string): (content: string, element: Element | null) => boolean {
  return (_content, element) => element?.tagName === 'P' && normalized(element.textContent) === normalized(sentence);
}
