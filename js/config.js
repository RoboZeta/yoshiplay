// Configuración del evento y de las máquinas.
// Cuando se conecte a Google Sheets, estos valores pueden venir de la hoja "config".
window.YP_CONFIG = {
  evento: {
    nombre: 'Pump It Up Phoenix 2 · 2026',
    sede: 'Yoshiplay',
    whatsapp: '51999999999', // número del local, sin "+" ni espacios
  },

  moneda: 'S/',

  // 'mock' usa datos de prueba en el navegador.
  // 'sheets' consulta el Web App de Google Apps Script indicado en sheetsUrl.
  modo: 'mock',
  sheetsUrl: '',
  refrescoSegundos: 30,

  dias: [
    { id: '2026-11-21', corto: 'Sáb', largo: 'Sábado', numero: '21', mes: 'Nov', apertura: '10:00', cierre: '21:00' },
    { id: '2026-11-22', corto: 'Dom', largo: 'Domingo', numero: '22', mes: 'Nov', apertura: '10:00', cierre: '20:00' },
  ],

  bloqueMinutos: 30,
  maxBloques: 4, // 2 horas por reserva

  // Precio por bloque de 30 min según modalidad
  modalidades: [
    { id: 'solo', nombre: 'Individual', detalle: '1 jugador en la máquina', jugadores: 1, precio: 12 },
    { id: 'coop', nombre: 'Co-op', detalle: '2 jugadores, mismo turno', jugadores: 2, precio: 18 },
  ],

  categorias: ['Intermedio', 'Avanzado', 'Co-op', 'Pro'],

  maquinas: [
    { id: 'M1', nombre: 'Máquina 1', modelo: 'Phoenix 2 · LX', nota: 'Pads de torneo', soloPro: false },
    { id: 'M2', nombre: 'Máquina 2', modelo: 'Phoenix 2 · LX', nota: 'Pads de torneo', soloPro: false },
    { id: 'M3', nombre: 'Máquina 3', modelo: 'Phoenix 2 · TX', nota: 'Ideal para calentar', soloPro: false },
    { id: 'M4', nombre: 'Máquina 4', modelo: 'Phoenix 2 · LX', nota: 'Calibrada para Pro', soloPro: true },
  ],

  // Franjas en las que las máquinas no se alquilan (rondas del torneo, mantenimiento)
  bloqueos: [
    { dia: '2026-11-21', desde: '15:00', hasta: '17:00', maquinas: ['M1', 'M2'], motivo: 'Clasificatoria Intermedio', corto: 'Clasif. Intermedio' },
    { dia: '2026-11-21', desde: '18:00', hasta: '20:00', maquinas: ['M1', 'M2', 'M4'], motivo: 'Clasificatoria Avanzado', corto: 'Clasif. Avanzado' },
    { dia: '2026-11-22', desde: '14:00', hasta: '16:00', maquinas: ['M1', 'M2'], motivo: 'Torneo Co-op', corto: 'Co-op' },
    { dia: '2026-11-22', desde: '17:00', hasta: '20:00', maquinas: ['M1', 'M2', 'M3', 'M4'], motivo: 'Final Pro', corto: 'Final Pro' },
  ],

  minutosParaPagar: 15,
};
