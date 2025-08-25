// utils_metadata.js - Updated to use centralized configuration
// Originally written by Abdurrahman Alyajouri

const fs = require('fs');
const openAI = require('openai');
const config = require('./config');

// Use centralized configuration for DeepSeek API
const deepSeek = new openAI({
    baseURL: `https://${config.deepseekApiConfig.host}`,
    apiKey: config.deepseekApiKey
});

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
};

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
};

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

function isValidDocumentMetadata(metadata) {
    const reference = documentEntryTemplate.document_metadata;
    let result = {
        valid: true,
        passedKeys: []
    };

    if (typeof metadata !== 'object') {
        console.error("Validation failed: metadata is not an object");
        result.valid = false;
        return result;
    }

    const referenceKeys = Object.keys(reference).sort();
    const suspectKeys = Object.keys(metadata).sort();

    // Key count test
    const matchesLength = referenceKeys.length === suspectKeys.length;
    if (!matchesLength) {
        console.error(`Validation failed: key count mismatch. Expected ${referenceKeys.length}, got ${suspectKeys.length}`);
        result.valid = false;
    }

    // Key presence test
    const matchesKeys = referenceKeys.every((key, i) => key === suspectKeys[i]);
    if (!matchesKeys) {
        console.error(`Validation failed: key mismatch. Expected keys: ${referenceKeys.join(', ')}, got: ${suspectKeys.join(', ')}`);
        result.valid = false;
    }

    // Individual field validations
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
            result.valid = false;
        } else {
            result.passedKeys.push(key);
        }
    }

    return result;
}

function cleanupDocumentMetadata(metadata) {
    // Ensure all array fields contain unique values and the maximum allowed number of values
    metadata.point_of_view = [...new Set(metadata.point_of_view)];
    metadata.audience = [...new Set(metadata.audience)];
    metadata.reach = [...new Set(metadata.reach)];
    metadata.topics = [...new Set(metadata.topics)];

    // Cap the number of topics at the configured maximum
    const maxTopics = config.processing.metadata.max_topics || 10;
    metadata.topics = metadata.topics.slice(0, maxTopics);
}

async function inferDocumentMetadata(text) {
    // Use configuration for max words to read
    const maxWords = config.processing.metadata.max_words_to_read || 1000;
    const words = text.split(/\s+/);
    const limitedText = words.slice(0, maxWords).join(' ');

    // Prompt engineering
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
    `;

    const additionalNotesPrompt = `
        Special instructions for the fields: "point_of_view", "audience", and "reach":

        - These three fields may contain **multiple values**, not just one.
        - When filling these fields, return them as **arrays** (even if only one value is chosen).
        - Use your best judgment to select one or more values that apply.
        - If a value is clearly stated or strongly implied in the excerpt, include it.
        - If nothing at all can be inferred, use the string "undefined" (do not leave it empty or null).

        Only these three fields may be multi-valued unless explicitly told otherwise.
    `;

    const metadataTemplate = JSON.stringify(documentEntryTemplate.document_metadata);
    const userPrompt = `${metadataTemplate} Excerpt: ${limitedText}`;

    let messages = [
        {role: "system", content: systemPrompt + "\n" + additionalNotesPrompt},
        {role: "user", content: userPrompt}
    ];

    try {
        const completion = await deepSeek.chat.completions.create({
            model: config.deepseekApiConfig.model,
            messages: messages,
            response_format: {
                type: 'json_object'
            },
            temperature: config.processing.text_cleanup.temperature || 0.1,
            max_tokens: config.processing.text_cleanup.max_tokens || 8000
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Failed to call DeepSeek API for metadata inference:', error.message);
        throw error;
    }
}

// Helper function to get current date in YYYY-MM-DD format
function getCurrentDateYYYYMMDD() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to get approximate word count
function getApproximateWordCountFromText(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Generate processing metadata with current config
function generateProcessingMetadata(submissionFileName, wordCount, originalPath = '', processedPath = '') {
    return {
        submission_file_name: submissionFileName,
        creation_date: getCurrentDateYYYYMMDD(),
        word_count: wordCount,
        status: "vectorization_pending",
        file_paths: {
            original: originalPath,
            processed: processedPath || `${config.domain}/${config.language.family}/${config.getItemFilename('XXX')}`
        },
        processing_notes: "Generated using automated metadata inference"
    };
}

module.exports = {
    isValidDocumentMetadata,
    cleanupDocumentMetadata,
    inferDocumentMetadata,
    documentEntryTemplate,
    documentMetadataNull,
    generateProcessingMetadata,
    getCurrentDateYYYYMMDD,
    getApproximateWordCountFromText
};