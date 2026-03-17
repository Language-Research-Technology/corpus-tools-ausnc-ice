const ExcelJS = require('exceljs'); 


function parser(workbooks) {
  let results = [[], [], [], []]

  // S1A

  assert(workbooks[0].worksheets[0].name, "001-090", "first sheet of demographic_info_ice-aus_s1a.xlsx")
  assert(workbooks[0].worksheets[1].name, "091-100", "second sheet of demographic_info_ice-aus_s1a.xlsx")
  
  results[0] = results[0].concat(results[0], parseWorksheet(workbooks[0].worksheets[0], [
      "textcode", "category", "wordcount", "free comments", "source type", "date of recording",
      "place of recording", "communicative situation", "subject", "no of speakers", "relationship"
    ],
    [
      "age a", "gender a", "education a", "occupation a", "age b", "gender b", "education b", "occupation b",
      "age c", "gender c", "education c", "occupation c", "age d", "gender d", "education d", "occupation d",
      "age e", "gender e", "education e", "occupation e", "age f", "gender f", "education f", "occupation f"
    ]
  ))
  results[0] = results[0].concat(results[0], parseWorksheet(workbooks[0].worksheets[1], [
      "textcode", "category", "wordcount", "free comments", "source type", "date of recording",
      "place of recording", "subject", "communicative situation", "no of speakers", "relationship",
    ],
    [
      "age a", "gender a", "education a", "occupation a", "age b", "gender b", "education b",
      "occupation b", "age c", "gender c", "education c", "occupation c"
    ]
  ))

  // S1B
  
  assert(workbooks[1].worksheets[0].name, "class lessons", "first sheet of demographic_info_ice-aus_s1b.xlsx")
  assert(workbooks[1].worksheets[1].name, "broadcast discussions", "second sheet of demographic_info_ice-aus_s1b.xlsx")
  assert(workbooks[1].worksheets[2].name, "broadcast interviews", "third sheet of demographic_info_ice-aus_s1b.xlsx")
  assert(workbooks[1].worksheets[3].name, "parliamentary debate", "fourth sheet of demographic_info_ice-aus_s1b.xlsx")
  assert(workbooks[1].worksheets[4].name, "legal cross-examinations", "fifth sheet of demographic_info_ice-aus_s1b.xlsx")

  results[1] = results[1].concat(results[1], parseWorksheet(workbooks[1].worksheets[0], [
    "textcode","no of subtexts","category","wordcount","version","free comments","source type",
    "date of recording","place of recording","organising body","subject","main title",
    "communicative situation","no of participants","no of speakers","relationship"
  ], [
    "age a","gender a","education a","occupation a","age b","gender b","education b","occupation b",
    "age c","gender c","education c","occupation c","age d","gender d","education d","occupation d",
    "age e","gender e","education e","occupation e","age f","gender f","education f","occupation f",
    "age g","gender g","education g","occupation g","age h","gender h","education h","occupation h",
    "age i","gender i","education i","occupation i","age j","gender j","education j","occupation j",
    "age k","gender k","education k"
  ]))
  results[1] = results[1].concat(results[1], parseWorksheet(workbooks[1].worksheets[1], [
    "textcode","no of subtexts","category","wordcount","version","free comments","subject",
    "place of recording","date of recording","program","channel","recorder","mode","number of speakers"
  ],
  ["age a","gender a","education a","surname a","forename a","occupation a","age b","gender b","education b",
    "surname b","forename b","occupation b","age c","gender c","education c","surname c","forename c",
    "occupation c","age d","gender d","education d","surname d","forename d","occupation d","age e","gender e",
    "education  e","surname e","forename e","occupation e","age f","gender f","education  f","surname f",
    "forename f","occupation f"
  ]))
  results[1] = results[1].concat(results[1], parseWorksheet(workbooks[1].worksheets[2], [
    "textcode","no of subtexts","category","wordcount","free comments","subject","place of recording",
    "date of recording","program","channel","recorder","relationship","mode","number of speakers",
    "number of participants","subtext number","subtext name","number of subtexts","ignore__textcode"
  ], [
    "age a","gender a","education a","occupation a","age b","gender b","education b","occupation b"
  ]))
  results[1] = results[1].concat(results[1], parseWorksheet(workbooks[1].worksheets[3], [
    "textcode","category","wordcount","free comments","date of recording","place of recording","channel",
    "address","tv/radio","source title","subject","no of speakers","comments",
  ], [
    "age a","gender a","nationality a","birthplace a","education a","occupation a","mother tongue a",
    "other languages a","age b","gender b","nationality b","birthplace b","education b","occupation b",
    "mother tongue b","other languages b","age c","gender c","nationality c","birthplace c","education c",
    "occupation c","mother tongue c","other languages c","age d","gender d","nationality d","birthplace d",
    "education d","occupation d","mother tongue d","other languages d","age e","gender e","nationality e",
    "birthplace e","education e","occupation e","mother tongue e","other languages e","age f","gender f",
    "nationality f","birthplace f","education f","occupation f","mother tongue f","other languages f",
    "age g","gender g","nationality g","birthplace g","education g","occupation g","mother tongue g",
    "other languages g","age h","gender h","nationality h","birthplace h","education h",
    "occupation h","mother tongue h","other languages h"
  ]))
  results[1] = results[1].concat(results[1], parseWorksheet(workbooks[1].worksheets[4], [
    "textcode","no of subtexts","category","wordcount","free comments","date of recording","place of recording",
    "organising body","subject","title","communicative situation","no of speakers","relationship","audience ",
    "audience size"
  ], [
    "age a","gender a","nationality a","birthplace a","education a","occupation a","mother tongue a",
    "other languages a","age b","gender b","nationality b","birthplace b","education b","occupation b",
    "mother tongue b","other languages b","surname c","forename c","age c","gender c","nationality c",
    "birthplace c","education c","occupation c","mother tongue c","other languages c"
  ]))
  results[1] = results[1].concat(results[1], parseWorksheet(workbooks[1].worksheets[5], [
    "textcode","no of subtexts","category","wordcount","free comments","date of recording","place of recording",
    "organising body","subject","no of speakers","relationship "
  ], [
    "age a","gender a","nationality a","birthplace a","education a","occupation a","mother tongue a",
    "other languages a","age b","gender b","nationality b","birthplace b","education b","occupation b",
    "mother tongue b","other languages b","age c","gender c","nationality c","birthplace c","education c",
    "occupation c","mother tongue c","other languages c","age d","gender d","nationality d","birthplace d",
    "education d","occupation d","mother tongue d","other languages d","age e","gender e","nationality e",
    "birthplace e","education e","occupation e","mother tongue e","other languages e","age f","gender f",
    "nationality f","birthplace f","education f","occupation f","mother tongue f","other languages f","age g",
    "gender g","nationality g","birthplace g","education g","occupation g","mother tongue g","other languages g",
    "age h","gender h","nationality h","birthplace h","education h","occupation h","mother tongue h","other languages h"
  ]))
  
  // S2A
  
  assert(workbooks[2].worksheets[0].name, "spontaneous commentaries", "first sheet of demographic_info_ice-aus_s2a.xlsx")
  assert(workbooks[2].worksheets[1].name, "unscripted speeches", "second sheet of demographic_info_ice-aus_s2a.xlsx")
  assert(workbooks[2].worksheets[2].name, "demonstrations", "third sheet of demographic_info_ice-aus_s2a.xlsx")
  assert(workbooks[2].worksheets[3].name, "legal presentations", "fourth sheet of demographic_info_ice-aus_s2a.xlsx")

  results[2] = results[2].concat(results[2], parseWorksheet(workbooks[2].worksheets[0], [
    "textcode","category","word count","free comments","source type","channel","tv/radio","source title",
    "date of recording","place of recording","subject","no of speakers","relationship","audience",
    "audience size"
    ], [
      "age a","gender a","education a","occupation a","age b","gender b","education b","occupation b",
  ]))
  results[2] = results[2].concat(results[2], parseWorksheet(workbooks[2].worksheets[1], [
    "textcode","category","wordcount","source type","date of recording","place of recording","free comments",
    "audience","audience size","subject","number of speakers"
    ], [
      "age a","gender a","education a","occupation a",
  ]))
  results[2] = results[2].concat(results[2], parseWorksheet(workbooks[2].worksheets[2], [
    "ignore__subtext source","category","wordcount","version","free comments","source type","channel","address",
    "tv/radio","source title","date of recording","place of recording","organising body","subject",
    "no of speakers","relationship"
  ], [
    "age a","gender a","education a","occupation a","surname a","forename a","age b","gemder b","education b","occupation b","surname b","forename b",
  ], (sheet) => (sheet.columns[0].values[rowidx])))
  results[2] = results[2].concat(results[2], parseWorksheet(workbooks[2].worksheets[3], [
    "textcode","category","wordcount","version","free comments","source type","date of recording"
    ,"place of recording","subject","number of speakers"
  ], [
    "age a","gender a","education a","occupation a",
  ]))
  

  // S2B

  assert(workbooks[3].worksheets[0].name, "news", "first sheet of demographic_info_ice-aus_s2b.xlsx")
  assert(workbooks[3].worksheets[1].name, "broadcast talks", "second sheet of demographic_info_ice-aus_s2b.xlsx")
  assert(workbooks[3].worksheets[2].name, "speeches (non broadcast)", "third sheet of demographic_info_ice-aus_s2b.xlsx")

  results[3] = results[3].concat(results[3], parseWorksheet(workbooks[3].worksheets[0], [
    "textcode","no of subtexts","category","wordcount","free comments","source type",
    "channel","address","tv/radio","source title","date of recording","place of recording",
    "number of speakers",
    // entirely blank
    "ignore__subject","ignore__subtext no","ignore__title","ignore__communicative situation",
    "ignore__no of speakers","ignore__relationship","ignore__audience","ignore__audience size",
    "ignore__speaker id","ignore__speaker id"
  ]))
  results[3] = results[3].concat(results[3], parseWorksheet(workbooks[3].worksheets[1], [
    "textcode","no of subtexts","category","wordcount","free comments","source type","channel",
    "address","tv/radio","source title","date of recording","place of recording","consent",
    "subject","subtext number","title","communicative situation","no of speakers","relationship",
    "audience","audience size"
  ], [
    "surname a","forename a","age a","gender a","education a","occupation a","surname b","forename b",
    "age b","gender b","education b","occupation b"
  ]))
  results[3] = results[3].concat(results[3], parseWorksheet(workbooks[3].worksheets[2], [
    "textcode","no of subtexts","category","wordcount","free comments","source type","date of recording",
    "place of recording","organising body","consent","subject","subtext no","title",
    "communicative situation","no of speakers","relationship","audience","audience size"
  ], [
    "age a","gender a","nationality a","birthplace a","education a","occupation a",
    "mother tongue a", "other languages a"
  ]))

  return results
}

