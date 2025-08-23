# Corpus Auto Processing - JSON Content Files

A tool to help speed up the process of creating JSON content files from corpora for the Pragmatic Auto-Translator project. This program was written by Evelyn Johnson.

This program is intended to be used BEFORE the Corpus Metadata Inference program (metadata_README). The logic behind this is that after doing the step-by-step review of the contents of a corpus item, the human processer will be more informed in carrying out the verification of the metadata generated for that item.

Note: Does not do well with double column papers or for Simplified Chinese

Note: For each corpus item, two types of JSON content need to be generated: the metadata (data about the data) and the contents of document. This README address the semi-automatic creation of the JSON for the contents of a corpus document. To learn how to generate the JSON metadata for a document, please see the metadata_README.

## System Requirements
### Required NPM Packages
- pdf-poppler (npm install pdf-poppler)
- tesseract.js (npm install tesseract.js)
- sharp (npm install sharp)
- Windows users may need Windows Build Tools

### Supported Languages
- Can add languages in pdfToText.js, line 17: lang: ''
- Examples: English (eng), Spanish (spa), Simplified Chinese (chi_sim)
- List of languages: https://github.com/tesseract-ocr/tessdata
- The language listed first has priority - so if you're analyzing a mostly Chinese text with a few English words, you would put lang: 'chi_sim+eng', but if you're analyizing an English text with some Chinese, you would put 'eng+chi_sim'

## (Semi) Auto-Processing Procedure
**Input/Output Folders:**
- pdf_to_text_input/ (source PDFs)
- pdf_to_text_output/ (extracted text files)
- text_to_json_input/ (cleaned text files)
- text_to_json_output/ (final json files)
- temp_images/ (temporary image files)

### 1. PDF -> Text (pdfToText.js)
**Dependencies:** Uses pdf-poppler (PDF → images), Tesseract.js (OCR), and sharp (image preprocessing).

**Convert PDF to Images**
- Split each PDF page into high-resolution (600 DPI) PNGs using pdf-poppler.
- Images are saved in temp_images/{pdf_name}/page_*.png.

**Preprocess Images**
- Resize to 2480px width.
- Convert to grayscale, apply threshold (180), and sharpen.
- Outputs raw OCR text, confidence score, and word count per page.

**Post-Process Text Cleaning Rules**
- Title Detection: Uses regex patterns (e.g., CHAPTER 1, Appendix A).
- Paragraph Joining: Merges lines if they’re continuations (e.g., no end punctuation, starts with parentheses).
- Noise Removal: Skips repeating headers/footers (e.g., page numbers, all-caps lines).
- List Detection: Identifies bullet points (-, •) or numbered items (1., a)).

**Cleanup**
- Final text saved as {pdf_name}.txt in pdf_to_text_output/.
- Metadata: Average OCR confidence, total words, and page count logged.
- Delete temporary images and folders.

### 2. Text Cleanup (pdfTextCleanup.js)
**Prepare Input Text**
- Input is the raw OCR text files from pdf_to_text_output/ folder.
- Splits text into chunks (max 5000 chars) while preserving paragraphs.
- Handles edge cases (long sentences/paragraphs) with smart splitting at punctuation/word boundaries.

**Clean Text via DeepSeek AI**<br/>
API Call:
- Sends each chunk to DeepSeek AI with a strict SYSTEM_PROMPT to:
- Fix OCR errors (e.g., "firs" → "first").
- Remove metadata (headers/footers/timestamps).
- Preserve original structure (paragraphs, lists, sections marked with [NEW_SECTION_HEADER]).

**Save Cleaned Output**
- Saves processed text to text_to_json_input/{filename}.txt.
- Logs stats (char count reduction, processing time).
- Falls back to original text if API fails.
- Tracks success/failure rates per file.

### 3. Text to JSON (textToJson.js)
- Takes text files from an input directory
- Splits content into manageable chunks (max 5000 chars)
- Detects explicit section markers like [NEW_SECTION]
- Uses DeepSeek API to transform text chunks into JSON
- Preserves paragraph breaks (double newlines become separate paragraphs)
- Organizes content into sections/subsections when markers exist
- Merges processed chunks into final JSON structure
- Saves files with language codes and incrementing numbers (e.g., filename_eng_001.json)

## Execution Modes
Single File Mode: Run with a filename argument (e.g., run "node scripts/pdfToText.js yourDoc.pdf" in the root dir to run ONLY the yourDoc PDF through the pdfToText.js script).
Batch Mode: Run the full process from PDF to JSON with "npm start".
See package.json for other template run types.

### Testing/Processing Suggestion<br/>
For testing I recommend focusing on a single PDF and running it through each script individually. However, you can potentially run it through the whole process and edit it at the end. This is not ideal, since the main issue with the code comes from sectioning and separating paragraphs correctly, and the most time consuming part (if one were to do it all by hand) would be to format it into a JSON (which Deepseek can do quite well if given the correct sections).<br/>

Corpus processing process recommendation:
1. Place PDFs into PDF input folder (The more PDFs and the longer the PDFs, the longer each step will take).
2. Run "npm pdftxtonly", which will run the PDFs through pdftoText.js abd pdfTextCleanup.js, converting them into cleaned txt files, output in text_to_json_input.
3. Fix section/subsection headers, paragraph spacing, and any typos here. It took me about 30 minutes to read through and section off ~3500 words (The Age of Al has begun by Bill Gates).
4. Run "npm texttojson" which will convert all the files in the text_to_json_input folder into JSONS. There should be minimal error in this step, because sections have already been fixed by the reviewer in Step 3.
5. Fix any additional errors if needed.<br/>
