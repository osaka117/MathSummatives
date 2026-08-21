import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
  block?: boolean;
}

/**
 * Safely renders LaTeX string with KaTeX
 */
function renderKatexSafe(math: string, displayMode: boolean): string {
  if (!math || !math.trim()) return '';
  try {
    return katex.renderToString(math.trim(), {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml'
    });
  } catch (err) {
    console.warn('KaTeX render warning:', err);
    return math;
  }
}

/**
 * Checks if a string without explicit delimiters is a pure LaTeX or math formula
 */
function isPureMathFormula(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;

  // If it starts with explicit block or inline dollar signs
  if (trimmed.startsWith('$$') || trimmed.startsWith('$')) return true;

  // If it contains LaTeX backslash commands like \le, \ge, \frac, \sqrt, \text, \cup, \infty, etc.
  const hasLatexCommands = /\\[a-zA-Z]+/.test(trimmed);

  // If it contains \text{...}, remove all \text{...} blocks to test the remaining structure
  const withoutTextBlocks = trimmed.replace(/\\text\{[^}]*\}/g, '').trim();

  // If it has LaTeX commands and the part outside \text{...} doesn't look like an English paragraph
  if (hasLatexCommands) {
    // Check if what's outside \text{...} contains ordinary multi-word sentences
    const plainWordsOutside = withoutTextBlocks.replace(/\\[a-zA-Z]+/g, '').match(/[a-zA-Z]{3,}/g) || [];
    // If few plain words outside \text blocks (like x, y, cm, m), it is a math formula
    if (plainWordsOutside.length <= 3) {
      return true;
    }
  }

  // Pure algebraic equation or inequality without backslashes (e.g., x^2 + 3x - 4 = 0, x^2 - 25 < 0, (x - 3)(x - 8) <= 0)
  const isAlgebraicEquation = /^[a-zA-Z0-9\s()+\-*/=<>≤≥^_,.\\[\]]+$/.test(trimmed) &&
    (/[\^=<>≤≥]/.test(trimmed) || /\\/.test(trimmed)) &&
    !(/\b(and|the|is|are|which|what|when|where|why|how|with|from|between|below|above|select|choose|solve|point|triangle|length|side|angle)\b/i.test(trimmed));

  if (isAlgebraicEquation) {
    return true;
  }

  return false;
}

/**
 * Pre-processes math formulas: converts common unicode or plain inequality symbols to LaTeX if in formula mode
 */
function sanitizeFormula(formula: string): string {
  return formula
    .replace(/<=/g, '\\le ')
    .replace(/>=/g, '\\ge ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/±/g, '\\pm ')
    .replace(/×/g, '\\times ')
    .replace(/°/g, '^\\circ ');
}

/**
 * Main rendering dispatcher for math and mixed text
 */
export function formatMathString(text: string, isBlock: boolean = false): string {
  if (!text) return '';

  const trimmed = text.trim();

  // 1. Explicit block math: $$...$$
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
    const inner = trimmed.slice(2, -2);
    return renderKatexSafe(sanitizeFormula(inner), true);
  }

  // 2. Explicit single inline math: $...$
  if (trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.indexOf('$', 1) === trimmed.length - 1) {
    const inner = trimmed.slice(1, -1);
    return renderKatexSafe(sanitizeFormula(inner), isBlock);
  }

  // 3. Text containing explicit $...$ or $$...$$ delimiters
  if (text.includes('$')) {
    let processed = text;

    // Replace block math $$...$$
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      return `<div class="my-2 overflow-x-auto">${renderKatexSafe(sanitizeFormula(math), true)}</div>`;
    });

    // Replace inline math $...$
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      return renderKatexSafe(sanitizeFormula(math), false);
    });

    // If there are still lingering LaTeX commands outside $ (e.g. \le, \ge, \frac, \sqrt), render them
    if (/\\[a-zA-Z]+/.test(processed)) {
      processed = processed.replace(/(\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^[\]]*\])*)/g, (match) => {
        return renderKatexSafe(match, false);
      });
    }

    return processed;
  }

  // 4. Pure LaTeX formula or answer choice without $ (e.g. "x \le -2 \text{ or } x \ge 1", "\frac{2}{3}", "\sqrt{x+1}")
  if (isPureMathFormula(trimmed)) {
    return renderKatexSafe(sanitizeFormula(trimmed), isBlock);
  }

  // 5. Plain English or mixed text containing LaTeX backslash commands
  if (/\\[a-zA-Z]+/.test(text)) {
    // Replace isolated LaTeX expressions inside the text
    const processed = text.replace(/([a-zA-Z0-9_^({\[\s]*\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^[\]]*\]|[a-zA-Z0-9_^({\[\s])*)/g, (match) => {
      // If the match is worth rendering with KaTeX
      if (/^[\s,.]+$/.test(match)) return match;
      return renderKatexSafe(sanitizeFormula(match), false);
    });
    return processed;
  }

  // 6. Plain text / label (e.g. "SSA (Side-Side-Angle)", "Two triangles", "19.40 cm", "90°")
  // Escape HTML characters for safe rendering
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const MathRenderer: React.FC<MathRendererProps> = ({ text, className = '', block = false }) => {
  const renderedContent = useMemo(() => {
    return formatMathString(text, block);
  }, [text, block]);

  if (block) {
    return (
      <div
        className={`katex-wrapper leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    );
  }

  return (
    <span
      className={`katex-wrapper inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};
