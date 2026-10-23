// Sesión por correo. La cookie la maneja el servidor; acá solo se recuerda
// el correo para dejar cargar tomas sin señal y se avisa cuando la sesión venció.

const CLAVE = 'correo'

export function correoGuardado() {
  try {
    return localStorage.getItem(CLAVE) ?? ''
  } catch {
    return ''
  }
}

function recordarCorreo(c: string) {
  try {
    if (c) localStorage.setItem(CLAVE, c)
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento: igual funciona mientras la app esté abierta.
  }
}

const oyentes = new Set<() => void>()
export function alVencerSesion(fn: () => void) {
  oyentes.add(fn)
  return () => {
    oyentes.delete(fn)
  }
}

// Lo llaman sync y diario cuando el servidor responde 401.
export function sesionVencida() {
  recordarCorreo('')
  oyentes.forEach((fn) => fn())
}

export async function consultarSesion(): Promise<string | null> {
  const r = await fetch('/api/sesion', { cache: 'no-store' })
  if (r.status === 401) {
    recordarCorreo('')
    return null
  }
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`)
  const { correo } = (await r.json()) as { correo: string }
  recordarCorreo(correo)
  return correo
}

async function login(datos: object) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datos),
  })
  const cuerpo = (await r.json().catch(() => ({}))) as { error?: string; desafio?: string; correo?: string }
  if (!r.ok) throw new Error(cuerpo.error ?? `El servidor respondió ${r.status}`)
  return cuerpo
}

export async function pedirCodigo(correo: string) {
  return (await login({ correo })).desafio ?? ''
}

export async function confirmarCodigo(desafio: string, codigo: string) {
  const { correo = '' } = await login({ desafio, codigo })
  recordarCorreo(correo)
  return correo
}

export async function cerrarSesion() {
  await fetch('/api/sesion', { method: 'DELETE' }).catch(() => {})
  recordarCorreo('')
}
