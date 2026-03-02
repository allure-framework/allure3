import express, { Request, Response, NextFunction } from 'express';

const JSON_BODY_LIMIT = process.env.BODY_SIZE_LIMIT || '50mb';

export const isResultsUpload = (req: Request) =>
  req.method === 'POST' &&
  req.originalUrl.includes('/launches/') &&
  req.originalUrl.includes('/results');

const defaultJsonParser = express.json({
  limit: JSON_BODY_LIMIT,
  strict: false,
  verify: (req: Request, _res: Response, buf: Buffer) => {
    (req as any).rawBody = buf.toString('utf8');
  }
});

/** For results upload we skip global JSON parse; the route will read body with express.raw() */
export const jsonParser = (req: Request, res: Response, next: NextFunction) => {
  if (isResultsUpload(req)) {
    return next();
  }
  return defaultJsonParser(req, res, next);
};

// Error handler for JSON parsing
export function jsonErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if this is a JSON parsing error
  const isJsonError = err instanceof SyntaxError || 
                      (err as any).type === 'entity.parse.failed' ||
                      (err as any).status === 400 && err.message.includes('JSON');
  
  if (isJsonError) {
    const rawBody = (req as any).rawBody || '';
    const errorMessage = err.message;
    
    console.error('=== JSON PARSING ERROR ===');
    console.error('Error message:', errorMessage);
    console.error('Error type:', (err as any).type);
    console.error('Raw body length:', rawBody.length);
    console.error('Content-Type:', req.headers['content-type']);
    console.error('Content-Length header:', req.headers['content-length']);
    console.error('Actual body length:', rawBody.length);
    
    // Log the problematic JSON section
    const errorMatch = errorMessage.match(/position (\d+)/);
    if (errorMatch && rawBody.length > 0) {
      const position = parseInt(errorMatch[1], 10);
      const start = Math.max(0, position - 200);
      const end = Math.min(rawBody.length, position + 200);
      console.error('Error at position:', position);
      console.error('Context before:', rawBody.substring(start, position));
      console.error('Context after:', rawBody.substring(position, end));
      if (position < rawBody.length) {
        console.error('Character at position:', JSON.stringify(rawBody[position]), 'code:', rawBody.charCodeAt(position));
      }
    }
    
    res.status(400).json({
      error: 'Invalid JSON',
      code: 'INVALID_JSON',
      details: err.message,
      timestamp: new Date().toISOString()
    });
    return;
  }
  next(err);
}

// URL-encoded body parser
export const urlEncodedParser = express.urlencoded({
  extended: true,
  limit: process.env.BODY_SIZE_LIMIT || '10mb'
});
