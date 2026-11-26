const nodemailer = require('nodemailer');

const CATEGORIA_LABELS = {
  MEJORA: 'Mejora funcional',
  ERROR: 'Error / Problema',
  UX_UI: 'Diseño / Usabilidad',
  OTRO: 'Otra sugerencia'
};

function cleanEnv(val, fallback = '') {
  return String(val ?? fallback).replace(/^"+|"+$/g, '').trim();
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseRecipientList(raw = '') {
  const seen = new Set();
  const list = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  String(raw || '')
    .split(/[;,]/)
    .map((item) => cleanEnv(item).toLowerCase())
    .filter(Boolean)
    .forEach((email) => {
      if (emailRegex.test(email) && !seen.has(email)) {
        seen.add(email);
        list.push(email);
      }
    });

  return list;
}

class EmailService {
  constructor() {
    this.internalTransporter = null;
    this.fallbackTransporter = null;
    this.internalFrom = '';
    this.fallbackFrom = '';
    this.initTransporters();
  }

  initTransporters() {
    const alertaUser = cleanEnv(process.env.ALERTA_SMTP_USER);
    const alertaPass = cleanEnv(process.env.ALERTA_SMTP_PASSWORD);
    const alertaHost = cleanEnv(process.env.ALERTA_SMTP_HOST, 'smtp-mail.outlook.com');
    const alertaPort = parseInt(cleanEnv(process.env.ALERTA_SMTP_PORT, '587'), 10) || 587;
    const alertaEncrypt = cleanEnv(process.env.ALERTA_SMTP_ENCRYPT, 'tls').toLowerCase();
    const isAlertaSecure = alertaEncrypt === 'ssl' || alertaPort === 465;

    if (alertaHost && alertaUser && alertaPass) {
      this.internalTransporter = nodemailer.createTransport({
        host: alertaHost,
        port: alertaPort,
        secure: isAlertaSecure,
        auth: { user: alertaUser, pass: alertaPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });
      const alertaName = cleanEnv(process.env.ALERTA_SMTP_NAME, 'Don Yeyo - Logística');
      this.internalFrom = `"${alertaName}" <${alertaUser}>`;
    }

    const smtpUser = cleanEnv(process.env.SMTP_USER);
    const smtpPass = cleanEnv(process.env.SMTP_PASS);
    const smtpHost = cleanEnv(process.env.SMTP_HOST);
    const smtpPort = parseInt(cleanEnv(process.env.SMTP_PORT, '465'), 10) || 465;
    const smtpSecure = cleanEnv(process.env.SMTP_SECURE) === 'true' || smtpPort === 465;

    if (smtpHost && smtpUser && smtpPass) {
      this.fallbackTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });
      const fromName = cleanEnv(process.env.SMTP_FROM_NAME, 'Don Yeyo - Logística');
      const fromEmail = cleanEnv(process.env.SMTP_FROM_EMAIL, smtpUser);
      this.fallbackFrom = `"${fromName}" <${fromEmail}>`;
    }
  }

  getLogoHeaderHtml(titulo = '', subtitulo = '') {
    const logoUrl = cleanEnv(process.env.EMAIL_LOGO_URL);
    const logoRender = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="Don Yeyo" style="max-height:46px; max-width:200px; object-fit:contain; margin-bottom:8px;" />`
      : `<h1 style="margin:0; font-size:1.5rem; letter-spacing:1px; font-weight:800; color:#ffffff;">DON YEYO</h1>`;

    return `
      <div style="background:#0d2c5c; color:#ffffff; padding:22px 20px; text-align:center; border-bottom:4px solid #e40521;">
        ${logoRender}
        ${titulo ? `<h2 style="margin:6px 0 0 0; font-size:1.2rem; font-weight:700; color:#ffffff;">${escapeHtml(titulo)}</h2>` : ''}
        ${subtitulo ? `<p style="margin:4px 0 0 0; opacity:0.88; font-size:0.84rem;">${escapeHtml(subtitulo)}</p>` : ''}
      </div>
    `;
  }

  async sendMail(mailOptions) {
    const primary = this.internalTransporter || this.fallbackTransporter;
    const primaryFrom = this.internalTransporter ? this.internalFrom : this.fallbackFrom;

    if (!primary) {
      throw new Error('El servidor de correo SMTP no está configurado en las variables de entorno.');
    }

    const testMode =
      cleanEnv(process.env.EMAIL_TEST_MODE).toLowerCase() === 'true' ||
      cleanEnv(process.env.EMAIL_TEST_MODE) === '1';
    const testRecipient = cleanEnv(
      process.env.EMAIL_TEST_RECIPIENT,
      cleanEnv(process.env.ALERTA_SMTP_USER) || cleanEnv(process.env.SMTP_USER)
    );

    const finalOptions = {
      from: primaryFrom,
      ...mailOptions
    };

    if (testMode && testRecipient) {
      const originalTo = Array.isArray(mailOptions.to)
        ? mailOptions.to.join(', ')
        : String(mailOptions.to || '');

      const bannerHtml = `
        <div style="background:#fef3c7; border:2px dashed #f59e0b; color:#92400e; padding:12px 14px; margin-bottom:16px; border-radius:8px; font-family:'Segoe UI', Tahoma, sans-serif; font-size:0.86rem; line-height:1.45;">
          <strong>MODO PRUEBAS (EMAIL_TEST_MODE)</strong><br/>
          Destinatarios originales: ${escapeHtml(originalTo)}
        </div>
      `;

      finalOptions.to = testRecipient;
      finalOptions.subject = `[TESTING - Para: ${originalTo}] ${mailOptions.subject}`;
      if (finalOptions.html) {
        finalOptions.html = `${bannerHtml}${finalOptions.html}`;
      }
    }

    try {
      const info = await primary.sendMail(finalOptions);
      return { info, simulatedTest: testMode && Boolean(testRecipient) };
    } catch (primaryErr) {
      if (this.fallbackTransporter && primary !== this.fallbackTransporter) {
        console.warn(`[EmailService] Falló SMTP primario (${primaryErr.message}). Reintentando con SMTP de respaldo...`);
        const info = await this.fallbackTransporter.sendMail({
          ...finalOptions,
          from: this.fallbackFrom
        });
        return { info, simulatedTest: testMode && Boolean(testRecipient) };
      }
      throw primaryErr;
    }
  }

  async sendSugerenciaEmail({ sugerenciaId, usuario, categoria, modulo, asunto, mensaje, recipients }) {
    const destList = Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : parseRecipientList(process.env.SUGERENCIAS_EMAILS_DESTINO);

    if (destList.length === 0) {
      throw new Error('No hay destinatarios configurados en SUGERENCIAS_EMAILS_DESTINO.');
    }

    const catLabel = CATEGORIA_LABELS[categoria] || categoria || 'Mejora funcional';
    const userName = usuario?.nombre || 'Usuario';
    const userEmail = usuario?.email || 'No informado';
    const userRole = usuario?.rol || 'chofer';
    const moduloText = modulo || 'General';
    const fechaText = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    const headerHtml = this.getLogoHeaderHtml(
      `Nueva Sugerencia de Mejora #${sugerenciaId || ''}`,
      'Portal Logístico y App Móvil para Choferes'
    );

    const safeMensaje = escapeHtml(mensaje).replace(/\r?\n/g, '<br/>');

    const html = `
      <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:620px; margin:auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
        ${headerHtml}
        <div style="padding:22px 24px; color:#1e293b; line-height:1.55;">
          <p style="margin-top:0;">Un usuario del sistema envió una nueva sugerencia o reporte de mejora:</p>

          <div style="background:#f1f5f9; padding:14px 16px; border-radius:8px; margin:14px 0; font-size:0.9rem;">
            <strong>Usuario:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})<br/>
            <strong>Rol:</strong> ${escapeHtml(userRole)}<br/>
            <strong>Categoría:</strong> ${escapeHtml(catLabel)}<br/>
            <strong>Módulo / Pantalla:</strong> ${escapeHtml(moduloText)}<br/>
            <strong>Fecha (AR):</strong> ${escapeHtml(fechaText)}
          </div>

          <h3 style="margin:18px 0 8px; color:#0d2c5c; font-size:1.05rem;">
            ${escapeHtml(asunto)}
          </h3>
          <div style="background:#f8fafc; border-left:4px solid #2563eb; padding:14px 16px; border-radius:6px; font-size:0.94rem; color:#0f172a;">
            ${safeMensaje}
          </div>
        </div>
        <div style="background:#f8fafc; padding:12px 16px; text-align:center; font-size:0.78rem; color:#64748b; border-top:1px solid #e2e8f0;">
          Don Yeyo S.A. · Portal Logístico DY-LOGISTICA-APP
        </div>
      </div>
    `;

    return this.sendMail({
      to: destList.join(', '),
      replyTo: userEmail && userEmail.includes('@') ? userEmail : undefined,
      subject: `[Sugerencia DY Logística #${sugerenciaId || '-'}] (${catLabel}) ${asunto}`,
      html
    });
  }
}

module.exports = {
  emailService: new EmailService(),
  parseRecipientList,
  CATEGORIA_LABELS
};
