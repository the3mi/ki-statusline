// Kiro quota reader — reads local SQLite DB for credit usage
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const DB_PATH = path.join(os.homedir(), '.kiro', 'data', 'User', 'globalStorage', 'state.vscdb');

export function readQuota() {
  if (!fs.existsSync(DB_PATH)) return null;

  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'kiro.kiroAgent'").get();
    db.close();

    if (!row || !row.value) return null;

    const data = JSON.parse(row.value);
    const creditsTotal = data.credits_total || 0;
    const creditsUsed = data.credits_used || 0;
    const bonusTotal = data.bonus_total || 0;
    const bonusUsed = data.bonus_used || 0;
    const resetAt = data.usage_reset_at || null;

    const pct = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;

    let resetCountdown = null;
    if (resetAt) {
      const resetMs = new Date(resetAt).getTime() - Date.now();
      if (resetMs > 0) {
        const hours = Math.floor(resetMs / 3600000);
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        resetCountdown = days > 0 ? `${days}d ${remHours}h` : `${remHours}h`;
      }
    }

    return { creditsTotal, creditsUsed, bonusTotal, bonusUsed, pct, resetCountdown };
  } catch (_) {
    return null;
  }
}

export function fmtCredits(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'G';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
