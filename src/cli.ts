#!/usr/bin/env node
import { startServer } from './index.js';

if (process.argv.includes('--test')) {
  console.log('@hirehuman/mcp v0.2.0 – OK');
  process.exit(0);
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
