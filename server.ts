import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, '.guru-admin-data');
const LATEST_BACKUP_FILE = path.join(DATA_DIR, 'guru-admin-pro-latest.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/storage/status', (_req, res) => {
    try {
      if (!fs.existsSync(LATEST_BACKUP_FILE)) {
        return res.json({ hasSnapshot: false });
      }
      const stat = fs.statSync(LATEST_BACKUP_FILE);
      const raw = JSON.parse(fs.readFileSync(LATEST_BACKUP_FILE, 'utf-8')) as {
        exportedAt?: string;
        academicYearName?: string;
        summary?: Record<string, number>;
      };
      return res.json({
        hasSnapshot: true,
        updatedAt: raw.exportedAt || stat.mtime.toISOString(),
        academicYearName: raw.academicYearName || '-',
        summary: raw.summary || {},
      });
    } catch {
      return res.json({ hasSnapshot: false });
    }
  });

  app.post('/api/storage/sync', (req, res) => {
    try {
      const payload = req.body;
      if (!payload || payload.app !== 'GURU_ADMIN_PRO' || !payload.data) {
        return res.status(400).json({ error: 'Format snapshot tidak valid.' });
      }
      ensureDataDir();
      const tmpFile = `${LATEST_BACKUP_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf-8');
      fs.renameSync(tmpFile, LATEST_BACKUP_FILE);
      return res.json({ ok: true, syncedAt: new Date().toISOString() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan snapshot.';
      return res.status(500).json({ error: msg });
    }
  });

  app.get('/api/storage/latest', (_req, res) => {
    try {
      if (!fs.existsSync(LATEST_BACKUP_FILE)) {
        return res.status(404).json({ error: 'Belum ada snapshot tersimpan di server.' });
      }
      const content = fs.readFileSync(LATEST_BACKUP_FILE, 'utf-8');
      return res.type('application/json').send(content);
    } catch {
      return res.status(500).json({ error: 'Gagal membaca snapshot server.' });
    }
  });

  app.get('/api/gemini/status', (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const configured = Boolean(
      apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== ''
    );
    res.json({ configured });
  });

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Layanan AI belum aktif karena GEMINI_API_KEY belum dikonfigurasi pada Secrets server. Anda tetap dapat menggunakan seluruh fitur administrasi secara manual.',
          code: 'API_KEY_MISSING',
        });
      }

      const {
        prompt,
        systemInstruction,
        responseMimeType,
        responseSchema,
        useGoogleSearch,
      } = req.body as {
        prompt?: string;
        systemInstruction?: string;
        responseMimeType?: string;
        responseSchema?: Record<string, unknown>;
        useGoogleSearch?: boolean;
      };

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt tidak boleh kosong.' });
      }

      const config: Record<string, unknown> = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (useGoogleSearch) {
        config.tools = [{ googleSearch: {} }];
      } else {
        if (responseMimeType) {
          config.responseMimeType = responseMimeType;
        }
        if (responseSchema) {
          config.responseSchema = responseSchema;
        }
      }

      let response;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config,
          });
          lastErr = null;
          break;
        } catch (e: unknown) {
          lastErr = e;
          const msg = e instanceof Error ? e.message : '';
          if (
            attempt === 0 &&
            !msg.includes('403') &&
            !msg.includes('API_KEY_INVALID') &&
            !msg.includes('PERMISSION_DENIED')
          ) {
            await new Promise((r) => setTimeout(r, 900));
            continue;
          }
          throw e;
        }
      }
      if (lastErr || !response) {
        throw lastErr || new Error('Gagal menerima respons dari AI.');
      }

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const groundingLinks = chunks
        .map((c: { web?: { uri?: string; title?: string } }) => ({
          uri: c.web?.uri || '',
          title: c.web?.title || '',
        }))
        .filter((l: { uri: string; title: string }) => Boolean(l.uri));

      return res.json({
        text: response.text ?? '',
        groundingLinks,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Gagal menghubungi layanan AI.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GURU ADMIN PRO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
