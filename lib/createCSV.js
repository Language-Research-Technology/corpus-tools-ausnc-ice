const fs = require('fs');
const path = require('path');


/**
 * Converts tab-separated text to CSV format.
 * @param {string} inputText - The plain text to convert.
 * @returns {string} - The CSV string.
 */
function toCSV(prefix, inputText) {
    let csv = `speaker,text\n${inputText.replace(/\r/g, '')}`;
    csv = csv.replace(/<&>.*<\/&>/g, '');
    csv = csv.replace(/\n\n+/g,'');
    csv = csv.replace(/<\$([A-Y])>/gm, `"${prefix}$1",`);
    csv = csv.replace(/<[^(@|O)]*?>/gm, '');
    csv = csv.replace(/\n([^"].+)/g, ' $1');
    csv = csv.replace(/",\s(.+)$/gm, '","$1"'); 
    csv = csv.replace(/^\s+/gm, '');
    // console.log('CSV output:', csv);
    // const outputPath = path.join(__dirname, '../output.csv');
    // require('fs').writeFileSync(outputPath, csv, 'utf8');
    return csv;
}

module.exports = { toCSV };