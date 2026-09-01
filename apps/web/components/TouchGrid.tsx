"use client";

const SYMBOLS: { id: string; glyph: string; label: string }[] = [
  { id: "circle", glyph: "○", label: "Círculo" },
  { id: "square", glyph: "■", label: "Quadrado" },
  { id: "triangle", glyph: "▲", label: "Triângulo" },
  { id: "diamond", glyph: "◆", label: "Losango" },
  { id: "cross", glyph: "✕", label: "Cruz" },
  { id: "star", glyph: "★", label: "Estrela" },
];

interface TouchGridProps {
  order: string[]; // shuffled order to display, per WCAG/anti-shoulder-surfing UX
  selected: string[];
  onSelect: (symbolId: string) => void;
  disabled?: boolean;
}

export function TouchGrid({ order, selected, onSelect, disabled }: TouchGridProps): JSX.Element {
  return (
    <div className="touch-grid" role="group" aria-label="Sequência 3-Touch">
      {order.map((id) => {
        const symbol = SYMBOLS.find((s) => s.id === id);
        if (!symbol) return null;
        const isSelected = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            className="touch-symbol"
            aria-pressed={isSelected}
            aria-label={symbol.label}
            disabled={disabled || (isSelected && selected[selected.length - 1] !== id)}
            onClick={() => onSelect(id)}
          >
            {symbol.glyph}
          </button>
        );
      })}
    </div>
  );
}

export function shuffledSymbolOrder(): string[] {
  const ids = SYMBOLS.map((s) => s.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    // Fisher-Yates swap over a small, locally-generated array of fixed
    // symbol ids; i/j are bounded loop indices, never user input.
    // eslint-disable-next-line security/detect-object-injection
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  }
  return ids;
}
