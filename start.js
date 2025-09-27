#!/usr/bin/env node

import { spawn } from 'child_process';

const port = process.env.PORT || 3000;

console.log(`Starting admin app on port ${port}`);
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT
});

// Use serve for static files instead of vite preview
const child = spawn('npx', ['serve', '-s', 'dist', '-l', `tcp://0.0.0.0:${port}`], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: port.toString()
  }
});

child.on('error', (error) => {
  console.error('Failed to start admin app:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Admin app exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  child.kill('SIGINT');
});
