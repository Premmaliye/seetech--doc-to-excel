export function findNearestValue(
    text,
    keyword,
    maxDistance = 3
) {

    const words =
        text.split(/\s+/);

    const keywordIndex =
        words.findIndex(
            word =>
                word.includes(keyword)
        );

    if (keywordIndex === -1) {

        return null;
    }

    // SEARCH NEARBY WORDS
    for (
        let i = keywordIndex + 1;
        i <= keywordIndex + maxDistance &&
        i < words.length;
        i++
    ) {

        const value =
            words[i];

        // NUMBER CHECK
        if (
            /^[0-9.]+$/.test(value)
        ) {

            return value;
        }
    }

    return null;
}