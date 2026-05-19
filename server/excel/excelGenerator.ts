import XLSX from "xlsx";

export function generateExcel(data: any[]) {

    const worksheet =
        XLSX.utils.json_to_sheet(data);

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Results"
    );

    XLSX.writeFile(
        workbook,
        "output.xlsx"
    );

    console.log(
        "Excel file generated"
    );
}