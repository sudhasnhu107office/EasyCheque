(() => {
  const params = new URLSearchParams(window.location.search);

  // Convert a numeric amount to Indian English words (Crore, Lakh, Thousand).
  // Accepts values such as 250000, 2,50,000, or "Rs. 2,50,000/-".
  function amountToIndianWords(rawAmount) {
    if (rawAmount == null || String(rawAmount).trim() === "") return "";

    const cleaned = String(rawAmount).replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
      throw new Error("Invalid amount. Enter a number such as 250000 or 250000.50.");
    }

    const amount = Number(cleaned);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Cheque amount must be a valid non-negative number.");
    }

    const integerPart = Math.floor(amount);
    const paisePart = Math.round((amount - integerPart) * 100);

    const ones = [
      "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
      "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen",
      "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty",
      "Seventy", "Eighty", "Ninety"
    ];

    function underThousand(n) {
      let words = "";
      if (n >= 100) {
        words += ones[Math.floor(n / 100)] + " Hundred";
        n %= 100;
        if (n) words += " ";
      }
      if (n >= 20) {
        words += tens[Math.floor(n / 10)];
        n %= 10;
        if (n) words += " " + ones[n];
      } else if (n > 0) {
        words += ones[n];
      }
      return words;
    }

    function indianIntegerWords(n) {
      if (n === 0) return "Zero";
      if (n > 99999999999) {
        throw new Error("Amount is too large. Maximum supported amount is 99,99,99,99,999.");
      }

      const parts = [];
      const crore = Math.floor(n / 10000000);
      n %= 10000000;
      const lakh = Math.floor(n / 100000);
      n %= 100000;
      const thousand = Math.floor(n / 1000);
      n %= 1000;

      if (crore) parts.push(underThousand(crore) + " Crore");
      if (lakh) parts.push(underThousand(lakh) + " Lakh");
      if (thousand) parts.push(underThousand(thousand) + " Thousand");
      if (n) parts.push(underThousand(n));

      return parts.join(" ");
    }

    let words = indianIntegerWords(integerPart);
    if (paisePart > 0) {
      words += " and " + underThousand(paisePart) + " Paise";
    }
    return "ㅤㅤㅤㅤㅤ**" + words + " Only/-";
  }

  const data = Object.fromEntries(params.entries());
  const bank = (params.get("bank") || "").toUpperCase();

  // Generate cheque text automatically from URL data.
  try {
    data.amountWords = amountToIndianWords(data.amount);
  } catch (error) {
    const errorBox = document.getElementById("error");
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent = error.message;
    }
  }

  // Payee: add ** prefix and ** postfix without duplicating existing markers.
  if (data.payee) {
    const cleanPayee = String(data.payee).replace(/^\*+\s*/, "").replace(/\s*\*+$/, "");
    data.payee = `**${cleanPayee}**`;
  }

  // Amount: Indian comma grouping, ** prefix and /- postfix.
  function formatChequeAmount(rawAmount) {
    if (rawAmount == null || String(rawAmount).trim() === "") return "";
    const numeric = String(rawAmount).replace(/,/g, "").replace(/[^\d.]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(numeric)) return `**${String(rawAmount).replace(/^\*+\s*/, "").replace(/\s*\/-$/, "")}/-`;
    const [integerPart, decimalPart] = numeric.split(".");
    const lastThree = integerPart.slice(-3);
    const otherDigits = integerPart.slice(0, -3);
    const grouped = otherDigits
      ? otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
    return `**${grouped}${decimalPart != null ? "." + decimalPart : ""}/-`;
  }
  data.amount = formatChequeAmount(data.amount);

  // Account-payee flag is available to JSON conditional elements.
  data.accountPayee = String(params.get("accountPayee") || "").trim().toLowerCase();
  const container = document.getElementById("cheque");
  const errorBox = document.getElementById("error");
  const status = document.getElementById("status");
  const tabs = [...document.querySelectorAll(".tab")];
  const zoom = document.getElementById("zoom");
  const showBackground = document.getElementById("show-background");
  const printButton = document.getElementById("print-button");
  let config = null;
  let currentSide = "front";


  function showError(message) {
    errorBox.hidden = false;
    errorBox.textContent = message;
    status.textContent = "Error";
    status.style.background = "rgba(180,30,30,.35)";
  }

  function updatePreview() {
    if (!config) return;
    ChequeLayout.render(container, config, currentSide, data, showBackground.checked);
    const scale = Number(zoom.value);
    container.style.transform = `scale(${scale})`;
    document.getElementById("preview-title").textContent =
      `${currentSide === "front" ? "Front" : "Back"} side preview`;
    document.getElementById("dimensions").textContent =
      `${config.page.width} × ${config.page.height} ${config.page.unit || "mm"}`;
    printButton.textContent = `Print ${currentSide} side`;
    document.getElementById("pdf-button").textContent = `Download ${currentSide} PDF`;
    //document.title = `${config.bank || bank} Cheque - ${currentSide}`;
  }

  async function init() {
    try {
      document.getElementById("url-data").textContent = JSON.stringify(data, null, 2);
      if (!bank) throw new Error("Bank parameter is missing. Example: ?bank=SBI");
      config = await ChequeLayout.load(bank);
      document.getElementById("bank-label").textContent = `${config.bank || bank} · Cheque layout loaded`;
      status.textContent = "Ready";
      updatePreview();

      tabs.forEach(button => button.addEventListener("click", () => {
        currentSide = button.dataset.side;
        tabs.forEach(tab => tab.classList.toggle("active", tab === button));
        updatePreview();
      }));
      zoom.addEventListener("change", updatePreview);
      showBackground.addEventListener("change", updatePreview);
      printButton.addEventListener("click", () => ChequePrinter.print(container, config));
      document.getElementById("pdf-button").addEventListener("click", async () => {
        const button = document.getElementById("pdf-button");
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Generating PDF…";
        errorBox.hidden = true;
        try {
          await ChequePrinter.downloadPdf(container, config, currentSide, bank);
        } catch (error) {
          showError(`PDF download failed: ${error.message || error}`);
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    } catch (error) {
      showError(error.message);
      document.getElementById("bank-label").textContent = "Unable to load cheque layout";
    }
  }

  init();
})();
