(function () {
  const CFG = window.YP_CONFIG;
  const API = window.YP_API;
  const { aMin, aHora } = API;
  const $ = (id) => document.getElementById(id);
  const MAQ = CFG.maquinas[0];
  const B = CFG.bloqueMinutos;

  const state = {
    dia: CFG.dias[0].id,
    modo: CFG.modalidades[0].id,
    sel: null, // { inicio (min), bloques }
    datos: {}, // por día: { actualizado, reservas }
    ultimaLectura: null,
    enviando: false,
  };

  const dinero = (n) => `${CFG.moneda} ${n}`;
  const diaCfg = (id = state.dia) => CFG.dias.find((d) => d.id === id);
  const modoCfg = () => CFG.modalidades.find((m) => m.id === state.modo);
  const enBloque = (t, desde, hasta) => t >= aMin(desde) && t < aMin(hasta);
  const finSel = () => state.sel.inicio + state.sel.bloques * B;

  // La pista tiene el mismo tamaño todos los días; las baldosas fuera de horario quedan apagadas.
  const PISTA_INICIO = Math.min(...CFG.dias.map((d) => aMin(d.apertura)));
  const PISTA_FIN = (() => {
    const fin = Math.max(...CFG.dias.map((d) => aMin(d.cierre)));
    const baldosas = Math.ceil((fin - PISTA_INICIO) / B / 12) * 12; // múltiplo de 4 y de 6 columnas
    return PISTA_INICIO + baldosas * B;
  })();
  const turnosPista = () => {
    const out = [];
    for (let t = PISTA_INICIO; t < PISTA_FIN; t += B) out.push(t);
    return out;
  };

  // Colores de las luces de la pista
  const LUCES = ['--sky', '--neon', '--gold', '--violet', '--yoshi'];

  // ---------- Estado de cada turno ----------

  function estadoTurno(diaId, t) {
    const dia = diaCfg(diaId);
    if (t < aMin(dia.apertura) || t >= aMin(dia.cierre)) return { tipo: 'closed', texto: 'Cerrado' };
    const bloqueo = CFG.bloqueos.find((b) => b.dia === diaId && b.maquinas.includes(MAQ.id) && enBloque(t, b.desde, b.hasta));
    if (bloqueo) return { tipo: 'block', texto: bloqueo.motivo };
    const reservas = state.datos[diaId]?.reservas || [];
    if (reservas.some((r) => r.maquina === MAQ.id && enBloque(t, r.desde, r.hasta))) return { tipo: 'busy', texto: 'Ocupado' };
    if (diaId === state.dia && state.sel && t >= state.sel.inicio && t < finSel()) return { tipo: 'sel', texto: 'Tu turno' };
    return { tipo: 'free', texto: 'Libre' };
  }

  const libre = (diaId, t) => ['free', 'sel'].includes(estadoTurno(diaId, t).tipo);

  function turnosLibres(diaId) {
    if (!state.datos[diaId]) return null;
    return turnosPista().filter((t) => estadoTurno(diaId, t).tipo === 'free').length;
  }

  // ---------- Render ----------

  function opcion(clase, checked, html, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = clase;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    b.innerHTML = html;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderDias() {
    $('days').replaceChildren(
      ...CFG.dias.map((d) => {
        const n = turnosLibres(d.id);
        return opcion(
          'opt day',
          d.id === state.dia,
          `<span class="day__blob"><span class="day__num">${d.numero}</span></span>
           <span class="day__txt"><b>${d.largo}</b><small>${d.apertura} – ${d.cierre}</small>
           <span class="day__free">${n === null ? '…' : `${n} turnos libres`}</span></span>`,
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
        opcion('seg__opt', m.id === state.modo, `${m.nombre} <b>${dinero(m.precio)}</b>`, () => {
          state.modo = m.id;
          render();
        })
      )
    );
    $('field-p2').hidden = modoCfg().jugadores < 2;
  }

  function renderPista() {
    const floor = $('floor');
    const enfocado = document.activeElement?.dataset?.t;
    floor.classList.toggle('is-loading', !state.datos[state.dia]);
    const s = state.sel;

    const baldosas = turnosPista().map((t, i) => {
      const est = estadoTurno(state.dia, t);
      const siguiente = s && est.tipo === 'free' && (t === finSel() || t === s.inicio - B) && s.bloques < CFG.maxBloques;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tile tile--${est.tipo}${siguiente ? ' tile--next' : ''}${t % 60 === 0 ? ' tile--hour' : ''}`;
      b.style.setProperty('--c', `var(${LUCES[i % LUCES.length]})`);
      b.style.setProperty('--d', `${(i % 7) * 0.35}s`);
      b.dataset.t = t;
      b.disabled = !['free', 'sel'].includes(est.tipo);
      const etiqueta = siguiente ? '+30 min' : est.tipo === 'free' ? '' : est.texto;
      b.innerHTML = `<span class="tile__time">${aHora(t)}</span><span class="tile__tag">${etiqueta}</span>`;
      b.setAttribute('aria-label', `${aHora(t)}: ${est.texto}${siguiente ? ', sumar 30 minutos' : ''}`);
      if (est.tipo === 'sel') b.setAttribute('aria-pressed', 'true');
      if (!b.disabled) b.addEventListener('click', () => pisar(t));
      return b;
    });

    floor.replaceChildren(...baldosas);
    if (enfocado) floor.querySelector(`[data-t="${enfocado}"]`)?.focus();
  }

  const duracion = (bloques) => {
    const min = bloques * B;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
  };
  const total = () => (state.sel ? state.sel.bloques * modoCfg().precio : 0);

  function filasTicket(conTotal) {
    const s = state.sel;
    const dia = diaCfg();
    const filas = [
      ['Día', `${dia.corto} ${dia.numero} ${dia.mes}`],
      ['Máquina', MAQ.nombre],
      ['Modalidad', modoCfg().nombre],
      ['Horario', s ? `${aHora(s.inicio)} – ${aHora(finSel())}` : null],
      ['Duración', s ? duracion(s.bloques) : null],
    ];
    if (conTotal) filas.push(['Total', dinero(total())]);
    return filas
      .map(([k, v]) => `<div><dt>${k}</dt><dd${v ? '' : ' class="is-empty"'}>${v ?? 'Pisa una baldosa'}</dd></div>`)
      .join('');
  }

  function renderResumen() {
    $('ticket-rows').innerHTML = filasTicket(false);
    $('total').textContent = dinero(total());
    $('calc').textContent = state.sel ? `${state.sel.bloques} × ${dinero(modoCfg().precio)} por turno de 30 min` : '';
    $('dock-total').textContent = dinero(total());
    $('dock-label').textContent = state.sel ? `${aHora(state.sel.inicio)} – ${aHora(finSel())} · ${duracion(state.sel.bloques)}` : 'Elige un horario';
  }

  function render() {
    renderDias();
    renderModos();
    renderPista();
    renderResumen();
  }

  // ---------- Selección ----------

  function pisar(t) {
    const s = state.sel;
    if (!s) {
      state.sel = { inicio: t, bloques: 1 };
    } else if (t === finSel() || t === s.inicio - B) {
      if (s.bloques >= CFG.maxBloques) {
        aviso(`El máximo por reserva es ${duracion(CFG.maxBloques)}.`);
        return;
      }
      state.sel = { inicio: Math.min(s.inicio, t), bloques: s.bloques + 1 };
    } else if (s.bloques === 1 && t === s.inicio) {
      state.sel = null;
    } else if (t === s.inicio) {
      state.sel = { inicio: s.inicio + B, bloques: s.bloques - 1 };
    } else if (t === finSel() - B) {
      state.sel = { ...s, bloques: s.bloques - 1 };
    } else {
      state.sel = { inicio: t, bloques: 1 };
    }
    renderPista();
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

  // Si otra persona tomó el turno mientras elegías, se avisa y se suelta.
  function validarSeleccion() {
    const s = state.sel;
    if (!s) return;
    for (let t = s.inicio; t < finSel(); t += B) {
      if (estadoTurno(state.dia, t).tipo !== 'sel') {
        state.sel = null;
        aviso('Alguien acaba de separar parte de tu horario. Elige otro turno.');
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
    if (foco) {
      foco.scrollIntoView({ block: 'center' });
      foco.focus({ preventScroll: true });
    }
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (state.enviando) return;
    const form = $('form');
    if (!state.sel) {
      aviso('Primero pisa una baldosa libre en el paso 2.');
      $('t-hora').scrollIntoView({ block: 'start' });
      return;
    }
    const falta = validarFormulario(form);
    if (falta) {
      mostrarError('Completa los campos marcados en rojo (WhatsApp con 9 dígitos).', falta);
      return;
    }
    mostrarError('');

    const fd = new FormData(form);
    const datos = {
      dia: state.dia,
      maquina: MAQ.id,
      desde: aHora(state.sel.inicio),
      hasta: aHora(finSel()),
      modalidad: state.modo,
      nombre: fd.get('nombre').trim(),
      alias: fd.get('alias').trim(),
      telefono: fd.get('telefono').replace(/\D/g, ''),
      jugador2: modoCfg().jugadores > 1 ? (fd.get('jugador2') || '').trim() : '',
      total: total(),
    };

    const btn = $('confirm');
    state.enviando = true;
    btn.disabled = true;
    btn.textContent = 'Separando tu turno…';
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
    const texto = `Hola Yoshiplay, separé la ${MAQ.nombre} el ${dia.corto} ${dia.numero} ${dia.mes} de ${datos.desde} a ${datos.hasta}. Código ${codigo}. Total ${dinero(datos.total)}.`;
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

  // Deja 1 h marcada al abrir para que se vea cómo queda el ticket.
  function seleccionEjemplo() {
    if (state.sel) return;
    for (const t of turnosPista()) {
      if (libre(state.dia, t) && estadoTurno(state.dia, t + B).tipo === 'free' && t >= aMin('12:00')) {
        state.sel = { inicio: t, bloques: 2 };
        break;
      }
    }
    renderPista();
    renderResumen();
  }

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

  iniciar();
})();
