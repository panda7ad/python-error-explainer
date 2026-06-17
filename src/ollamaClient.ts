import * as http from 'http';
import { ParsedError, OllamaResponse } from './types';

const SYSTEM_PROMPT = 
`You are a Python teacher helping a complete beginner understand their error.

Your ONLY job is to explain what went wrong. You must NEVER fix the code.

follow these Hard rules:
- Use simple everyday English. No jargon unless you immediately explain it.
- Maximum 4 sentences.
- Sentence 1: What the error type means in plain English.
- Sentence 2: Why this specific error happened based on their code line.
- Sentence 3: One hint about where to look, NOT what to change.
- Sentence 4 (optional): A common cause beginners miss for this error type.
- Sentence 5: Try to give the answer in points 
- NEVER write any code.
- NEVER say "you should change X to Y" or "the fix is".
- Respond in plain text only. No markdown, no bullet points, no bold.`;

function buildPrompt(parsed: ParsedError): string {
  return `A Python beginner got this error:

Error type: ${parsed.errorType}
Error message: ${parsed.errorMessage}
File: ${parsed.fileName}
Line number: ${parsed.lineNumber}
Code on that line: ${parsed.codeLine || '(not available)'}

Explain what went wrong in simple terms. Do not fix it.`;
}

// ── Core HTTP POST using Node built-in (no fetch needed) ─────────────────────
function httpPost(url: string, body: object, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const parsed = new URL(url);

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: Number(parsed.port) || 11434,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };

    const req = http.request(options, (res: import("http").IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP_${res.statusCode}:${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });

    req.on('error', (err: Error) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

// ── GET request helper ────────────────────────────────────────────────────────
function httpGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: Number(parsed.port) || 11434,
      path: parsed.pathname,
      method: 'GET',
    };

    const req = http.request(options, (res: import("http").IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => resolve(data));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });

    req.on('error', (err: Error) => reject(err));
    req.end();
  });
}

// ── Check if Ollama is running ────────────────────────────────────────────────
export async function checkOllamaRunning(baseUrl: string): Promise<boolean> {
  try {
    await httpGet(`${baseUrl}/api/tags`, 3000);
    return true;
  } catch {
    return false;
  }
}

// ── Check if model is downloaded ─────────────────────────────────────────────
export async function checkModelAvailable(baseUrl: string, model: string): Promise<boolean> {
  try {
    const raw = await httpGet(`${baseUrl}/api/tags`, 3000);
    const data = JSON.parse(raw) as { models: { name: string }[] };
    return data.models.some((m) => m.name.startsWith(model));
  } catch {
    return false;
  }
}

// ── Send error to Ollama, get plain English explanation ───────────────────────
export async function explainError(
  parsed: ParsedError,
  model: string,
  baseUrl: string
): Promise<OllamaResponse> {
  try {
    const raw = await httpPost(
      `${baseUrl}/api/generate`,
      {
        model,
        prompt: buildPrompt(parsed),
        system: SYSTEM_PROMPT,
        stream: false,
        options: { temperature: 0.3, num_predict: 250, top_p: 0.9 },
      },
      30000
    );

    const data = JSON.parse(raw) as { response?: string; error?: string };

    if (data.error) {
      if (data.error.toLowerCase().includes('model') && data.error.toLowerCase().includes('not found')) {
        return { success: false, explanation: '', error: `MODEL_NOT_FOUND:${model}` };
      }
      return { success: false, explanation: '', error: data.error };
    }

    const explanation = data.response?.trim();
    if (!explanation) {
      return { success: false, explanation: '', error: 'Ollama returned an empty response.' };
    }

    return { success: true, explanation };

  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'TIMEOUT') {
        return { success: false, explanation: '', error: 'Request timed out. The model may still be loading — try again in a moment.' };
      }
      if (err.message.startsWith('HTTP_404')) {
        return { success: false, explanation: '', error: `MODEL_NOT_FOUND:${model}` };
      }
      if (err.message.includes('ECONNREFUSED')) {
        return { success: false, explanation: '', error: 'OLLAMA_NOT_RUNNING' };
      }
      return { success: false, explanation: '', error: err.message };
    }
    return { success: false, explanation: '', error: 'Unknown error occurred.' };
  }
}