import { correoDeSesion, sinSesion } from './_auth.js'

// Recibe una toma desde la app y la reenvía al webhook de Make.
// La URL del webhook queda solo en Vercel (variable MAKE_WEBHOOK_TOMA).
export async function POST(request: Request) {
  const correo = await correoDeSesion(request)
  if (!correo) return sinSesion()
  const destino = process.env.MAKE_WEBHOOK_TOMA
  if (!destino) return Response.json({ error: 'Falta MAKE_WEBHOOK_TOMA' }, { status: 500 })

  let toma: { id?: string }
  try {
    toma = JSON.parse(await request.text())
    if (!/^W-[A-Z0-9]{8}$/.test(toma.id ?? '')) throw new Error()
  } catch {
    return Response.json({ error: 'Toma inválida' }, { status: 400 })
  }

  const r = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...toma, usuario: correo }),
  })
  if (!r.ok) return Response.json({ error: `Make respondió ${r.status}` }, { status: 502 })
  return Response.json({ ok: true })
}
