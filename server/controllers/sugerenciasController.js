const { withAuditConnection } = require('../config/db');
const { emailService, parseRecipientList, CATEGORIA_LABELS } = require('../services/emailService');

/**
 * Registrar una sugerencia de mejora del sistema y enviarla por correo
 * a los destinatarios definidos en SUGERENCIAS_EMAILS_DESTINO.
 */
async function crearSugerencia(req, res) {
  try {
    const user = req.user;
    const rawAsunto = String(req.body?.asunto || '').trim();
    const rawMensaje = String(req.body?.mensaje || '').trim();
    const rawCategoria = String(req.body?.categoria || 'MEJORA').trim().toUpperCase();
    const rawModulo = String(req.body?.modulo || '').trim().slice(0, 80);

    const categoria = Object.prototype.hasOwnProperty.call(CATEGORIA_LABELS, rawCategoria)
      ? rawCategoria
      : 'MEJORA';

    if (rawAsunto.length < 3 || rawAsunto.length > 200) {
      return res.status(400).json({
        ok: false,
        error: 'El asunto debe tener entre 3 y 200 caracteres.'
      });
    }

    if (rawMensaje.length < 5 || rawMensaje.length > 4000) {
      return res.status(400).json({
        ok: false,
        error: 'El detalle de la sugerencia debe tener entre 5 y 4000 caracteres.'
      });
    }

    const recipients = parseRecipientList(process.env.SUGERENCIAS_EMAILS_DESTINO);
    if (recipients.length === 0) {
      return res.status(500).json({
        ok: false,
        error: 'No hay casillas de destino válidas configuradas en SUGERENCIAS_EMAILS_DESTINO.'
      });
    }

    const recipientsText = recipients.join(', ').slice(0, 500);

    const insertResult = await withAuditConnection(user, async (connection) => {
      const [result] = await connection.query(
        `INSERT INTO APP_SUGERENCIAS
           (usuario_email, usuario_nombre, usuario_rol, categoria, modulo, asunto, mensaje, emails_destino, estado_envio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
        [
          user.email,
          user.nombre || user.email,
          user.rol || 'chofer',
          categoria,
          rawModulo || null,
          rawAsunto,
          rawMensaje,
          recipientsText
        ]
      );
      return result.insertId;
    });

    try {
      const mailRes = await emailService.sendSugerenciaEmail({
        sugerenciaId: insertResult,
        usuario: user,
        categoria,
        modulo: rawModulo,
        asunto: rawAsunto,
        mensaje: rawMensaje,
        recipients
      });

      const finalEstado = mailRes?.simulatedTest ? 'SIMULADO_TEST' : 'ENVIADO';
      await withAuditConnection(user, async (connection) => {
        await connection.query(
          `UPDATE APP_SUGERENCIAS SET estado_envio = ?, error_envio = NULL WHERE id = ?`,
          [finalEstado, insertResult]
        );
      });

      return res.status(201).json({
        ok: true,
        id: insertResult,
        estado_envio: finalEstado,
        message: '¡Gracias! Tu sugerencia fue enviada correctamente al equipo de soporte y mejoras.'
      });
    } catch (mailErr) {
      console.error(`[SugerenciasController] Error enviando correo de sugerencia #${insertResult}:`, mailErr.message);
      try {
        await withAuditConnection(user, async (connection) => {
          await connection.query(
            `UPDATE APP_SUGERENCIAS SET estado_envio = 'FALLIDO', error_envio = ? WHERE id = ?`,
            [String(mailErr.message || 'Error SMTP').slice(0, 500), insertResult]
          );
        });
      } catch (dbErr) {
        console.error('[SugerenciasController] Error actualizando estado_envio FALLIDO:', dbErr.message);
      }

      return res.status(502).json({
        ok: false,
        id: insertResult,
        error: `La sugerencia #${insertResult} quedó registrada en la base, pero falló el envío de correo (${mailErr.message}).`
      });
    }
  } catch (error) {
    console.error(`[SugerenciasController.crearSugerencia] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar la sugerencia.',
      details: error.message
    });
  }
}

module.exports = {
  crearSugerencia
};
