// Supabase Edge Function: bitrot-rot (Deno). BIT ROT "ROT METER" (shared decay meter + daily feed streaks).
// GET  ?wallet=0x..            -> meter state (+ that wallet's streak)
// POST { message, signature }  -> feed the rot (once per wallet per UTC day). message is signed with personal_sign:
//   BIT ROT: FEED THE ROT\nWallet: 0x..\nDay: YYYY-MM-DD\nNonce: <hex>\nIssued At: <iso>\n\nFree signature. No transaction, no gas.
// All state + rules live in SQL (bitrot_rot_get / bitrot_rot_feed). Deploy with verify_jwt=false (auth = wallet signature).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { recoverMessageAddress, type Hex } from 'npm:viem@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ORIGINS = (Deno.env.get('BITROT_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
// Vercel previews of the "bitrot" project (bitrot-git-<branch>-<scope>.vercel.app / bitrot-<hash>-<scope>.vercel.app).
// Override with BITROT_PREVIEW_ORIGIN_RE to lock it to the exact team scope.
const PREVIEW = new RegExp(Deno.env.get('BITROT_PREVIEW_ORIGIN_RE') || '^https://bitrot(-[a-z0-9-]+)?\\.vercel\\.app$');
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const SKEW = 10 * 60_000;

function originOk(o: string) { return !!o && (ORIGINS.includes(o) || PREVIEW.test(o) || LOCAL.test(o)); }
function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return { 'access-control-allow-origin': originOk(o) ? o : (ORIGINS[0] || 'null'), 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'origin' };
}
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
function checkMessage(m: unknown, now: number): { wallet: string; nonce: string } | { error: string } {
  if (typeof m !== 'string' || m.length > 600 || !m.startsWith('BIT ROT: FEED THE ROT\n')) return { error: 'bad_message' };
  const addr = /\nWallet: (\S+)\n/.exec(m)?.[1] || '', day = /\nDay: (\d{4}-\d{2}-\d{2})\n/.exec(m)?.[1] || '';
  const nonce = /\nNonce: ([0-9a-f]{16,64})\n/.exec(m)?.[1] || '', iss = Date.parse(/\nIssued At: (\S+)\n/.exec(m)?.[1] || '');
  if (!ADDR.test(addr) || !day || !nonce || !isFinite(iss)) return { error: 'bad_message' };
  if (Math.abs(now - iss) > SKEW || day !== utcDay(now)) return { error: 'message_expired' };
  return { wallet: addr.toLowerCase(), nonce };
}
async function state(wallet: string | null) {
  const { data, error } = await db.rpc('bitrot_rot_get', { p_wallet: wallet }); if (error) throw error; return data;
}

Deno.serve(async req => {
  const h = cors(req); if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const J = (b: unknown, status = 200) => Response.json(b, { status, headers: { ...h, 'cache-control': 'no-store' } });
  const origin = req.headers.get('origin') || '';
  try {
    if (req.method === 'GET') {
      // GETs without an Origin header (curl, link previews) are allowed: read-only public state.
      if (origin && !originOk(origin)) return J({ error: 'bad_origin' }, 403);
      const w = new URL(req.url).searchParams.get('wallet');
      return J(await state(w && ADDR.test(w) ? w.toLowerCase() : null));
    }
    if (req.method !== 'POST') return J({ error: 'method_not_allowed' }, 405);
    if (!originOk(origin)) return J({ error: 'bad_origin' }, 403);
    if (Number(req.headers.get('content-length') || 0) > 4 * 1024) return J({ error: 'too_large' }, 413);
    let body: any; try { body = await req.json(); } catch { return J({ error: 'bad_json' }, 400); }
    const now = Date.now(); const c = checkMessage(body?.message, now); if ('error' in c) return J(c, 401);
    let rec: string; try { rec = (await recoverMessageAddress({ message: body.message, signature: body.signature as Hex })).toLowerCase(); } catch { return J({ error: 'bad_signature' }, 401); }
    if (rec !== c.wallet) return J({ error: 'bad_signature' }, 401);
    const { data, error } = await db.rpc('bitrot_rot_feed', { p_wallet: c.wallet, p_nonce: c.nonce }); if (error) throw error;
    if (data?.error === 'already_fed') return J(data, 429);
    if (data?.error) return J(data, 400);
    return J(data);
  } catch (e) { console.error(e); return J({ error: 'server_error' }, 500); }
});
