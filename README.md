# corpus-tools-ausnc-ice

Corpus preparation tools for the International Corpus of English Australia (ICE) using metadata screenscraped from AusNC website.

## Install

Run:

```
npm install
```

## Usage

Create a file named `make_run.sh` containing the following data:

```
#!/usr/bin/env bash

make BASE_DATA_DIR=<base path>/ausnc_metadata \
 REPO_OUT_DIR=/opt/storage/oni/ocfl \
 REPO_SCRATCH_DIR=/opt/storage/oni/scratch-ocfl \
 BASE_TMP_DIR=./storage/temp \
 NAMESPACE=international-corpus-of-english-australia \
 CORPUS_NAME=international-corpus-of-english-australia \
 JSON=<base path>/ausnc_metadata/ICE.json \
 DATA_DIR=<base path>/ausnc_corpora-master/ICE

```

Update the `<base path>` sections to the appropriate locations for your local installation.

Running this file using `bash make_run.sh` (or appropriate command) will generate an RO-Crate for the corpus using the metadata created from screenscraping the AusNC website, then, for some fields, using the XML data supplied by AusNC to populate missing data.
