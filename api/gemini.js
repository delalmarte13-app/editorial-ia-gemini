/**
 * Función serverless para Vercel.
 * Recibe { mensaje, contexto, historial } y responde { ok, respuesta }.
 *
 * La clave de Gemini NUNCA se envía desde el navegador:
 * se lee solo aquí, desde la variable de entorno GEMINI_API_KEY de Vercel.
 *
 * Variables de entorno (Vercel -> Settings -> Environment Variables):
 *   GEMINI_API_KEY   (obligatoria)  tu clave de https://aistudio.google.com/apikey
 *   GEMINI_MODEL     (opcional)     por defecto: gemini-2.5-flash
 */

const GEMINI_BASE = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
const MODELO_POR_DEFECTO = "gemini-2.5-flash";

const PROMPT_SISTEMA =
  "Eres el Director Editorial de Editorial IA. Coordinas la produccion de cuentos " +
  "infantiles y ayudas al autor con correccion, estilo, estructura, continuidad y " +
  "produccion editorial. Responde siempre en espanol, con concrecion y sin relleno.";

function leerCuerpo(req) {
  let c = req.body;
  if (typeof c === "string") {
    try { c = JSON.parse(c); } catch { c = {}; }
  }
  return c && typeof c === "object" ? c : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Usa el metodo POST." });
  }

  const clave = (process.env.GEMINI_API_KEY || "").trim();
  if (!clave) {
    return res.status(500).json({
      ok: false,
      error: "Falta GEMINI_API_KEY. Anadela en Vercel: Settings -> Environment Variables y vuelve a desplegar.",
    });
  }

  const cuerpo = leerCuerpo(req);
  const mensaje = typeof cuerpo.mensaje === "string" ? cuerpo.mensaje.trim() : "";
  if (!mensaje) {
    return res.status(400).json({ ok: false, error: "Falta el campo 'mensaje'." });
  }

  const historial = Array.isArray(cuerpo.historial) ? cuerpo.historial.slice(-10) : [];
  const contexto = typeof cuerpo.contexto === "string" ? cuerpo.contexto.trim() : "";
  const modelo = (process.env.GEMINI_MODEL || MODELO_POR_DEFECTO).trim();

  const contents = [];
  for (const m of historial) {
    if (m && typeof m.content === "string" && m.content.trim()) {
      contents.push({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  const textoUsuario = contexto
    ? "TEXTO DE TRABAJO:\n" + contexto + "\n\nPETICION:\n" + mensaje
    : mensaje;
  contents.push({ role: "user", parts: [{ text: textoUsuario }] });

  const url = GEMINI_BASE + "/models/" + modelo + ":generateContent?key=" + encodeURIComponent(clave);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const detalle =
        (data && data.error && (data.error.message || data.error.status)) || "HTTP " + r.status;
      const pista =
        r.status === 400 || r.status === 403
          ? " Comprueba que la clave es correcta y que el modelo '" + modelo + "' esta disponible para tu cuenta."
          : "";
      return res.status(502).json({ ok: false, error: "Gemini respondio con error: " + detalle + pista });
    }

    const partes = (data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts) || [];
    const respuesta = partes.map((p) => p && p.text ? p.text : "").join("").trim();

    if (!respuesta) {
      return res.status(502).json({ ok: false, error: "Gemini no devolvio texto (respuesta vacia o bloqueada)." });
    }

    return res.status(200).json({ ok: true, respuesta, modelo });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo contactar con Gemini: " + (e && e.message ? e.message : String(e)),
    });
  }
};
