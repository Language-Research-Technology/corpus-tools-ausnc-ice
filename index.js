const { Collector, generateArcpId, Provenance } = require('oni-ocfl');
const { languageProfileURI, Languages, Vocab } = require('language-data-commons-vocabs');
const fs = require('fs-extra');
const { cloneDeep } = require('lodash');
const path = require('path');
const { DataPack } = require('@ldac/data-packs');
const shell = require("shelljs");
const PRONOM_URI_BASE = 'https://www.nationalarchives.gov.uk/PRONOM/';
const { toCSV } = require('./lib/createCSV.js');
const { Console } = require('console');
const ExcelJS = require('exceljs');
const roCrateExcel = require('ro-crate-excel');
const catalogueParser = require('./lib/catalogue_parser.js')
const demographicInfoParser = require('./lib/demographic_info_parser.js')

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
  corpusCrate.addContext(vocab.getContext());
  const corpusRoot = corpus.crate.root;

  corpus.mintArcpId();
  corpusCrate.addProfile(languageProfileURI('Collection'));

  corpusRoot['@type'] = ['Dataset', 'RepositoryCollection'];

  const metadataDescriptor = corpusCrate.getItem('ro-crate-metadata.json');
  metadataDescriptor.license = licenses.metadata_license;

  makeReadme(corpus, corpusRoot)

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
          repositoryObj.date = item.date;
        }
      }
      if (item.wordcount) {
        if (typeof(item.wordcount) === "string") {
          repositoryObj.wordcount = Number(item.wordcount.replace(/ words/, ""));
        } else if (typeof(item.wordcount) === "number") {
          repositoryObj.wordcount = item.wordcount
        }
      }
      if (item.author) repositoryObj.author = item.author;
      if (item.textcode === "W2C") repositoryObj['ldac:linguisticGenre'] = vocab.getVocabItem("Report");
  
      let filename = path.join(collector.dataDir, "ICE Written", item.textcode.slice(0, 3), `${item.textcode}.TXT`)
      let id = path.join("original", "written", item.textcode.slice(0, 3), `${item.textcode}.TXT`)
      if (!fs.existsSync(filename)) {
        throw new Error(`Missing file ${filename}`)
      }
      let objFile = {
        "@id": id,
        "name": id.replace(/.+\/.+\/(.+\..+)$/, "$1"),
        "@type": ["File"],
        "license": licenses.data_license,
      }
  
      repositoryObj.hasPart.push(objFile)
      files.push([filename, id])

      let basedOn = objFile
      {
        let filename = path.join(collector.dataDir,`${item.textcode}-plain.txt`)
        let id = path.join("derived", "written", item.textcode.slice(0, 3), `${item.textcode}-plain.txt`)
        let objFile, objProv;
        try {
          objFile = plainTextCopy(filename, id)
          objProv = plainTextProv(basedOn["@id"], filename)
        } catch {
          try {
            filename = filename.replace(/(\d\d\d)\w-plain.txt/, "$1-plain.txt")
            objFile = plainTextCopy(filename, id)
            objProv = plainTextProv(basedOn["@id"], filename)
          } catch (e) { console.log(e) }
        }

        if (objFile) {
          repositoryObj.hasPart.push(objFile)
          if (objProv) repositoryObj.hasPart.push(objProv);
          files.push([filename, id])
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

    for (let item of spoken[i]) {
      console.log(item.textcode)
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

      let filename = path.join(collector.dataDir, "ICE Spoken", item.textcode.slice(0, 3), `${item.textcode.slice(0, 7)}.TXT`)
      let id = path.join("original", "spoken", item.textcode.slice(0, 3), `${item.textcode.slice(0, 7)}.TXT`)
      if (!fs.existsSync(filename)) {
        throw new Error(`Missing file ${filename}`)
      }
      let objFile = {
        "@id": id,
        "name": id.replace(/.+\/.+\/(.+\..+)$/, "$1"),
        "@type": ["File"],
        "license": licenses.data_license,
      }
      
      repositoryObj.hasPart.push(objFile)
      files.push([filename, id])

      var basedOn = objFile
      {
        let filename = path.join(collector.dataDir,`${item.textcode}-plain.txt`)
        let id = path.join("derived", "spoken", item.textcode.slice(0, 3), `${item.textcode}-plain.txt`)
        let objFile, objProv;
        try {
          objFile = plainTextCopy(filename, id)
          objProv = plainTextProv(basedOn["@id"], filename)
        } catch (e) {
          try {
            filename = filename.replace(/(\d\d\d)\w-plain.txt/, "$1-plain.txt")
            objFile = plainTextCopy(filename, id)
            objProv = plainTextProv(basedOn["@id"], filename)
          } catch (e) { console.log(e) }
        }

        if (objFile) {
          repositoryObj.hasPart.push(objFile)
          if (objProv) repositoryObj.hasPart.push(objProv);
          files.push([filename, id])
        } else {
          console.log(`skipping ${filename}`)
        }
      }

      corpusCrate.addValues(subcorpusObj, 'pcdm:hasMember', repositoryObj);
    }
  }

  files.push(
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s1a.xls"), "original/demographic_info_ice-aus_s1a.xls"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s1b.xls"), "original/demographic_info_ice-aus_s1b.xls"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s2a.xls"), "original/demographic_info_ice-aus_s2a.xls"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s2b.xls"), "original/demographic_info_ice-aus_s2b.xls"],
    [path.join(collector.dataDir, "metadata/ICE-catalogue.xls"), "original/ICE-catalogue.xls"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s1a.xlsx"), "derived/demographic_info_ice-aus_s1a.xlsx"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s1b.xlsx"), "derived/demographic_info_ice-aus_s1b.xlsx"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s2a.xlsx"), "derived/demographic_info_ice-aus_s2a.xlsx"],
    [path.join(collector.dataDir, "metadata/demographic_info_ice-aus_s2b.xlsx"), "derived/demographic_info_ice-aus_s2b.xlsx"],
    [path.join(collector.dataDir, "metadata/ICE-catalogue.xlsx"), "derived/ICE-catalogue.xlsx"],
  )
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

