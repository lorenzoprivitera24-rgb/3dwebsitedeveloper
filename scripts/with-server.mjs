#!/usr/bin/env node
// with-server.mjs — avvia il dev server, aspetta che risponda DAVVERO, esegue il comando
// passato e spegne tutto. Serve a rendere i gate lanciabili con un comando solo, anche da
// un worktree (dove la preview MCP servirebbe il checkout principale, non questo codice).
//
// Uso: node scripts/with-server.mjs node scripts/state-gate.mjs [args...]
//      PORT=5199 (default) — la porta è passata al comando come ultimo argomento URL.
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT ?? 5199)
const URL = `http://127.0.0.1:${PORT}/`
const cmd = process.argv.slice(2)
if (cmd.length === 0) {
  console.error('uso: node scripts/with-server.mjs <comando> [args...]')
  process.exit(2)
}

// --host 127.0.0.1 esplicito: senza, Vite si lega a `localhost`, che su macOS risolve ::1 e
// lascia il gate a bussare su 127.0.0.1 fino al timeout (sintomo: "server non raggiungibile"
// mentre il log di Vite dice ready).
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
const serverLog = []
server.stdout.on('data', (d) => serverLog.push(String(d)))
server.stderr.on('data', (d) => serverLog.push(String(d)))

const stop = () => {
  if (!server.killed) server.kill('SIGTERM')
}
process.on('exit', stop)
process.on('SIGINT', () => {
  stop()
  process.exit(130)
})

// attesa attiva: un timeout fisso è la ricetta per un gate che fallisce a caso
const deadline = Date.now() + 60_000
let up = false
while (Date.now() < deadline) {
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(1500) })
    if (r.ok) {
      up = true
      break
    }
  } catch {
    /* non ancora su */
  }
  await new Promise((r) => setTimeout(r, 300))
}

if (!up) {
  console.error(`✗ dev server non raggiungibile su ${URL} entro 60 s`)
  console.error(serverLog.join('').slice(-2000))
  stop()
  process.exit(1)
}

const child = spawn(cmd[0], [...cmd.slice(1), URL], { stdio: 'inherit' })
const code = await new Promise((resolve) => child.on('close', resolve))
stop()
process.exit(code ?? 0)
