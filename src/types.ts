// All shared TypeScript interfaces for the extension

export interface ParsedError {
  errorType: string;       // e.g. "NameError"
  errorMessage: string;    // e.g. "name 'x' is not defined"
  fileName: string;        // e.g. "main.py"
  lineNumber: number;      // e.g. 12
  codeLine: string;        // e.g. "print(x)"
  fullTraceback: string;   // raw full traceback text
}

export interface OllamaResponse {
  success: boolean;
  explanation: string;
  error?: string;          // set when success is false
}

export interface ExtensionConfig {
  ollamaModel: string;
  enabled: boolean;
  ollamaUrl: string;
}
