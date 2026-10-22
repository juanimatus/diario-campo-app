import { leerDiario } from './_diario'

// Variedades y tomas de la planilla, para las fichas y la bandeja de revisión.
export async function GET() {
  try {
    return Response.json(await leerDiario(), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
