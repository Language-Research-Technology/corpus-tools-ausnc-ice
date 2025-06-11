const { Collector, generateArcpId, Provenance } = require('oni-ocfl');
const { languageProfileURI, Languages, Vocab } = require('language-data-commons-vocabs');
const fs = require('fs-extra');
const { cloneDeep } = require('lodash');
const path = require('path');
const { DataPack } = require('@ldac/data-packs');
const shell = require("shelljs");
const PRONOM_URI_BASE = 'https://www.nationalarchives.gov.uk/PRONOM/';

async function main() {

  // Bring in the OLAC-derived terms
  const vocab = new Vocab;

  await vocab.load();
  const languages = new Languages();
  await languages.fetch();
  let datapack = new DataPack({ dataPacks: ['Glottolog'], indexFields: ['name'] });

  await datapack.load();
  let engLang = datapack.get({
    field: "name",
    value: "English",
  });

  //const audioFiles = new Files(path.join(dataDir, "Sound\ files"), 2);
  const collector = new Collector();

  await collector.connect(); // Make or find the OCFL repo
  const data = await fs.readJSON("ICE.json");

  const allFiles = fs.readdirSync(collector.dataDir, { recursive: true })


  // Get a new crate

  // This is the main crate - TODO: actually have some data in the template collector.templateCrateDir and add it below.
  const corpus = collector.newObject();

  const corpusCrate = corpus.crate;
  corpusCrate.addContext(vocab.getContext());
  const corpusRoot = corpus.rootDataset;

  corpus.mintArcpId();
  corpusCrate.addProfile(languageProfileURI('Collection'));

  corpusRoot['@type'] = ['Dataset', 'RepositoryCollection'];

  const licenses = fs.readJSONSync('licenses.json');

  const subCorpus = fs.readJSONSync('subCorpus.json');

  corpusRoot['name'] = data.title;
  corpusRoot['description'] = data.abstract += "This collection was previously accessible online via the Australian National Corpus (AusNC), an initiative managed by Griffith University between 2012 and 2023.";
  const publisher = data.owner.split(',');
  const publisherObj = { "@id": publisher[1], "name": publisher[0], "@type": "Organization" };
  corpusCrate.addValues(corpusRoot, 'publisher', publisherObj);
  const author = data.creator.split(',');
  const authorObj = { "@id": author[1], "name": author[0], "@type": "Person" };
  corpusCrate.addValues(corpusRoot, 'creator', authorObj);
  corpusCrate.addValues(corpusRoot, 'ldac:compiler', authorObj);
  corpusRoot['datePublished'] = data.created.replace(/.*(\d{4}).$/g, '$1');
  corpusRoot['temporal'] = data.created.replace(/.*?(\d{4}).+?(\d{4}).$/g, '$1/$2');
  corpusCrate.addValues(corpusRoot, 'license', licenses.data_license);
  corpusRoot['inLanguage'] = engLang;
  const metadataDescriptor = corpusCrate.getItem('ro-crate-metadata.json');
  metadataDescriptor.license = licenses.metadata_license;

  let siegfriedData = {}

  if (fs.existsSync(path.join(process.cwd(), "siegfriedOutput.json"))) {
    console.log("Reading SF Data");
    siegfriedData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "siegfriedOutput.json")));
  }
  let siegfriedDataRaw = cloneDeep(siegfriedData);

  let children = [];

  for (let c in subCorpus) {
    const subCorpusName = `ICE: ${c}: ${subCorpus[c]}`;
    let subcorpus = {
      "@id": generateArcpId(collector.namespace, c),
      "@type": ['Dataset', 'RepositoryCollection'],
      "name": subCorpusName,
      "description": `${subCorpus[c]} from the International Corpus of English (Aus)`,
      "inLanguage": engLang,
      "pcdm:memberOf": [{ "@id": corpus.id }],
      "conformsTo": { "@id": languageProfileURI("Collection") },
      "creator": authorObj,
      "ldac:compiler": authorObj,
      "license": licenses.data_license,
      "publisher": publisherObj,
      "datePublished": data.created.replace(/.*(\d{4}).$/g, '$1'),
      "temporal": data.created.replace(/.*?(\d{4}).+?(\d{4}).$/g, '$1/$2'),
      "pcdm:hasMember": [],
      "hasPart": []
    }
    // let newCorpus = collector.newObject();
    // let newCorpusCrate = newCorpus.crate;
    // newCorpusCrate.addContext(vocab.getContext());
    // let newCorpusRoot = newCorpus.rootDataset;
    // newCorpus.mintArcpId(c);
    // newCorpusCrate.addProfile(languageProfileURI('Collection'));
    // newCorpusRoot['@type'] = ['Dataset', 'RepositoryCollection'];
    // newCorpusRoot["name"] = subCorpusName;
    // newCorpusRoot["description"] = subCorpus[c] + " from the International Corpus of English (Aus)";
    // newCorpusRoot["inLang"] = engLang;
    // newCorpusRoot.memberOf = [{ "@id": corpus.id }];
    // newCorpusCrate.addValues(newCorpusRoot, 'creator', authorObj);
    // newCorpusCrate.addValues(newCorpusRoot, 'compiler', authorObj);
    // newCorpusCrate.addValues(newCorpusRoot, 'license', licenses.data_license);
    // newCorpusCrate.addValues(newCorpusRoot, 'publisher', publisherObj);
    // newCorpusRoot['datePublished'] = data.created.replace(/.*(\d{4}).$/g, '$1');
    // newCorpusRoot['temporal'] = data.created.replace(/.*?(\d{4}).+?(\d{4}).$/g, '$1/$2');
    // const newMetadataDescriptor = newCorpusCrate.getItem('ro-crate-metadata.json');
    // newMetadataDescriptor.license = licenses.metadata_license;

    let corpusFileNames = allFiles.filter((cn) => cn.includes(c));

    for (let file of corpusFileNames) {
      if (file.includes("metadata.nt.json")) {
        const text = await JSON.parse(fs.readFileSync(path.join(collector.dataDir, file), "utf8"));
        const obj = {};
        let speakers = [];
        let iceType;
        obj.hasPart = [];
        obj['ldac:speaker'] = [];
        let id;
        for (let child in text) {
          Object.keys(text[child]).forEach(function (key) {
            children.includes(key) ? null : children.push(key);
          });
          if (JSON.stringify(text[child]['@type']).includes('AusNCObject')) {

            id = text[child]['@id'].replace("http://app.alveo.edu.au/catalog/ice/", "");
            obj['@id'] = generateArcpId(collector.namespace, 'Document', id);
            obj["@type"] = "RepositoryObject";

            obj.name = text[child]["http://purl.org/dc/terms/identifier"][0]["@value"];
            if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/source"]) {
              obj.name += " : " + text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/source"][0]["@value"];
            } else if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/genre"]) {
              obj.name += " : " + text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/genre"][0]["@value"];
            } else if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/communicative_situation"]) {
              obj.name += " : " + text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/communicative_situation"][0]["@value"].replace(/./, c => c.toUpperCase());
            } else if (text[child]["http://purl.org/dc/terms/title"]) {
              obj.name += " : " + text[child]["http://purl.org/dc/terms/title"][0]["@value"];
            }
            if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/subtitle"]) {
              obj.name += " - " + text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/subtitle"][0]["@value"];
            } else if (text[child]["http://purl.org/dc/terms/subject"]) {
              obj.name += " - " + text[child]["http://purl.org/dc/terms/subject"][0]["@value"].replace(/^(.+?\.)(.+:.+)/, "$1");
            }

            obj.inLanguage = engLang;
            obj.conformsTo = { "@id": languageProfileURI("Object") };
            obj.license = licenses.data_license;

            let createDate

            try {
              createDate = text[child]["http://purl.org/dc/terms/created"][0]["@value"].split(/\//);
            } catch (err) {
              try {
                createDate = text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/source"][0]["@value"].split("-")[1].trim().split(/\//);
              } catch (err) {

              }
            }

            if (typeof createDate !== 'undefined') {
              createDate = createDate.filter(function (e) { return e });
              createDate.reverse();
              if (createDate[2]) {
                createDate[2] = createDate[2].padStart(2, '0');
              }
              createDate[0] = createDate[0].padStart(4, '19');

              if (createDate[1]) {
                createDate[1] = createDate[1].padStart(2, '0');
              }

              let createdDate = createDate.join("-");

              obj.datePublished = createdDate;
            }

            if (typeof text[child]["http://purl.org/dc/terms/subject"] !== 'undefined') {
              obj.description = text[child]["http://purl.org/dc/terms/subject"][0]["@value"].replace(/^(.+?\.)(.+:.+)/, "$1");
            }

            if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/mode"].some(mode => mode["@id"] === "http://ns.ausnc.org.au/schemas/ausnc_md_model/spoken")) {
              iceType = "Transcription";
              obj['ldac:communicationMode'] = vocab.getVocabItem("SpokenLanguage");
            } else {
              iceType = "PrimaryMaterial";
              obj['ldac:communicationMode'] = vocab.getVocabItem("WrittenLanguage");
            }

            if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/interactivity"]) {
              if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/interactivity"][0]["@id"].includes("dialogue")) {
                obj['ldac:linguisticGenre'] = vocab.getVocabItem("Dialogue");
              } else if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/interactivity"][0]["@id"].includes("monologue")) {
                obj['ldac:linguisticGenre'] = vocab.getVocabItem("Oratory");
              } else if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/interactivity"][0]["@id"].includes("interview")) {
                obj['ldac:linguisticGenre'] = vocab.getVocabItem("Interview");
              }
            } else if (c === "S2B") {
              obj['ldac:linguisticGenre'] = vocab.getVocabItem("Oratory");
            } else if (c === "S2A" || c === "S1A" || c === "S1B") {
              obj['ldac:linguisticGenre'] = vocab.getVocabItem("Dialogue");
            } else {
              let commSetting = text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/communication_setting"][0]["@id"].replace("http://ns.ausnc.org.au/schemas/ausnc_md_model/", "");
              let dataMapping = {
                "educational": "Informational",
                "intitutional": "Informational",
                "popular": "Informational",
                "fiction": "Narrative"
              }
              obj['ldac:linguisticGenre'] = vocab.getVocabItem(dataMapping[commSetting]);
              if (obj["@id"].includes("W2C")) {
                obj['ldac:linguisticGenre'] = vocab.getVocabItem("Report");
              }

            }

          } else if (!JSON.stringify(text[child]['@id']).includes('person')) {
            let objFile = {
              "@id": text[child]["http://purl.org/dc/terms/identifier"][0]["@value"],
              "name": text[child]["http://purl.org/dc/terms/title"][0]["@value"],
              "@type": ["File"],
              "license": licenses.data_license,
              "encodingFormat": [],
              "contentSize": text[child]["http://purl.org/dc/terms/extent"][0]["@value"] + "Bytes",
            }

            if (objFile["name"].match(/^S/)) {
              objFile['ldac:materialType'] = vocab.getVocabItem("Annotation");
              objFile['ldac:annotatationType'] = vocab.getVocabItem(iceType)
              objFile['ldac:communicationMode'] = vocab.getVocabItem("SpokenLanguage");
            } else {
              objFile['ldac:materialType'] = vocab.getVocabItem("PrimaryMaterial")
              objFile['ldac:communicationMode'] = vocab.getVocabItem("WrittenLanguage");
            }

            let fileSF;
            readSiegfried(objFile, objFile['@id'], fileSF, siegfriedData, collector.dataDir);
            obj['hasPart'].push(objFile);
            subcorpus.hasPart.push(objFile);
            obj["ldac:indexableText"] = objFile;
          } else if (JSON.stringify(text[child]['@id']).includes('person')) {
            speakers.push(text[child]);
          }
          for (person in speakers) {
            const speaker = {
              "@id": generateArcpId(collector.namespace, "speaker", speakers[person]["@id"].replace("http://app.alveo.edu.au/catalog/ice/person/", "")),
              "@type": "Person"
            }
            for (let key in speakers[person]) {
              if (key.startsWith('http://ns.ausnc.org.au/schemas/ausnc_md_model')) {
                const newKey = key.replace('http://ns.ausnc.org.au/schemas/ausnc_md_model/', '');
                speaker[newKey] = speakers[person][key][0]["@value"];
              }
              if (key.startsWith('http://xmlns.com/foaf/0.1/')) {
                const newKey = key.replace('http://xmlns.com/foaf/0.1/', '');
                speaker[newKey] = speakers[person][key][0]["@value"];
              }

            }
            obj['ldac:speaker'].push(speaker)
            // newCorpusCrate.addValues(obj, 'speaker', speaker);
          }
        }
        subcorpus['pcdm:hasMember'].push(obj);
        obj['pcdm:memberOf'] = subcorpus["@id"];
        // newCorpusCrate.addValues(newCorpusRoot, 'hasMember', obj);

        // for (person in speakers) {
        //   const speaker = {
        //     "@id": generateArcpId(collector.namespace, "speaker", speakers[person]["@id"].replace("http://app.alveo.edu.au/catalog/ice/person/", "")),
        //     "@type": "Speaker"
        //   }
        //   for (let key in speakers[person]) {
        //     if (key.startsWith('http://ns.ausnc.org.au/schemas/ausnc_md_model')) {
        //       const newKey = key.replace('http://ns.ausnc.org.au/schemas/ausnc_md_model/', '');
        //       speaker[newKey] = speakers[person][key][0]["@value"];
        //     }
        //     if (key.startsWith('http://xmlns.com/foaf/0.1/')) {
        //       const newKey = key.replace('http://xmlns.com/foaf/0.1/', '');
        //       speaker[newKey] = speakers[person][key][0]["@value"];
        //     }

        //   }
        //   // newCorpusCrate.addValues(obj, 'speaker', speaker);
        // }
        console.log(id);
        let objectFiles = allFiles.filter((cn) => cn.includes(id));
        for (let f of objectFiles) {
          if (!f.includes("data/")&&!f.includes("plain")) {
            let objFile = {
              "@id": f,
              "name": f.replace(/.+\/.+\/(.+\..+)$/, "$1"),
              "@type": ["File"],
              "license": licenses.data_license,
              "encodingFormat": [],
              "contentSize": ""
            }
            let fileSF;
            readSiegfried(objFile, objFile['@id'], fileSF, siegfriedData, collector.dataDir);
            obj['hasPart'].push(objFile);
            if (f.includes(".TXT")) {
              obj["ldac:mainText"] = objFile;
            }
          }
        }
      }
      // } else if (file.includes(".TXT")) {
      //   console.log(file);
      //   let objFile = {
      //     "@id": file,
      //     "name": file.replace(/.+\/.+\/(.+\.TXT)/, "$1"),
      //     "@type": ["File"],
      //     "license": licenses.data_license,
      //     "encodingFormat": [],
      //     "size": ""
      //   }
      //   objFile.isPartOf = generateArcpId(collector.namespace, 'Document', objFile.name.replace(".TXT",""));
      //   corpusCrate.addEntity(objFile);
      // } else {
      //   console.log(file)
      //   let objFile = {
      //     "@id": file,
      //     "name": file.replace(/.+\/.+\/(.+\.\w{3})$/, "$1"),
      //     "@type": ["File"],
      //     "license": licenses.data_license,
      //     "encodingFormat": [],
      //     "size": ""
      //   }
      //   objFile.isPartOf = generateArcpId(collector.namespace, 'Document', objFile.name.replace(/\.\w{3}$/,""));
      //   corpusCrate.addEntity(objFile);
      // }
    }
    // for (const entity of newCorpusCrate.graph) {
    //   if (entity['@type'].includes('File')) {
    //     await newCorpus.addFile(entity, collector.dataDir, null, true); //adds each file to the repository 
    //   }

    // }
    // await newCorpus.addToRepo();
    corpusCrate.addValues(corpusRoot, 'pcdm:hasMember', subcorpus);

  }


  let provenanceFile = {
    "@id": "ice-provenance.zip",
    "@type": ["File"],
    "name": "Provenance files for International Corpus of English",
    "description": "Source files used to generate the metadata for the International Corpus of English as presented in the LDaCA Data Portal",
    "encodingFormat": []
  }
  let fileSF;
  readSiegfried(provenanceFile, provenanceFile['@id'], fileSF, siegfriedData, collector.dataDir);

  collector.prov.createAction.input = [provenanceFile];
  corpusCrate.addEntity(provenanceFile);

  if (siegfriedData !== siegfriedDataRaw) {
    console.log("Writing SF Data")
    fs.writeFileSync(path.join(process.cwd(), "siegfriedOutput.json"), JSON.stringify(siegfriedData));
  }


  // for (const entity of corpusCrate.graph) {
  //   if (entity['@type'].includes('File')) {
  //     await corpus.addFile(entity, collector.dataDir, null, true); //adds each file to the repository 
  //   } 
  // }

  await corpus.addToRepo(); //add the metadata to the repository

}

function readSiegfried(objFile, fileID, fileSF, siegfriedData, dataDir) {
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
}

main();
