import { Router } from 'express';
import { getChangesSince, applyChanges } from '../services/syncService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/sync/changes', (req, res) => {
  try {
    const since = (req.query.since as string) || '1970-01-01T00:00:00.000Z';
    const changes = getChangesSince(since);
    res.json(changes);
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: 'Failed to fetch changes' });
  }
});

router.post('/sync/changes', (req, res) => {
  try {
    applyChanges(req.body);
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: 'Failed to apply changes' });
  }
});

export default router;
