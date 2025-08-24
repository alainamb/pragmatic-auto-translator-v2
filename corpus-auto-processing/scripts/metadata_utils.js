// metadata_utils.js written by Abdurrahman Alyajouri

const fs = require('fs')
const openAI = require('openai')

//const pdf = require('pdf-parse')

const DEEPSEEK_API_KEY = 'sk-your-key-here'
const deepSeek = new openAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: DEEPSEEK_API_KEY
})

const documentEntryTemplate = {
    "document_metadata": {
        "language_family": "eng, esp",
        "language_variant": "Lowercase three letter ISO code",
        "title": "Title of item",
        "authors": [
            {
                "name": "Author Name",
                "affiliation": "Organization (optional)"
            },
            {
                "name": "Author Name",
                "affiliation": "Organization (optional)"
            }
        ],
        "publisher": "Publisher",
        "publication_year": "YYYY",
        "domain": "generative_ai",
        "text_type": [ "Academic paper", "Advertisement", "App/Website content", "Blog post", "Book chapter", "Case study", "Contract/Legal document", "Documentation", "Email", "Essay", "FAQ", "Journal article", "Manual/Guide", "Marketing material", "News article", "Policy Documentation", "Press release", "Product description", "Report", "Research proposal", "Review", "Script", "Social media post", "Subtitles/Captions", "Technical specification", "Translation", "Tutorial", "White paper" ],
        "purpose": [ "Entertainment", "Informational", "Persuasive", "Philosophical", "Religious" ],
        "point_of_view": [ "Academic", "Content creator", "Copywriter", "Documentation specialist", "General public", "Grant writer", "Legal professional", "Marketing specialist", "Philanthropist", "Policy analyst", "Proposal writer", "Reporter", "Researcher", "Student", "Subject matter expert", "Technical writer" ],
        "audience": [ "Academic", "Business", "Children/Youth", "Clients (B2B)", "Developers", "Educators", "General public", "Government", "Healthcare professionals", "Internal", "Investors", "Legal professionals", "Media", "Patients/Consumers", "Policy makers", "Professional", "Regulatory", "Researchers", "Students", "Subject matter experts", "Technical", "Users/Customers" ],
        "reach": [ "Cross-organizational", "For informational purposes only", "Global", "Industry-specific", "Internal team", "Local", "National", "Organization-wide", "Regional" ],
        "topics": [
          "topic 1",
          "topic 2",
          "topic 3"
        ],
        "summary": "Summary",
        "suggested_citation": "Harvard style"
    },
    "processing_metadata": {
        "submission_file_name": "AuthorLastName_AbbreviatedTitle_YYYY.pdf",
        "creation_date": "YYYY-MM-DD",
        "word_count": 0,
        "status": "vectorization_pending",
        "file_paths": {
            "original": "gai/eng/submissions/AuthorLastName_AbbreviatedTitle_YYYY.pdf",
            "processed": "gai/eng/processed/gai-eng_itemXXX.json"
        },
        "processing_notes": "Processing notes"
    }
}

const documentMetadataNull = {
    "language_family": "",
    "language_variant": "",
    "title": "",
    "authors": [],
    "publisher": "",
    "publication_year": "",
    "domain": "",
    "text_type": "",
    "purpose": "",
    "point_of_view": [],
    "audience": [],
    "reach": [],
    "topics": [],
    "summary": "",
    "suggested_citation": ""
}

function isString(val) {
    return typeof val === 'string';
}

function isArray(val) {
    return Array.isArray(val);
}

function isArrayOfStrings(val) {
    return isArray(val) && val.every(item => typeof item === 'string');
}

function isAuthorArray(val) {
    return isArray(val) && val.every(author =>
        typeof author === 'object' &&
        isString(author.name) &&
        (!author.affiliation || isString(author.affiliation))
    );
}

// function isValidDocumentMetadata(metadata) {
//     if (typeof metadata !== 'object') return false;

//     const referenceKeys = Object.keys(documentEntryTemplate.document_metadata).sort()
//     const suspectKeys = Object.keys(metadata).sort()

//     //Key count test.
//     const matchesLength = referenceKeys.length === suspectKeys.length

