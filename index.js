const { Collector, generateArcpId, Provenance } = require('oni-ocfl');
const { languageProfileURI, Languages, Vocab } = require('language-data-commons-vocabs');
const fs = require('fs-extra');
const { cloneDeep } = require('lodash');
const path = require('path');
const { DataPack } = require('@ldac/data-packs');
const shell = require("shelljs");
const PRONOM_URI_BASE = 'https://www.nationalarchives.gov.uk/PRONOM/';
const { toCSV } = require('./lib/createCSV.js');
const { makePlainText } = require('./lib/makePlainText.js');
const { Console } = require('console');
const ExcelJS = require('exceljs');
const roCrateExcel = require('ro-crate-excel');
const catalogueParser = require('./lib/catalogue_parser.js')
const demographicInfoParser = require('./lib/demographic_info_parser.js')

let tempDir = fs.mkdtempDisposableSync("storage/temp/ldaca-ice")

// Ensure that value is treated as String instead of Number
const options = {
  map(value) { return String(value) }
 };

const licenses = fs.readJSONSync('licenses.json');
let vocab;
let engLang;
let siegfriedData = {}
let files = []
// TODO: siegfried is broken

async function main() {

  // Bring in the OLAC-derived terms
  vocab = new Vocab;

  await vocab.load();
  const languages = new Languages();
  await languages.fetch();
  let datapack = new DataPack({ dataPacks: ['Glottolog'], indexFields: ['name'] });

  await datapack.load();
  engLang = datapack.get({
    field: "name",
    value: "English",
  });

  //const audioFiles = new Files(path.join(dataDir, "Sound\ files"), 2);
  const collector = await Collector.create();

  // await collector.connect(); // Make or find the OCFL repo
  const data = await fs.readJSON("ICE.json");

  
  const allFiles = fs.readdirSync(collector.dataDir, { recursive: true })
  
  // Get a new crate
  
  // This is the main crate - TODO: actually have some data in the template collector.templateCrateDir and add it below.
  const corpus = collector.newObject();

  const metadataTemplate = new roCrateExcel.Workbook();
  await metadataTemplate.loadExcel(collector.templateCrateDir + '/ro-crate-metadata-ausnc-ice.xlsx', false);
  corpus.crate = metadataTemplate.crate

  const corpusCrate = corpus.crate;
  crate.addContext({ldac: "https://w3id.org/ldac/terms#"})
  const corpusRoot = corpus.crate.root;

  corpus.mintArcpId();
  corpusCrate.addProfile(languageProfileURI('Collection'));

  corpusRoot['@type'] = ['Dataset', 'RepositoryCollection'];

  const metadataDescriptor = corpusCrate.getItem('ro-crate-metadata.json');
  metadataDescriptor.license = licenses.metadata_license;

  corpus.importFile(path.join(collector.dataDir, "manuals/tagging-manual.pdf"), "manuals/tagging-manual.pdf", {
    "@id": "manuals/tagging-manual.pdf",
    "@type": ["File"],
    "name": "The ICE Tagging Manual",
    "author": "Gerald Nelson",
    "datePublished": "2005"
  })
  corpus.importFile(path.join(collector.dataDir, "manuals/markup-manual-spoken.pdf"), "manuals/markup-manual-spoken.pdf", {
    "@id": "manuals/markup-manual-spoken.pdf",
    "@type": ["File"],
    "name": "Markup Manual for Spoken Texts",
    "author": "Gerald Nelson",
    "datePublished": "2002"
  })
  corpus.importFile(path.join(collector.dataDir, "manuals/markup-manual-written.pdf"), "manuals/markup-manual-written.pdf", {
    "@id": "manuals/markup-manual-written.pdf",
    "@type": ["File"],
    "name": "Markup Manual for Written Texts",
    "author": "Gerald Nelson",
    "datePublished": "2002"
  })

  if (fs.existsSync(path.join(process.cwd(), "siegfriedOutput.json"))) {
    console.log("Reading SF Data");
    siegfriedData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "siegfriedOutput.json")));
  }
  let siegfriedDataRaw = cloneDeep(siegfriedData);

  let children = [];
  
  const catalogue = new ExcelJS.Workbook();
  await catalogue.xlsx.readFile(path.join(collector.dataDir, 'metadata', 'ICE-catalogue.xlsx'), {
    map(value) { return String(value) }
  })

  let written = catalogueParser(catalogue);

  for (let [i, id] of ["W1A","W1B","W2A","W2B","W2C","W2D","W2E","W2F"].entries()) {
    let subcorpusId = generateArcpId(collector.namespace, id)
    let subcorpusObj = corpusCrate.getItem(subcorpusId)
    corpusCrate.addValues(corpusRoot, 'pcdm:hasMember', subcorpusObj)

    for (let item of written[i]) {
      let repositoryObj = {
        "@id": generateArcpId(collector.namespace, "Document", item.textcode),
        "@type": "RepositoryObject",
        "license": licenses.data_license,
        "hasPart": [],
        inLanguage: engLang,
        "ldac:communicationMode": vocab.getVocabItem("WrittenLanguage"),
        conformsTo: { "@id": languageProfileURI("Object") }
      }
      repositoryObj.name = item.textcode
      if (item.title) repositoryObj.name = `${repositoryObj.name} - ${item.title}`;
      if (item.subtitle) repositoryObj.subtitle = item.subtitle;

      if (item.date) {
        try {
          item.date.map((date) => typeof(item.date) === "string" ? date : date.toISOString())
          repositoryObj.date = item.date.map(tryParseDate);
        } catch {
          repositoryObj.date = String(item.date);
        }
      }
      if (item.wordcount) repositoryObj.wordcount = item.wordcount;
      if (item.author) repositoryObj.author = item.author;
      if (item.textcode === "W2C") repositoryObj['ldac:linguisticGenre'] = vocab.getVocabItem("Report");
  
      let filename = path.join("ICE Written", item.textcode.slice(0, 3), `${item.textcode}.TXT`)
      if (!fs.existsSync(path.join(collector.dataDir, filename))) {
        throw new Error(`Missing file ${filename}`)
      }
      let objFile = {
        "@id": filename,
        "name": filename.replace(/.+\/.+\/(.+\..+)$/, "$1"),
        "@type": ["File"],
        "license": licenses.data_license,
      }
  
      repositoryObj.hasPart.push(objFile)
      corpus.importFile(path.join(collector.dataDir, filename), filename, objFile)

      // TODO: refactor this to just call plainTextCopy
      let baseFilename = filename
      let basedOn = objFile
      {
        let [filename, plainText] = plainTextCopy(collector, baseFilename, item.textcode)

        if (plainText) {
          repositoryObj.hasPart.push(plainText)
          corpus.importFile(filename, plainText['@id'], plainText)
        } else {
          console.log(`skipping ${filename}`)
        }
      }

      corpusCrate.addValues(subcorpusObj, 'pcdm:hasMember', repositoryObj);
    }
  }

  let spoken = demographicInfoParser(
    await Promise.all(
      [
        "demographic_info_ice-aus_s1a.xlsx",
        "demographic_info_ice-aus_s1b.xlsx",
        "demographic_info_ice-aus_s2a.xlsx",
        "demographic_info_ice-aus_s2b.xlsx",
      ].map(async (filepath) => {
        let workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(collector.dataDir, "metadata", filepath), options)
        return workbook
      })
    ),
    vocab
  )
  for (let [i, id] of ["S1A","S1B","S2A","S2B"].entries()) {
    let subcorpusId = generateArcpId(collector.namespace, id)
    let subcorpusObj = corpusCrate.getItem(subcorpusId)
    corpusCrate.addValues(corpusRoot, 'pcdm:hasMember', subcorpusObj)

    for (let [index, item] of spoken[i].entries()) {
      let repositoryObj = {
        "@id": generateArcpId(collector.namespace, "Document", item.textcode),
        "@type": "RepositoryObject",
        "license": licenses.data_license,
        "hasPart": [],
        inLanguage: engLang,
        conformsTo: { "@id": languageProfileURI("Object") },
        "ldac:communicationMode": vocab.getVocabItem("SpokenLanguage"),
      }

      if (item.subject) repositoryObj.description = item.subject;
      if (item.relationship) repositoryObj.relationship = item.relationship;
      if (item["place of recording"])
        repositoryObj.location = item["place of recording"];
      if (item["ldac:speaker"])
        repositoryObj["ldac:speaker"] = item["ldac:speaker"].map(speaker => (
          {...speaker, "@id": generateArcpId(collector.namespace, "speaker", speaker["@id"])}
        ));

      if (item["number of speakers"]) {
        repositoryObj["ldac:speaker"] = repositoryObj["ldac:speaker"].slice(0, item["number of speakers"])
      } else {
        delete repositoryObj["ldac:speaker"]
      }
      if (item.date) {
        try {
          repositoryObj.date = item.date.map(tryParseDate);
        } catch {
          let dates = item.date.flatMap(v => {
            return v.split(" & ")
          })
          repositoryObj.date = dates.map(tryParseDate);
        }
      }
      if (item.subject) repositoryObj.description = item.subject;
      if (item.audience) repositoryObj.audience = item.audience;
      if (item["audience size"]) repositoryObj.audienceSize = item.audienceSize;
      if (item["organising body"]) repositoryObj.organisingBody = item["organising body"];
      if (item["number of speakers"]) repositoryObj.numberOfParticipants = item["number of participants"];

      
      if (item.wordcount) {
        if (typeof(item.wordcount) === "string") {
          repositoryObj.wordcount = Number(item.wordcount.replace(/ words/, ""));
        } else if (typeof(item.wordcount) === "number") {
          repositoryObj.wordcount = item.wordcount
        }
      }

      // if (item.title) repositoryObj.title = item.title;
      if (item["communicative situation"]) {
        repositoryObj["name"] = `${item.textcode} : ${
          item["communicative situation"].charAt(0).toUpperCase()
        }${item["communicative situation"].slice(1)}`
        if (item["description"]) repositoryObj["name"] += ` - ${item["description"]}`
      } else {
        repositoryObj["name"] = item.textcode
      }

      switch (item.textcode.slice(0, 3)) {
        case "S1A":
        case "S1B":
        case "S2A":
          repositoryObj['ldac:linguisticGenre'] = vocab.getVocabItem("Dialogue");
          break
        case "S2B":
          repositoryObj['ldac:linguisticGenre'] = vocab.getVocabItem("Oratory");
          break
        default:
          throw new Error(`Unrecognised textcode prefix: ${item.textcode}`)
      }

      let filename = path.join("ICE Spoken", item.textcode.slice(0, 3), `${item.textcode.slice(0, 7)}.TXT`)

      if (!fs.existsSync(path.join(collector.dataDir, filename))) {
        throw new Error(`Missing file ${filename}`)
      }
      let objFile = {
        "@id": filename,
        "name": filename.replace(/.+\/.+\/(.+\..+)$/, "$1"),
        "@type": ["File"],
        "license": licenses.data_license,
      }
      
      repositoryObj.hasPart.push(objFile)
      corpus.importFile(path.join(collector.dataDir, filename), filename, objFile)

      let baseFilename = filename
      {
        // let id = path.join("derived", "spoken", item.textcode.slice(0, 3), `${item.textcode}-plain.txt`)
        let [filename, plainText] = plainTextCopy(collector, baseFilename, item.textcode)

        if (plainText) {
          repositoryObj.hasPart.push(plainText)
          files.push([filename, plainText['@id']])
        } else {
          console.log(`skipping ${filename}`)
        }
      }

      corpusCrate.addValues(subcorpusObj, 'pcdm:hasMember', repositoryObj);
    }
  }

  for (let spreadsheet of [
    "metadata/demographic_info_ice-aus_s1a.xls",
    "metadata/demographic_info_ice-aus_s1b.xls",
    "metadata/demographic_info_ice-aus_s2a.xls",
    "metadata/demographic_info_ice-aus_s2b.xls",
    "metadata/ICE-catalogue.xls",
    "metadata/demographic_info_ice-aus_s1a.xlsx",
    "metadata/demographic_info_ice-aus_s1b.xlsx",
    "metadata/demographic_info_ice-aus_s2a.xlsx",
    "metadata/demographic_info_ice-aus_s2b.xlsx",
    "metadata/ICE-catalogue.xlsx"
  ]) {
    files.push([path.join(collector.dataDir, spreadsheet), spreadsheet])
  }

  await corpus.addToRepo(true, files);
}

