// pdfTextCleanup.js written by Evelyn Johnson

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const API_KEY = 'sk-5121dd6d7f1d4cceb78e5443cfa95af4';
const API_HOST = 'api.deepseek.com';
const API_PATH = '/v1/chat/completions';
const INPUT_FOLDER = 'corpus_items/pdf_to_text_output';
const OUTPUT_FOLDER = 'corpus_items/text_to_json_input';
const MAX_CHUNK_SIZE = 5000;

const SYSTEM_PROMPT = `Your job is to clean up OCR-processed text while preserving ALL original content and structure:

Remove titles, subtitles, and article information that are not part of the main content.

INSTRUCTIONS:
1. Fix OCR errors and complete incomplete words (e.g., "firs" → "first")
2. Remove unnecessary symbols, artifacts and garbage characters that don't belong in normal text
3. Remove timestamps, page numbers, headers, footers, and other metadata that are clearly not part of the main content
4. Maintain the logical flow and paragraph structure of the original text
5. If the first sentence of a paragraph seems to be a continuation of the previous paragraph, connect them appropriately
6. Remove obvious duplicate text that appears to be OCR errors
7. Label the section headers with [NEW_SECTION_HEADER] at the start of the line

CRITICAL RULES:
- Do NOT add section headers, titles, or formatting that wasn't in the original
- Do NOT remove sentences just because they are capitalized or look like titles
- Preserve the original paragraph breaks and structure
- Keep the same language as the original
- Maintain any important formatting like bullet points or numbered lists
- If text appears garbled and unrecoverable, leave it as is rather than removing it

Return ONLY the cleaned text with the same content and structure as the original, no explanations or additional commentary.`;

