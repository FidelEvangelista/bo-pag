/**
 * Google Apps Script — Invitación de boda Astrid & Fidel
 *
 * Hace dos cosas, sobre el mismo Sheet:
 *
 *   1) RSVP (doPost): guarda cada respuesta del formulario.
 *   2) LISTA DE INVITADOS (doGet): los pases asignados viven acá, en una
 *      pestaña llamada "Invitados". La invitación los consulta con el código
 *      que lleva el link de cada persona (?i=CODIGO). Así, si cambias los
 *      pases en esta hoja, el link ya entregado muestra el valor nuevo: no hay
 *      que regenerar nada ni volver a mandar el link. Y el número no viaja en
 *      la URL, así que nadie puede retipearlo.
 *
 * PESTAÑA "Invitados" (la crea el script solo la primera vez):
 *
 *   | Nombre | Pases | Código |
 *   | Astrid  |   2   | k7m3p9qt |
 *   | Fidel   |   4   | a2b8x5mn |
 *
 *   - Nombre: la referencia para ustedes (también la devuelve la API).
 *   - Pases : cuántos boletos tiene esa invitación. Es el número que se ve.
 *   - Código: lo genera el script. No hace falta tocarlo nunca.
 *
 * CÓMO PUBLICARLO (la primera vez y cada vez que cambie este archivo):
 *   1. Extensiones > Apps Script > pegar TODO este archivo > Ctrl+S
 *   2. Implementar > Administrar implementaciones > lápiz > "Nueva versión"
 *      > Implementar.  (Ejecutar como: Yo · Quién tiene acceso: Cualquier persona)
 *      La URL no cambia: es la misma que ya está en js/main.js.
 */

/* =====================================================================
   1) RSVP — cada respuesta del formulario cae en la primera pestaña
   ===================================================================== */

function doPost(e) {
  // NOTA: en la copia original faltaba esta línea (no existía la variable
  // `sheet`), así que el formulario respondía "enviado" sin guardar nada.
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  var fila = [];
  try {
    var datos = JSON.parse(e.postData.contents);
    fila = [
      new Date(),
      datos.name || '',
      datos.email || '',
      datos.attending || '',
      datos.pases || datos.invitados || '',
      datos.menu || datos.menú || '',
      datos.song || datos.cancion || datos.canción || '',
      datos.note || datos.nota || ''
    ];
  } catch (err) {
    return json_({ status: 'error', error: 'JSON inválido' });
  }

  sheet.appendRow(fila);
  return json_({ status: 'ok' });
}

/* =====================================================================
   2) LISTA DE INVITADOS — los pases asignados son los de esta hoja
   ===================================================================== */

var NOMBRE_HOJA_INVITADOS = 'Invitados';

// Clave para pedir la lista completa. Solo la usa el generador de links, que
// es un archivo local. Cambiala si algún día se te filtra.
var CLAVE_LISTA = 'AF-boda-9f3k2m7q';

var LARGO_CODIGO = 8;
// Alfabeto sin letras ni números que se confunden al leerlos: 0/O, 1/l/I.
var ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789';