function parseWorksheet(sheet, columns, speaker_cols, gen_text_id = (sheet) => (sheet.columns[columns.indexOf("textcode")].values[rowidx])) {
  let results = []
  let colmapping = {}

  let textcode;
  for (let colidx in columns) {
    let colname = columns[colidx]
    if (colname.startsWith("ignore__")) {
      break
    }
    if (cleanHeader(sheet.columns[colidx].values[1]) !== colname) {
      assert(cleanHeader(sheet.columns[colidx].values[1]), colname, `sheet ${sheet.name} column ${colidx} name`)
    }
    colmapping[colname] = colidx
  }

  for (let rowidx = 2; rowidx < sheet.rowCount; rowidx++) {
    if (!sheet.getRow(rowidx).values.find(x => x)) {
      // skip entirely blank rows
      break
    }

    let result = {
      "ldac:speaker": []
    }

    let textcode = cleanHeader(sheet.columns[0].values[rowidx]).toUpperCase()
    if (!textcode.match(/^S/)) {
      throw new Error("This part of the code expects only spoken items")
    }

    for (let colidx of Array(sheet.columnCount).keys()) {
      let colname = columns[colidx]
      if (colname && colname.startsWith("ignore__")) {
        break
      } else if (colname && sheet.columns[colidx].values[rowidx]) {
        result[colname] = sheet.columns[colidx].values[rowidx]
      } else if (speaker_cols && cleanHeader(sheet.columns[colidx].values[1]).match(/ [a-z]$/)) {
        let colname = cleanHeader(sheet.columns[colidx].values[1]).replace(/ [a-z]$/, "")
        let [speaker_letter] = cleanHeader(sheet.columns[colidx].values[1]).match(/[a-z]$/)
        colname = cleanHeader(colname)
        // TODO: prepend text uri

        let speakerId = `${textcode}#${speaker_letter.toUpperCase()}`
        let existingSpeakerIndex = result["ldac:speaker"].findIndex(s => s["@id"] === speakerId)
        if (existingSpeakerIndex < 0) {
          result["ldac:speaker"].push({
            "@id": speakerId,
            "@type": "Person",
            "role": "speaker"
          })
          existingSpeakerIndex = result["ldac:speaker"].length-1
        }

        if (colname === "age" ||
            colname === "education" ||
            colname === "occupation" ||
            colname === "surname" ||
            colname === "forename" ||
            colname === "nationality") {
          result["ldac:speaker"][existingSpeakerIndex][colname] = sheet.columns[colidx].values[rowidx];
        }

        if (colname === "mother tongue") {
          result["ldac:speaker"][existingSpeakerIndex]["motherTongue"] = sheet.columns[colidx].values[rowidx];
        }
        if (colname === "birthplace") {
          result["ldac:speaker"][existingSpeakerIndex]["birthPlace"] = sheet.columns[colidx].values[rowidx];
        }
        if (colname === "mother tongue") {
          result["ldac:speaker"][existingSpeakerIndex]["motherTongue"] = sheet.columns[colidx].values[rowidx];
        }

        // result["ldac:speaker"] = speakers
        if (colname === "gender") {
          switch (sheet.columns[colidx].values[rowidx]) {
            case "F":
              result["ldac:speaker"][existingSpeakerIndex][colname] = "female"
              break
            case "M":
              result["ldac:speaker"][existingSpeakerIndex][colname] = "male"
              break
            case undefined:
            case "?": // only S1B-015
              // noop
              break
            default:
              throw new Error(`Unrecognised gender value: ${sheet.columns[colidx].values[rowidx]}`)
          }
        }
      }
    }

    result["ldac:speaker"] = result["ldac:speaker"].filter(speaker => {
      // TODO: I think this is bugged, all speakers have a `role` so probably none are filtered
      // should use `no of speakers` instead
      // Remove speakers with no metadata
      return Object.entries(speaker).some(([k, v]) => !k.startsWith("@") && v)
    })
  
    rename(result, "no of speakers", "number of speakers")
    rename(result, "no of participants", "number of participants")
    rename(result, "audience ", "audience")

    // TODO: parse dates
    results.push({
      ...result,
      textcode,
    })
  }


  return results
}


function rename(obj, old_name, new_name) {
  if (old_name in obj) {
    obj[new_name] = obj[old_name]
    delete obj[old_name]
  }
}

function cleanHeader(headerName, index) {
  if (!headerName) {
    return String(index)
  }
  return headerName.toLowerCase().replace("'", "")
}

function assert(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(
      `expected ${description} to be '${expected}' (got '${actual}')`
    )
  }
}

module.exports = parser;
