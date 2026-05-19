export function cleanText(text) {

    return text
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
}