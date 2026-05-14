import { ParsedError } from './types';

// Strip ANSI color/escape codes that terminals inject into output
export function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[mGKHFJABCDsuhl]/g, '')
    .replace(/\x1b\[?\d*[A-Za-z]/g, '')
    .replace(/\r/g, '');
}

// Main parser — returns null if no Python traceback found in the text
export function parsePythonTraceback(rawOutput: string): ParsedError | null {
  const output = stripAnsi(rawOutput);

  // Must contain the traceback header to proceed
  if (!output.includes('Traceback (most recent call last):')) {
    return null;
  }

  // ── 1. Extract error type and message ────────────────────────────────────
  // Python always ends a traceback with: ErrorType: message
  // This regex covers: NameError, ValueError, custom.module.ErrorType, etc.
  const errorLineRegex =
    /^([A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception|Warning|Interrupt|Exit|StopIteration|GeneratorExit|BaseException|KeyboardInterrupt|SystemExit))\s*:\s*(.+)$/m;

  const errorMatch = output.match(errorLineRegex);

  // Fallback: SyntaxError has a different format sometimes
  const syntaxMatch = !errorMatch
    ? output.match(/^(SyntaxError|IndentationError|TabError)\s*:\s*(.+)$/m)
    : null;

  const match = errorMatch || syntaxMatch;
  if (!match) {
    return null;
  }

  const errorType = match[1].trim();
  const errorMessage = match[2].trim();

  // ── 2. Extract file name and line number ─────────────────────────────────
  // Tracebacks list multiple "File X, line Y" entries for nested calls.
  // We want the LAST one — closest to where the actual error happened.
  const fileLineRegex = /File "(.+?)", line (\d+)/g;
  let fileMatch: RegExpExecArray | null;
  let lastFileMatch: RegExpExecArray | null = null;

  while ((fileMatch = fileLineRegex.exec(output)) !== null) {
    // Skip internal Python files like <frozen importlib>
    if (!fileMatch[1].startsWith('<')) {
      lastFileMatch = fileMatch;
    }
  }

  // Fall back to any match including internals if nothing else found
  if (!lastFileMatch) {
    fileLineRegex.lastIndex = 0;
    fileLineRegex.exec(output); // reset and grab first
    while ((fileMatch = fileLineRegex.exec(output)) !== null) {
      lastFileMatch = fileMatch;
    }
  }

  const fileName = lastFileMatch ? lastFileMatch[1] : 'unknown file';
  const lineNumber = lastFileMatch ? parseInt(lastFileMatch[2], 10) : 0;

  // ── 3. Extract the actual code line ──────────────────────────────────────
  // After "File X, line Y", the next non-empty line is the code that caused it
  let codeLine = '';
  if (lastFileMatch) {
    const afterFile = output.substring(
      lastFileMatch.index + lastFileMatch[0].length
    );
    // The code line is indented with spaces/tabs on the next line
    const codeLineMatch = afterFile.match(/\n[ \t]+(.+)/);
    if (codeLineMatch) {
      codeLine = codeLineMatch[1].trim();
    }
  }

  return {
    errorType,
    errorMessage,
    fileName,
    lineNumber,
    codeLine,
    fullTraceback: output.trim(),
  };
}
