export function parseTableRows(rows, headerIdx = -1) {
    if (rows.length === 0) return [];

    console.log(">>> [GRID] Reconstructing table grid with anchor alignment...");

    let validAnchors = [];

    // 1. If we have a header index, use header items as PRIMARY anchors
    if (headerIdx !== -1 && rows[headerIdx]) {
        console.log(`>>> [GRID] Using row ${headerIdx} as anchor source (Header-First Mode).`);
        validAnchors = rows[headerIdx].items
            .sort((a, b) => a.box[0][0] - b.box[0][0])
            .map(item => ({
                center: (item.box[0][0] + item.box[1][0]) / 2,
                avgWidth: item.box[1][0] - item.box[0][0],
                text: item.text,
                count: 10 // Higher weight for header anchors
            }));
    } else {
        // Fallback: Global X-position clustering
        const allXPositions = [];
        rows.forEach(row => {
            row.items.forEach(item => {
                const center = (item.box[0][0] + item.box[1][0]) / 2;
                allXPositions.push({ center, width: item.box[1][0] - item.box[0][0] });
            });
        });

        const xSorted = allXPositions.sort((a, b) => a.center - b.center);
        if (xSorted.length > 0) {
            let currentAnchor = { center: xSorted[0].center, count: 1, avgWidth: xSorted[0].width };
            for (let i = 1; i < xSorted.length; i++) {
                if (Math.abs(xSorted[i].center - currentAnchor.center) < 60) { // Increased threshold for stability
                    currentAnchor.center = (currentAnchor.center * currentAnchor.count + xSorted[i].center) / (currentAnchor.count + 1);
                    currentAnchor.avgWidth = (currentAnchor.avgWidth * currentAnchor.count + xSorted[i].width) / (currentAnchor.count + 1);
                    currentAnchor.count++;
                } else {
                    validAnchors.push(currentAnchor);
                    currentAnchor = { center: xSorted[i].center, count: 1, avgWidth: xSorted[i].width };
                }
            }
            validAnchors.push(currentAnchor);
        }
    }

    validAnchors = validAnchors.filter(a => a.count > 0).sort((a, b) => a.center - b.center);
    console.log(`>>> [GRID] Column Mapping: ${validAnchors.length} anchors active.`);

    const parsedRows = [];
    for (const row of rows) {
        const gridRow = new Array(validAnchors.length).fill(null);
        
        for (const item of row.items) {
            const itemCenter = (item.box[0][0] + item.box[1][0]) / 2;
            let bestAnchorIdx = -1;
            let minDistance = Infinity;
            
            validAnchors.forEach((anchor, idx) => {
                const dist = Math.abs(anchor.center - itemCenter);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestAnchorIdx = idx;
                }
            });

            // Match if within reasonable distance (1.5x anchor width)
            if (bestAnchorIdx !== -1 && minDistance < validAnchors[bestAnchorIdx].avgWidth * 1.5) {
                if (gridRow[bestAnchorIdx]) {
                    gridRow[bestAnchorIdx].text += " " + item.text;
                } else {
                    gridRow[bestAnchorIdx] = { text: item.text, x: item.box[0][0], y: item.box[0][1] };
                }
            }
        }

        parsedRows.push(gridRow.map((cell, idx) => cell || { text: "", x: validAnchors[idx].center, y: row.y }));
    }

    return parsedRows;
}