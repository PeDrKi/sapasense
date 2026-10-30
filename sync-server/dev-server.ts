// Local server with the same API, backed by SQLite (node:sqlite). `npm run sync-server` → http://localhost:8787
// Env: PORT, DB_FILE (default: in memory), ADMIN_TOKEN (default "dev-admin" — local use only), ADMIN_TOKENS="name:token:role,…".
import http from 'node:http'
import { handle, parseAdmins } from './handler'
import { d1Api } from './db'
import { sqliteD1 } from './sqlite-shim'

const api = d1Api(sqliteD1(process.env.DB_FILE || ':memory:'))
const admins = parseAdmins(process.env.ADMIN_TOKENS || '', process.env.ADMIN_TOKEN || 'dev-admin')

http.createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = Buffer.concat(chunks)
  const request = new Request('http://localhost' + req.url, { method: req.method, headers: req.headers as Record<string, string>, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body })
  const out = await handle(request, api, { admins, ip: req.socket.remoteAddress || '' })
  res.writeHead(out.status, Object.fromEntries(out.headers))
  res.end(Buffer.from(await out.arrayBuffer()))
}).listen(Number(process.env.PORT || 8787), () => console.log('api dev server on', process.env.PORT || 8787, '(admins: ' + admins.map(a => `${a.name}/${a.role}`).join(', ') + ')'))
