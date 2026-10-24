(function () {
  const CFG = window.YP_CONFIG;
  const API = window.YP_API;
  const { aMin, aHora } = API;
  const $ = (id) => document.getElementById(id);

  const state = {
    dia: CFG.dias[0].id,
    modo: CFG.modalidades[0].id,
    categoria: 'Avanzado',
    sel: null, // { maquina, inicio (min), bloques }
    datos: {}, // por día: { actualizado, reservas }
    ultimaLectura: null,
    enviando: false,
  };

  const dinero = (n) => `${CFG.moneda} ${n}`;
  const diaCfg = () => CFG.dias.find((d) => d.id === state.dia);
  const modoCfg = () => CFG.modalidades.find((m) => m.id === state.modo);
  const maqCfg = (id) => CFG.maquinas.find((m) => m.id === id);
  const bloquesDelDia = (dia) => {
    const out = [];
    for (let t = aMin(dia.apertura); t < aMin(dia.cierre); t += CFG.bloqueMinutos) out.push(t);
    return out;
  };
  const enBloque = (t, desde, hasta) => t >= aMin(desde) && t < aMin(hasta);

  // ---------- Estado de cada celda del tablero ----------

  function estadoCelda(diaId, maq, t) {
    if (maq.soloPro && state.categoria !== 'Pro') return { tipo: 'locked', texto: 'Solo Pro' };
    const bloqueo = CFG.bloqueos.find((b) => b.dia === diaId && b.maquinas.includes(maq.id) && enBloque(t, b.desde, b.hasta));
    if (bloqueo) return { tipo: 'block', texto: bloqueo.motivo, corto: bloqueo.corto || bloqueo.motivo };
    const reservas = state.datos[diaId]?.reservas || [];
    const r = reservas.findIndex((r) => r.maquina === maq.id && enBloque(t, r.desde, r.hasta));
    if (r >= 0) return { tipo: 'busy', texto: 'Ocupado', grupo: r };
    const s = state.sel;
    if (diaId === state.dia && s && s.maquina === maq.id && t >= s.inicio && t < s.inicio + s.bloques * CFG.bloqueMinutos) {
      return { tipo: 'sel', texto: '✓ Tuyo' };
    }
    return { tipo: 'free', texto: '' };
  }

  const libre = (diaId, maq, t) => ['free', 'sel'].includes(estadoCelda(diaId, maq, t).tipo);

  function bloquesLibres(diaId) {
    const dia = CFG.dias.find((d) => d.id === diaId);
    if (!state.datos[diaId]) return null;
    let n = 0;
    for (const maq of CFG.maquinas) for (const t of bloquesDelDia(dia)) if (libre(diaId, maq, t)) n++;
    return n;
  }

  // ---------- Render ----------

  function opcion(clase, checked, html, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `opt ${clase}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    b.innerHTML = html;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderDias() {
    $('days').replaceChildren(
      ...CFG.dias.map((d) => {
        const n = bloquesLibres(d.id);
        const libres = n === null ? '…' : `${n} bloques libres`;
        return opcion(
          'day',
          d.id === state.dia,
          `<span class="day__blob"><span class="day__num">${d.numero}</span></span>
           <span class="day__txt"><b>${d.largo}</b><small>${d.apertura} – ${d.cierre}</small>
           <span class="day__free">${libres}</span></span>`,
          () => {
            if (state.dia === d.id) return;
            state.dia = d.id;
            state.sel = null;
            cargar(d.id);
            render();
          }
        );
      })
    );
  }

  function renderModos() {
    $('modes').replaceChildren(
      ...CFG.modalidades.map((m) =>
        opcion(
          'mode',
          m.id === state.modo,
          `<b>${m.nombre}</b><small>${m.detalle}</small>
           <span class="mode__price">${dinero(m.precio)} <span>/ 30 min</span></span>`,
          () => {
            state.modo = m.id;
            render();
          }
        )
      )
    );
    $('field-p2').hidden = modoCfg().jugadores < 2;
  }

  function renderCategorias() {
    $('cats').replaceChildren(
      ...CFG.categorias.map((c) =>
        opcion('chip', c === state.categoria, c, () => {
          state.categoria = c;
          if (state.sel && maqCfg(state.sel.maquina).soloPro && c !== 'Pro') {
            state.sel = null;
            aviso('Quitamos tu selección: la Máquina 4 es solo para categoría Pro.');
          }
          render();
        })
      )
    );
  }

  // Flecha de panel Pump It Up: los pads libres alternan direcciones como en un chart.
  const PANELES = ['dl', 'ul', 'c', 'ur', 'dr'];
  const flecha = (panel) =>
    panel === 'c'
      ? '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="3"/></svg>'
      : `<svg viewBox="0 0 20 20" aria-hidden="true" class="arw arw--${panel}"><path d="M4 4h9l-3 3 7 7-3 3-7-7-3 3z"/></svg>`;

  // Agrupa bloques seguidos con el mismo estado para dibujarlos como una sola cápsula.
  function segmentos(maq, tiempos) {
    const out = [];
    tiempos.forEach((t, i) => {
      const est = estadoCelda(state.dia, maq, t);
      const clave = est.tipo === 'free' ? `free${i}` : `${est.tipo}:${est.grupo ?? est.texto}`;
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.clave === clave) ultimo.n++;
      else out.push({ clave, est, fila: i, t, n: 1 });
    });
    return out;
  }

  function capsula(clase, col, seg, html) {
    const el = document.createElement('div');
    el.className = `cap ${clase}${seg.n === 1 ? ' cap--short' : ''}`;
    el.style.gridColumn = col;
    el.style.gridRow = `${seg.fila + 2} / span ${seg.n}`;
    el.innerHTML = html;
    return el;
  }

  function renderTablero() {
    const board = $('board');
    const enfocado = document.activeElement?.dataset?.key;
    const B = CFG.bloqueMinutos;
    const tiempos = bloquesDelDia(diaCfg());
    board.style.setProperty('--cols', CFG.maquinas.length);
    board.style.setProperty('--rows', tiempos.length);
    board.classList.toggle('is-loading', !state.datos[state.dia]);
    const nodos = [];

    // Líneas de hora y etiquetas
    tiempos.forEach((t, i) => {
      if (t % 60 !== 0) return;
      const beat = document.createElement('div');
      beat.className = 'beat';
      beat.style.gridRow = i + 2;
      const hora = document.createElement('span');
      hora.className = 'tlabel';
      hora.style.gridRow = i + 2;
      hora.textContent = aHora(t);
      nodos.push(beat, hora);
    });

    const s = state.sel;
    CFG.maquinas.forEach((maq, c) => {
      const col = c + 2;
      const locked = maq.soloPro && state.categoria !== 'Pro';
      const ocupados = tiempos.filter((t) => ['busy', 'block'].includes(estadoCelda(state.dia, maq, t).tipo)).length;
      const pct = Math.round((ocupados / tiempos.length) * 100);

      const head = document.createElement('div');
      head.className = `mach${locked ? ' is-locked' : ''}`;
      head.style.gridColumn = col;
      head.innerHTML = `<span class="mach__ring" style="--p:${pct}" title="${pct}% ocupada"><b>${c + 1}</b></span>
        <span class="mach__name">${maq.modelo.split('· ')[1]}${maq.soloPro ? ' · Pro' : ''}</span>
        <span class="mach__note">${maq.nota}</span>`;

      const lane = document.createElement('div');
      lane.className = `lane${s?.maquina === maq.id ? ' is-active' : ''}`;
      lane.style.gridColumn = col;
      nodos.push(head, lane);

      if (locked) {
        const lock = document.createElement('div');
        lock.className = 'lane-lock';
        lock.style.gridColumn = col;
        lock.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          <b>Zona Pro</b><span>Elige la categoría Pro para separarla</span>`;
        nodos.push(lock);
        return;
      }

      for (const seg of segmentos(maq, tiempos)) {
        const desde = aHora(seg.t);
        const hasta = aHora(seg.t + seg.n * B);
        if (seg.est.tipo === 'free') {
          const b = document.createElement('button');
          b.type = 'button';
          const vecino = s && s.maquina === maq.id && (seg.t === s.inicio + s.bloques * B || seg.t === s.inicio - B) && s.bloques < CFG.maxBloques;
          b.className = `pad${vecino ? ' pad--next' : ''}`;
          b.style.gridColumn = col;
          b.style.gridRow = seg.fila + 2;
          b.dataset.key = `${maq.id}-${seg.t}`;
          b.dataset.t = vecino ? '+30 min' : desde;
          b.setAttribute('aria-label', `${maq.nombre}, ${desde}: libre${vecino ? ', sumar 30 minutos' : ''}`);
          b.innerHTML = flecha(PANELES[(seg.fila + c * 2) % PANELES.length]);
          b.addEventListener('click', () => tocarCelda(maq, seg.t));
          nodos.push(b);
        } else if (seg.est.tipo === 'busy') {
          nodos.push(capsula('cap--busy', col, seg, `<span>Ocupado</span>`));
        } else if (seg.est.tipo === 'block') {
          nodos.push(
            capsula(
              'cap--block',
              col,
              seg,
              `<b class="cap__full">${seg.est.texto}</b><b class="cap__short">${seg.est.corto}</b>
               <span class="cap__time">${desde}<span class="cap__to"> – ${hasta}</span></span>`
            )
          );
        } else {
          const cap = capsula(
            'cap--sel',
            col,
            seg,
            `<span class="cap__time">${desde}<span class="cap__to"> – ${hasta}</span></span>
             <span class="cap__dur">${duracion(seg.n)}</span>
             <span class="cap__ctrl">
               ${seg.n > 1 ? `<button type="button" data-key="trim" data-acc="trim" aria-label="Quitar 30 minutos">−</button>` : ''}
               <button type="button" data-key="clear" data-acc="clear" aria-label="Quitar selección">×</button>
             </span>`
          );
          cap.addEventListener('click', (e) => {
            const acc = e.target.closest('button')?.dataset.acc;
            if (acc === 'trim') state.sel = { ...state.sel, bloques: state.sel.bloques - 1 };
            if (acc === 'clear') state.sel = null;
            if (acc) {
              renderTablero();
              renderResumen();
            }
          });
          nodos.push(cap);
        }
      }
    });

    board.replaceChildren(...nodos);
    if (enfocado) board.querySelector(`[data-key="${enfocado}"]`)?.focus();
  }

  function filasTicket(conDatos) {
    const s = state.sel;
    const dia = diaCfg();
    const filas = [
      ['Día', `${dia.corto} ${dia.numero} ${dia.mes}`],
      ['Modalidad', modoCfg().nombre],
      ['Categoría', state.categoria],
      ['Máquina', s ? `${maqCfg(s.maquina).nombre} · ${maqCfg(s.maquina).modelo.split('· ')[1]}` : null],
      ['Horario', s ? `${aHora(s.inicio)} – ${aHora(s.inicio + s.bloques * CFG.bloqueMinutos)}` : null],
      ['Duración', s ? duracion(s.bloques) : null],
    ];
    if (conDatos) filas.push(['Total', dinero(total())]);
    return filas
      .map(([k, v]) => `<div><dt>${k}</dt><dd${v ? '' : ' class="is-empty"'}>${v ?? 'Elige en el paso 3'}</dd></div>`)
      .join('');
  }

  const duracion = (bloques) => {
    const min = bloques * CFG.bloqueMinutos;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
  };
  const total = () => (state.sel ? state.sel.bloques * modoCfg().precio : 0);

  function renderResumen() {
    $('ticket-rows').innerHTML = filasTicket(false);
    $('total').textContent = dinero(total());
    $('calc').textContent = state.sel ? `${state.sel.bloques} × ${dinero(modoCfg().precio)} por bloque de 30 min` : '';
    $('dock-total').textContent = dinero(total());
    $('dock-label').textContent = state.sel
      ? `${maqCfg(state.sel.maquina).nombre} · ${aHora(state.sel.inicio)} · ${duracion(state.sel.bloques)}`
      : 'Elige un horario';
  }

  function render() {
    renderDias();
    renderModos();
    renderCategorias();
    renderTablero();
    renderResumen();
  }

  // ---------- Selección de bloques ----------

  function tocarCelda(maq, t) {
    const s = state.sel;
    const B = CFG.bloqueMinutos;
    if (!s || s.maquina !== maq.id) {
      state.sel = { maquina: maq.id, inicio: t, bloques: 1 };
    } else {
      const fin = s.inicio + s.bloques * B;
      if (t === fin || t === s.inicio - B) {
        if (s.bloques >= CFG.maxBloques) {
          aviso(`El máximo por reserva es ${duracion(CFG.maxBloques)}.`);
          return;
        }
        state.sel = { ...s, inicio: Math.min(s.inicio, t), bloques: s.bloques + 1 };
      } else if (s.bloques === 1 && t === s.inicio) {
        state.sel = null;
      } else if (t === s.inicio) {
        state.sel = { ...s, inicio: s.inicio + B, bloques: s.bloques - 1 };
      } else if (t === fin - B) {
        state.sel = { ...s, bloques: s.bloques - 1 };
      } else {
        state.sel = { maquina: maq.id, inicio: t, bloques: 1 };
      }
    }
    renderTablero();
    renderResumen();
  }

  // ---------- Datos en vivo ----------

  async function cargar(diaId) {
    try {
      state.datos[diaId] = await API.disponibilidad(diaId);
      state.ultimaLectura = Date.now();
      $('live').classList.remove('is-off');
      validarSeleccion();
    } catch (e) {
      $('live').classList.add('is-off');
      $('live-text').textContent = 'Sin conexión';
      return;
    }
    render();
  }

  // Si otra persona tomó el bloque mientras elegías, se avisa y se suelta.
  function validarSeleccion() {
    const s = state.sel;
    if (!s) return;
    const maq = maqCfg(s.maquina);
    for (let i = 0; i < s.bloques; i++) {
      const tipo = estadoCelda(state.dia, maq, s.inicio + i * CFG.bloqueMinutos).tipo;
      if (tipo !== 'sel') {
        state.sel = null;
        aviso('Alguien acaba de separar parte de tu horario. Elige otro bloque.');
        return;
      }
    }
  }

  function tickVivo() {
    if (!state.ultimaLectura || $('live').classList.contains('is-off')) return;
    const s = Math.round((Date.now() - state.ultimaLectura) / 1000);
    $('live-text').textContent = s < 5 ? 'En vivo · recién actualizado' : `En vivo · hace ${s} s`;
  }

  let avisoTimer;
  function aviso(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => (t.hidden = true), 3800);
  }

  // ---------- Envío ----------

  function validarFormulario(form) {
    let primero = null;
    for (const input of form.querySelectorAll('input[required]')) {
      const ok = input.type === 'checkbox' ? input.checked : input.value.trim().length > 1;
      input.setAttribute('aria-invalid', String(!ok));
      if (!ok && !primero) primero = input;
    }
    const tel = $('f-tel');
    if (tel.value.replace(/\D/g, '').length < 9) {
      tel.setAttribute('aria-invalid', 'true');
      primero = primero || tel;
    }
    return primero;
  }

  function mostrarError(msg, foco) {
    const el = $('form-error');
    el.textContent = msg;
    el.hidden = !msg;
    if (foco) foco.scrollIntoView({ block: 'center' }), foco.focus({ preventScroll: true });
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (state.enviando) return;
    const form = $('form');
    if (!state.sel) {
      aviso('Primero elige tu máquina y horario en el paso 3.');
      $('t-hora').scrollIntoView({ block: 'start' });
      return;
    }
    const falta = validarFormulario(form);
    if (falta) {
      mostrarError('Completa los campos marcados en rojo (WhatsApp con 9 dígitos).', falta);
      return;
    }
    mostrarError('');

    const s = state.sel;
    const fd = new FormData(form);
    const datos = {
      dia: state.dia,
      maquina: s.maquina,
      desde: aHora(s.inicio),
      hasta: aHora(s.inicio + s.bloques * CFG.bloqueMinutos),
      modalidad: state.modo,
      categoria: state.categoria,
      nombre: fd.get('nombre').trim(),
      alias: fd.get('alias').trim(),
      telefono: fd.get('telefono').replace(/\D/g, ''),
      jugador2: modoCfg().jugadores > 1 ? (fd.get('jugador2') || '').trim() : '',
      total: total(),
    };

    const btn = $('confirm');
    state.enviando = true;
    btn.disabled = true;
    btn.textContent = 'Separando tu máquina…';
    try {
      const { codigo } = await API.reservar(datos);
      abrirModal(codigo, datos);
    } catch (e) {
      mostrarError(e.message);
      await cargar(state.dia);
    } finally {
      state.enviando = false;
      btn.disabled = false;
      btn.textContent = 'Confirmar reserva';
    }
  }

  function abrirModal(codigo, datos) {
    $('m-alias').textContent = datos.alias;
    $('m-code').textContent = codigo;
    $('m-rows').innerHTML = filasTicket(true);
    $('m-min').textContent = CFG.minutosParaPagar;
    const num = CFG.evento.whatsapp;
    $('m-phone').textContent = `+${num.slice(0, 2)} ${num.slice(2).replace(/(\d{3})(?=\d)/g, '$1 ')}`;
    const dia = diaCfg();
    const texto = `Hola Yoshiplay, separé la ${maqCfg(datos.maquina).nombre} el ${dia.corto} ${dia.numero} ${dia.mes} de ${datos.desde} a ${datos.hasta}. Código ${codigo}. Total ${dinero(datos.total)}.`;
    $('m-wa').href = `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
    $('modal').hidden = false;
    $('m-new').focus();
  }

  function cerrarModal() {
    $('modal').hidden = true;
    state.sel = null;
    $('form').reset();
    cargar(state.dia);
    $('t-hora').scrollIntoView({ block: 'start' });
  }

  // ---------- Inicio ----------

  function iniciar() {
    $('min-pago').textContent = CFG.minutosParaPagar;
    $('form').addEventListener('submit', enviar);
    $('form').addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));
    $('m-new').addEventListener('click', cerrarModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('modal').hidden) cerrarModal();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => $('dock').classList.toggle('is-hidden', en.isIntersecting)).observe($('summary'));
    }

    render();
    Promise.all(CFG.dias.map((d) => cargar(d.id))).then(seleccionEjemplo);
    setInterval(() => cargar(state.dia), CFG.refrescoSegundos * 1000);
    setInterval(tickVivo, 1000);
  }

  // Deja un bloque de 1 h marcado al abrir para que se vea cómo queda el ticket.
  function seleccionEjemplo() {
    if (state.sel) return;
    const maq = CFG.maquinas[2];
    const cierre = aMin(diaCfg().cierre);
    for (const t of bloquesDelDia(diaCfg())) {
      if (t + 2 * CFG.bloqueMinutos <= cierre && libre(state.dia, maq, t) && libre(state.dia, maq, t + CFG.bloqueMinutos)) {
        state.sel = { maquina: maq.id, inicio: t, bloques: 2 };
        break;
      }
    }
    renderTablero();
    renderResumen();
  }

  iniciar();
})();
