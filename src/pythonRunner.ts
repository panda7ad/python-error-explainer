import * as vscode from 'vscode';
import cp from 'child_process';
import * as path from 'path';
import { parsePythonTraceback } from './errorParser';
import { explainError, checkOllamaRunning, checkModelAvailable } from './ollamaClient';
import { showExplanationPanel, showSetupPanel, showModelMissingPanel } from './webviewPanel';

export class PythonRunner {
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    // Output channel acts as the "terminal" — shows raw Python output
    this.outputChannel = vscode.window.createOutputChannel('Python Error Explainer');
  }

  async runCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    // Must have a Python file open
    if (!editor) {
      vscode.window.showWarningMessage('Open a Python file first.');
      return;
    }
    if (editor.document.languageId !== 'python') {
      vscode.window.showWarningMessage('This command only works with Python files.');
      return;
    }

    // Save the file before running so we get the latest code
    await editor.document.save();

    const filePath = editor.document.fileName;
    const fileDir = path.dirname(filePath);

    this.outputChannel.clear();
    this.outputChannel.show(true); // show but keep focus on editor
    this.outputChannel.appendLine(`Running: python "${filePath}"\n${'─'.repeat(50)}`);

    // Status bar spinner
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(sync~spin) Running Python...';
    statusBar.show();

    try {
      const { stdout, stderr } = await this.spawnPython(filePath, fileDir);

      // Show all output in the channel
      if (stdout) { this.outputChannel.appendLine(stdout); }

      // ── No error — just show output cleanly ─────────────────────────────
      if (!stderr || !stderr.includes('Traceback')) {
        if (stderr) { this.outputChannel.appendLine(stderr); }
        statusBar.dispose();
        return;
      }

      // ── Error detected ───────────────────────────────────────────────────
      this.outputChannel.appendLine('\n' + stderr);
      this.outputChannel.appendLine('\n' + '─'.repeat(50));
      this.outputChannel.appendLine('Explaining error...');

      statusBar.text = '$(sync~spin) Explaining error...';

      const parsed = parsePythonTraceback(stderr);
      if (!parsed) {
        statusBar.dispose();
        return;
      }

      const config = vscode.workspace.getConfiguration('pythonErrorExplainer');
      const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
      const model = config.get<string>('ollamaModel', 'phi3');

      // Check Ollama
      const running = await checkOllamaRunning(ollamaUrl);
      if (!running) {
        showSetupPanel(this.context);
        statusBar.dispose();
        return;
      }

      // Check model
      const modelAvailable = await checkModelAvailable(ollamaUrl, model);
      if (!modelAvailable) {
        showModelMissingPanel(this.context, model);
        statusBar.dispose();
        return;
      }

      // Get explanation
      const result = await explainError(parsed, model, ollamaUrl);

      if (!result.success && result.error?.startsWith('MODEL_NOT_FOUND:')) {
        showModelMissingPanel(this.context, model);
        statusBar.dispose();
        return;
      }

       this.outputChannel.appendLine('Error explained');
       showExplanationPanel(this.context, parsed, result);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error.';
      vscode.window.showErrorMessage(`Python Error Explainer: ${msg}`);
    } finally {
      statusBar.dispose();
    }
  }

  // ── Spawn python process, collect stdout + stderr ─────────────────────────
  private spawnPython(filePath: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Try 'python' first, fall back to 'python3' (Linux/Mac default)
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

      const proc = cp.spawn(pythonCmd, [filePath], { cwd });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: any) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: any) => { stderr += data.toString(); });

      proc.on('close', () => resolve({ stdout, stderr }));
      proc.on('error', (err: Error) => {
        // 'python' not found — try 'python3'
        if (err.message.includes('ENOENT') && pythonCmd === 'python') {
          const proc2 = cp.spawn('python3', [filePath], { cwd });
          let out2 = '';
          let err2 = '';
          proc2.stdout.on('data', (d: any) => { out2 += d.toString(); });
          proc2.stderr.on('data', (d: any) => { err2 += d.toString(); });
          proc2.on('close', () => resolve({ stdout: out2, stderr: err2 }));
          proc2.on('error', () => reject(new Error('Python not found. Make sure Python is installed and in your PATH.')));
        } else {
          reject(err);
        }
      });
    });
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
