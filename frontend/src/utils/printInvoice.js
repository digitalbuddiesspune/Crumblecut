import { INVOICE_EXPORT_CSS } from './invoiceExportStyles';

/**
 * Foolproof Invoice Printing using an isolated hidden iframe.
 * Ensures only the clean A4 Tax Invoice prints with exact colors, logos,
 * and zero blank pages or background app clutter.
 * 
 * @param {HTMLElement} element - The invoice container DOM node
 */
export function printInvoice(element) {
  if (!element) {
    window.print();
    return;
  }

  const captureTarget = element.querySelector('.invoice-export') || element;
  const invoiceHtml = captureTarget.outerHTML;

  // Create an invisible iframe attached to body
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Tax Invoice - Crumblecut</title>
        <style>
          ${INVOICE_EXPORT_CSS}
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }
          .invoice-export {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .invoice-export-block,
          .invoice-export-totals-box,
          .invoice-export-table tr,
          .invoice-export-bottom-grid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        ${invoiceHtml}
      </body>
    </html>
  `);
  doc.close();

  // Wait for images in the iframe to finish loading before opening print dialog
  const iframeImages = doc.querySelectorAll('img');
  const imagePromises = Array.from(iframeImages).map((img) => {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(resolve, 1500);
    });
  });

  Promise.all(imagePromises).then(() => {
    // Two animation frames for layout calculation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Iframe print error, falling back to window.print():', err);
          window.print();
        } finally {
          // Cleanup iframe after user closes print dialog
          setTimeout(() => {
            try {
              iframe.remove();
            } catch {}
          }, 2000);
        }
      });
    });
  });
}

export default printInvoice;
