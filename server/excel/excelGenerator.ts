import ExcelJS from "exceljs";

export async function generateExcel(data: any[]) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Results");

    if (data.length === 0) {
        await workbook.xlsx.writeFile("output.xlsx");
        console.log("Excel file generated (empty)");
        return;
    }

    const headers = Object.keys(data[0]);
    ws.addRow(headers);

    for (const row of data) {
        const rowArr = headers.map(h => (row[h] !== undefined && row[h] !== null) ? row[h] : "");
        ws.addRow(rowArr);
    }

    ws.columns.forEach(col => { col.width = 20; });

    await workbook.xlsx.writeFile("output.xlsx");
    console.log("Excel file generated");
}