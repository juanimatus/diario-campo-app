// Lee la respuesta del escenario de Make "App Vercel - Leer diario":
// una línea por fila, separada por tabulaciones, que empieza con V (variedad) o T (toma).

export interface VariedadHoja {
  id: string
  nombre: string
  cultivo: string
  estaca: string
  campana: string
  activa: boolean
  carpeta: string
  notas: string
}

export interface TomaHoja {
  id: string
  variedad: string
  campana: string
  nro: string
  fecha: string
  dictado: string
  idLeido: string
  coincide: string
  textoEtiqueta: string
  transcripcion: string
  observacion: string
  estado: string
  carpeta: string
  procesadoEn: string
  error: string
  etiquetaEscrita: string
  notasMano: string
}

export async function leerDiario(): Promise<{ variedades: VariedadHoja[]; tomas: TomaHoja[] }> {
  const origen = process.env.MAKE_WEBHOOK_VARIEDADES
  if (!origen) throw new Error('Falta MAKE_WEBHOOK_VARIEDADES')
  const r = await fetch(origen, { method: 'GET' })
  if (!r.ok) throw new Error(`Make respondió ${r.status}`)
  const variedades: VariedadHoja[] = []
  const tomas: TomaHoja[] = []
  for (const linea of (await r.text()).split('\n')) {
    const [tipo, ...c] = linea.split('\t').map((x) => x.trim())
    if (tipo === 'V' && c[0]?.startsWith('VAR-')) {
      const [id, nombre, cultivo, estaca, campana, activa, carpeta, notas] = c
      variedades.push({
        id,
        nombre: nombre ?? '',
        cultivo: cultivo ?? '',
        estaca: estaca ?? '',
        campana: campana ?? '',
        activa: (activa ?? '').toUpperCase() !== 'FALSE',
        carpeta: carpeta ?? '',
        notas: notas ?? '',
      })
    } else if (tipo === 'T' && c[0]) {
      const [id, variedad, campana, nro, fecha, dictado, idLeido, coincide, textoEtiqueta, transcripcion, observacion, estado, carpeta, procesadoEn, error, etiquetaEscrita, notasMano] =
        c.map((x) => x ?? '')
      tomas.push({ id, variedad, campana, nro, fecha, dictado, idLeido, coincide, textoEtiqueta, transcripcion, observacion, estado, carpeta, procesadoEn, error, etiquetaEscrita: etiquetaEscrita ?? '', notasMano: (notasMano ?? '').replaceAll('¶', '\n') })
    }
  }
  variedades.sort((a, b) => a.id.localeCompare(b.id))
  return { variedades, tomas }
}
