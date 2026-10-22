import { useEffect, useRef, useState } from 'react'
import { fechaPlanilla, guardarToma, listarTomas, borrarToma, nuevoId, type Toma, type Variedad } from './db'
import { comprimirFoto, miniatura, tipoAudioSoportado } from './media'
import { alCambiar, sincronizar } from './sync'
import { actualizarVariedades, codigoDesdeTexto, filtrar, leerVariedades } from './variedades'

type Pestana = 'nueva' | 'tomas'

function useConexion() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function useTomas() {
  const [tomas, setTomas] = useState<Toma[]>([])
  useEffect(() => {
    const cargar = () => listarTomas().then(setTomas)
    cargar()
    const fuera = alCambiar(cargar)
    return () => {
      fuera()
    }
  }, [])
  return [tomas, () => listarTomas().then(setTomas)] as const
}

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('nueva')
  const [ajustes, setAjustes] = useState(false)
  const online = useConexion()
  const [tomas, recargar] = useTomas()
  const enCola = tomas.filter((t) => t.estado !== 'enviada').length

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>Diario de Campo</span>
        </div>
        <button className="icono" onClick={() => setAjustes(true)} aria-label="Ajustes">
          ⚙︎
        </button>
      </header>

      <div className={`estado ${online ? 'ok' : 'off'}`}>
        <span className="punto" />
        {online ? 'Con señal' : 'Sin señal'}
        {' · '}
        {enCola === 0 ? 'todo enviado' : `${enCola} ${enCola === 1 ? 'toma' : 'tomas'} en cola`}
      </div>

      <main>
        {pestana === 'nueva' ? (
          <NuevaToma
            alGuardar={async () => {
              await recargar()
              sincronizar()
            }}
          />
        ) : (
          <ListaTomas tomas={tomas} recargar={recargar} />
        )}
      </main>

      <nav className="pestanas">
        <button className={pestana === 'nueva' ? 'activa' : ''} onClick={() => setPestana('nueva')}>
          <span>＋</span>Nueva toma
        </button>
        <button className={pestana === 'tomas' ? 'activa' : ''} onClick={() => setPestana('tomas')}>
          <span>☰</span>Mis tomas{enCola > 0 && <b className="globo">{enCola}</b>}
        </button>
      </nav>

      {ajustes && <Ajustes cerrar={() => setAjustes(false)} />}
    </div>
  )
}