//     //Key presence test.
//     const matchesKeys = referenceKeys.every((element, index, array) => element === suspectKeys[index])

//     //Value test.
//     const reference = documentEntryTemplate.document_metadata
//     const textTypeMatches = reference.text_type.includes(metadata.text_type)
//     const purposeMatches = reference.purpose.includes(metadata.purpose)
//     const pointOfViewMatches = metadata.point_of_view.every((element) => reference.point_of_view.includes(element))
//     const audienceMatches = metadata.audience.every((element) => reference.audience.includes(element))
//     const reachMatches = metadata.reach.every((element) => reference.reach.includes(element))

//     return (
//         matchesLength &&
//         matchesKeys &&
//         isString(metadata.language_family) &&
//         isString(metadata.language_variant) &&
//         isString(metadata.title) &&
//         isAuthorArray(metadata.authors) &&
//         isString(metadata.publisher) &&
//         isString(metadata.publication_year) &&
//         isString(metadata.domain) &&
//         isString(metadata.text_type) &&
//         isString(metadata.purpose) &&
//         isArrayOfStrings(metadata.point_of_view) &&
//         isArrayOfStrings(metadata.audience) &&
//         isArrayOfStrings(metadata.reach) &&
//         isArrayOfStrings(metadata.topics) &&
//         isString(metadata.summary) &&
//         isString(metadata.suggested_citation) &&
//         textTypeMatches &&
//         purposeMatches &&
//         audienceMatches &&
//         reachMatches
//     );
// }

function isValidDocumentMetadata(metadata) {
    const reference = documentEntryTemplate.document_metadata;
    let result = {
        valid: true,
        passedKeys: []
    }

    if (typeof metadata !== 'object') {
        console.error("Validation failed: metadata is not an object");
        result.valid = false;
    }

    const referenceKeys = Object.keys(reference).sort();
    const suspectKeys = Object.keys(metadata).sort();

    //Key count test
    const matchesLength = referenceKeys.length === suspectKeys.length;
    if (!matchesLength) {
        console.error(`Validation failed: key count mismatch. Expected ${referenceKeys.length}, got ${suspectKeys.length}`);
        result.valid = false
    }

    //Key presence test
    const matchesKeys = referenceKeys.every((key, i) => key === suspectKeys[i]);
    if (!matchesKeys) {
        console.error(`Validation failed: key mismatch. Expected keys: ${referenceKeys.join(', ')}, got: ${suspectKeys.join(', ')}`);
        result.valid = false
    }

    //Individual field validations
    const validations = [
        [isString(metadata.language_family), "language_family must be a string", "language_family"],
        [isString(metadata.language_variant), "language_variant must be a string", "language_variant"],
        [isString(metadata.title), "title must be a string", "title"],
        [isAuthorArray(metadata.authors), "authors must be a valid array of authors", "authors"],
        [isString(metadata.publisher), "publisher must be a string", "publisher"],
        [isString(metadata.publication_year), "publication_year must be a string", "publication_year"],
        [isString(metadata.domain), "domain must be a string", "domain"],
        [isString(metadata.text_type), "text_type must be a string", "text_type"],
        [isString(metadata.purpose), "purpose must be a string", "purpose"],
        [isArrayOfStrings(metadata.point_of_view), "point_of_view must be an array of strings", "point_of_view"],
        [isArrayOfStrings(metadata.audience), "audience must be an array of strings", "audience"],
        [isArrayOfStrings(metadata.reach), "reach must be an array of strings", "reach"],
        [isArrayOfStrings(metadata.topics), "topics must be an array of strings", "topics"],
        [isString(metadata.summary), "summary must be a string", "summary"],
        [isString(metadata.suggested_citation), "suggested_citation must be a string", "suggested_citation"],
        [reference.text_type.includes(metadata.text_type), `text_type value '${JSON.stringify(metadata.text_type)}' not in allowed values`, "text_type"],
        [reference.purpose.includes(metadata.purpose), `purpose value '${JSON.stringify(metadata.purpose)}' not in allowed values`, "purpose"],
        [metadata.point_of_view.every((v) => reference.point_of_view.includes(v)), `point_of_view contains unsupported values: ${JSON.stringify(metadata.point_of_view)}`, "point_of_view"],
        [metadata.audience.every((v) => reference.audience.includes(v)), `audience contains unsupported values: ${JSON.stringify(metadata.audience)}`, "audience"],
        [metadata.reach.every((v) => reference.reach.includes(v)), `reach contains unsupported values: ${JSON.stringify(metadata.reach)}`, "reach"],
    ];

    for (const [valid, message, key] of validations) {
        if (!valid) {
            console.error("Validation failed:", message);
            result.valid = false
            //result.failedKeys.push(key)
        } else {
            result.passedKeys.push(key)
        }
    }

    return result;
}

