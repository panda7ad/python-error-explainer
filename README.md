# 🐍 Python Error Explainer

> Understand your Python errors in plain English — without asking AI to fix them for you.

Python Error Explainer watches your terminal, detects Python errors the moment they occur, and opens a clean side panel that explains **what went wrong and why** — in language a beginner can understand.

It does **not** fix your code. That part is yours.

---

## Why this exists

When you're learning Python, the biggest enemy is not the error — it's not understanding what the error is *telling you*. Most beginners either:
- Paste the error into ChatGPT and accept the fix without understanding it, or
- Give up because the traceback looks like noise

This extension gives you a third option: read a human explanation, think about it, and fix it yourself. That's how you actually learn.

---

## How it works

```
You run Python code
       ↓
Terminal shows an error
       ↓
Extension detects the traceback
       ↓
Sends it to a local AI model (Ollama) on your machine
       ↓
Side panel opens with a plain English explanation
       ↓
You read it, think, and fix it yourself
```

Everything runs **locally on your machine**. No internet. No API keys. No data sent anywhere.

---

## Installation

### Step 1 — Install the extension
Search for **Python Error Explainer** in the VS Code Extensions panel and click Install.

Or install from `.vsix` file:
```
code --install-extension python-error-explainer-0.0.1.vsix
```

### Step 2 — Install Ollama (one time only)
Download from [ollama.com](https://ollama.com) and install it for your OS (Windows, Mac, or Linux).

### Step 3 — Download the AI model (one time only)
Open any terminal and run:
```bash
ollama pull phi3
```
This downloads a ~2.3 GB model to your computer. It only needs to happen once.

### Step 4 — You're done
Open VS Code. Run your Python code. The extension will automatically explain any errors you encounter.



---

## Usage

Once set up, the extension works **automatically**. There is nothing to click.

1. Open a `.py` file in VS Code
2. Run it in the integrated terminal (`python main.py`)
3. If it throws an error, a panel opens on the right side within a few seconds

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type:

| Command | What it does |
|---|---|
| `Python Error Explainer: Toggle On/Off` | Pause or resume the extension |
| `Python Error Explainer: Check Setup` | Verify Ollama is running |

### Settings

Go to **File → Preferences → Settings** and search for `Python Error Explainer`.

| Setting | Default | Options |
|---|---|---|
| `pythonErrorExplainer.ollamaModel` | `phi3` | `phi3`, `llama3.2`, `codellama`, `mistral` |
| `pythonErrorExplainer.enabled` | `true` | `true`, `false` |
| `pythonErrorExplainer.ollamaUrl` | `http://localhost:11434` | Change if using remote Ollama |

---

## Changing the AI model

Different models have different strengths and sizes. To switch:

1. Pull the model you want:
   ```bash
   ollama pull llama3.2
   ```
2. Update the setting in VS Code:
   **Settings → Python Error Explainer → Ollama Model → select model**

### Model comparison

| Model | Size | Speed | Best for |
|---|---|---|---|
| `phi3` | 2.3 GB | Fast | Daily use, beginner errors |
| `llama3.2` | 2 GB | Fast | General purpose |
| `codellama` | 3.8 GB | Medium | Code-specific errors |
| `mistral` | 4 GB | Medium | More detailed explanations |

---

## Troubleshooting

### "Setup Required" panel keeps appearing
Ollama is not running. Open a terminal and run:
```bash
ollama serve
```
Ollama should auto-start on system boot after initial install. If it doesn't, you can add it to startup programs.

### "Model Not Found" panel appears
You need to pull the model. Run:
```bash
ollama pull phi3
```

### Panel appears but explanation is empty
The model may still be loading (first request after boot takes longer). Wait 10 seconds and trigger another error.

### Extension seems stuck / not responding
Open the Command Palette and run **Python Error Explainer: Toggle On/Off** twice to reset it.

### Error in a library (not your code)
If the traceback points to a file inside `site-packages` (a library), the extension will still explain the error type — but the cause is usually how you called the library function, not the library itself.

---

## Project structure (for developers)

```
python-error-explainer/
├── src/
│   ├── extension.ts        # Entry point — activates extension, registers commands
│   ├── terminalWatcher.ts  # Intercepts terminal output, orchestrates the pipeline
│   ├── errorParser.ts      # Regex parser — turns raw traceback into structured data
│   ├── ollamaClient.ts     # HTTP client — talks to Ollama API at localhost:11434
│   ├── webviewPanel.ts     # UI — renders HTML explanation panel inside VS Code
│   └── types.ts            # Shared TypeScript interfaces
├── package.json            # Extension manifest and VS Code contribution points
├── tsconfig.json           # TypeScript compiler config
└── README.md
```

### Building from source

```bash
git clone https://github.com/panda7ad/python-error-explainer.git
cd python-error-explainer
npm install
npm run compile
```

To run in development:
- Press `F5` in VS Code to open a new Extension Development Host window
- Trigger a Python error in that window's terminal to test

To package:
```bash
npm install -g @vscode/vsce
vsce package
```

---

## Philosophy

This extension is intentionally designed with one constraint: **it explains, it never fixes**.

The explanation panel has no "Apply fix" button. No suggested code. No one-click solution. You get a plain English description of what went wrong and where to look.

This is not a limitation — it is the entire point. The moment you understand an error yourself and fix it, it stops being a mystery. The next time you see it, you'll recognize it immediately. That accumulation of recognized patterns is what coding fluency actually is.

---

## License

MIT
