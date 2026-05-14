
import * as vscode from 'vscode';
import { PythonRunner } from './pythonRunner';
import { checkOllamaRunning } from './ollamaClient';
import { showSetupPanel } from './webviewPanel';

let runner: PythonRunner | undefined;

export function activate(context: vscode.ExtensionContext): void {
  runner = new PythonRunner(context);

  // ── Command: Run current Python file and explain any error ────────────────
  const runCommand = vscode.commands.registerCommand(
    'pythonErrorExplainer.runFile',
    () => runner?.runCurrentFile()
  );

  // ── Command: Check setup ──────────────────────────────────────────────────
  const checkSetupCommand = vscode.commands.registerCommand(
    'pythonErrorExplainer.checkSetup',
    async () => {
      const config = vscode.workspace.getConfiguration('pythonErrorExplainer');
      const url = config.get<string>('ollamaUrl', 'http://localhost:11434');
      const running = await checkOllamaRunning(url);
      if (running) {
        vscode.window.showInformationMessage('✅ Ollama is running. Python Error Explainer is ready.');
      } else {
        showSetupPanel(context);
      }
    }
  );

  context.subscriptions.push(runCommand, checkSetupCommand);

  // Show setup panel once on first install if Ollama not found
  setTimeout(async () => {
    const config = vscode.workspace.getConfiguration('pythonErrorExplainer');
    const url = config.get<string>('ollamaUrl', 'http://localhost:11434');
    const running = await checkOllamaRunning(url);
    if (!running) {
      const seen = context.globalState.get<boolean>('hasSeenSetup', false);
      if (!seen) {
        showSetupPanel(context);
        context.globalState.update('hasSeenSetup', true);
      }
    }
  }, 2000);
}

export function deactivate(): void {
  runner?.dispose();
}