function createSubcorpus(collector, corpus, code, lang, authorObj, publisherObj, license, data) {
  const subcorpora = fs.readJSONSync('subCorpus.json');

  const subcorpusName = `ICE: ${code}: ${subcorpora[code]}`;
  const subcorpusId = generateArcpId(collector.namespace, code)
  const subcorpusObj = {
    "@id": subcorpusId,
    "@type": ['Dataset', 'RepositoryCollection'],
    "name": subcorpusName,
    "description": `${subcorpora[code]} from the International Corpus of English (Aus)`,
    "inLanguage": lang,
    "pcdm:memberOf": [{ "@id": corpus.id }],
    "conformsTo": { "@id": languageProfileURI("Collection") },
    "creator": authorObj,
    "ldac:compiler": authorObj,
    "license": license,
    "publisher": publisherObj,
    "datePublished": data.created.replace(/.*(\d{4}).$/g, '$1'),
    "temporal": data.created.replace(/.*?(\d{4}).+?(\d{4}).$/g, '$1/$2'),
    "pcdm:hasMember": [],
    "hasPart": []
  }

  return [subcorpusId, subcorpusName, subcorpusObj]
}

function plainTextCopy(collector, baseFilename, textcode) {
  let filename = path.join(collector.dataDir,`${textcode}-plain.txt`)
  let id = path.join(
    "plain_text",
    textcode.startsWith("S") ? "ICE Spoken" : "ICE Written",
    textcode.slice(0, 3),
    `${textcode}-plain.txt`
  )

  let objFile = {
    "@id": id,
    "name": id.replace(/.+\/.+\/(.+\..+)$/, "$1"),
    "@type": ["File"],
    "license": licenses.data_license,
  }
  if (!fs.existsSync(filename)) {
    console.log(`Missing file ${filename}`)

    let plainText = makePlainText(path.join(collector.dataDir, baseFilename))
    let plaintextpath = path.join(tempDir.path, filename)
    fs.mkdirSync(path.dirname(plaintextpath), {recursive: true})
    fs.writeFileSync(plaintextpath, plainText)
  

    return [plaintextpath, objFile]
  }

  return [filename, objFile]
}

