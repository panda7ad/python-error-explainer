import * as vscode from 'vscode';
import { ParsedError, OllamaResponse } from './types';

// Single shared panel — reused across errors so we don't spam new tabs
let currentPanel: vscode.WebviewPanel | undefined;

// ── Show the error explanation panel ─────────────────────────────────────────
export function showExplanationPanel(
  context: vscode.ExtensionContext,
  parsed: ParsedError,
  result: OllamaResponse
): void {
  const panel = getOrCreatePanel('🐍 Error Explained');
  panel.webview.html = buildExplanationHTML(parsed, result);
}

// ── Show the Ollama setup instructions ───────────────────────────────────────
export function showSetupPanel(context: vscode.ExtensionContext): void {
  const panel = getOrCreatePanel('⚙️ Setup Required');
  panel.webview.html = buildSetupHTML();
}

// ── Show model-not-found error ────────────────────────────────────────────────
export function showModelMissingPanel(
  context: vscode.ExtensionContext,
  model: string
): void {
  const panel = getOrCreatePanel('⚙️ Model Missing');
  panel.webview.html = buildModelMissingHTML(model);
}

// ── Internal: get existing panel or create new one ───────────────────────────
function getOrCreatePanel(title: string): vscode.WebviewPanel {
  if (currentPanel) {
    currentPanel.title = title;
    currentPanel.reveal(vscode.ViewColumn.Beside, true); // true = don't steal focus
    return currentPanel;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'pythonErrorExplainer',
    title,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: false } // no scripts needed — pure HTML/CSS
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });

  return currentPanel;
}

// ── HTML Builders ─────────────────────────────────────────────────────────────

function buildExplanationHTML(parsed: ParsedError, result: OllamaResponse): string {
  // Short file name for display (strip long paths)
  const shortFile = parsed.fileName.includes('/')
    ? parsed.fileName.split('/').pop() ?? parsed.fileName
    : parsed.fileName.includes('\\')
    ? parsed.fileName.split('\\').pop() ?? parsed.fileName
    : parsed.fileName;

  const docsUrl = `https://docs.python.org/3/library/exceptions.html#${parsed.errorType}`;

  // What to show in the explanation box
  const explanationBlock = result.success
    ? `<div class="explanation-box">
        <div class="box-label">What happened</div>
        <p class="explanation-text">${escapeHtml(result.explanation)}</p>
       </div>`
    : `<div class="error-box">
        <div class="box-label">Could not get explanation</div>
        <p>${escapeHtml(result.error ?? 'Unknown error')}</p>
       </div>`;

  const codeBlock = parsed.codeLine
    ? `<div class="section-label">Code that caused it</div>
       <div class="code-block">
         <span class="line-num">line ${parsed.lineNumber}</span>
         <code>${escapeHtml(parsed.codeLine)}</code>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --subtle: var(--vscode-descriptionForeground);
    --border: var(--vscode-widget-border, #444);
    --block-bg: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.05));
    --link: var(--vscode-textLink-foreground, #4fc1ff);
    --red: #e74c3c;
    --green: #27ae60;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    background: var(--bg);
    color: var(--fg);
    padding: 24px 20px;
    line-height: 1.6;
  }

  /* ── Header ── */
  .header { margin-bottom: 20px; }

  .error-badge {
    display: inline-block;
    background: var(--red);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 3px 10px;
    border-radius: 12px;
    margin-bottom: 10px;
  }

  .title {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .meta {
    font-size: 12px;
    color: var(--subtle);
  }

  /* ── Code block ── */
  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--subtle);
    margin: 20px 0 6px 0;
  }

  .code-block {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--block-bg);
    border-left: 3px solid var(--red);
    padding: 10px 14px;
    border-radius: 0 6px 6px 0;
    overflow-x: auto;
  }

  .line-num {
    font-size: 11px;
    color: var(--subtle);
    white-space: nowrap;
    flex-shrink: 0;
  }

  code {
    font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
    font-size: 13px;
    white-space: pre;
  }

  /* ── Explanation box ── */
  .explanation-box {
    margin-top: 20px;
    background: var(--block-bg);
    border-left: 3px solid var(--green);
    border-radius: 0 6px 6px 0;
    padding: 14px 16px;
  }

  .error-box {
    margin-top: 20px;
    background: rgba(231, 76, 60, 0.08);
    border: 1px solid var(--red);
    border-radius: 6px;
    padding: 14px 16px;
  }

  .box-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--subtle);
    margin-bottom: 8px;
  }

  .explanation-text {
    font-size: 14px;
    line-height: 1.75;
  }

  /* ── Footer ── */
  .divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 24px 0 16px 0;
  }

  .docs-link {
    color: var(--link);
    font-size: 13px;
    text-decoration: none;
  }
  .docs-link:hover { text-decoration: underline; }

  .reminder {
    margin-top: 14px;
    font-size: 12px;
    color: var(--subtle);
    font-style: italic;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="error-badge">${escapeHtml(parsed.errorType)}</div>
    <div class="title">What went wrong?</div>
    <div class="meta">📄 ${escapeHtml(shortFile)} · Line ${parsed.lineNumber}</div>
  </div>

  ${codeBlock}
  ${explanationBlock}

  <hr class="divider"/>

  <a class="docs-link" href="${escapeHtml(docsUrl)}">
    📖 Official Python docs for ${escapeHtml(parsed.errorType)} →
  </a>

  <div class="reminder">
    💡 Try to figure it out yourself before searching for the answer.
    The struggle is where the learning happens.
  </div>
</body>
</html>`;
}

function buildSetupHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    padding: 24px 20px;
    line-height: 1.6;
  }
  h1 { font-size: 20px; margin-bottom: 8px; }
  .subtitle { color: var(--vscode-descriptionForeground); font-size: 13px; margin-bottom: 24px; }
  .step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
  .num {
    width: 28px; height: 28px; border-radius: 50%;
    background: #3498db; color: white;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px; flex-shrink: 0;
    margin-top: 1px;
  }
  .step-text { font-size: 14px; }
  code {
    background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.08));
    padding: 2px 8px; border-radius: 4px;
    font-family: 'Courier New', monospace; font-size: 13px;
  }
  .note {
    margin-top: 24px; padding: 14px;
    background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.05));
    border-radius: 6px; font-size: 13px;
    color: var(--vscode-descriptionForeground); line-height: 1.7;
  }
</style>
</head>
<body>
  <h1>⚙️ One-time Setup Required</h1>
  <p class="subtitle">
    Python Error Explainer uses a local AI model — nothing ever leaves your machine.
  </p>

  <div class="step">
    <div class="num">1</div>
    <div class="step-text">
      Download and install <strong>Ollama</strong> from
      <a href="https://ollama.com" style="color: var(--vscode-textLink-foreground);">ollama.com</a>
      (free, Windows / Mac / Linux)
    </div>
  </div>

  <div class="step">
    <div class="num">2</div>
    <div class="step-text">
      Open a terminal and run:<br/>
      <code>ollama pull phi3</code><br/>
      <span style="font-size:12px; color: var(--vscode-descriptionForeground);">
        Downloads the AI model (~2.3 GB, one time only)
      </span>
    </div>
  </div>

  <div class="step">
    <div class="num">3</div>
    <div class="step-text">
      Restart VS Code. The extension will work automatically from now on.
    </div>
  </div>

  <div class="note">
    🔒 Your code never leaves your computer.<br/>
    📦 The model is stored locally and runs offline after download.<br/>
    ⚡ Ollama starts automatically when your computer starts.
  </div>
</body>
</html>`;
}

function buildModelMissingHTML(model: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 24px 20px; font-size: 14px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    line-height: 1.6;
  }
  h1 { font-size: 20px; margin-bottom: 8px; }
  p { margin-bottom: 16px; color: var(--vscode-descriptionForeground); }
  code {
    background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.08));
    padding: 8px 14px; border-radius: 6px; display: block;
    font-family: 'Courier New', monospace; font-size: 14px;
    margin: 12px 0;
  }
  .tip { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 20px; }
</style>
</head>
<body>
  <h1>⚠️ Model Not Found</h1>
  <p>
    Ollama is running but the model <strong>${escapeHtml(model)}</strong> is not installed.
    Run this command in your terminal:
  </p>
  <code>ollama pull ${escapeHtml(model)}</code>
  <p>
    Or change the model in VS Code settings:<br/>
    <strong>Settings → Python Error Explainer → Ollama Model</strong>
  </p>
  <p class="tip">Available models: phi3 (~2.3GB), llama3.2 (~2GB), codellama (~3.8GB), mistral (~4GB)</p>
</body>
</html>`;
}

// Prevent XSS in the webview
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
