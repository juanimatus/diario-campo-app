import { correoPermitido, cookieSesion, normalizarCorreo, nuevoDesafio, verificarCodigo } from './_auth.js'

// Paso 1 {correo}: manda el código por correo y devuelve el desafío.
// Paso 2 {desafio, codigo}: si el código es correcto, deja la cookie de sesión.
export async function POST(request: Request) {
  const datos = (await request.json().catch(() => null)) as { correo?: string; desafio?: string; codigo?: string } | null
  if (!datos) return Response.json({ error: 'Pedido inválido' }, { status: 400 })

  if (datos.desafio) {
    const correo = await verificarCodigo(datos.desafio, String(datos.codigo ?? ''))
    if (!correo) return Response.json({ error: 'Código incorrecto o vencido' }, { status: 401 })
    return Response.json({ correo }, { headers: { 'set-cookie': await cookieSesion(correo) } })
  }

  const correo = normalizarCorreo(datos.correo)
  if (!correoPermitido(correo)) return Response.json({ error: 'Ese correo no tiene acceso a la app' }, { status: 403 })
  const destino = process.env.MAKE_WEBHOOK_LOGIN
  if (!destino) return Response.json({ error: 'Falta MAKE_WEBHOOK_LOGIN' }, { status: 500 })

  const { codigo, desafio } = await nuevoDesafio(correo)
  const r = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo, codigo }),
  })
  if (!r.ok) return Response.json({ error: `No se pudo mandar el correo (${r.status})` }, { status: 502 })
  return Response.json({ desafio })
}
