import { readFileSync } from 'node:fs'

function makePlainText(filename) {
    return readFileSync(filename).toString()
        // remove untranscribed text, its mostly used for things like '<O>2 names removed</O>'
        .replaceAll(/<O>.*<\/O>/g, "")
        .replaceAll(/<space>/g, " ")
        // These are attempts to match how Alveo's plain text versions are formatted
        .replaceAll(/>/g, "> ")
        .replaceAll("<p>", "\n\n")
        .replaceAll("</p>", "\n\n")
        .replaceAll(/\n/g, "")
        .replaceAll("<#\\>", "\n")
        .replaceAll(/<[^<>]*>/g, "")
        .replaceAll(/[ ]{2,}/g, " ")
        .replaceAll(/^\s+/g, "")
        .replaceAll(/^ /gm, "")
}

export { makePlainText }