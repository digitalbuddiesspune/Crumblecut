import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Wait for all images in the container to load completely.
 */
function waitForImages(element) {
  const images = element.querySelectorAll('img');
  return Promise.all(
    Array.from(images).map((img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 2500);
      })
    )
  );
}

/**
 * Fix Tailwind v4 OKLCH color parsing bug in html2canvas.
 * Temporarily patches <style> tags containing `oklch` so html2canvas doesn't fail.
 */
function patchOklchInDocument() {
  const styleBackups = [];
  document.querySelectorAll('style').forEach((style) => {
    const content = style.textContent || '';
    if (content.includes('oklch')) {
      styleBackups.push([style, content]);
      style.textContent = content.replace(/oklch\([^)]*\)/gi, '#374151');
    }
  });

  const linkBackups = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    linkBackups.push([link, link.disabled]);
    link.disabled = true;
  });

  return () => {
    styleBackups.forEach(([style, content]) => {
      style.textContent = content;
    });
    linkBackups.forEach(([link, disabled]) => {
      link.disabled = disabled;
    });
  };
}

/**
 * Generates and downloads an A4 PDF from a DOM element.
 * @param {HTMLElement} element - Target container element
 * @param {string} filename - Target filename (e.g. invoice-12345.pdf)
 */
export async function downloadInvoicePdf(element, filename = 'invoice.pdf') {
  if (!element) throw new Error('Invoice container element not found');

  const captureTarget = element.querySelector('.invoice-export') || element;

  // Create an off-screen backdrop to prevent visual flashing
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:#ffffff;z-index:99998;pointer-events:none;';
  document.body.appendChild(backdrop);

  // Snapshot previous style attributes
  const prevStyle = element.getAttribute('style') || '';
  element.style.cssText =
    'position:fixed;top:0;left:0;width:794px;max-width:794px;background:#ffffff;z-index:99999;opacity:1;visibility:visible;pointer-events:none;';

  try {
    await waitForImages(captureTarget);
    // Allow browser two frames to settle layout
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const restoreStyles = patchOklchInDocument();
    let canvas;
    try {
      canvas = await html2canvas(captureTarget, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        windowWidth: 794,
      });
    } finally {
      restoreStyles();
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    const printableHeight = pageHeight - margin * 2;

    let heightLeft = contentHeight;
    let yPosition = contentHeight <= printableHeight ? (pageHeight - contentHeight) / 2 : margin;

    pdf.addImage(imgData, 'JPEG', margin, yPosition, contentWidth, contentHeight);
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      yPosition = margin - (contentHeight - heightLeft);
      pdf.addImage(imgData, 'JPEG', margin, yPosition, contentWidth, contentHeight);
      heightLeft -= printableHeight;
    }

    pdf.save(filename);
    return { success: true };
  } finally {
    element.setAttribute('style', prevStyle);
    backdrop.remove();
  }
}

export default downloadInvoicePdf;
