# Diario de Campo (app)

App web instalable (PWA) para cargar tomas de ensayos a campo, con o sin señal:
fotos con la cámara, nota de voz grabada en la app y observaciones escritas.
Cada toma queda guardada en el teléfono y se envía sola cuando hay conexión.

## Cómo fluye una toma
1. La app la guarda en el teléfono (IndexedDB) y la pone en cola.
2. Con señal, la manda a `/api/toma` (función de Vercel), que la reenvía al webhook de Make.
3. Make sube fotos y audio a Drive, transcribe el audio con Whisper y crea la fila en **Tomas** como *Pendiente*.
4. El escenario **Clasificar tomas** hace el resto (lectura de etiqueta con IA, Nro_Toma, carpetas por variedad).

## Variables en Vercel
Ver `.env.example`: `MAKE_WEBHOOK_TOMA`, `MAKE_WEBHOOK_VARIEDADES` y opcionalmente `APP_PIN`.

## Desarrollo
```
npm install
npm run dev     # interfaz (sin /api)
npm run build
```