function NuevaToma({ alGuardar }: { alGuardar: () => void }) {
  const [variedades, setVariedades] = useState<Variedad[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [variedad, setVariedad] = useState<Variedad | null>(null)
  const [codigoLibre, setCodigoLibre] = useState('')
  const [campana, setCampana] = useState(() => recordar('campana') || '2026/27')
  const [fotos, setFotos] = useState<Blob[]>([])
  const [audio, setAudio] = useState<Blob | null>(null)
  const [nota, setNota] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    leerVariedades().then((v) => {
      setVariedades(v)
      if (navigator.onLine) actualizarVariedades().then(setVariedades).catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const resultados = busqueda ? filtrar(variedades, busqueda).slice(0, 8) : []
  const codigoTipeado = codigoDesdeTexto(busqueda)

  async function agregarFotos(files: FileList | null) {
    if (!files?.length) return
    setProcesando(true)
    try {
      const nuevas = await Promise.all(Array.from(files).map((f) => comprimirFoto(f)))
      setFotos((prev) => [...prev, ...nuevas])
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo agregar la foto')
    } finally {
      setProcesando(false)
    }
  }

  async function guardar() {
    if (!fotos.length) return
    setProcesando(true)
    const id = nuevoId()
    const idVariedad = variedad?.id ?? codigoLibre
    await guardarToma({
      id,
      creadaEn: new Date().toISOString(),
      fecha: fechaPlanilla(),
      idVariedad,
      nombreVariedad: variedad?.nombre ?? '',
      campana,
      nota: nota.trim(),
      fotos,
      audio,
      miniatura: await miniatura(fotos[0]),
      cantFotos: fotos.length,
      tieneAudio: !!audio,
      estado: 'pendiente',
    })
    guardarRecuerdo('campana', campana)
    setFotos([])
    setAudio(null)
    setNota('')
    setVariedad(null)
    setCodigoLibre('')
    setBusqueda('')
    setProcesando(false)
    setAviso(navigator.onLine ? 'Toma guardada. Enviando…' : 'Toma guardada. Se envía sola cuando haya señal.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    alGuardar()
  }

  return (
    <div className="formulario">
      <section className="tarjeta">
        <h2>
          <span className="paso">1</span>Variedad <small>opcional</small>
        </h2>
        {variedad || codigoLibre ? (
          <div className="elegida">
            <div>
              <strong>{variedad ? variedad.nombre || variedad.id : 'Código tipeado'}</strong>
              <span>
                {variedad?.id ?? codigoLibre}
                {variedad?.cultivo ? ` · ${variedad.cultivo}` : ''}
              </span>
            </div>
            <button
              className="link"
              onClick={() => {
                setVariedad(null)
                setCodigoLibre('')
              }}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <input
              className="campo"
              type="search"
              inputMode="search"
              placeholder="Buscar por número o nombre (ej. 10, zapallo)"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {resultados.length > 0 && (
              <ul className="resultados">
                {resultados.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => {
                        setVariedad(v)
                        setBusqueda('')
                        if (v.campana) setCampana(v.campana)
                      }}
                    >
                      <strong>{v.nombre || v.id}</strong>
                      <span>
                        {v.id}
                        {v.cultivo ? ` · ${v.cultivo}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busqueda && resultados.length === 0 && codigoTipeado && (
              <button className="secundario" onClick={() => setCodigoLibre(codigoTipeado)}>
                Usar {codigoTipeado} (variedad nueva)
              </button>
            )}
            <p className="ayuda">Si no elegís, la IA lee el código en la foto de la etiqueta.</p>
          </>
        )}
        <label className="fila">
          <span>Campaña</span>
          <input className="campo corto" value={campana} onChange={(e) => setCampana(e.target.value)} />
        </label>
      </section>

      <section className="tarjeta">
        <h2>
          <span className="paso">2</span>Fotos
        </h2>
        <label className={`principal ${procesando ? 'ocupado' : ''}`}>
          📷 {fotos.length ? 'Sacar otra foto' : 'Sacar foto de la etiqueta'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              agregarFotos(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="link centrado">
          o elegir de la galería
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              agregarFotos(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        {fotos.length > 0 && (
          <div className="miniaturas">
            {fotos.map((f, i) => (
              <Miniatura
                key={i}
                blob={f}
                etiqueta={i === 0 ? 'Etiqueta' : `Muestra ${i}`}
                quitar={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2>
          <span className="paso">3</span>Nota de voz <small>opcional</small>
        </h2>
        <Grabador audio={audio} setAudio={setAudio} />
        <textarea
          className="campo"
          rows={3}
          placeholder="Observaciones escritas (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </section>

      <button className="guardar" disabled={!fotos.length || procesando} onClick={guardar}>
        {procesando ? 'Procesando…' : fotos.length ? 'Guardar toma' : 'Sacá al menos una foto'}
      </button>

      {aviso && <div className="aviso">{aviso}</div>}
    </div>
  )
}

function Miniatura({ blob, etiqueta, quitar }: { blob: Blob; etiqueta: string; quitar: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return (
    <figure>
      {url && <img src={url} alt={etiqueta} />}
      <figcaption>{etiqueta}</figcaption>
      <button onClick={quitar} aria-label={`Quitar ${etiqueta}`}>
        ×
      </button>
    </figure>
  )
}

function Grabador({ audio, setAudio }: { audio: Blob | null; setAudio: (b: Blob | null) => void }) {
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const tipo = tipoAudioSoportado()

  useEffect(() => {
    if (!audio) return setUrl('')
    const u = URL.createObjectURL(audio)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [audio])

  useEffect(() => {
    if (!grabando) return
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [grabando])

  async function empezar() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined)
      const partes: Blob[] = []
      r.ondataavailable = (e) => e.data.size && partes.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setAudio(new Blob(partes, { type: r.mimeType || tipo || 'audio/mp4' }))
        setGrabando(false)
      }
      r.start(1000)
      rec.current = r
      setSegundos(0)
      setGrabando(true)
    } catch {
      setError('No se pudo usar el micrófono. Revisá el permiso en Ajustes del teléfono.')
    }
  }

  if (!tipo) return <p className="ayuda">Este navegador no permite grabar. Usá el dictado del teclado en la nota.</p>

  return (
    <div className="grabador">
      {grabando ? (
        <button className="principal grabando" onClick={() => rec.current?.stop()}>
          ■ Detener · {mmss(segundos)}
        </button>
      ) : audio ? (
        <div className="audio">
          <audio controls src={url} />
          <button className="link" onClick={() => setAudio(null)}>
            Borrar
          </button>
        </div>
      ) : (
        <button className="principal suave" onClick={empezar}>
          🎙 Grabar nota de voz
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function ListaTomas({ tomas, recargar }: { tomas: Toma[]; recargar: () => void }) {
  if (!tomas.length)
    return (
      <div className="vacio">
        <p>Todavía no cargaste tomas en este teléfono.</p>
      </div>
    )
  const hayCola = tomas.some((t) => t.estado !== 'enviada')
  return (
    <div className="lista">
      {hayCola && (
        <button className="secundario" onClick={() => sincronizar()} disabled={!navigator.onLine}>
          {navigator.onLine ? 'Enviar ahora' : 'Sin señal: se envían al volver'}
        </button>
      )}
      {tomas.map((t) => (
        <article key={t.id} className="item">
          {t.miniatura ? <img src={t.miniatura} alt="" /> : <div className="sinfoto" />}
          <div className="datos">
            <strong>{t.nombreVariedad || t.idVariedad || 'Variedad por leer (IA)'}</strong>
            <span>
              {t.fecha.slice(0, 16)} · {t.cantFotos} foto{t.cantFotos === 1 ? '' : 's'}
              {t.tieneAudio ? ' · audio' : ''}
            </span>
            {t.error && <span className="error">{t.error}</span>}
          </div>
          <div className="lado">
            <Estado estado={t.estado} />
            {t.estado === 'enviada' && (
              <button
                className="link chico"
                onClick={async () => {
                  await borrarToma(t.id)
                  recargar()
                }}
              >
                Quitar
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function Estado({ estado }: { estado: Toma['estado'] }) {
  const txt = { pendiente: 'En cola', enviando: 'Enviando…', enviada: 'Enviada', error: 'Reintentando' }[estado]
  return <span className={`chip ${estado}`}>{txt}</span>
}

function Ajustes({ cerrar }: { cerrar: () => void }) {
  const [pin, setPin] = useState(() => recordar('pin'))
  const [msj, setMsj] = useState('')
  return (
    <div className="fondo" onClick={cerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()}>
        <h2>Ajustes</h2>
        <label className="fila">
          <span>PIN de envío</span>
          <input className="campo corto" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        <button
          className="secundario"
          onClick={async () => {
            setMsj('Actualizando…')
            try {
              const v = await actualizarVariedades()
              setMsj(`Listo: ${v.length} variedades guardadas en el teléfono.`)
            } catch (e) {
              setMsj(e instanceof Error ? e.message : 'No se pudo actualizar')
            }
          }}
        >
          Actualizar lista de variedades
        </button>
        {msj && <p className="ayuda">{msj}</p>}
        <p className="ayuda">
          Para usarla sin señal: en Safari tocá Compartir → <b>Agregar a pantalla de inicio</b> y abrila una vez con señal.
        </p>
        <button
          className="guardar"
          onClick={() => {
            guardarRecuerdo('pin', pin.trim())
            sincronizar()
            cerrar()
          }}
        >
          Listo
        </button>
      </div>
    </div>
  )
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function recordar(k: string) {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

function guardarRecuerdo(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento local: se pide de nuevo */
  }
}
