/* Printing helpers. The browser print dialog is used; the user chooses the physical printer. */
window.ChequePrinter = (() => {
  function setPageSize(width, height) {
    let style = document.getElementById("dynamic-print-size");
    if (!style) {
      style = document.createElement("style");
      style.id = "dynamic-print-size";
      document.head.appendChild(style);
    }
    style.textContent = `@media print { @page { size: ${width}mm ${height}mm; margin: 0; } }`;
  }

  
function print(container, config) {
    const width = Number(config.page.width);
    const height = Number(config.page.height);

    if (!(width > 0 && height > 0)) {
        throw new Error("Invalid cheque page dimensions.");
    }

    setPageSize(width, height);

    container.style.width = `${width}mm`;
    container.style.height = `${height}mm`;
    container.style.transform = "none";

    window.print();
}
  


  async function loadScript(src, globalName) {
    if (window[globalName]) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => window[globalName]
        ? resolve()
        : reject(new Error(`Library loaded but ${globalName} was not found.`));
      script.onerror = () => reject(new Error("Could not load PDF libraries from CDN. Check internet access or allow cdnjs.cloudflare.com."));
      document.head.appendChild(script);
    });
  }

  async function downloadPdf(container, config, side, bank) {
    const widthMm = Number(config.page.width);
    const heightMm = Number(config.page.height);
    if (!(widthMm > 0 && heightMm > 0)) {
      throw new Error("Invalid page dimensions in bank JSON.");
    }

    document.getElementById("show-background").checked = false;
    
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "html2canvas"
    );
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "jspdf"
    );

    // Clone the selected side into a visible off-screen staging area.
    // html2canvas cannot reliably capture elements positioned far outside the viewport.
    const pxPerMm = 96 / 25.4;
    const widthPx = widthMm * pxPerMm;
    const heightPx = heightMm * pxPerMm;

    const staging = document.createElement("div");
    staging.id = "pdf-staging";
    staging.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "opacity:0.01",
      "pointer-events:none",
      "z-index:-1",
      `width:${widthMm}mm`,
      `height:${heightMm}mm`,
      "overflow:hidden",
      "background:#ffffff"
    ].join(";");

    const copy = container.cloneNode(true);
    copy.id = "pdf-cheque";
    copy.style.cssText += `;width:${widthMm}mm;height:${heightMm}mm;position:relative;transform:none;margin:0;box-shadow:none;`;
    staging.appendChild(copy);
    document.body.appendChild(staging);

    try {
      const images = [...copy.querySelectorAll("img")];
      await Promise.all(images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      const canvas = await window.html2canvas(copy, {
        scale: 3,
        width: widthPx,
        height: heightPx,
        windowWidth: Math.max(document.documentElement.clientWidth, Math.ceil(widthPx)),
        windowHeight: Math.max(document.documentElement.clientHeight, Math.ceil(heightPx)),
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: widthMm >= heightMm ? "landscape" : "portrait",
        unit: "mm",
        format: [widthMm, heightMm],
        compress: true
      });

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);
      const safeBank = String(bank || "Cheque").replace(/[^a-z0-9_-]/gi, "_");
      pdf.save(`${safeBank}-${side}.pdf`);
    } finally {
      staging.remove();
    }
  }
  return { print, downloadPdf };
})();
