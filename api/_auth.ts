// Acceso por correo: solo los correos de ALLOWED_EMAILS pueden entrar.
// Se manda un código de 6 números por correo (vía Make) y, si es correcto,
// queda una cookie firmada por 90 días. No hay base de datos: todo va firmado con AUTH_SECRET.

const DIAS_SESION = 90
const MIN_CODIGO = 10
const COOKIE = 'sesion'
const enc = new TextEncoder()

function b64url(datos: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof datos === 'string' ? enc.encode(datos) : new Uint8Array(datos)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function desdeB64url(s: string) {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'))
}

async function hmac(texto: string) {
  const secreto = process.env.AUTH_SECRET
  if (!secreto) throw new Error('Falta AUTH_SECRET')
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', clave, enc.encode(texto)))
}

// Comparación de largo fijo para no filtrar información por el tiempo de respuesta.
function iguales(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function firmar(datos: object) {
  const cuerpo = b64url(JSON.stringify(datos))
  return `${cuerpo}.${await hmac(cuerpo)}`
}

async function abrir<T>(token: string): Promise<T | null> {
  const [cuerpo, firma] = token.split('.')
  if (!cuerpo || !firma || !iguales(firma, await hmac(cuerpo))) return null
  try {
    const datos = JSON.parse(desdeB64url(cuerpo)) as T & { exp: number }
    return datos.exp > Date.now() ? datos : null
  } catch {
    return null
  }
}

export function normalizarCorreo(c: unknown) {
  return typeof c === 'string' ? c.trim().toLowerCase() : ''
}

export function correoPermitido(correo: string) {
  const lista = (process.env.ALLOWED_EMAILS ?? '').split(',').map(normalizarCorreo).filter(Boolean)
  return !!correo && lista.includes(correo)
}

// Devuelve el código (para mandarlo por correo) y el desafío firmado que guarda la app.
export async function nuevoDesafio(correo: string) {
  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  const exp = Date.now() + MIN_CODIGO * 60_000
  const desafio = await firmar({ e: correo, exp, h: await hmac(`codigo:${correo}:${exp}:${codigo}`) })
  return { codigo, desafio }
}

export async function verificarCodigo(desafio: string, codigo: string) {
  const d = await abrir<{ e: string; exp: number; h: string }>(desafio)
  if (!d || !correoPermitido(d.e)) return null
  const limpio = codigo.replace(/\D/g, '')
  return iguales(d.h, await hmac(`codigo:${d.e}:${d.exp}:${limpio}`)) ? d.e : null
}

export async function cookieSesion(correo: string) {
  const token = await firmar({ e: correo, exp: Date.now() + DIAS_SESION * 86_400_000 })
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS_SESION * 86_400}`
}

export const cookieSalir = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

export async function correoDeSesion(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const token = cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  if (!token) return null
  const d = await abrir<{ e: string }>(token)
  // Si se saca un correo de ALLOWED_EMAILS, su sesión deja de valer en el acto.
  return d && correoPermitido(d.e) ? d.e : null
}

export const sinSesion = () => Response.json({ error: 'Iniciá sesión' }, { status: 401 })
