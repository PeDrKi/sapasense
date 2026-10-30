// Cloudflare Worker (free plan) — deploy with `npx wrangler deploy` from the sync-server folder.
// Needs a D1 database bound as DB (see wrangler.toml + schema.sql) and a secret ADMIN_TOKENS (`npx wrangler secret put ADMIN_TOKENS`, format name:token:role,…) or the older single ADMIN_TOKEN.
import { handle, parseAdmins } from './handler'
import { d1Api, type D1Like } from './db'

interface Env { DB: D1Like; ADMIN_TOKENS?: string; ADMIN_TOKEN?: string; ALLOWED_ORIGIN?: string }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, d1Api(env.DB), { origin: env.ALLOWED_ORIGIN || '*', admins: parseAdmins(env.ADMIN_TOKENS, env.ADMIN_TOKEN), ip: request.headers.get('CF-Connecting-IP') || '' })
  },
}
