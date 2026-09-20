// Entrypoint for Vercel deployment fallback
const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  const distDir = path.join(__dirname, 'frontend', 'dist');
  let targetPath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);

  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    targetPath = path.join(distDir, 'index.html');
  }

  if (targetPath.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
  else if (targetPath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  else if (targetPath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
  else if (targetPath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');

  if (fs.existsSync(targetPath)) {
    return res.end(fs.readFileSync(targetPath));
  }

  res.end('TripZo Live Frontend');
};
