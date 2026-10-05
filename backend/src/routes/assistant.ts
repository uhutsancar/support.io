// GET /api/assistant/status — whether this server can run the FAQ assistant.
//
// The panel uses it to show the per-site switch as available or not. It says
// whether a Gemini key is configured and which model answers — never the key.

import express from 'express';
import { auth } from '../middleware/auth';
import { assistantConfig } from '../config/assistant';
import { requireOrganization } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();

router.get('/status', auth, requireOrganization, (_req: Request, res: Response) => {
  const config = assistantConfig();
  res.json({ available: config !== null, model: config?.model ?? null });
});

export default router;
