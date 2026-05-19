export function groupRows(lines) {
    if (lines.length === 0) return [];

    console.log(">>> [SPATIAL] Analyzing visual baselines for robust row grouping...");

    // 1. Sort by Y-coordinate
    const sortedLines = [...lines].sort((a, b) => {
        const yA = a.box[0][1];
        const yB = b.box[0][1];
        return yA - yB;
    });

    const rows = [];
    let currentRow = {
        y: sortedLines[0].box[0][1],
        height: sortedLines[0].box[2][1] - sortedLines[0].box[0][1],
        items: [sortedLines[0]]
    };

    for (let i = 1; i < sortedLines.length; i++) {
        const line = sortedLines[i];
        const lineY = line.box[0][1];
        const lineHeight = line.box[2][1] - line.box[0][1];
        
        // Calculate vertical overlap
        const overlapTop = Math.max(currentRow.y, lineY);
        const overlapBottom = Math.min(currentRow.y + currentRow.height, lineY + lineHeight);
        const overlap = Math.max(0, overlapBottom - overlapTop);
        
        // If overlap > 30% of either height, they belong to the same visual row
        // This handles slight skews better than a fixed point threshold
        if (overlap > Math.min(currentRow.height, lineHeight) * 0.3) {
            currentRow.items.push(line);
            // Expand row bounds to include this line
            currentRow.y = Math.min(currentRow.y, lineY);
            const maxY = Math.max(currentRow.y + currentRow.height, lineY + lineHeight);
            currentRow.height = maxY - currentRow.y;
        } else {
            rows.push(currentRow);
            currentRow = {
                y: lineY,
                height: lineHeight,
                items: [line]
            };
        }
    }
    rows.push(currentRow);

    console.log(`>>> [SPATIAL] Baseline Analysis Complete. Identified ${rows.length} visual rows.`);
    return rows;
}