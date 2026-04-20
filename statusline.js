#!/usr/bin/env node
// Kiro CLI Statusline — reads hook events via stdin, outputs ANSI statusline
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { readQuota, fmtCredits } from './lib/quota.js';

// ─── Config ────────────────────────────────────────────────────────────────
const THEME = 'catppuccin';  // 'default' | 'nord' | 'catppuccin' | 'dracula'
const USE_POWERLINE = true;
const PL  = USE_POWERLINE ? '\uE0B0' : '│';
const PLR = USE_POWERLINE ? '\uE0B2' : '│';
const R = '\x1b[0m', DIM = '\x1b[2m', BOLD = '\x1b[1m';

// ─── Themes ────────────────────────────────────────────────────────────────
const THEMES = {
  default:    { s: '\x1b[36m', c: '\x1b[32m', d: '\x1b[2m', e: '\x1b[35m', ok: '\x1b[32m', hi: '\x1b[31m', bar: '\x1b[36m', qLow: '\x1b[32m', qMid: '\x1b[33m', qHi: '\x1b[31m' },
  nord:       { s: '\x1b[38;5;75m',  c: '\x1b[38;5;181m', d: '\x1b[38;5;244m', e: '\x1b[38;5;139m', ok: '\x1b[38;5;142m', hi: '\x1b[38;5;203m', bar: '\x1b[38;5;68m', qLow: '\x1b[38;5;142m', qMid: '\x1b[38;5;222m', qHi: '\x1b[38;5;203m' },
  catppuccin: { s: '\x1b[38;5;147m', c: '\x1b[38;5;114m', d: '\x1b[38;5;245m', e: '\x1b[38;5;212m', ok: '\x1b[38;5;114m', hi: '\x1b[38;5;203m', bar: '\x1b[38;5;117m', qLow: '\x1b[38;5;114m', qMid: '\x1b[38;5;222m', qHi: '\x1b[38;5;203m' },
  dracula:    { s: '\x1b[38;5;171m', c: '\x1b[38;5;84m', d: '\x1b[38;5;244m', e: '\x1b[38;5;212m', ok: '\x1b[38;5;84m', hi: '\x1b[38;5;203m', bar: '\x1b[38;5;117m', qLow: '\x1b[38;5;84m', qMid: '\x1b[38;5;222m', qHi: '\x1b[38;5;203m' },
};
const C = THEMES[THEME] || THEMES.default;

// ─── Atomic write ─────────────────────────────────────────────────────────
function atomicWrite(f, data) {
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  try { fs.writeFileSync(tmp, data); fs.renameSync(tmp, f); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} }
}

// ─── Bar chart ────────────────────────────────────────────────────────────
function bar(len) {
  return '\u2588'.repeat(len);
}

// ─── Format helpers ──────────────────────────────────────────────────────
function fmtDir(p) {
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 2) return p;
  return parts.slice(-2).join('/');
}

function ageMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

// ─── Load state ──────────────────────────────────────────────────────────
const statePath = path.join(os.homedir(), '.kiro', 'ki-statusline.json');
let state = { sessionId: '', cwd: '', startMs: 0, agents: [], events: [] };

try {
  state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
} catch (_) {}

// ─── Parse stdin hook event ───────────────────────────────────────────────
let raw = '';
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(raw);
    const eventName = event.hook_event_name || '';
    const cwd = event.cwd || state.cwd || process.cwd();
    const sessionId = event.session_id || state.sessionId || '';

    // Update state
    state.cwd = cwd;
    state.sessionId = sessionId;
    if (!state.startMs) state.startMs = Date.now();

    if (eventName === 'agentSpawn') {
      const name = event.agent_name || 'agent';
      state.agents = state.agents.filter(a => a.name !== name);
      state.agents.push({ name, startMs: Date.now() });
    } else if (eventName === 'agentStop') {
      const name = event.agent_name || '';
      const agent = state.agents.find(a => a.name === name);
      if (agent) {
        state.agents = state.agents.filter(a => a.name !== name);
        state.events.unshift({ type: 'stop', name, ms: Date.now() });
        if (state.events.length > 5) state.events = state.events.slice(0, 5);
      }
    }

    // Track tool calls
    if (eventName === 'toolCall') {
      state.events.unshift({ type: 'tool', name: event.tool_name || '?', ms: Date.now() });
      if (state.events.length > 10) state.events = state.events.slice(0, 10);
    }

    atomicWrite(statePath, JSON.stringify(state));

    // ─── Build output ─────────────────────────────────────────────────────
    const running = state.agents.length;
    const age = state.startMs ? ageMs(Date.now() - state.startMs) : '0s';
    const shortDir = fmtDir(cwd);
    const shortSid = sessionId ? sessionId.slice(0, 8) : 'no-session';

    const seg = (t, fg) => fg + t + R;
    const dim = t => DIM + t + R;
    const bold = (t, fg) => BOLD + fg + t + R;

    // Left: session + directory
    const left = [
      bold(shortSid, C.s),
      dim(shortDir),
    ].join(' ');

    // Right: agents + uptime
    const right = [];
    if (running > 0) right.push(seg(`${running}\u25C6`, C.e));
    right.push(dim(age));

    // Last tool/agent event
    if (state.events.length > 0) {
      const last = state.events[0];
      if (last.type === 'tool') {
        right.push(dim(last.name));
      } else if (last.type === 'stop') {
        right.push(dim(`${last.name} ${ageMs(Date.now() - last.ms)}`));
      }
    }

    // Quota display
    const quota = readQuota();
    const quotaParts = [];
    if (quota) {
      // Plan name badge
      if (quota.planName) quotaParts.push(seg(`[${quota.planName}]`, C.s));

      // Main credits bar
      const qColor = quota.pct < 50 ? C.qLow : quota.pct < 80 ? C.qMid : C.qHi;
      const filled = Math.round(quota.pct / 100 * 6);
      const empty = 6 - filled;
      const qBar = qColor + bar(filled) + R + DIM + '░'.repeat(empty) + R;
      quotaParts.push(qBar + ' ' + dim(`${fmtCredits(quota.creditsUsed)}/${fmtCredits(quota.creditsTotal)}`));

      // Bonus credits (separate segment, different color)
      if (quota.bonusTotal > 0) {
        const bonusRemaining = quota.bonusTotal - quota.bonusUsed;
        quotaParts.push(seg(`\uF753 ${fmtCredits(bonusRemaining)}/${fmtCredits(quota.bonusTotal)}`, C.bar));
      }

      // Precise reset time + countdown
      if (quota.resetTime) {
        if (quota.resetTime === 'expired') {
          quotaParts.push(seg('\u27F3 expired', C.qHi));
        } else {
          const resetLabel = quota.resetCountdown ? `\u27F3 ${quota.resetTime} (${quota.resetCountdown})` : `\u27F3 ${quota.resetTime}`;
          quotaParts.push(dim(resetLabel));
        }
      }

      // Burn rate prediction
      if (quota.burnEta) quotaParts.push(seg(`\uF7EE ${quota.burnEta}`, C.qMid));
    }

    const sep = ' ' + DIM + PL + ' ' + R;
    let output = left;
    if (quotaParts.length > 0) output += sep + quotaParts.join(' ');
    if (right.length > 0) output += sep + right.join(' ');

    if (USE_POWERLINE) {
      output = DIM + PLR + ' ' + R + output + ' ' + DIM + PL + R;
    }

    process.stdout.write(output + '\n');
  } catch (e) {
    process.stdout.write('');
  }
});
