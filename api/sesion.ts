import { cookieSalir, correoDeSesion, sinSesion } from './_auth.js'

// Con quién está abierta la sesión (la app lo consulta al abrir).
export async function GET(request: Request) {
  const correo = await correoDeSesion(request)
  return correo ? Response.json({ correo }, { headers: { 'cache-control': 'no-store' } }) : sinSesion()
}

// Cerrar sesión.
export async function DELETE() {
  return Response.json({ ok: true }, { headers: { 'set-cookie': cookieSalir } })
}
