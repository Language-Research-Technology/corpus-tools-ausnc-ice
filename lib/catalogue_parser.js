const ExcelJS = require('exceljs');

// Ensure that value is treated as String instead of Number
const options = { map: String };

const defaultcolumns = {
  textcode: 1,
  title: 2,
  subtitle: 2,
  date: 3,
  wordcount: 4,
  author: 5
}

function parser(workbook) {
  let sheets = workbook.worksheets.slice(0, 8).map(processSheet)
  return sheets.map(([sheetname, chunks]) => {
    let results = []
    for (let chunk of chunks) {
      // junk data at the end of W2A
      if (chunk[0][1] === "W2A-spa") continue;

      let result;
      if (sheetname === "W1a") {
        result = w1a(chunk)
      }
      if (sheetname === "W1b") {
        result = w1b(chunk)
      }
      if (sheetname === "W2A ") {
        result = w2a(chunk)
      }
      if (sheetname === "w2b") {
        result = w2b(chunk)
      }
      if (sheetname === "w2c") {
        result = w2c(chunk)
      }
      if (sheetname === "w2d") {
        result = w2d(chunk)
      }
      if (sheetname === "w2e") {
        result = w2e(chunk)
      }
      if (sheetname === "w2f") {
        result = w2f(chunk)
      }
      results.push(result)
    }
    return results;
  })
}

function processSheet(sheet) {
  const chunks = []
  // catches the first chunk even though there is no blank line before it
  let blanksCount = 2

  sheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
    if (rowNumber === 1) {
      return
    }
    const isEmpty = Array.isArray(row.values) && row.values.length < 1
    if (isEmpty) {
      blanksCount++
    } else {
      if (blanksCount > 1) {
        blanksCount = 0
        chunks.push([])
      }
      chunks[chunks.length - 1].push(row.values)
    }
  });
  return [sheet.name, chunks]
}

function w1a(chunk) {
  let result = w1b(chunk)
  // W1A doesn't have dates
  assert(chunk[0][3] === undefined)
  delete result.date
  return result
}

function w1b(chunk, col = defaultcolumns) {
  assert(chunk[0][1] === undefined)

  const title = chunk[0][col.title]
  // TODO: date parsing
  const date = []
  const wordcount = chunk[0][col.wordcount] ? [chunk[0][col.wordcount]] : []
  const subtitles = new Set()
  const authors = new Set()

  if (chunk[0][col.date]) date.push(chunk[0][col.date])

  let textcodes = []
  for (let row of chunk.slice(1)) {
    if (row[col.textcode]) textcodes.push(row[col.textcode]);
    subtitles.add(row[col.subtitle])
    if (row[col.date]) date.push(row[col.date]);
    if (row[col.wordcount]) wordcount.push(row[col.wordcount]);
    if (row[col.author]) authors.add(row[col.author]);
  }

  // trim off subtext letter (w1a-001b -> W1A-001) and deduplicate the list
  textcodes = [...new Set(textcodes.map(s => s.replace(/(\w\d\w-\d\d\d)\w/i, "$1").toUpperCase()))]
  assert(textcodes.length === 1)
  assert(wordcount.length < 2)

  return {
    textcode: textcodes[0],
    title,
    authors: [...authors],
    wordcount: wordcount[0],
    subtitles: [...subtitles],
    date,
  }
}

function w2a(chunk, numberOfCreditLines = 1) {
  let result = w1b(chunk.slice(0, chunk.length - numberOfCreditLines))

  result.credit = []
  for (let line of chunk.slice(chunk.length - numberOfCreditLines)) {

    assert(line[1] === undefined)
    assert(line[3] === undefined)
    assert(line[4] === undefined)
    result.credit.push(line[2])
  }

  return result
}

let w2b = w2a;

function w2c(chunk) {
  let result;
  // Some chunks in W2C have two credit lines
  if (chunk[chunk.length - 2][1] === undefined && chunk[chunk.length - 1][1] === undefined) {
    result = w2a(chunk, 2)
  } else {
    result = w2a(chunk, 1)
  }
  return result
}

function w2d(chunk, col = defaultcolumns) {
  let result;
  if (chunk[0][col.textcode] === undefined) {
    result = w1b(chunk, col)
  } else {
    assert(chunk[1][col.textcode] === undefined)
    assert(chunk[1][col.date] === undefined)
    assert(chunk[1][col.wordcount] === undefined)
    credit = chunk[1][col.title]
    result = {
      textcode: chunk[0][col.textcode],
      title: chunk[0][col.title],
      date: chunk[0][col.date],
      wordcount: chunk[0][col.wordcount],
      credit,
    }
  }
  return result
}
let w2e = (chunk) => w1b(chunk, {
  textcode: 1,
  title: 10,
  subtitle: 10,
  date: 223,
  wordcount: 224,
  author: 225 // no author col but 225 is blank
});
let w2f = (chunk) => w2d(chunk, {
  textcode: 1,
  title: 9,
  subtitle: 9,
  date: 77,
  wordcount: 78,
  author: 79 // no author col but 225 is blank
});

function assert(predicate, message) {
  if (predicate !== true) {
    throw new Error(message || "assertion failed")
  }
}

module.exports = parser;