// Kiro quota reader — reads local SQLite DB for credit usage
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const DB_PATH = path.join(os.homedir(), '.kiro', 'data', 'User', 'globalStorage', 'state.vscdb');
const BURN_PATH = path.join(os.homedir(), '.kiro', 'ki-statusline-burn.json');

function loadBurnHistory() {
  try {
    return JSON.parse(fs.readFileSync(BURN_PATH, 'utf8'));
  } catch (_) {
    return { readings: [] };
  }
}

function saveBurnHistory(history) {
  try {
    fs.writeFileSync(BURN_PATH, JSON.stringify(history));
  } catch (_) {}
}

function calcBurnRate(creditsUsed, creditsTotal) {
  const now = Date.now();
  const history = loadBurnHistory();

  // Add current reading
  history.readings.push({ ts: now, credits_used: creditsUsed });

  // Keep only last N readings (configurable, avoid unbounded growth)
  const MAX_READINGS = 48; // TODO: wire to config
  if (history.readings.length > MAX_READINGS) {
    history.readings = history.readings.slice(-MAX_READINGS);
  }

  saveBurnHistory(history);

  // Need at least 2 data points
  if (history.readings.length < 2) return null;

  const oldest = history.readings[0];
  const hoursElapsed = (now - oldest.ts) / 3600000;
  if (hoursElapsed < 0.01) return null; // avoid division by near-zero

  const creditsBurned = creditsUsed - oldest.credits_used;
  if (creditsBurned <= 0) return null; // no burn or reset happened

  const burnPerHour = creditsBurned / hoursElapsed;
  const remaining = creditsTotal - creditsUsed;
  if (remaining <= 0 || burnPerHour <= 0) return null;

  const hoursLeft = remaining / burnPerHour;
  const days = Math.floor(hoursLeft / 24);
  const hours = Math.floor(hoursLeft % 24);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

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
    const planName = data.plan_name || data.plan_tier || null;

    const pct = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;

    // Precise reset time (formatted) and countdown
    let resetCountdown = null;
    let resetTime = null;
    if (resetAt) {
      // usage_reset_at is Unix timestamp in ms
      const resetDate = typeof resetAt === 'number' ? new Date(resetAt) : new Date(resetAt);
      const resetMs = resetDate.getTime() - Date.now();
      if (resetMs > 0) {
        const hours = Math.floor(resetMs / 3600000);
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        resetCountdown = days > 0 ? `${days}d ${remHours}h` : `${remHours}h`;
        // Format as YYYY/MM/DD HH:mm
        const y = resetDate.getFullYear();
        const mo = String(resetDate.getMonth() + 1).padStart(2, '0');
        const d = String(resetDate.getDate()).padStart(2, '0');
        const h = String(resetDate.getHours()).padStart(2, '0');
        const mi = String(resetDate.getMinutes()).padStart(2, '0');
        resetTime = `${y}/${mo}/${d} ${h}:${mi}`;
      } else {
        resetTime = 'expired';
      }
    }

    // Burn rate prediction
    const burnEta = calcBurnRate(creditsUsed, creditsTotal);

    return { creditsTotal, creditsUsed, bonusTotal, bonusUsed, pct, resetCountdown, resetTime, planName, burnEta };
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