function doGet(e) {
  var p = (e && e.parameter) || {};
  var callback = p.callback || '';
  var respuesta;

  try {
    if (p.action === 'list') {
      if (String(p.key || '') !== CLAVE_LISTA) throw new Error('clave incorrecta');
      var r = leerInvitados_(true);
      respuesta = { ok: true, invitados: r.lista, avisos: r.avisos };
    } else if (p.i) {
      var invitado = buscarPorCodigo_(p.i);
      respuesta = invitado
        ? { ok: true, n: invitado.n, p: invitado.p }
        : { ok: false, error: 'codigo no encontrado' };
    } else {
      respuesta = { ok: true, mensaje: 'API de la invitación. Usa ?i=CODIGO' };
    }
  } catch (err) {
    respuesta = { ok: false, error: String((err && err.message) || err) };
  }

  // Con ?callback=... responde JSONP (lo que usa la invitación y el generador:
  // Apps Script no manda cabeceras CORS, así que leer la respuesta con fetch()
  // desde otro dominio no es posible; con una etiqueta <script> sí).
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(respuesta) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(respuesta);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* --- Lectura de la hoja ------------------------------------------------- */

function hojaInvitados_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(NOMBRE_HOJA_INVITADOS);
  if (!hoja) {
    hoja = libro.insertSheet(NOMBRE_HOJA_INVITADOS);
    hoja.getRange(1, 1, 1, 3).setValues([['Nombre', 'Pases', 'Código']]);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function normalizar_(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .trim().toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');
}

function cabeceras_(hoja) {
  var ancho = Math.max(hoja.getLastColumn(), 3);
  var valores = hoja.getRange(1, 1, 1, ancho).getValues()[0];
  return valores.map(normalizar_);
}

function indiceColumna_(cabeceras, alias) {
  for (var a = 0; a < alias.length; a++) {
    for (var c = 0; c < cabeceras.length; c++) {
      if (cabeceras[c] === alias[a]) return c;
    }
  }
  return -1;
}

/**
 * Devuelve { lista, avisos, asignados }.
 * Con asignar = true, le pone código a las filas que no tengan.
 */
function leerInvitados_(asignar) {
  var hoja = hojaInvitados_();
  var cabeceras = cabeceras_(hoja);
  var avisos = [];

  var colNombre = indiceColumna_(cabeceras, ['nombre', 'invitado', 'invitados', 'nombre completo', 'familia']);
  var colPases = indiceColumna_(cabeceras, ['pases', 'boletos', 'pases asignados', 'boletos asignados', 'cupo', 'personas', 'invitados asignados']);
  var colCodigo = indiceColumna_(cabeceras, ['codigo', 'code', 'clave', 'id', 'identificador']);

  if (colPases < 0) {
    avisos.push('No encuentro la columna de pases: agregá un encabezado "Pases".');
  }
  if (colCodigo < 0) {
    colCodigo = hoja.getLastColumn();
    hoja.getRange(1, colCodigo + 1).setValue('Código');
    avisos.push('Agregué la columna "Código" al final de la hoja.');
  }

  var ultima = hoja.getLastRow();
  var lista = [];
  var asignados = 0;
  if (ultima < 2) return { lista: lista, avisos: avisos, asignados: asignados };

  var ancho = Math.max(hoja.getLastColumn(), colCodigo + 1);
  var filas = hoja.getRange(2, 1, ultima - 1, ancho).getValues();

  var usados = {};
  for (var j = 0; j < filas.length; j++) {
    if (colCodigo < filas[j].length) {
      var c = normalizar_(filas[j][colCodigo]);
      if (c) usados[c] = true;
    }
  }

  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    var nombre = colNombre >= 0 ? String(f[colNombre] || '').trim() : '';
    var pases = colPases >= 0 ? parseInt(f[colPases], 10) : 0;
    if (!isFinite(pases) || pases < 0) pases = 0;
    var codigo = String(f[colCodigo] || '').trim();

    if (!nombre && !pases && !codigo) continue; // fila vacía

    if (asignar && !codigo) {
      codigo = nuevoCodigo_(usados);
      usados[codigo] = true;
      hoja.getRange(2 + i, colCodigo + 1).setValue(codigo);
      asignados++;
    }

    lista.push({ n: nombre, p: pases, c: codigo });
  }

  return { lista: lista, avisos: avisos, asignados: asignados };
}

function buscarPorCodigo_(codigoBuscado) {
  var codigo = normalizar_(codigoBuscado);
  var r = leerInvitados_(false);
  for (var i = 0; i < r.lista.length; i++) {
    if (r.lista[i].c && r.lista[i].c.toLowerCase() === codigo) return r.lista[i];
  }
  return null;
}

/* --- Códigos ------------------------------------------------------------ */

function nuevoCodigo_(usados) {
  var codigo;
  do {
    codigo = '';
    for (var i = 0; i < LARGO_CODIGO; i++) {
      codigo += ALFABETO.charAt(Math.floor(Math.random() * ALFABETO.length));
    }
  } while (usados && usados[codigo]);
  return codigo;
}

/* --- Utilidades para vosotros, desde la hoja ---------------------------- */

function generarCodigosFaltantes() {
  var r = leerInvitados_(true);
  var msg = r.asignados + (r.asignados === 1 ? ' código generado.' : ' códigos generados.') +
    '\nInvitados en la lista: ' + r.lista.length + '.' +
    (r.avisos.length ? '\n\n' + r.avisos.join('\n') : '');
  aviso_(msg);
}

function estado() {
  var hoja = hojaInvitados_();
  var r = leerInvitados_(false);
  var conCodigo = 0;
  for (var i = 0; i < r.lista.length; i++) if (r.lista[i].c) conCodigo++;
  var lineas = [
    'Pestaña: ' + hoja.getName(),
    'Encabezados: ' + cabeceras_(hoja).join(' | '),
    'Invitados: ' + r.lista.length,
    'Con código: ' + conCodigo
  ].concat(r.avisos);
  aviso_(lineas.join('\n'));
}

function aviso_(texto) {
  try {
    SpreadsheetApp.getUi().alert('Invitados', texto, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (err) {
    Logger.log(msg_final_(texto));
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Invitación')
      .addItem('Generar códigos faltantes', 'generarCodigosFaltantes')
      .addItem('Ver estado de la lista', 'estado')
      .addToUi();
  } catch (err) { /* sin interfaz: no pasa nada */ }
}

/* --- Automático: el código se asigna al cargar el invitado -------------- */

/**
 * Disparador simple de la hoja: corre solo cuando editás la pestaña
 * "Invitados". Si la fila tiene nombre o pases y todavía no tiene código, se lo
 * asigna en ese momento.
 *
 * Para qué: la columna del link se arma con el código. Sin esto habría que
 * abrir el generador (o el menú) para que los códigos existan. Con esto, cargás
 * la persona y el link aparece solo.
 *
 * Reglas:
 *  - Nunca toca una fila que ya tenga código: un link ya mandado no se rompe.
 *  - Nunca toca el encabezado (fila 1) ni otras pestañas (el RSVP, por ejemplo).
 *  - Si algo falla, se ignora en silencio: un disparador no puede romper la hoja.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;

    var hoja = e.range.getSheet();
    if (hoja.getName() !== NOMBRE_HOJA_INVITADOS) return;

    var cabeceras = cabeceras_(hoja);
    var colNombre = indiceColumna_(cabeceras, ['nombre', 'invitado', 'invitados', 'nombre completo', 'familia']);
    var colPases = indiceColumna_(cabeceras, ['pases', 'boletos', 'pases asignados', 'boletos asignados', 'cupo', 'personas', 'invitados asignados']);
    var colCodigo = indiceColumna_(cabeceras, ['codigo', 'code', 'clave', 'id', 'identificador']);

    if (colCodigo < 0) return; // sin columna de códigos no hay nada que hacer

    var primera = Math.max(e.range.getRow(), 2); // la fila 1 es el encabezado
    var ultima = e.range.getLastRow();
    if (ultima < primera) return;

    // Códigos que ya existen, para no repetir ninguno.
    var usados = {};
    var fin = hoja.getLastRow();
    if (fin >= 2) {
      var columna = hoja.getRange(2, colCodigo + 1, fin - 1, 1).getValues();
      for (var i = 0; i < columna.length; i++) {
        var ya = normalizar_(columna[i][0]);
        if (ya) usados[ya] = true;
      }
    }

    var ancho = Math.max(hoja.getLastColumn(), colCodigo + 1, colNombre + 1, colPases + 1);
    var filas = hoja.getRange(primera, 1, ultima - primera + 1, ancho).getValues();

    for (var f = 0; f < filas.length; f++) {
      var fila = filas[f] || [];

      if (normalizar_(fila[colCodigo])) continue; // ya tiene código: no se toca

      var nombre = colNombre >= 0 ? String(fila[colNombre] || '').trim() : '';
      var pases = colPases >= 0 ? String(fila[colPases] || '').trim() : '';
      if (!nombre && !pases) continue; // fila vacía: no inventamos códigos

      var nuevo = nuevoCodigo_(usados);
      usados[nuevo] = true;
      hoja.getRange(primera + f, colCodigo + 1).setValue(nuevo);
    }
  } catch (err) { /* en silencio: el disparador no puede romper la hoja */ }
}

