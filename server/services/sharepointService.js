const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Servicio para procesar y enviar imágenes a SharePoint / Power Automate.
 */
class SharePointService {
  /**
   * Genera el nombre de archivo estandarizado para la foto capturada por el chofer.
   * @param {string} codigoChofer - Código de chofer o legajo (ej. "32355")
   * @param {string} comprobante - Número de remito/comprobante (ej. "R-0050-00487512")
   * @param {string} ext - Extensión del archivo (por defecto ".jpg")
   */
  static generateFileName(codigoChofer, comprobante, ext = '.jpg') {
    const cleanComprobante = (comprobante || 'SIN_CBTE').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanChofer = (codigoChofer || 'DESCONOCIDO').replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    
    // Identificador claro de que proviene de la cámara del chofer
    return `FOTO_CAM_CHOFER_${cleanChofer}_${cleanComprobante}_${timestamp}${ext.startsWith('.') ? ext : '.' + ext}`;
  }

  /**
   * Sube la imagen a Power Automate / SharePoint si está habilitado en las variables de entorno.
   * @param {string} filePath - Ruta absoluta del archivo local
   * @param {string} finalFileName - Nombre estandarizado del archivo
   * @param {object} metadata - Metadatos adicionales (remitoId, choferEmail, comprobante, etc.)
   */
  static async uploadToSharePoint(filePath, finalFileName, metadata = {}) {
    const isEnabled = process.env.ENABLE_SHAREPOINT_UPLOAD === 'true';
    const powerAutomateUrl = process.env.POWERAUTOMATE_URL;

    if (!isEnabled || !powerAutomateUrl || powerAutomateUrl.includes('placeholder')) {
      console.log(`[SharePoint] Subida remota desactivada o no configurada. Conservando archivo local: ${finalFileName}`);
      return {
        success: true,
        isRemote: false,
        fileName: finalFileName,
        url: `/uploads/${finalFileName}`,
        message: 'Archivo guardado localmente en servidor'
      };
    }

    try {
      console.log(`[SharePoint] Enviando archivo ${finalFileName} a Power Automate (${powerAutomateUrl})...`);
      
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');

      const payload = {
        filename: finalFileName,
        imagebase64: base64Data,
        use_ia: false
      };

      const response = await axios.post(powerAutomateUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      console.log(`✔ [SharePoint] Imagen enviada con éxito a SharePoint/Power Automate [Status: ${response.status}]`);
      
      let remoteUrl = null;
      if (response.data) {
        let archivoPath = response.data.resultado || response.data.archivo || response.data.url || response.data.fileUrl || '';
        if (typeof archivoPath === 'string' && archivoPath.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(archivoPath);
            archivoPath = parsed.archivo || parsed.resultado || archivoPath;
          } catch (e) {
            // No es JSON válido, conservar string original
          }
        }

        if (archivoPath && process.env.SHAREPOINT_FQDN) {
          const fqdn = process.env.SHAREPOINT_FQDN.replace(/\/$/, '');
          const cleanPath = decodeURIComponent(archivoPath).replace(/^\//, '');
          remoteUrl = `${fqdn}/${encodeURI(cleanPath)}`;
        } else if (archivoPath) {
          remoteUrl = archivoPath;
        } else {
          remoteUrl = `${process.env.SHAREPOINT_FQDN || 'SharePoint'}/${finalFileName}`;
        }
      }

      return {
        success: true,
        isRemote: true,
        fileName: finalFileName,
        url: remoteUrl,
        response: response.data
      };

    } catch (error) {
      console.error(`❌ [SharePoint] Error al subir imagen a SharePoint (${error.message}). Se mantiene copia local.`);
      return {
        success: false,
        isRemote: false,
        fileName: finalFileName,
        url: `/uploads/${finalFileName}`,
        error: error.message
      };
    }
  }
}

module.exports = SharePointService;
