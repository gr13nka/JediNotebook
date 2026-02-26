import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;

  // If no API key is configured, allow all requests
  if (!apiKey) {
    return next();
  }

  const provided = req.headers['x-api-key'];
  if (provided === apiKey) {
    return next();
  }

  res.status(401).json({ error: 'Invalid or missing API key' });
}