function cleanupDocumentMetadata(metadata) {
    //Essentially just make sure all array fields contain unique values and the maximum allowed number of values.
    metadata.point_of_view = [...new Set(metadata.point_of_view)]
    metadata.audience = [...new Set(metadata.audience)]
    metadata.reach = [...new Set(metadata.reach)]
    metadata.topics = [...new Set(metadata.topics)]

    //Alaina wanted the number of topics to be capped at 10. 
    metadata.topics = metadata.topics.slice(0, 10)

}

async function inferDocumentMetadata(text) {
    //Prompt engineering.
    // const systemPrompt = "The user will provide a template JSON object, followed by an excerpt extracted from some research/academic literature. The provided template JSON object will contain fields that contain either a single value that describes what should go in said field, or an array of possible values that can fill said field (only one possible value may be chosen for these types of fields unless otherwise specified). Your job is to read the provided excerpt, and then infer the values that should fill the provided JSON fields based on the excerpt. You need to return an identical JSON object, where the fields are now filled with your inferred values."

    // const additionalNotesPrompt = "When inferring ONLY the 'point_of_view', 'audience', and 'reach' fields from the provided JSON template, you are allowed to pick 1 or more values using your best judgement. The 'point_of_view', 'audience', and 'reach' fields must be placed as array type values within the JSON template. If any value is clearly stated or can be confidently inferred, provide it. If the value is completely missing or there's no reasonable basis to infer it, use 'undefined'. Do not use 'undefined' just because you're slightly unsure, use your best judgment."

    const systemPrompt = `
        You will be given two inputs:
        1. A template JSON object.
        2. An excerpt from academic or research literature.

        Your task is to:
        - Carefully read the excerpt.
        - Fill in the fields of the provided JSON object using the information from the excerpt.

        Instructions:
        - Some fields in the JSON template have a single placeholder value (e.g., "describe the method").
        - Others contain an array of possible values (e.g., ["qualitative", "quantitative", "mixed methods"]). For these, select the **one most appropriate** value based on the excerpt, **unless otherwise specified**.

        Your output should be:
        - The same JSON structure, but with each field filled in with the appropriate value inferred from the excerpt.
        - Do not add or remove fields.
        - Use the original field names exactly as provided.

        If no reasonable information can be inferred for a field, use the string "undefined".

        Be as accurate as possible. Use good judgment when the information is not explicit but strongly implied.
        `

    const additionalNotesPrompt = `
        Special instructions for the fields: "point_of_view", "audience", and "reach":

        - These three fields may contain **multiple values**, not just one.
        - When filling these fields, return them as **arrays** (even if only one value is chosen).
        - Use your best judgment to select one or more values that apply.
        - If a value is clearly stated or strongly implied in the excerpt, include it.
        - If nothing at all can be inferred, use the string "undefined" (do not leave it empty or null).

        Only these three fields may be multi-valued unless explicitly told otherwise.
        `;



    const metadataTemplate = JSON.stringify(documentEntryTemplate.document_metadata)
    const userPrompt = `${metadataTemplate} Excerpt: ${text}`

    let messages = [
        {role: "system", content: systemPrompt + "\n" + additionalNotesPrompt},
        {role: "user", content: userPrompt}
    ]

    const completion = await deepSeek.chat.completions.create({
        model: "deepseek-chat",
        messages: messages,
        response_format: {
            type: 'json_object'
        }
    });
    
    return JSON.parse(completion.choices[0].message.content);
}

module.exports = {
    isValidDocumentMetadata,
    cleanupDocumentMetadata,
    inferDocumentMetadata,
    documentEntryTemplate,
    documentMetadataNull,
}

