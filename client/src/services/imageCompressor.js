/**
 * Utilidad client-side para redimensionar y comprimir fotografías a JPEG al 70% antes de enviarlas al servidor.
 */
export async function compressImage(file, options = {}) {
  const quality = options.quality || parseFloat(import.meta.env.VITE_IMAGE_COMPRESSION_QUALITY || '0.70');
  const maxWidth = options.maxWidth || parseInt(import.meta.env.VITE_IMAGE_MAX_WIDTH || '1920', 10);
  const maxHeight = options.maxHeight || parseInt(import.meta.env.VITE_IMAGE_MAX_HEIGHT || '1920', 10);

  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular dimensiones proporcionales
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Suavizado de imagen de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG con compresión del 70%
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Fallo al comprimir la imagen en Canvas.'));
              return;
            }

            const compressedSizeKb = Math.round(blob.size / 1024);
            const reductionPct = Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100);

            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now()
            });

            const dataUrl = canvas.toDataURL('image/jpeg', quality);

            resolve({
              file: compressedFile,
              dataUrl: dataUrl,
              blob: blob,
              originalSizeKb,
              compressedSizeKb,
              reductionPct: reductionPct > 0 ? reductionPct : 0,
              width,
              height
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Error al decodificar la imagen seleccionada.'));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}
