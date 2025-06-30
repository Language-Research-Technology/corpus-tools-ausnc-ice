const assert = require('assert');
const fs = require('fs');
const path = require('path');
const toCSV = require('../lib/createCSV.js').toCSV;

describe('toCSV', () => {

    it('should convert test_data/S1A-001.TXT to match test_data/S1A-001.csv', () => {
        const prefix = "arcp://name,ice/speaker/S1A-001#";
        const txtPath = path.join(__dirname, '../test_data/S1A-001.TXT');
        const csvPath = path.join(__dirname, '../test_data/S1A-001.csv');
        const inputText = fs.readFileSync(txtPath, 'utf8');
        const expectedCSV = fs.readFileSync(csvPath, 'utf8').trim();

        const outputCSV = toCSV(prefix, inputText);

        assert.strictEqual(
            outputCSV,
            expectedCSV
        );
    });
});