function plainTextCopy(filename, id) {
  if (!fs.existsSync(filename)) {
    throw new Error(`Missing file ${filename}`)
  }
  let objFile = {
    "@id": id,
    "name": id.replace(/.+\/.+\/(.+\..+)$/, "$1"),
    "@type": ["File"],
    "license": licenses.data_license,
  }

  return objFile
}

function plainTextProv(object, result) {
  return {
    "@id": `#${result}Derived`,
    "name": `${result} derived`,
    "object": { "@id": object },
    "agent": "Alveo project",
    "instrument": "unknown; likely a script",
    "result": { "@id": result }
  }
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


async function makeReadme(corpus, corpusRoot) {  
  let content = `
<html>
  <head>
    <meta charset="utf-8">
    <title>${corpusRoot["name"].join(' ')}</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: max(1vw, 16px);;
        margin: 0;
      }
        main {
        margin: 0 auto;
        padding: 1em;
        width: min(800px, 100vw);
      }
      h3 {
        font-size: 0.6em;
        line-height: 0;
        margin-bottom: 4px;
        margin-top: 2em;
      }
      .entity-header-row {
        width: 100%;
        padding: 15px;
        padding-bottom: 25px;
        background-color: rgb(0, 0, 0);
        color: #fff;
        font-size: 2em;
        font-weight: bold;
        text-align: center;
      }
      .entity-header-row h2 {
        align-items: center;
        text-align: center;
        line-height: 1.1em;
        margin-bottom: 0px;
        justify-content: center; /* Center horizontally */
      }
      .entity-header-row .info {
        text-decoration: none;
        font-size: 0.75em;
      }
      .entity-header-row a {
        color: #fff;
        text-decoration: none;
        font-size: 0.5em;
        font-weight: bold;
        line-height: 1.25;
        margin-top: 0;
        padding-top: 0;
        text-decoration: underline dotted 2px;
        text-underline-offset: 5px;
      }
      .entity-header-row p {
        font-size: 0.6em;
        display: inline;
      }
      p {
        margin: auto;
      }
      dt {
        font-weight: bold;
      }
      p + p {
        padding-top: 0.4em;
      }
  </style>
</head>
<body>
<h1 class="entity-header-row">${corpusRoot["name"]}</h1>
<main>
  <p>
    For a complete description of this dataset see the <a href="./ro-crate-preview.html">metadata preview file</a> (ro-crate-preview.html).
  </p>
  <dl>
    <dt>Date published</dt><dd>${corpusRoot["datePublished"].join(' ')}</dd>
    <dt>License</dt><dd>${corpusRoot["license"].map(x=>x["@id"]).join(' ')}</dd>
  </dl>
  ${corpusRoot["description"].join('\n').split('\n').map(line => `<p>${line}</p>`).join('')}
<pre>
.
├── README.html
├── derived            -- contains derivative files created from the originals
│   ├── ICE-catalogue.xlsx
│   ├── demographic_info_ice-aus_s1a.xlsx
│   ├── demographic_info_ice-aus_s1b.xlsx
│   ├── demographic_info_ice-aus_s2a.xlsx
│   ├── demographic_info_ice-aus_s2b.xlsx
│   ├── spoken
│   │   ├── S1A
│   │   │   ├── S1A-001-plain.txt   -- plain text files that have had their ICE markup removed
│   │   │   ├── [...]
│   │   │   ├── S1A-057A-plain.txt  -- some plain text files are split up by subtext
│   │   │   ├── S1A-057B-plain.txt
│   │   │   ├── [...]
│   │   │   └── S1A-100-plain.txt
│   │   ├── S1B
│   │   ├── S2A
│   │   └── S2B
│       │   ├── [...]
│       │   ├── S2B-008B-plain.txt
│       │   ├──                      -- a couple of files do not have plain text versions
│       │   ├── S2B-010A-plain.txt
│       │   ├── [...]
│   └── written
│       ├── W1A
│       ├── W1B
│       ├── W2A
│       ├── W2B
│       ├── W2C
│       ├── W2D
│       ├── W2E
│       └── W2F
├── original           -- contains data and metadata files as packaged for the ICE project
│   ├── ICE-catalogue.xls
│   ├── demographic_info_ice-aus_s1a.xls
│   ├── demographic_info_ice-aus_s1b.xls
│   ├── demographic_info_ice-aus_s2a.xls
│   ├── demographic_info_ice-aus_s2b.xls
│   ├── spoken
│   │   ├── S1A
│   │   │   ├── S1A-001.TXT
│   │   │   ├── [...]
│   │   │   └── S1A-100.TXT
│   │   ├── S1B
│   │   ├── S2A
│   │   └── S2B
│   └── written
│       ├── W1A
│       │   ├── W1A-001.TXT
│       │   ├── [...]
│       │   └── W1A-020.TXT
│       ├── W1B
│       ├── W2A
│       ├── W2B
│       ├── W2C
│       ├── W2D
│       ├── W2E
│       └── W2F
├── ro-crate-metadata.json
├── ro-crate-metadata.xlsx
└── ro-crate-preview.html
</pre>
  </main>
</body>
`

  let dir = fs.mkdtempDisposableSync("storage/temp/ldaca-ice")
  let readmepath = path.join(dir.path, "README.html") 
  fs.writeFileSync(readmepath, content)
  corpus.importFile(readmepath, "README.html")
}

main();
