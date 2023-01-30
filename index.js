const { Collector, generateArcpId } = require('oni-ocfl');
const { languageProfileURI, Languages, Vocab } = require('language-data-commons-vocabs');
const fs = require('fs-extra');
const { first, flatMap } = require('lodash');
const path = require('path');
const { LdacProfile } = require('ldac-profile');
const parser = require('xml2json');
const XLSX = require('xlsx');
const { DataPack } = require('@describo/data-packs');

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
  // Get a new crate

  // This is the main crate - TODO: actually have some data in the template collector.templateCrateDir and add it below.
  const corpus = collector.newObject();

  const corpusCrate = corpus.crate;
  corpusCrate.addContext(vocab.getContext());
  const corpusRoot = corpus.rootDataset;

  corpus.mintArcpId('corpus', 'root');
  corpusCrate.addProfile(languageProfileURI('Collection'));

  corpusRoot['@type'] = ['Dataset', 'RepositoryCollection'];

  const data = await fs.readJSON(collector.excelFile);
  const licenses = fs.readJSONSync('licenses.json');
  const fileNames = fs.readdirSync(collector.dataDir);

  corpusRoot['name'] = data.title;
  corpusRoot['description'] = data.abstract;
  const publisher = data.owner.split(',');
  const publisherObj = { "@id": publisher[1], "name": publisher[0], "@type": "Organization" };
  corpusCrate.addValues(corpusRoot, 'publisher', publisherObj);
  const author = data.creator.split(',');
  const authorObj = { "@id": author[1], "name": author[0], "@type": "Person" };
  corpusCrate.addValues(corpusRoot, 'author', authorObj);
  corpusRoot['datePublished'] = data.created.replace(/.*(\d{4})$/g, '$1');
  corpusCrate.addValues(corpusRoot, 'license', licenses.data_license);
  corpusRoot['language'] = engLang;

  const metadataDescriptor = corpusCrate.getItem('ro-crate-metadata.json');
  metadataDescriptor.license = licenses.metadata_license;

  let children = [];

  for (let file in fileNames) {
    if (fileNames[file].includes("metadata.nt.json")) {
      const text = await JSON.parse(fs.readFileSync(path.join(collector.dataDir, fileNames[file]), "utf8"));
      const obj = {};
      let speakers = [];
      let iceType;
      obj.hasPart = [];
      for (let child in text) {
        Object.keys(text[child]).forEach(function (key) {
          children.includes(key) ? null : children.push(key);
        });
        if (JSON.stringify(text[child]['@type']).includes('AusNCObject')) {
          obj['@id'] = generateArcpId(collector.namespace, 'Document', text[child]['@id'].replace("http://app.alveo.edu.au/catalog/ice/", ""));
          obj["@type"] = "RepositoryObject";

          obj.name = text[child]["http://purl.org/dc/terms/identifier"][0]["@value"];
          if (text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/subtitle"]) {
            obj.name += " - " + text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/subtitle"][0]["@value"];
          }

          obj.language = engLang;
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
            obj.description = text[child]["http://purl.org/dc/terms/subject"][0]["@value"]
          }

          text[child]["http://ns.ausnc.org.au/schemas/ausnc_md_model/mode"].some(mode => mode["@id"] === "http://ns.ausnc.org.au/schemas/ausnc_md_model/spoken") ? iceType = "Transcription" : iceType = "PrimaryText";

        } else if (!JSON.stringify(text[child]['@id']).includes('person')) {

          let objFile = {
            "@id": text[child]["http://purl.org/dc/terms/identifier"][0]["@value"],
            "name": text[child]["http://purl.org/dc/terms/title"][0]["@value"],
            "@type": ["File", iceType, text[child]["http://purl.org/dc/terms/type"][0]["@value"]],
            "license": licenses.data_license,
            "encodingFormat": "text/plain",
            "linguisticGenre": vocab.getVocabItem("Report"),
            "size": text[child]["http://purl.org/dc/terms/extent"][0]["@value"]
          }

          iceType === "Transcription" ? objFile.modality = vocab.getVocabItem("SpokenLanguage") : objFile.modality = vocab.getVocabItem("WrittenLanguage");

          obj['hasPart'].push(objFile);
        } else if (JSON.stringify(text[child]['@id']).includes('person')) {
          speakers.push(text[child]);
        }

      }

      corpusCrate.addValues(corpusRoot, 'hasMember', obj);

      for (person in speakers) {
        const speaker = {
          "@id": generateArcpId(collector.namespace, "speaker", speakers[person]["@id"].replace("http://app.alveo.edu.au/catalog/ice/person/", "")),
          "@type": "Speaker"
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
        corpusCrate.addValues(obj, 'speaker', speaker);
      }
    }
  }


  //Debug data being exported
  if (collector.debug) {
    fs.writeFileSync("ro-crate_for_debug.json", JSON.stringify(corpusCrate, null, 2));
    var result = LdacProfile.validate(corpusCrate);
    // console.log(result);
    fs.writeFileSync("validation_result.json", JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      //process.exit(1);
    }
    process.exit()
  }
  for (const entity of corpusCrate.graph) {
    if (entity['@type'].includes('File')) {
      await corpus.addFile(entity, collector.dataDir, null, true); //adds each file to the repository 
    }

  }
  await corpus.addToRepo(); //add the metadata to the repository

}


main();