// Function to make API call to DeepSeek
async function callDeepSeekAPI(text) {
    console.log(`Making API call... (text length: ${text.length} chars)`);
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: `Clean up this OCR text:\n\n${text}`
                }
            ],
            max_tokens: 8000,
            temperature: 0.1,
            stream: false
        });

        const options = {
            hostname: API_HOST,
            port: 443,
            path: API_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
                console.log(`     Received data chunk: ${chunk.length} bytes`);
            });

            res.on('end', () => {
                console.log(`     Response complete: ${data.length} total bytes`);
                try {
                    const response = JSON.parse(data);
                    if (response.choices && response.choices[0] && response.choices[0].message) {
                        console.log(`     API call successful`);
                        resolve(response.choices[0].message.content.trim());
                    } else if (response.error) {
                        console.error(`     API Error:`, response.error);
                        reject(new Error(`API Error: ${response.error.message}`));
                    } else {
                        console.error(`     Unexpected response:`, response);
                        reject(new Error('Unexpected API response format'));
                    }
                } catch (error) {
                    console.error(`     Parse error:`, error.message);
                    console.error(`    Raw response:`, data.substring(0, 500));
                    reject(new Error(`Failed to parse API response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error(`     Request error:`, error.message);
            reject(new Error(`Request failed: ${error.message}`));
        });
        
        // Add timeout
        req.setTimeout(120000, () => {
            console.error(`     Request timeout`);
            req.destroy();
            reject(new Error('Request timeout'));
        });

        console.log(`     Sending request...`);
        req.write(postData);
        req.end();
        console.log(`     Request sent, waiting for response...`);
    });
}

// Function to split text into chunks// Function to split text into chunks
function splitTextIntoChunks(text, maxChunkSize) {
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/); // handles 1+ blank lines

    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
        // If adding this paragraph would exceed the limit
        if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // If the paragraph itself is too long, split it by sentences
            if (paragraph.length > maxChunkSize) {
                const sentences = paragraph.split(/(?<=[.!?])\s+/);
                let sentenceChunk = '';
                
                for (const sentence of sentences) {
                    // Check if adding this sentence would exceed the limit
                    if (sentenceChunk.length + sentence.length + 1 > maxChunkSize) {
                        if (sentenceChunk.trim()) {
                            chunks.push(sentenceChunk.trim());
                        }
                        
                        // If individual sentence is still too long, we need to force split
                        if (sentence.length > maxChunkSize) {
                            // Split the sentence at word boundaries, preferring to end at punctuation
                            let remainingSentence = sentence;
                            while (remainingSentence.length > maxChunkSize) {
                                let splitPoint = maxChunkSize;
                                
                                // Try to find a good break point (space, comma, semicolon, etc.)
                                const breakPoints = [' ', ',', ';', ':', '-'];
                                for (let i = maxChunkSize - 1; i >= maxChunkSize * 0.8; i--) {
                                    if (breakPoints.includes(remainingSentence[i])) {
                                        splitPoint = i + 1;
                                        break;
                                    }
                                }
                                
                                const chunk = remainingSentence.substring(0, splitPoint).trim();
                                if (chunk) {
                                    chunks.push(chunk);
                                }
                                remainingSentence = remainingSentence.substring(splitPoint).trim();
                            }
                            
                            if (remainingSentence.trim()) {
                                sentenceChunk = remainingSentence;
                            } else {
                                sentenceChunk = '';
                            }
                        } else {
                            sentenceChunk = sentence;
                        }
                    } else {
                        sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                    }
                }
                
                if (sentenceChunk.trim()) {
                    currentChunk = sentenceChunk;
                }
            } else {
                currentChunk = paragraph;
            }
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
    }
    
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

// Function to add delay between API calls
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to process a single text file
async function processTextFile(filePath) {
    const fileName = path.basename(filePath, '.txt');
    const outputPath = path.join(OUTPUT_FOLDER, `${fileName}.txt`);
    
    console.log(`\nProcessing: ${fileName}.txt`);
    
    try {
        // Read the input file
        const inputText = fs.readFileSync(filePath, 'utf8');
        
        if (!inputText.trim()) {
            console.log(`  File is empty: ${fileName}.txt`);
            fs.writeFileSync(outputPath, '', 'utf8');
            return true;
        }
        
        // Split text into chunks
        const chunks = splitTextIntoChunks(inputText, MAX_CHUNK_SIZE);
        console.log(`  Split into ${chunks.length} chunk(s)`);
        
        let cleanedText = '';
        
        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
            console.log(`  Processing chunk ${i + 1}/${chunks.length}...`);
            
            try {
                const cleanedChunk = await callDeepSeekAPI(chunks[i]);
                cleanedText += cleanedChunk;
                
                // Add spacing between chunks if needed
                if (i < chunks.length - 1 && !cleanedChunk.endsWith('\n\n')) {
                    cleanedText += '\n\n';
                }
            } catch (chunkError) {
                console.error(`    Error processing chunk ${i + 1}: ${chunkError.message}`);
                // Continue with original chunk if API fails
                cleanedText += chunks[i];
                if (i < chunks.length - 1) {
                    cleanedText += '\n\n';
                }
            }
            
            // Add delay to avoid rate limiting (increased to 2 seconds)
            if (i < chunks.length - 1) {
                await delay(2000);
            }
        }
        
        // Write the cleaned text to output file
        fs.writeFileSync(outputPath, cleanedText.trim(), 'utf8');
        console.log(`   Cleaned text saved to: ${fileName}.txt`);
        
        // Show some statistics
        const originalLength = inputText.length;
        const cleanedLength = cleanedText.length;
        const reduction = ((originalLength - cleanedLength) / originalLength * 100).toFixed(1);
        
        console.log(`   Original: ${originalLength} chars, Cleaned: ${cleanedLength} chars (${reduction}% reduction)`);
        
        return true;
        
    } catch (error) {
        console.error(` Error processing ${fileName}.txt:`, error.message);
        return false;
    }
}

// Main function to process all text files
async function processAllTextFiles() {
    console.log('='.repeat(60));
    console.log('OCR Cleanup with DeepSeek AI');
    console.log('='.repeat(60));
    
    try {
        // Check if input folder exists
        if (!fs.existsSync(INPUT_FOLDER)) {
            console.error(` Input folder '${INPUT_FOLDER}' does not exist!`);
            console.log('Please run the PDF to text conversion first.');
            return;
        }
        
        // Create output folder if it doesn't exist
        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
            console.log(` Created output folder: ${OUTPUT_FOLDER}`);
        }
        
        // Get all text files
        const files = fs.readdirSync(INPUT_FOLDER);
        const textFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));
        
        if (textFiles.length === 0) {
            console.log(`No text files found in '${INPUT_FOLDER}' folder.`);
            return;
        }
        
        console.log(`Found ${textFiles.length} text file(s) to process:`);
        textFiles.forEach((file, index) => {
            const filePath = path.join(INPUT_FOLDER, file);
            const stats = fs.statSync(filePath);
            const sizeKB = (stats.size / 1024).toFixed(1);
            console.log(`${index + 1}. ${file} (${sizeKB} KB)`);
        });
        
        console.log(`\nConfiguration:`);
        console.log(`   Max chunk size: ${MAX_CHUNK_SIZE} characters`);
        console.log(`   Output folder: ${OUTPUT_FOLDER}`);
        
        console.log('\nStarting text cleaning process...');
        
        let successful = 0;
        let failed = 0;
        const startTime = Date.now();
        
        // Process each file
        for (const textFile of textFiles) {
            const filePath = path.join(INPUT_FOLDER, textFile);
            const success = await processTextFile(filePath);
            
            if (success) {
                successful++;
            } else {
                failed++;
            }
            
            // Add delay between files to avoid rate limiting
            if (textFiles.indexOf(textFile) < textFiles.length - 1) {
                await delay(1000);
            }
        }
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '='.repeat(60));
        console.log('CLEANING PROCESS COMPLETE!');
        console.log(` Successfully processed: ${successful} files`);
        if (failed > 0) {
            console.log(` Failed to process: ${failed} files`);
        }
        console.log(` Total time: ${totalTime} seconds`);
        console.log(` Cleaned files saved in: ${OUTPUT_FOLDER}`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error(' Error during processing:', error.message);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n\n  Process interrupted by user.');
    console.log('Any completed files have been saved.');
    process.exit(0);
});

// Export functions for potential use in other scripts
module.exports = {
    processAllTextFiles,
    processTextFile,
    callDeepSeekAPI
};

if (require.main === module) {
    const arg = process.argv[2];

    if (arg) {
        const singleFilePath = path.join(INPUT_FOLDER, arg);
        if (!fs.existsSync(singleFilePath)) {
            console.error(` Specified file not found: ${singleFilePath}`);
        } else {
            processTextFile(singleFilePath).then(success => {
                if (success) {
                    console.log(` Finished processing ${arg}`);
                } else {
                    console.error(` Failed to process ${arg}`);
                }
            });
        }
    } else {
        processAllTextFiles();
    }
}
