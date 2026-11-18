import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'logicbench' });
  });

  // Engineering Diagnostics & Circuit Analysis endpoint using Gemini 4 Carbon High Thinking
  app.post('/api/diagnostics/analyze', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error:
          'GEMINI_API_KEY is not configured. Configure a valid API key in Settings > Secrets.',
      });
      return;
    }

    const { question, circuitSummary } = req.body ?? {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'A technical question is required.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = [
        'You are a senior digital electronics laboratory engineer assisting a student on a DT-1004 Digital Circuit Trainer (LogicBench).',
        'Analyze the student circuit state accurately using standard TTL (74xx), CMOS (4077), 6116 SRAM, and LTS542 common-anode 7-segment datasheets.',
        'Provide concise, precise engineering guidance with exact pin numbers and active-low/edge-triggering details.',
        '',
        'Current Trainer Circuit State:',
        JSON.stringify(circuitSummary ?? {}, null, 2),
        '',
        'Student Query:',
        question.trim(),
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-carbon',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction:
            'Be strictly accurate with IC pinouts, power pins (e.g., 7483 VCC=5/GND=12, 7476 VCC=5/GND=13, 7490 VCC=5/GND=10), clock edges, and active-low controls. Keep answers structured, concise, and practical for lab wiring.',
        },
      });

      res.json({
        answer: response.text ?? 'No diagnostic explanation returned.',
        model: 'gemini-4-carbon',
        thinkingLevel: 'HIGH',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to analyze circuit with Gemini.';
      const status =
        message.includes('PERMISSION_DENIED') || message.includes('403')
          ? 403
          : message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
          ? 429
          : 500;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LogicBench server running at http://localhost:${PORT}`);
  });
}

startServer();
