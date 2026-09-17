// Editorial IA · Gemini en Vercel
// La clave NO vive aqui: el servidor la lee de la variable de entorno GEMINI_API_KEY.

const AGENTES = {
  corrector: "Actua como corrector de estilo profesional: corrige ortografia, puntuacion y concordancia. Devuelve el texto corregido y, al final, una lista breve de los cambios.",
  estilo: "Actua como guarda de estilo: analiza la voz del texto, detecta repeticiones, adjetivos gastados y frases largas, y propone mejoras concretas.",
  estructura: "Actua como director editorial: evalua ritmo, arcos de personaje, tension por capitulo y continuidad. Senala 3 problemas prioritarios y como resolverlos.",
  libre: "Responde a la peticion del autor con criterio editorial.",
};

const $ = (id) => document.getElementById(id);

const estado = (texto, tipo) => {
  const el = $("estado");
  el.textContent = texto;
  el.className = "estado" + (tipo ? " " + tipo : "");
};

let historial = [];

function construirPeticion() {
  const base = AGENTES[$("agente").value] || AGENTES.libre;
  const extra = $("peticion").value.trim();
  return extra ? base + "\n\nInstruccion adicional del autor: " + extra : base;
}

async function consultar() {
  const contexto = $("contexto").value.trim();
  const peticion = $("peticion").value.trim();

  if (!peticion && !contexto) {
    estado("Escribe al menos una peticion o pega un texto.", "error");
    return;
  }

  $("enviar").disabled = true;
  estado("Consultando a Gemini...");
  $("respuesta").textContent = "";

  historial.push({ role: "user", content: construirPeticion() });

  try {
    const r = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensaje: construirPeticion(),
        contexto: contexto,
        historial: historial.slice(-10),
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.ok) {
      estado(data.error || "Error " + r.status + " al llamar a la API.", "error");
      historial.pop();
      return;
    }

    historial.push({ role: "assistant", content: data.respuesta });
    $("respuesta").textContent = data.respuesta;
    estado("Respuesta recibida · modelo: " + (data.modelo || "gemini"), "ok");
  } catch (e) {
    estado("No se pudo conectar: " + (e && e.message ? e.message : e), "error");
    historial.pop();
  } finally {
    $("enviar").disabled = false;
  }
}

// Permite instalar la app en el celular (necesita HTTPS; Vercel ya lo da).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("enviar").addEventListener("click", consultar);
  $("limpiar").addEventListener("click", () => {
    historial = [];
    $("contexto").value = "";
    $("peticion").value = "";
    $("respuesta").textContent = "";
    estado("Conversacion reiniciada.");
  });
  $("peticion").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") consultar();
  });
});
