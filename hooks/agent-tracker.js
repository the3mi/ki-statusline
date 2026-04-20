#!/usr/bin/env node
// Kiro hook script — receives hook events via stdin, updates state
import fs from 'fs';
import path from 'path';
import os from 'os';

const action = process.argv[2]; // 'spawn' | 'stop'
const statePath = path.join(os.homedir(), '.kiro', 'ki-statusline.json');

let state = { agents: [], events: [] };
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) {}

let raw = '';
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(raw);
    const eventName = event.hook_event_name || '';
    const agentName = event.agent_name || 'agent';

    if (eventName === 'agentSpawn' || action === 'spawn') {
      state.agents = state.agents.filter(a => a.name !== agentName);
      state.agents.push({ name: agentName, startMs: Date.now() });
    } else if (eventName === 'agentStop' || action === 'stop') {
      const agent = state.agents.find(a => a.name === agentName);
      if (agent) {
        state.agents = state.agents.filter(a => a.name !== agentName);
        state.events.unshift({ type: 'agent', name: agentName, ms: Date.now() });
        if (state.events.length > 10) state.events = state.events.slice(0, 10);
      }
    }

    fs.writeFileSync(statePath, JSON.stringify(state));
  } catch (_) {}
});
