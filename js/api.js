// Capa de datos. La interfaz pública (disponibilidad / reservar) es la misma
// en modo 'mock' y en modo 'sheets', así la UI no cambia al conectar la hoja.
(function () {
  const CFG = window.YP_CONFIG;
  const STORAGE_KEY = 'yp-reservas-demo';

  const aMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const aHora = (min) =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  // ---------- Modo mock ----------

  // Reservas de ejemplo, estables entre recargas para que la maqueta se vea "viva".
  function reservasEjemplo(diaId) {
    const dia = CFG.dias.find((d) => d.id === diaId);
    let seed = [...diaId].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const B = CFG.bloqueMinutos;
    const bloqueada = (maq, t) =>
      CFG.bloqueos.some((b) => b.dia === diaId && b.maquinas.includes(maq.id) && t >= aMin(b.desde) && t < aMin(b.hasta));
    const reservas = [];
    for (const maq of CFG.maquinas) {
      for (let t = aMin(dia.apertura); t < aMin(dia.cierre); t += B) {
        if (bloqueada(maq, t) || rnd() > 0.4) continue;
        let fin = t + B;
        if (rnd() < 0.35 && fin < aMin(dia.cierre) && !bloqueada(maq, fin)) fin += B;
        reservas.push({ maquina: maq.id, desde: aHora(t), hasta: aHora(fin) });
        t = fin;
      }
    }
    return reservas;
  }

  function leerGuardadas() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }
  function guardar(lista) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      /* sin almacenamiento: la reserva vive solo en esta sesión */
    }
  }
  let memoria = leerGuardadas();

  const choca = (a, b) => a.maquina === b.maquina && aMin(a.desde) < aMin(b.hasta) && aMin(b.desde) < aMin(a.hasta);

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  const mock = {
    async disponibilidad(diaId) {
      await espera(250);
      const ocupadas = reservasEjemplo(diaId)
        // no dejar que un ejemplo pise un bloqueo de torneo
        .filter((r) => !CFG.bloqueos.some((b) => b.dia === diaId && b.maquinas.includes(r.maquina) && choca(r, { ...b, maquina: r.maquina })))
        .concat(memoria.filter((r) => r.dia === diaId).map(({ maquina, desde, hasta }) => ({ maquina, desde, hasta })));
      return { actualizado: new Date().toISOString(), reservas: ocupadas };
    },

    async reservar(datos) {
      await espera(600);
      const { reservas } = await mock.disponibilidad(datos.dia);
      if (reservas.some((r) => choca(r, datos))) {
        throw new Error('Alguien acaba de tomar ese horario. Elige otro bloque.');
      }
      const codigo = 'YP-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      memoria = memoria.concat({ ...datos, codigo, creada: new Date().toISOString() });
      guardar(memoria);
      return { codigo };
    },
  };

  // ---------- Modo Google Sheets (Apps Script Web App) ----------
  // GET  ?accion=disponibilidad&dia=2026-11-21  -> { actualizado, reservas:[{maquina,desde,hasta}] }
  // POST { accion:'reservar', ...datos }         -> { codigo } | { error }
  const sheets = {
    async disponibilidad(diaId) {
      const res = await fetch(`${CFG.sheetsUrl}?accion=disponibilidad&dia=${encodeURIComponent(diaId)}`);
      if (!res.ok) throw new Error('No pudimos leer los horarios. Revisa tu conexión.');
      return res.json();
    },
    async reservar(datos) {
      // text/plain evita el preflight CORS que Apps Script no responde
      const res = await fetch(CFG.sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'reservar', ...datos }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json;
    },
  };

  window.YP_API = {
    ...(CFG.modo === 'sheets' && CFG.sheetsUrl ? sheets : mock),
    aMin,
    aHora,
    choca,
  };
})();
