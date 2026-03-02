import compression from 'compression';

export const compressionMiddleware = compression({
  filter: (req, res) => {
    // Don't compress responses if request has no-transform cache control
    if (req.headers['cache-control']?.includes('no-transform')) {
      return false;
    }
    // Use compression for all other responses
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9)
  threshold: 1024 // Only compress responses larger than 1KB
});
