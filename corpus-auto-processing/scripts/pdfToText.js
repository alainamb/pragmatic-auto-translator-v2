// pdfToText.js written by Evelyn Johnson

const fs = require('fs');
const path = require('path');
const poppler = require('pdf-poppler');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

const INPUT_FOLDER = 'corpus_items/pdf_to_text_input';
const OUTPUT_FOLDER = 'corpus_items/pdf_to_text_output';
const TEMP_FOLDER = 'corpus_items/temp_images';

[OUTPUT_FOLDER, TEMP_FOLDER].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function performOCR(imagePath, pageNumber) {
    const OCR_CONFIG = {
        lang: 'chi_sim+eng', // English (eng), Spanish (spa), Simplified Chinese (chi_sim)
        oem: 1,
        psm: 1,
        preserve_interword_spaces: 1,
        user_defined_dpi: 600,
    };

    try {
        if (!fs.existsSync(imagePath)) {
            console.error(`Image not found: ${imagePath}`);
            return { text: '', confidence: 0, wordCount: 0 };
        }

        const processedPath = await preprocessImage(imagePath);
        const result = await Tesseract.recognize(
            processedPath,
            OCR_CONFIG.lang,
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        process.stdout.write(`\rOCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
                ...OCR_CONFIG
            }
        );

        process.stdout.write('\n');
        const { data: { text, confidence, words } } = result;
        const cleanedText = postProcessText(text);
        const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

        if (processedPath !== imagePath) fs.unlinkSync(processedPath);
        return { text: cleanedText, confidence, wordCount };
    } catch (error) {
        console.error(`OCR failed on page ${pageNumber}:`, error.message);
        return { text: '', confidence: 0, wordCount: 0 };
    }
}

async function preprocessImage(imagePath) {
    try {
        const processedPath = imagePath.replace('.png', '_processed.png');
        await sharp(imagePath)
            .resize({ width: 2480 })
            .grayscale()
            .threshold(180)
            .sharpen()
            .png({ quality: 100 })
            .toFile(processedPath);
        return processedPath;
    } catch {
        return imagePath;
    }
}

function isLikelyTitle(line, nextLine = '', prevLine = '') {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Common title patterns
    const titlePatterns = [
        /^(CHAPTER|Chapter|Section|SECTION)\s+\d+/i,
        /^(Abstract|Introduction|Conclusion|Summary|References|Bibliography|Appendix)/i,
        /^[A-Z][A-Z\s]{3,}$/,  // ALL CAPS titles
        /^\d+\.\s+[A-Z]/,      // Numbered sections (1. Title)
        /^[A-Z][^.!?]*[^.!?]$/, // Starts with capital, no ending punctuation
        /^(I|II|III|IV|V|VI|VII|VIII|IX|X)[.)]\s+[A-Z]/i,   // e.g., I. INTRODUCTION
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/,              // e.g., "Related Work", "Model Architecture"
        /^(Appendix|Appendices)\s+[A-Z]/i, // e.g., "Appendix A: Title"
        /^\d+\.\d+\s+[A-Z]/, // e.g., "1.1 Introduction"
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/, // e.g., "Machine Learning Techniques"
        /^([A-Z][a-z]+[\s-])*[A-Z][a-z]+$/, // e.g., "Deep Learning in Computer Vision"
    ];

    const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 2;
    const isShort = trimmed.length < 60;
    const hasNoEndPunctuation = !/[.!?]$/.test(trimmed);
    const nextLineStartsCapital = /^[A-Z]/.test(nextLine.trim());
    const prevLineEmpty = !prevLine.trim();

    // Check patterns
    if (titlePatterns.some(pattern => pattern.test(trimmed))) return true;

    // Heuristic: short line, no punctuation, followed by text or empty line
    if (isShort && hasNoEndPunctuation && (nextLineStartsCapital || !nextLine.trim())) {
        return true;
    }

    // All caps and short
    if (isAllCaps && isShort) return true;

    return false;
}

function isRepeatingLine(line, prevLine, nextLine) {
    const footerOrHeaderPatterns = [
        /^\d+$/, // page numbers
        /^Page\s+\d+/i,
        /^[A-Z ]{10,}$/, // e.g., DOCUMENT TITLE or headers in all caps
    ];
    return footerOrHeaderPatterns.some(p => p.test(line.trim()));
}

function isLikelyListItem(line) {
    const trimmed = line.trim();
    return /^[\-•*]\s+/.test(trimmed) ||
        /^\d+\.\s+/.test(trimmed) ||
        /^[a-zA-Z]\.\s+/.test(trimmed) ||
        /^\([a-zA-Z0-9]+\)\s+/.test(trimmed);
}

function shouldJoinWithPrevious(currentLine, previousLine) {
    if (!previousLine || !currentLine) return false;

    const prevTrimmed = previousLine.trim();
    const currTrimmed = currentLine.trim();

    if (!prevTrimmed || !currTrimmed) return false;

    // Don't join if current line looks like a title
    if (isLikelyTitle(currTrimmed)) return false;

    // Don't join if current line is a list item
    if (isLikelyListItem(currTrimmed)) return false;

    const prevEndsWithSentence = /[.!?]["']?$/.test(prevTrimmed);
    const currStartsWithCapital = /^[A-Z]/.test(currTrimmed);
    const currStartsWithParen = /^\(/.test(currTrimmed);
    const prevEndsWithColon = /[:：]$/.test(prevTrimmed);
    const prevEndsWithAbbrev = /\b(e\.g|i\.e|etc)\.$/i.test(prevTrimmed);

    // Join if previous ends with colon (likely continuation)
    if (prevEndsWithColon) return true;

    // Join if current starts with parenthesis (likely continuation)
    if (currStartsWithParen) return true;

    // Join if previous ends with abbreviation (not end of paragraph)
    if (prevEndsWithAbbrev) return true;

    // Join if prev doesn't end sentence and current doesn't start with capital
    if (!prevEndsWithSentence && !currStartsWithCapital) return true;

    // Join if previous ends with comma, dash, or is incomplete
    if (/[,\-–—]$/.test(prevTrimmed)) return true;

    // Join if previous is short and doesn't end with punctuation
    if (prevTrimmed.length < 40 && !prevEndsWithSentence && currStartsWithCapital) {
        return true;
    }

    return false;
}

function postProcessText(text) {
    if (!text) return '';

    const lines = text
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.trimEnd());

    let result = '';
    let currentParagraph = '';

    for (let i = 0; i < lines.length; i++) {
        const current = lines[i];
        const next = lines[i + 1] || '';
        const previous = lines[i - 1] || '';
        const isEmpty = current.trim() === '';

        // Handle empty lines
        if (isEmpty) {
            if (currentParagraph.trim()) {
                result += currentParagraph.trim() + '\n\n';
                currentParagraph = '';
            }
            continue;
        }

        if (isRepeatingLine(current, previous, next)) continue;

        // Check if this line should be treated as a title/header
        if (isLikelyTitle(current, next, previous)) {
            // Finish current paragraph if exists
            if (currentParagraph.trim()) {
                result += currentParagraph.trim() + '\n\n';
                currentParagraph = '';
            }
            // Add title with extra spacing
            result += current.trim() + '\n\n';
            continue;
        }

        // Check if this line should join with previous
        if (shouldJoinWithPrevious(current, currentParagraph)) {
            currentParagraph += (currentParagraph ? ' ' : '') + current.trim();
        } else {
            // Start new paragraph
            if (currentParagraph.trim()) {
                result += currentParagraph.trim() + '\n\n';
            }
            currentParagraph = current.trim();
        }

        // Check if this line completes a paragraph
        const endsWithSentence = /[.!?]["']?$/.test(current.trim()) && !/\b(e\.g|i\.e|etc)\.$/i.test(current.trim());
        const nextIsEmpty = !next.trim();
        const nextIsTitle = isLikelyTitle(next, lines[i + 2] || '', current);
        const nextStartsNewSentence = /^[A-Z(]/.test(next.trim()); // allow open paren to continue



        if (endsWithSentence && (nextIsEmpty || nextIsTitle ||
            (nextStartsNewSentence && !shouldJoinWithPrevious(next, currentParagraph)))) {
            if (currentParagraph.trim()) {
                result += currentParagraph.trim() + '\n\n';
                currentParagraph = '';
            }
        }
    }

    // Add any remaining paragraph
    if (currentParagraph.trim()) {
        result += currentParagraph.trim();
    }

    return result.trim();
}

async function pdfToImages(pdfPath, outputDir) {
    const options = {
        format: 'png',
        out_dir: outputDir,
        out_prefix: 'page',
        dpi: 600,
        use_pdftocairo: true,
    };

    await poppler.convert(pdfPath, options);
    return fs.readdirSync(outputDir)
        .filter(file => file.startsWith('page') && file.endsWith('.png'))
        .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
        .map(file => path.join(outputDir, file));
}

async function processPDF(pdfPath) {
    const pdfName = path.basename(pdfPath, '.pdf');
    const outputTextPath = path.join(OUTPUT_FOLDER, `${pdfName}.txt`);
    const tempDir = path.join(TEMP_FOLDER, pdfName);

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const imageFiles = await pdfToImages(pdfPath, tempDir);
    if (imageFiles.length === 0) {
        console.error(`No images generated from ${pdfPath}`);
        return;
    }

    let fullText = '';
    let totalConfidence = 0, totalWords = 0;

    console.log('\n' + '='.repeat(60));
    console.log(`Processing Document: ${pdfName}`);
    console.log(`Total Pages: ${imageFiles.length}`);
    console.log('='.repeat(60) + '\n');

    for (let i = 0; i < imageFiles.length; i++) {
        const page = i + 1;
        console.log(`${pdfName} - Processing page ${page}/${imageFiles.length}`);

        const result = await performOCR(imageFiles[i], page);
        totalConfidence += result.confidence;
        totalWords += result.wordCount;

        if (result.text) {
            fullText += result.text + '\n\n';
        } else {
            console.warn(`${pdfName} - No text found on page ${page}`);
        }
    }

    const avgConfidence = Math.round(totalConfidence / imageFiles.length);
    fs.writeFileSync(outputTextPath, fullText.trim() + '\n', 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log(`Finished Processing: ${pdfName}`);
    console.log('='.repeat(60));
    console.log(`Pages Processed: ${imageFiles.length}`);
    console.log(`Total words: ${totalWords}`);
    console.log(`Avg confidence: ${avgConfidence}%`);
    console.log(`Output saved to: ${outputTextPath}`);
    console.log('='.repeat(60) + '\n');

    cleanupTempFiles(tempDir);
}

function cleanupTempFiles(tempDir) {
    try {
        fs.readdirSync(tempDir).forEach(file => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        fs.rmdirSync(tempDir);
    } catch (err) {
        console.warn(`⚠️ Error cleaning up ${tempDir}:`, err.message);
    }
}

async function processAllPDFs() {
    console.log('='.repeat(60));
    console.log('PDF TO TEXT CONVERTER');
    console.log('='.repeat(60));

    if (!fs.existsSync(INPUT_FOLDER)) {
        console.error(` Input folder '${INPUT_FOLDER}' not found.`);
        return;
    }

    const pdfFiles = fs.readdirSync(INPUT_FOLDER)
        .filter(file => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
        console.log(`No PDF files found in '${INPUT_FOLDER}'.`);
        return;
    }

    for (const pdfFile of pdfFiles) {
        const pdfPath = path.join(INPUT_FOLDER, pdfFile);
        await processPDF(pdfPath);
    }
}

// === Entry point ===
if (require.main === module) {
    const singleFileArg = process.argv[2];
    if (singleFileArg) {
        const singlePath = path.join(INPUT_FOLDER, singleFileArg);
        if (!fs.existsSync(singlePath)) {
            console.error(` Specified file not found: ${singlePath}`);
        } else {
            processPDF(singlePath);
        }
    } else {
        processAllPDFs();
    }
}