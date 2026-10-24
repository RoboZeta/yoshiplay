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

  bloqueMinutos: 60, // turnos por hora: 10–11, 11–12…
  maxBloques: 2, // 2 horas por reserva

  // Precio por hora según modalidad
  modalidades: [
    { id: 'solo', nombre: 'Individual', detalle: '1 jugador en la máquina', jugadores: 1, precio: 20 },
    { id: 'coop', nombre: 'Co-op', detalle: '2 jugadores, mismo turno', jugadores: 2, precio: 30 },
  ],

  // Una sola máquina en alquiler
  maquinas: [{ id: 'LX', nombre: 'Phoenix 2 LX', modelo: 'Pump It Up Phoenix 2 · LX' }],

  // Franjas en las que la máquina no se alquila (rondas del torneo, mantenimiento)
  bloqueos: [
    { dia: '2026-11-21', desde: '15:00', hasta: '17:00', maquinas: ['LX'], motivo: 'Clasificatoria', corto: 'Clasif.' },
    { dia: '2026-11-21', desde: '18:00', hasta: '20:00', maquinas: ['LX'], motivo: 'Torneo' },
    { dia: '2026-11-22', desde: '14:00', hasta: '16:00', maquinas: ['LX'], motivo: 'Co-op' },
    { dia: '2026-11-22', desde: '17:00', hasta: '20:00', maquinas: ['LX'], motivo: 'Final' },
  ],

  minutosParaPagar: 15,
};
