export const INVOICE_EXPORT_CSS = `
.invoice-export {
  width: 794px;
  max-width: 794px;
  min-height: 1123px;
  margin: 0 auto;
  background: #ffffff;
  color: #111827;
  padding: 40px 36px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}
.invoice-export-sheet { width: 100%; }
.invoice-export * { box-sizing: border-box; }
.invoice-export-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.invoice-export-logo { height: 50px; max-width: 220px; object-fit: contain; }
.invoice-export-brand { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
.invoice-export-doc-title { font-size: 26px; font-weight: 800; letter-spacing: 1px; text-align: right; margin: 0; color: #111827; }
.invoice-export-badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: #EEF2F6; color: #374151; margin-top: 4px; }
.invoice-export-company { font-size: 11px; color: #4B5563; margin: 6px 0 20px; line-height: 1.5; max-width: 480px; }
.invoice-export-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.invoice-export-block { border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
.invoice-export-block-title { background: #F3F4F6; color: #111827; font-weight: 700; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #E5E7EB; }
.invoice-export-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
.invoice-export-table th { background: #F9FAFB; border: 1px solid #E5E7EB; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #374151; letter-spacing: 0.5px; }
.invoice-export-table th.center, .invoice-export-table td.center { text-align: center; }
.invoice-export-table th.right, .invoice-export-table td.right { text-align: right; }
.invoice-export-table td { border: 1px solid #E5E7EB; padding: 8px 10px; font-size: 12px; color: #1F2937; }
.invoice-export-details-table { width: 100%; border-collapse: collapse; }
.invoice-export-details-table td { border: 1px solid #E5E7EB; padding: 6px 10px; font-size: 12px; }
.invoice-export-details-table td:first-child { background: #FAFAFA; width: 40%; font-weight: 600; color: #4B5563; }
.invoice-export-body-text { padding: 8px 12px; font-size: 12px; color: #374151; line-height: 1.6; }
.invoice-export-totals { display: flex; justify-content: flex-end; margin-top: 8px; margin-bottom: 24px; }
.invoice-export-totals-box { width: 330px; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
.invoice-export-totals-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #374151; }
.invoice-export-totals-grand { display: flex; justify-content: space-between; padding: 9px 12px; background: #F9FAFB; font-weight: 800; font-size: 14px; border-top: 2px solid #111827; color: #111827; }
.invoice-export-bottom-grid { display: grid; grid-template-columns: 1fr 220px; gap: 20px; margin-top: auto; padding-top: 16px; border-top: 1px dashed #D1D5DB; }
.invoice-export-signatory { text-align: right; font-size: 11px; color: #4B5563; }
.invoice-export-signatory-line { margin-top: 45px; border-top: 1px solid #9CA3AF; padding-top: 4px; font-weight: 600; color: #111827; }
.invoice-export-footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #F3F4F6; text-align: center; font-size: 10px; color: #6B7280; }

@media print {
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body * {
    visibility: hidden !important;
  }
  .invoice-export,
  .invoice-export *,
  #admin-invoice-print-root,
  #admin-invoice-print-root * {
    visibility: visible !important;
  }
  .invoice-export,
  #admin-invoice-print-root {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
    display: block !important;
    z-index: 999999 !important;
    opacity: 1 !important;
  }
  .invoice-export-block,
  .invoice-export-totals-box,
  .invoice-export-table tr,
  .invoice-export-bottom-grid {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
`;

export default INVOICE_EXPORT_CSS;
