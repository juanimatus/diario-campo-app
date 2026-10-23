import { correoDeSesion, sinSesion } from './_auth.js'

// Cambios hechos desde la app: variedad de una toma, reprocesar, borrar tomas y variedades.
// Los aplica el escenario de Make "App Vercel - Acciones".
const ACCIONES = ['asignar', 'reprocesar', 'alta_variedad', 'editar_variedad', 'borrar_toma', 'borrar_variedad']

export async function POST(request: Request) {
  const correo = await correoDeSesion(request)
  if (!correo) return sinSesion()
  const destino = process.env.MAKE_WEBHOOK_ACCIONES
  if (!destino) return Response.json({ error: 'Falta MAKE_WEBHOOK_ACCIONES' }, { status: 500 })

  const datos = await request.json().catch(() => null)
  if (!datos || !ACCIONES.includes(datos.accion)) return Response.json({ error: 'Acción inválida' }, { status: 400 })

  const r = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...datos, usuario: correo }),
  })
  const texto = (await r.text()).trim()
  // 409: Make explica por qué no se puede (por ejemplo, una variedad que todavía tiene tomas).
  if (r.status === 409) return Response.json({ error: texto }, { status: 409 })
  if (!r.ok) return Response.json({ error: `Make respondió ${r.status}` }, { status: 502 })
  return Response.json({ ok: true, resultado: texto })
}
