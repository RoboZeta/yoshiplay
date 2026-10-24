# Yoshiplay · Reservas

Landing de reservas para el evento **Pump It Up Phoenix 2 · 2026** (21 y 22 de noviembre).
Una sola máquina (Phoenix 2 LX). Entra directo a la reserva: día → horario en la pista de baile → datos → código de reserva.

## Cómo verla

Es HTML/CSS/JS sin build. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Maqueta de la página |
| `css/styles.css` | Estilos (paleta neón del flyer) |
| `js/config.js` | Días, horarios, máquina, precios, bloqueos de torneo |
| `js/api.js` | Capa de datos: modo `mock` (demo) o `sheets` (Google Apps Script) |
| `js/app.js` | Lógica de la UI: pista de turnos, selección, envío |

## Reglas de reserva (maqueta)

- El horario es una pista de baile: cada baldosa encendida es un turno libre de 30 min.
- Máximo 2 h seguidas por reserva; se pisa una baldosa y luego la siguiente para sumar tiempo.
- Modalidad Individual o Co-op (precio por turno distinto).
- Las rondas del torneo apagan la máquina en las franjas indicadas en `config.js`.
- Los horarios se refrescan cada 30 s; si alguien toma tu turno mientras eliges, se suelta y se avisa.

## Conexión a Google Sheets (siguiente paso)

`js/api.js` ya define el contrato. En `config.js` se cambia `modo: 'sheets'` y se pone la URL del Web App:

- `GET ?accion=disponibilidad&dia=2026-11-21` → `{ actualizado, reservas: [{ maquina, desde, hasta }] }`
- `POST { accion: 'reservar', dia, maquina, desde, hasta, modalidad, nombre, alias, telefono, jugador2, total }` → `{ codigo }` o `{ error }`

Hoja sugerida `reservas`: `codigo | dia | maquina | desde | hasta | modalidad | nombre | alias | telefono | jugador2 | total | estado | creada`.