//DEPRECATED

//unused for now - meant to assist in minimizing ai reliance and time spent reviewing metadata by a human.
//const deterministicFields = ["title", "authors", "publisher", "publication_year"]

// async function extractPDF(path) {
//     let dataBuffer = await fs.promises.readFile(path);
//     try {
//         pdfObj = await pdf(dataBuffer)
//         console.log(pdfObj.info)
//     } catch(error) {
//         console.error(error);
//     }
// }

// async function extractNPdfPages(path, n) {
   
//     //THE BELOW FUNCTION COMES FROM THE 'pdf-parse' NPM PACKAGE DOCUMENTATION, SUBJECT TO IMPROVEMENT.
//     // default render callback
//     function render_page(pageData) {
//         //check documents https://mozilla.github.io/pdf.js/
//         let render_options = {
//             //replaces all occurrences of whitespace with standard spaces (0x20). The default value is `false`.
//             normalizeWhitespace: false,
//             //do not attempt to combine same line TextItem's. The default value is `false`.
//             disableCombineTextItems: false
//         }
    
//         return pageData.getTextContent(render_options)
//         .then(function(textContent) {
//             let lastY, text = '';
//             for (let item of textContent.items) {
//                 if (lastY == item.transform[5] || !lastY){
//                     text += item.str;
//                 }  
//                 else{
//                     text += '\n' + item.str;
//                 }    
//                 lastY = item.transform[5];
//             }
//             return text;
//         });
//     }
    
//     let options = {
//         pagerender: render_page,
//         max: n
//     }
    
//     try {
//         let dataBuffer = await fs.promises.readFile(path);
//         let pdfData = await pdf(dataBuffer, options);
//         return pdfData;
//     } catch(error) {
//         console.error(error);
//     }
    
// }

// function getFileNameFromPath(path) {
//     const parts = path.split('/');
//     return parts[parts.length - 1];
// }

// function getCurrentDateYYYYMMDD() {
//     const today = new Date();
//     const year = today.getFullYear();
//     const month = String(today.getMonth() + 1).padStart(2, '0'); //Month is 0-indexed
//     const day = String(today.getDate()).padStart(2, '0'); //Ensure two digits

//     return `${year}-${month}-${day}`;
// }

// function getApproximateWordCountFromText(text) {
//     const words = text.split(" ")
//     return words.length
// }

// async function getNumCorpusItemsFromDatabase(domain, language) {
//     //TODO: rewrite for mongodb database logic.

//     return 1
// }

// async function createNewCorpusID(domain, language) {
//     try {
//         const numDatabaseItems = await getNumCorpusItemsFromDatabase(domain, language)
//         const suffix = String(numDatabaseItems + 1).padStart(3, '0')
//         return `${domain}-${language}_${numDatabaseItems + 1}`
//     } catch(error) {
//         console.error(error)
//     }
// }

// async function generateProcessingMetadata(domain, language, path, text) {
//     let processingMetadata = { ...documentEntryTemplate.processing_metadata }
    
//     try {
//         processingMetadata.submission_file_name = getFileNameFromPath(path)
//         processingMetadata.creation_date = getCurrentDateYYYYMMDD()
//         processingMetadata.word_count = getApproximateWordCountFromText(text)
//         processingMetadata.status = "corpus-JSON_pending"
//         processingMetadata.file_paths = {
//             original: path,
//             processed: `${domain}/${language}/${createNewCorpusID(domain, language)}.json`
//         }
//         processingMetadata.processing_notes = " "
//         return processingMetadata
//     } catch(error) {
//         console.error(error)
//     }
// }

// async function pushCorpusMetadataToDatabase(domain, language, metadata) {
//     //TODO: do mongodb logic instead of json db logic.
    
//     const jsonDatabasePath = `../../corpora/${domain}/${language}`

//     let database = JSON.parse(fs.readFileSync(jsonDatabasePath))
    
//     try {
//         database[await createNewCorpusID(domain, language)] = metadata
//         fs.writeFileSync(jsonDatabasePath, JSON.stringify(database))
//     } catch(error) {
//         console.error(error)
//     }
// }


 
