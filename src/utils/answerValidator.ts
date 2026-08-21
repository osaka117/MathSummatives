import { PracticeProblem } from '../types/math';

export interface ValidationResult {
  isCorrect: boolean;
  feedback: string;
}

export function validateAnswer(
  userRawInput: string,
  problem: PracticeProblem,
  selectedOptionLabel?: string
): ValidationResult {
  const trimmed = (userRawInput || '').trim();

  // 1. Multiple-Choice Mode: If user clicked an explicit multiple-choice option button ('a', 'b', 'c', 'd')
  if (selectedOptionLabel) {
    const selectedClean = selectedOptionLabel.trim().toLowerCase();
    const correctClean = (problem.correctOptionLabel || '').trim().toLowerCase();

    // Direct check by option label
    if (correctClean && selectedClean === correctClean) {
      return {
        isCorrect: true,
        feedback: `Correct! You selected Option (${selectedOptionLabel.toUpperCase()}).`
      };
    }

    // Direct check by option object property
    const chosenOption = problem.options.find(
      opt => opt.label.trim().toLowerCase() === selectedClean
    );
    if (chosenOption && chosenOption.isCorrect === true) {
      return {
        isCorrect: true,
        feedback: `Correct! You selected Option (${selectedOptionLabel.toUpperCase()}).`
      };
    }

    // If neither matched, this multiple choice selection is INCORRECT.
    return {
      isCorrect: false,
      feedback: `Incorrect. Option (${selectedOptionLabel.toUpperCase()}) is not the correct answer.`
    };
  }

  // If input is empty
  if (!trimmed) {
    return {
      isCorrect: false,
      feedback: 'Please enter or select an answer before submitting.'
    };
  }

  // 2. Direct single-letter typed answer (e.g. user typed "b", "(b)", "Option B", "b.")
  const singleLetterMatch = trimmed.match(/^[\(\[]?\s*([a-dA-D])\s*[\)\]\.]?$/i) ||
                            trimmed.match(/^option\s+([a-dA-D])$/i);
  if (singleLetterMatch && problem.correctOptionLabel) {
    const typedLetter = singleLetterMatch[1].toLowerCase();
    const correctLetter = problem.correctOptionLabel.toLowerCase();
    if (typedLetter === correctLetter) {
      return {
        isCorrect: true,
        feedback: `Correct! Option (${problem.correctOptionLabel.toUpperCase()}) is the right answer.`
      };
    } else {
      return {
        isCorrect: false,
        feedback: `Incorrect. Option (${typedLetter.toUpperCase()}) is not the correct answer.`
      };
    }
  }

  const normInput = normalizeMathString(trimmed);

  // 3. Prevent false positives: Check if typed text matches any of the explicit INCORRECT options
  const matchedIncorrectOption = problem.options.find(
    opt => !opt.isCorrect && normalizeMathString(opt.text) === normInput
  );
  if (matchedIncorrectOption) {
    return {
      isCorrect: false,
      feedback: `Incorrect. "${trimmed}" is not the correct answer.`
    };
  }

  // 4. Exact string match against normalized correct answer
  const normCorrectAnswer = normalizeMathString(problem.correctAnswer);
  if (normInput === normCorrectAnswer) {
    return {
      isCorrect: true,
      feedback: 'Correct! Excellent work.'
    };
  }

  // 5. Match against the correct option object's text
  const correctOption = problem.options.find(opt => opt.isCorrect);
  if (correctOption && normInput === normalizeMathString(correctOption.text)) {
    return {
      isCorrect: true,
      feedback: 'Correct! Your answer matches the solution.'
    };
  }

  // 6. Match against valid acceptable answers list
  if (problem.acceptableAnswers && problem.acceptableAnswers.length > 0) {
    for (const acceptable of problem.acceptableAnswers) {
      if (acceptable) {
        const normAcceptable = normalizeMathString(acceptable);
        if (normInput === normAcceptable) {
          return {
            isCorrect: true,
            feedback: 'Correct! Your answer matches the solution.'
          };
        }
      }
    }
  }

  // 7. Coordinates comparison (e.g. "(5, -2)" vs "5, -2")
  const userCoords = extractCoordinates(trimmed);
  const correctCoords = extractCoordinates(problem.correctAnswer);
  if (userCoords && correctCoords) {
    if (userCoords[0] === correctCoords[0] && userCoords[1] === correctCoords[1]) {
      return {
        isCorrect: true,
        feedback: `Correct! Coordinates (${userCoords[0]}, ${userCoords[1]}) match.`
      };
    }
  }

  // 8. Interval notation comparison (e.g. "[3, 8]" vs "[3,8]")
  const userInterval = extractInterval(trimmed);
  const correctInterval = extractInterval(problem.correctAnswer);
  if (userInterval && correctInterval && userInterval === correctInterval) {
    return {
      isCorrect: true,
      feedback: 'Correct! The interval notation matches.'
    };
  }

  // 9. Numeric tolerance comparison (only for purely numeric answers, strictly within 0.05)
  const userNum = extractNumber(trimmed);
  const correctNum = extractNumber(problem.correctAnswer);
  if (userNum !== null && correctNum !== null && !isNaN(userNum) && !isNaN(correctNum)) {
    const diff = Math.abs(userNum - correctNum);
    // Allow strict rounding tolerance up to 0.05 (e.g. 19.4 vs 19.40)
    if (diff <= 0.05) {
      return {
        isCorrect: true,
        feedback: 'Correct! Your calculated value matches.'
      };
    }
  }

  // If none matched, mark as Incorrect
  return {
    isCorrect: false,
    feedback: 'Incorrect. Review the step-by-step solution below to see the methodology.'
  };
}

export function normalizeMathString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\le|<=|≤/g, '<=')
    .replace(/\\ge|>=|≥/g, '>=')
    .replace(/\\ne|!=|≠/g, '!=')
    .replace(/\\pm|±/g, '+-')
    .replace(/\\cdot|\\times|×|\*/g, '*')
    .replace(/\\approx/g, '=')
    .replace(/\\circ|°/g, '')
    .replace(/\\cup/g, 'u')
    .replace(/\\infty/g, 'inf')
    .replace(/cm|km|miles|meters|m\^2|m²|degrees/g, '')
    .replace(/[$]/g, '');
}

function extractNumber(str: string): number | null {
  // Only extract if string represents a single numeric value (e.g. "19.40 cm" or "19.4")
  const cleaned = str.replace(/[^\d.-]/g, ' ').trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const num = parseFloat(tokens[0]);
    return isNaN(num) ? null : num;
  }
  return null;
}

function extractCoordinates(str: string): [number, number] | null {
  const cleaned = str.replace(/[()]/g, '').trim();
  const parts = cleaned.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

function extractInterval(str: string): string | null {
  const match = str.match(/([(\[])\s*(-?\d+|-\w+|-?\\infty)\s*,\s*(\d+|\w+|\\infty|\+?\\infty)\s*([)\]])/);
  if (match) {
    return `${match[1]}${match[2].replace('\\', '')},${match[3].replace('\\', '')}${match[4]}`;
  }
  return null;
}
