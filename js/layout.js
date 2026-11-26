
/* Bank layout loader and rendering helpers.
   All bank-specific geometry belongs in layouts/*.json.
*/

window.ChequeLayout = (() => {

    async function load(bank) {
        const safeBank = String(bank || "")
    .trim()
    .toUpperCase();

// Remove all special characters, preserving spaces
const fileName = safeBank
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

        const response = await fetch(
            `layouts/${fileName}.json`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                `Could not load layout: layouts/${fileName}.json (HTTP ${response.status})`
            );
        }

        const config = await response.json();

        validate(config);

        return config;
    }


    function validate(config) {
        if (!config.page || !Number(config.page.width) || !Number(config.page.height)) {
            throw new Error("Bank JSON must define page.width and page.height.");
        }

        if (!config.front || !config.back) {
            throw new Error("Bank JSON must define both front and back sections.");
        }

        for (const side of ["front", "back"]) {
            if (!Array.isArray(config[side].elements)) {
                config[side].elements = [];
            }
        }
    }


    function applyPositionAndSize(node, element) {
        node.style.left = `${Number(element.x || 0)}mm`;
        node.style.top = `${Number(element.y || 0)}mm`;

        if (element.width != null) {
            node.style.width = `${Number(element.width)}mm`;
        }

        if (element.height != null) {
            node.style.height = `${Number(element.height)}mm`;
        }

        if (element.rotation) {
            node.style.transform = `rotate(${Number(element.rotation)}deg)`;
        }
    }


    function applyTextStyle(node, element) {
        applyPositionAndSize(node, element);

        if (element.fontSize != null) {
            node.style.fontSize = `${Number(element.fontSize)}pt`;
        }

        if (element.fontFamily) {
            node.style.fontFamily = element.fontFamily;
        }

        if (element.bold) {
            node.style.fontWeight = "700";
        }

        if (element.italic) {
            node.style.fontStyle = "italic";
        }

        if (element.align) {
            node.style.textAlign = element.align;
        }

        if (element.verticalAlign) {
            node.style.display = "flex";
            node.style.alignItems = ({
                top: "flex-start",
                middle: "center",
                bottom: "flex-end"
            })[element.verticalAlign] || "flex-start";
        }

        if (element.letterSpacing != null) {
            node.style.letterSpacing = `${Number(element.letterSpacing)}mm`;
        }

        if (element.wordSpacing != null) {
            node.style.wordSpacing = `${Number(element.wordSpacing)}mm`;
        }

        if (element.lineHeight != null) {
            node.style.lineHeight = String(element.lineHeight);
        }

        if (element.color) {
            node.style.color = element.color;
        }

        if (element.uppercase) {
            node.style.textTransform = "uppercase";
        }

        if (element.maxLength != null) {
            node.textContent = node.textContent.slice(0, Number(element.maxLength));
        }

        if (element.whiteSpace) {
            node.style.whiteSpace = element.whiteSpace;
        }

        if (element.overflow) {
            node.style.overflow = element.overflow;
        }

        if (element.fontWeight != null) {
            node.style.fontWeight = String(element.fontWeight);
        }
    }


    function renderShape(node, element) {
        applyPositionAndSize(node, element);

        node.style.border = element.stroke
            ? `${Number(element.strokeWidth ?? 0.25)}mm solid ${element.stroke}`
            : "none";

        if (element.fill) {
            node.style.backgroundColor = element.fill;
        }

        if (element.radius != null) {
            node.style.borderRadius = `${Number(element.radius)}mm`;
        }

        if (element.type === "line") {
            node.style.height = "0";
            node.style.border = "none";
            node.style.borderTop = `${Number(element.strokeWidth ?? 0.25)}mm solid ${element.stroke || "#000"}`;
        }
    }


    function render(container, config, side, data, showBackground = true) {

        const section = config[side];
        const page = config.page;

        container.replaceChildren();

        container.style.width = `${page.width}mm`;
        container.style.height = `${page.height}mm`;

        container.dataset.width = page.width;
        container.dataset.height = page.height;

        // Background image
        if (showBackground && section.background) {
            const img = document.createElement("img");

            img.className = "cheque-background";
            img.alt = "";
            img.src = section.background;

            container.appendChild(img);
        }

        const elements = section.elements || [];

        const dynamic = section.dynamicRows;

        const elementOverrides = new Map();
        const hiddenIds = new Set();


        // ==========================================
        // DYNAMIC BENEFICIARY ROWS
        // ==========================================

        if (dynamic) {

            const visibleRows = (dynamic.rows || []).filter(row =>
                String(data[row.field] ?? "").trim() !== ""
            );

            const rowCount = visibleRows.length;

            const card = elements.find(
                element => element.id === dynamic.containerId
            );


            // Hide beneficiary card and related elements
            // when no beneficiary details are available
            if (rowCount === 0) {

                hiddenIds.add(dynamic.containerId);

                (dynamic.hideWhenEmpty || []).forEach(id => {
                    hiddenIds.add(id);
                });

            } else {

                // ----------------------------------
                // Position beneficiary rows
                // ----------------------------------

                let currentY = Number(dynamic.startY);
                let dividerPlaced = false;

                visibleRows.forEach(row => {

                    // Position divider immediately ABOVE Account No.
                    if (
                        !dividerPlaced &&
                        row.field === dynamic.dividerBeforeField
                    ) {

                        const divider = elements.find(
                            element => element.id === dynamic.dividerId
                        );

                        if (divider) {
                            elementOverrides.set(dynamic.dividerId, {
                                y: currentY
                                    - Number(dynamic.dividerGapAbove || 2.5)
                                    + 2.8
                            });
                        }

                        currentY += Number(dynamic.dividerGapBelow || 2.5);

                        dividerPlaced = true;
                    }


                    // Label position
                    elementOverrides.set(row.labelId, {
                        y: currentY
                    });


                    // Value position
                    elementOverrides.set(row.valueId, {
                        y: currentY - 0.2
                    });


                    currentY += Number(dynamic.rowGap);
                });


                // ----------------------------------
                // Calculate beneficiary card height
                // ----------------------------------

                if (card) {

                    const lastRow = visibleRows[visibleRows.length - 1];

                    const lastRowY = elementOverrides.get(lastRow.labelId).y;

                    const newHeight =
                        lastRowY
                        + Number(dynamic.rowHeight || 5.5)
                        + Number(dynamic.bottomPadding || 2.8)
                        - Number(card.y || 0);


                    elementOverrides.set(dynamic.containerId, {
                        height: newHeight
                    });


                    // ----------------------------------
                    // Move contact card and its contents
                    // ----------------------------------

                    if (dynamic.contactCardId) {

                        const contactCard = elements.find(
                            element => element.id === dynamic.contactCardId
                        );

                        if (contactCard) {

                            const newContactY =
                                Number(card.y || 0)
                                + newHeight
                                + Number(dynamic.gapAfterCard ?? 2);

                            const shift =
                                newContactY - Number(contactCard.y || 0);


                            // Move border, label and number together
                            [
                                dynamic.contactCardId,
                                "contact-label",
                                "contact-number"
                            ].forEach(id => {

                                const element = elements.find(
                                    item => item.id === id
                                );

                                if (element) {
                                    elementOverrides.set(id, {
                                        y: Number(element.y || 0) + shift
                                    });
                                }

                            });
                        }
                    }
                }
            }
        }


        // ==========================================
        // RENDER ELEMENTS
        // ==========================================

        for (const originalElement of elements) {

            const element = {
                ...originalElement,
                ...(elementOverrides.get(originalElement.id) || {})
            };


            // Skip hidden elements
            if (
                element.visible === false ||
                hiddenIds.has(element.id)
            ) {
                continue;
            }


            // ----------------------------------
            // Conditional visibility
            // ----------------------------------

            if (element.showIf) {

                const actualRaw = data[element.showIf.field];

                if (
                    element.showIf.present === true &&
                    String(actualRaw ?? "").trim() === ""
                ) {
                    continue;
                }

                if (element.showIf.equals != null) {

                    const actual = String(actualRaw ?? "")
                        .trim()
                        .toLowerCase();

                    const expected = String(element.showIf.equals)
                        .trim()
                        .toLowerCase();

                    if (actual !== expected) {
                        continue;
                    }
                }
            }


            // ----------------------------------
            // Create element
            // ----------------------------------

            const node = document.createElement("div");

            node.className = "cheque-element";
            node.dataset.elementId = element.id || "";


            // Shapes and lines
            if (["line", "rectangle"].includes(element.type)) {

                renderShape(node, element);

            }

            // Images
            else if (element.type === "image") {

                applyPositionAndSize(node, element);

                const img = document.createElement("img");

                img.src = element.src || "";
                img.alt = element.alt || "";

                img.style.width = "100%";
                img.style.height = "100%";

                node.appendChild(img);

            }

            // Text elements
            else {

                const value =
                    element.value != null
                        ? element.value
                        : data[element.field];

                node.textContent = value == null ? "" : String(value);

                applyTextStyle(node, element);
            }


            container.appendChild(node);
        }
    }


    return { load, render };

})();