function readSiegfried(objFile, fileID, fileSF, siegfriedData, dataDir) {
  // TODO: re-enable this
  return
  if (siegfriedData[fileID]) {
    fileSF = siegfriedData[fileID].files[0];
  } else {
    let sfData;
    try {
      console.log(`Running SF on "${fileID}"`);
      sfData = JSON.parse(shell.exec(`sf -nr -json "${path.join(dataDir, fileID)}"`, { silent: true }).stdout);
    } catch (e) {
      console.error("File identification error: " + e);
      console.error("Have you installed Siegfried?");
      console.error("https://github.com/richardlehane/siegfried/wiki/Getting-started");
      process.exit(1);
    }
    fileSF = sfData.files[0];
    siegfriedData[fileID] = sfData;
  }
  objFile['encodingFormat'].push(fileSF.matches[0].mime);
  let formatID = PRONOM_URI_BASE + fileSF.matches[0].id
  objFile['encodingFormat'].push({ '@id': formatID })
  objFile['contentSize'] = `${fileSF.filesize} bytes`;
  if (fileID.includes(".xml")) {
    objFile['encodingFormat'] = [`application/xml`];
    objFile['encodingFormat'].push({ '@id': PRONOM_URI_BASE + "fmt/101" })
  }
}

function tryParseDate(rawDate) {
  let matches = null

  // // distribute year amongst ampersand-separated dates (e.g., )
  // matches = rawDate.match(/^([0-3]?\d)\/([01]?\d)\/(9\d)$/)
  // if (matches) {
  //   return `19${matches[3]}-${matches[2].padStart(2, '0')}-${matches[1].padStart(2, '0')}`
  // }

  // d/m/y
  matches = rawDate.match(/^([0-3]?\d)\/([01]?\d)\/(9\d)$/)
  if (matches) {
    return `19${matches[3]}-${matches[2].padStart(2, '0')}-${matches[1].padStart(2, '0')}`
  }

  // y/m/d
  matches = rawDate.match(/^(9\d)\/([01]?\d)\/([0-3]?\d)$/)
  if (matches) {
    return `19${matches[1]}-${matches[2].padStart(2, '0')}-${matches[3].padStart(2, '0')}`
  }

  // two-digit year after slash (e.g., `/93`)
  matches = rawDate.match(/^\/(9\d)$/)
  if (matches) {
    return `19${matches[1]}`
  }

  // just four-digit year (e.g., `1992`)
  matches = rawDate.match(/^(199\d)$/)
  if (matches) {
    return matches[0]
  }

  // just four-digit year range (e.g., `1990-1994`)
  matches = rawDate.match(/^(199\d)-199\d$/)
  if (matches) {
    return matches[0]
  }

  // hyphen-, comma- or ampersand-separated days then /M/Y (e.g., `19-22/7/93`, `8,9/7/94` or `11&14/6/93`)
  // we keep only the first day
  matches = rawDate.match(/^([0-3]?\d)[,&-][0-3]?\d\/([01]?\d)\/(9\d)$/)
  if (matches) {
    return `19${matches[3]}-${matches[2].padStart(2, '0')}-${matches[1].padStart(2, '0')}`
  }

  // ampersand-separated d/m then /y (e.g., `24/7&2/10/92`)
  // we keep only the first day/month
  matches = rawDate.match(/^(?:([0-3]?\d)\/([01]?\d)\s?[,&-]\s?)+[0-3]?\d\/[01]?\d\/(9\d)$/)
  if (matches) {
    return `19${matches[3]}-${matches[2].padStart(2, '0')}-${matches[1].padStart(2, '0')}`
  }

  // m/y with possible question mark at the end (e.g., `9/93?`)
  // we ignore the question mark, making this date seem more certain than the original metadata suggests
  matches = rawDate.match(/^([01]?\d)\/(9\d)\??$/)
  if (matches) {
    return `19${matches[2]}-${matches[1].padStart(2, '0')}`
  }

  throw new Error(`could not parse date ${rawDate}`)
}

main();
