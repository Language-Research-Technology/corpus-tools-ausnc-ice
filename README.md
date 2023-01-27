# corpus-tools-ausnc-braided
Corpus preparation tools for the Braided Channels corpus using metadata screenscraped from AusNC website

## Install

Then install
```
npm install
```

## Usage 

Create a file named make_run.sh containing the following data

```#!/usr/bin/env bash

make BASE_DATA_DIR=<base path>/cloudstor/ausnc_metadata \
 REPO_OUT_DIR=/opt/storage/oni/ocfl \
 REPO_SCRATCH_DIR=/opt/storage/oni/scratch-ocfl \
 BASE_TMP_DIR=./storage/temp \
 NAMESPACE=AustLit \
 CORPUS_NAME=AustLit \
 JSON=<base path>/cloudstor/ausnc_metadata/braided_channels.json \
 DATA_DIR=<base path>/cloudstor/ausnc_corpora-master/braided_channels
 
```
Update the paths to the appropriate locations for your local installation.

Running this file using bash make_run.sh (or appropriate command) will generate an RO-Crate for the corpus using the metadata created from screenscraping the AusNC website, then, for some fields, using the XML data supplied by AusNC to populate missing data.


