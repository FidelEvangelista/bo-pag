/**
 * Google Apps Script — RSVP Handler para invitación de boda
 *
 * INSTRUCCIONES:
 * 1. Crear un Google Sheet nuevo en https://sheets.google.com
 * 2. Nombrar la hoja "RSVP - Astrid & Fidel"
 * 3. En la fila 1, crear estas columnas:
 *    A: Fecha | B: Nombre | C: Email | D: Asistirá | E: Invitados | F: Menú | G: Canción | H: Nota
 * 4. Ir a Extensiones > Apps Script
 * 5. Pegar TODO este código reemplazando el contenido default
 * 6. Guardar (Ctrl+S)
 * 7. Implementar > Desplegar > Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 8. Copiar la URL generada y pegarla en main.js donde dice "PEGA_TU_URL_AQUI"
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data;

  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var row = [
    new Date(),                    // A: Fecha de envío
    data.name      || '',          // B: Nombre completo
    data.email     || '',          // C: Email
    data.attending || '',          // D: Sí / No
    data.guests    || '1',         // E: Número de invitados
    data.meal      || '',          // F: Menú
    data.song      || '',          // G: Canción
    data.note      || ''           // H: Nota
  ];

  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
