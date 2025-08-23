// metadata.js written by Abdurrahman Alyajouri

const fs = require('fs')
const path = require('path')

const metadataUtils = require('./metadata_utils.js')

const acceptedDomains = ["gai"]
const acceptedLanguages = {
    eng: ["usa"],
    esp: ["mex"]
}

//The maximum amount of words to read from the provided text file for metadata inference purposes. This will influence the amount of tokens sent to deepseek, so change with caution.
const maxWordsToRead = 1000 

function printHelpMessage() {
    const baseMessage = "There are 2 valid ways to run the program 'metadata.js':\n1. 'node [insert path to metadata.js]/metadata.js' -> shows this help message.\n2. 'node [insert path to 'metadata.js']/metadata.js [insert domain] [insert language] [insert language variant] [insert path to document text file] [insert path to output folder]' -> runs the metadata generation/inference process.\n\nExample: 'node metadata.js gai eng usa ./pdf_to_text/Bender_DangersOfStochasticParrots_2021.txt ./metadata_output'"

    console.log(baseMessage)

    console.log("\nCurrently accepted domains:")
    acceptedDomains.forEach(element => {
        console.log(`\t${element}`)
    });

    console.log("\nCurrently accepted language families and language variants:")
    console.log(acceptedLanguages)
}

function getTextContentFromFile(path) {
    const text = fs.readFileSync(path, 'utf-8') //Read as string
    const words = text.split(/\s+/) //Split by whitespace
    const limitedWords = words.slice(0, maxWordsToRead)
    return limitedWords.join(' ')
}

async function main() {

    //I wanted this to be as user friendly and the least syntax intensive as possible so im avoiding unix style cli options,
    //in favor for 5 additional strictly ordered and required arguments, or no additional arguments to display the help message.

    if(process.argv.length != 2 && process.argv.length != 7) {
        console.error("You provided an invalid set of arguments, try 'node metadata.js' in the console to see how to use this program.")
        return
    }

    //User only passed 'node metadata.js', so display a help message.
    if(process.argv.length == 2) {
        printHelpMessage()
        return
    }

    //First and second cli arguments go like 'node metadata.js'

    //3rd argument must be the domain that the document covers.
    const domain = process.argv[2]

    //4th argument must be the language that the document is in.
    const language = process.argv[3]

    //5th argument must be the variant of the previously specified language.
    const languageVariant = process.argv[4]

    //6th argument must be the file path of the input pdf to text converted file.
    const inputPath = path.normalize(process.argv[5])

    //7th argument must be the path to the output folder for the inferred metadata json.
    const outputPath = path.normalize(process.argv[6])

    //Validate command line args, print errors if a mismatch occurs and return.
    if(!fs.existsSync(inputPath)) {
        console.error(`The specified INPUT document file path '${inputPath}' was not found!`)
        return
    } else if(!fs.existsSync(outputPath)) {
        console.error(`The specified OUTPUT folder path '${outputPath}' was not found!`)
        return
    } else if(path.extname(inputPath) != ".txt") {
        console.error(`The specified INPUT document file at path '${inputPath}' is not a valid text file of extension '.txt'!`)
        return
    } else if(!acceptedDomains.includes(domain)) {
        console.error(`The specified '${domain}' domain is not one of the accepted domains!`)
        return
    } else if(!(language in acceptedLanguages)) {
        console.error(`The specified '${language}' language is not one of the accepted languages!`)
        return
    } else if(!acceptedLanguages[language].includes(languageVariant)) {
        console.error(`The specified '${languageVariant}' language variant is not one of the accepted variants for '${language}'!`)
        return
    }
    
    console.log(`Inferring as much metadata as possible for '${path.basename(inputPath)}', please wait...`)

    let documentText = null
    let documentMetadata = {...metadataUtils.documentMetadataNull}

    try {
        documentText = getTextContentFromFile(inputPath)
    } catch(error) {
        //I could exit the process here but I want to give the user the option to fill in metadata values themselves.
        console.error(`Failed to read the file at '${path}': ${error}`)
    }

    if(documentText !== null) {
        try {
            inferredMetadata = await metadataUtils.inferDocumentMetadata(documentText)
            console.log("Inference complete!")
            //console.log(JSON.stringify(inferredMetadata, null, 2))
            console.log("Checking inference validity...")
            const report = metadataUtils.isValidDocumentMetadata(inferredMetadata)
            if(!report.valid) {
                console.log("A portion of the inferred metadata was found to not conform to the standard, incorrect fields will be discarded for the user to fill in.")
                report.passedKeys.every((key) => documentMetadata[key] = inferredMetadata[key])
            } else {
                documentMetadata = inferredMetadata
            }

            metadataUtils.cleanupDocumentMetadata(documentMetadata)

        } catch(error) {
            console.error(`Failed to infer document metadata from text: ${error}`)
            //console.log(JSON.stringify(documentMetadata, null, 2))
            documentMetadata = metadataUtils.documentMetadataNull
        }
    }

    //Overwrite some of the fields with command line argument data.
    documentMetadata.domain = domain 
    documentMetadata.language_family = language
    documentMetadata.language_variant = languageVariant

    //Construct final metadata entry object.
    let final_metadata = {...metadataUtils.documentEntryTemplate}
    final_metadata.document_metadata = documentMetadata

    //Finally write the metadata object to a json file.
    fs.writeFileSync(path.join(outputPath, path.basename(inputPath, ".txt") + "_metadata.json"), JSON.stringify(final_metadata, null, 2))
    console.log(`Saved metadata for '${path.basename(inputPath)}' to '${path.resolve(outputPath) + path.normalize("/" + path.basename(inputPath, ".txt") + "_metadata.json")}'`)

    console.log("Done!")
}

//Entry point.
if(require.main === module) {
    main().then(function(data) {
        console.log("Exiting metadata.js process...")
    })
}

