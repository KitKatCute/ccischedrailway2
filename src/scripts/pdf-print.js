// ─────────────────────────────────────────────
//  Shared helper: print a jsPDF document directly.
//  Prints the exact same document object that "Export PDF" saves.
// ─────────────────────────────────────────────
function printPdfDoc(doc) {
  const url = doc.output('bloburl');

  // Remove any leftover frame from a previous print
  document.getElementById('pdfPrintFrame')?.remove();

  const frame = document.createElement('iframe');
  frame.id = 'pdfPrintFrame';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  frame.src = url;

  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      // Some browsers block printing a PDF inside an iframe —
      // fall back to opening the PDF in a tab (its viewer has a print button).
      window.open(url, '_blank');
    }
  };

  document.body.appendChild(frame);
}

// ─────────────────────────────────────────────
//  Shared helper: official PUP / CCI letterhead for jsPDF exports.
//  Header image (seals + college name + Bagong Pilipinas) on top, official
//  footer image (campus address, ISO / ranking badges) at the bottom of
//  EVERY page. Usage:
//    await loadPdfLetterhead();
//    const L = pdfLetterheadLayout(doc, margin);
//    y = drawPdfTitle(doc, L, 'TITLE', 'subtitle');   // first page only
//    ... content (new pages start at L.contentTop, stop at L.contentBottom) ...
//    applyPdfLetterhead(doc, L);                      // after all pages exist
// ─────────────────────────────────────────────
let _pdfLH = null;

function _loadImageAsDataURL(relPath) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch (err) {
        resolve(null);   // canvas blocked (e.g. file://) — PDF still builds, without images
      }
    };
    img.onerror = () => resolve(null);
    img.src = new URL(relPath, window.location.href).href;
  });
}

// Call (and await) before building a PDF. Safe to call repeatedly.
async function loadPdfLetterhead() {
  if (_pdfLH) return _pdfLH;
  const [header, footer] = await Promise.all([
    _loadImageAsDataURL('../assets/images/letterhead-header.png'),
    _loadImageAsDataURL('../assets/images/letterhead-footer.png'),
  ]);
  _pdfLH = { header, footer };
  return _pdfLH;
}

// Works out where the header / footer sit and where content may go.
function pdfLetterheadLayout(doc, margin) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const w     = pageW - margin * 2;
  const edge  = 24;                                   // gap from paper edge
  const hImg  = _pdfLH?.header, fImg = _pdfLH?.footer;
  const headerH = hImg ? w * hImg.h / hImg.w : 0;
  const footerW = fImg ? w * 0.92 : 0;                // slightly narrower than the header
  const footerH = fImg ? footerW * fImg.h / fImg.w : 0;
  const ruleY   = edge + headerH + 6;
  return {
    pageW, pageH, margin, w, edge, headerH, footerW, footerH, ruleY,
    contentTop:    (hImg ? ruleY + 16 : margin),
    footerTop:     pageH - edge - footerH,
    contentBottom: pageH - edge - footerH - 26,       // leaves room for the page-number line
  };
}

// Centered document title + subtitle under the header. Returns next y.
function drawPdfTitle(doc, L, title, subtitle) {
  let y = L.contentTop + 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, L.pageW / 2, y, { align: 'center' });
  if (subtitle) {
    y += 15;
    doc.setFontSize(10.5);
    doc.text(subtitle, L.pageW / 2, y, { align: 'center' });
  }
  return y + 24;
}

// Stamps header, rule, footer and page numbers on every page.
function applyPdfLetterhead(doc, L) {
  const total = doc.internal.getNumberOfPages();
  const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (_pdfLH?.header) {
      doc.addImage(_pdfLH.header.data, 'PNG', L.margin, L.edge, L.w, L.headerH);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.line(L.margin, L.ruleY, L.pageW - L.margin, L.ruleY);
    }
    if (_pdfLH?.footer) {
      doc.addImage(_pdfLH.footer.data, 'PNG', L.margin, L.footerTop, L.footerW, L.footerH);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated on ${stamp}   \u00b7   Page ${i} of ${total}`,
             L.pageW - L.margin, L.footerTop - 8, { align: 'right' });
  }
}
