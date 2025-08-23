// textToJson.js written by Evelyn Johnson

const fs = require('fs');
const path = require('path');
const https = require('https');
// Configuration
const API_KEY = 'sk-5121dd6d7f1d4cceb78e5443cfa95af4';
const API_HOST = 'api.deepseek.com';
const API_PATH = '/v1/chat/completions';
const INPUT_DIR = 'corpus_items/text_to_json_input';
const OUTPUT_DIR = 'corpus_items/text_to_json_output';
const MAX_CHUNK_SIZE = 5000;
// Ensure directories exist
[INPUT_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});
// Function to check if the entire text contains section markers
function hasExplicitSectionMarkers(text) {
  const markers = [
    '[NEW_SECTION]',
    '[NEW_SECTION_HEADER]',
    '[NEW_SUBSECTION]',
    '[NEW_SUBSECTION_HEADER]',
    '[NEW_SUBSUBSECTION]',
    '[NEW_SUBSUBSECTION_HEADER]'
  ];

  return markers.some(marker => text.includes(marker));
}
function generateSystemPrompt(hasMarkers) {
  if (hasMarkers) {
    return `Convert the following plain text into JSON following this exact schema:

STRICT PARAGRAPH RULES:
1. EVERY double newline (blank line) MUST create a new paragraph
2. NEVER combine multiple paragraphs into one unless they're part of the same logical block
3. PRESERVE all paragraph breaks from the original text

STRICT SECTION RULES:
1. ONLY create sections when you see these EXACT markers:
   - [NEW_SECTION] - starts new main section
   - [NEW_SECTION_HEADER] Title - starts new main section with title
   - [NEW_SUBSECTION] - starts new subsection in current section
   - [NEW_SUBSECTION_HEADER] Title - starts new subsection with title
   - [NEW_SUBSUBSECTION] - starts new sub-subsection in current subsection
   - [NEW_SUBSUBSECTION_HEADER] Title - starts new sub-subsection with title
2. CONTINUE current section if no markers are present
3. NEVER start new sections automatically
4. Remove all markers from output

{
  "document_id": "gai-language (eng, esp, zho)-itemXXX",
  "content": {
    "abstract": "",
    "sections": [
      {
        "id": "section_1",
        "title": "Section Title",
        "paragraphs": [
          {
            "id": "p1_1",
            "text": "paragraph text"
          }
        ],
        "subsections": [
          {
            "id": "section_1_1",
            "title": "Subsection Title",
            "paragraphs": [
              {
                "id": "p1_1_1",
                "text": "paragraph text"
              }
            ],
            "subsubsections": [
              {
                "id": "section_1_1_1",
                "title": "Sub-subsection Title",
                "paragraphs": [
                  {
                    "id": "p1_1_1_1",
                    "text": "paragraph text"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
  
REQUIREMENTS:
1. Use straight quotes "" and apostrophes '' only, overwrite any curly quotes
2. Use backslashes to escape quotes within text: "He said \\"Hello\\""
3. Do not include any metadata or file information
4. Remove in-line markers, headers, footers, page numbers, authors, and non-content text
5. Remove footnote numbers from paragraph text entirely
6. If no abstract is provided, do not include the "abstract" field.
7. Remove marker text ([NEW_SECTION], [NEW_SECTION_HEADER], etc.) from the final output

ID NAMING CONVENTIONS:
- Section IDs: section_1, section_2, etc.
- Subsection IDs: section_1_1, section_2_1, etc.
- Paragraph IDs: p1_1 (section 1, para 1), p1_2_1 (section 1, subsection 2, para 1)

OPTIONAL ARRAYS AT THE END OF THE DOCUMENT (only include if present):
- figures: Only if document contains figures
- tables: Only if document contains tables

Return ONLY the JSON, no explanations or additional text.`;
  } else {
    return `Convert the following plain text into JSON following this exact schema:

STRICT PARAGRAPH RULES:
1. EVERY double newline (blank line) MUST create a new paragraph
2. NEVER combine multiple paragraphs into one
3. PRESERVE all paragraph breaks from the original text

STRICT NO-SECTION RULES:
1. Since this document contains NO explicit section markers, DO NOT create any sections
2. Return ONLY paragraphs
3. Do not try to infer sections from formatting

{
  "document_id": "gai-language (eng, esp, zho)-itemXXX",
  "content": {
    "abstract": "",
    "paragraphs": [
      {
        "id": "p1_1",
        "text": "paragraph text"
      }
    ]
  }
}
  
REQUIREMENTS:
1. Use straight quotes "" and apostrophes '' only, overwrite any curly quotes
2. Use backslashes to escape quotes within text: "He said \\"Hello\\""
3. Do not include any metadata or file information
4. Remove in-line markers, headers, footers, page numbers, authors, and non-content text
5. Remove footnote numbers from paragraph text entirely
6. If no abstract is provided, do not include the "abstract" field.
7. Return ONLY paragraphs - sections will be created during merge process
ID NAMING CONVENTIONS:
- Paragraph IDs: p1_1, p1_2, p1_3, etc. (will be renumbered during merge)
OPTIONAL ARRAYS AT THE END OF THE DOCUMENT (only include if present):
- figures: Only if document contains figures
- tables: Only if document contains tables
Return ONLY the JSON, no explanations or additional text.`;
  }
}

function preprocessText(text) {
  // Normalize all line endings to \n
  text = text.replace(/\r\n/g, '\n');
  
  // Replace multiple newlines with exactly two
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim each line but preserve empty lines between paragraphs
  const lines = text.split('\n');
  return lines.map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // Ensure exactly two newlines between paragraphs
}

function replaceCurlyQuotes(text) {
  return text.replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-'); // Replace em/en dashes with regular dashes
}

function cleanTextFormatting(text) {
  // Remove bold/italic markdown formatting
  text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove **bold**
  text = text.replace(/\*(.*?)\*/g, '$1'); // Remove *italic*
  text = text.replace(/__(.*?)__/g, '$1'); // Remove **bold**
  text = text.replace(/_(.*?)_/g, '$1'); // Remove *italic*

  // Remove footnote references (numbers in brackets or superscript)
  text = text.replace(/\[\d+\]/g, ''); // Remove [1], [2], etc.
  text = text.replace(/\(\d+\)/g, ''); // Remove (1), (2), etc.

  // Clean up extra spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
async function detectLanguage(text) {
  // Simple heuristic-based language detection
  const spanishWords = [' el ', ' la ', ' los ', ' las ', ' y ', ' en ', ' de ', ' que '];
  const chineseChars = /[\u4e00-\u9fff]/;

  const sampleText = text.substring(0, 1000).toLowerCase();

  // Check for Chinese characters
  if (chineseChars.test(sampleText)) {
    return 'zho';
  }

  // Check for Spanish words
  const spanishCount = spanishWords.reduce((count, word) =>
    count + (sampleText.includes(word) ? 1 : 0), 0);

  if (spanishCount >= 3) {
    return 'esp';
  }

  // Default to English
  return 'eng';
}
// Modified document ID generation
async function generateDocumentId(originalFilename, fileContent) {
  const lang = await detectLanguage(fileContent);
  let index = 1;
  let outputPath;

  // Find the next available index
  do {
    const paddedIndex = String(index).padStart(3, '0');
    outputPath = path.join(OUTPUT_DIR, `${originalFilename}_${lang}_${paddedIndex}.json`);
    index++;
  } while (fs.existsSync(outputPath));

  return {
    documentId: `${originalFilename}_${lang}_${String(index - 1).padStart(3, '0')}`,
    outputPath
  };
}
// Simplified section structure normalization - no automatic merging
function normalizeSectionStructure(jsonObj) {
  if (!jsonObj.content || !jsonObj.content.sections) return jsonObj;

  // Clean section and subsection text without merging logic
  jsonObj.content.sections.forEach((section, index) => {
    // Clean section title
    if (section.title) {
      section.title = cleanTextFormatting(section.title);
      // Remove section markers if they somehow remain
      section.title = section.title.replace(/^\[NEW_SECTION_HEADER\]\s*/, '');
      section.title = section.title.replace(/^\[NEW_SECTION\]\s*/, '');
    }

    // Clean paragraph text
    if (section.paragraphs) {
      section.paragraphs.forEach(paragraph => {
        if (paragraph.text) {
          paragraph.text = cleanTextFormatting(replaceCurlyQuotes(paragraph.text));
        }
      });
    }

    // Clean subsection text
    if (section.subsections) {
      section.subsections.forEach(subsection => {
        if (subsection.title) {
          subsection.title = cleanTextFormatting(subsection.title);
          // Remove subsection markers if they somehow remain
          subsection.title = subsection.title.replace(/^\[NEW_SUBSECTION_HEADER\]\s*/, '');
          subsection.title = subsection.title.replace(/^\[NEW_SUBSECTION\]\s*/, '');
        }
        if (subsection.paragraphs) {
          subsection.paragraphs.forEach(paragraph => {
            if (paragraph.text) {
              paragraph.text = cleanTextFormatting(replaceCurlyQuotes(paragraph.text));
            }
          });
        }

        // Clean sub-subsection text - Fixed scoping issue
        if (subsection.subsubsections) {
          subsection.subsubsections.forEach(subsubsection => {
            if (subsubsection.title) {
              subsubsection.title = cleanTextFormatting(subsubsection.title);
              // Remove sub-subsection markers if they somehow remain
              subsubsection.title = subsubsection.title.replace(/^\[NEW_SUBSUBSECTION_HEADER\]\s*/, '');
              subsubsection.title = subsubsection.title.replace(/^\[NEW_SUBSUBSECTION\]\s*/, '');
            }
            if (subsubsection.paragraphs) {
              subsubsection.paragraphs.forEach(paragraph => {
                if (paragraph.text) {
                  paragraph.text = cleanTextFormatting(replaceCurlyQuotes(paragraph.text));
                }
              });
            }
          });
        }
      });
    }
  });

  return jsonObj;
}

function splitTextIntoChunks(text, maxChunkSize) {
  // First split by double newlines to preserve paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  let chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const cleanParagraph = paragraph.trim();

    // If adding this paragraph would exceed the limit (with 2 newlines)
    if (currentChunk.length + cleanParagraph.length + 2 > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If paragraph itself is too large, split by sentences
      if (cleanParagraph.length > maxChunkSize) {
        const sentences = cleanParagraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 > maxChunkSize) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
          }
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      } else {
        currentChunk = cleanParagraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanParagraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function validateAndFixJsonStructure(jsonObj, documentId) {
  const result = {
    document_id: documentId,
    content: {}
  };

  // Handle abstract if it exists
  if (jsonObj.content?.abstract?.trim() && jsonObj.content.abstract.trim().length > 10) {
    result.content.abstract = cleanTextFormatting(
      replaceCurlyQuotes(jsonObj.content.abstract.trim())
    );
  }

  // Handle documents with sections
  if (jsonObj.content?.sections && Array.isArray(jsonObj.content.sections)) {
    result.content.sections = [];
    let sectionCounter = 1;

    jsonObj.content.sections.forEach((section) => {
      if (!section.title || !section.paragraphs) return;

      const processedSection = {
        id: `section_${sectionCounter}`,
        title: cleanTextFormatting(section.title.trim()),
        paragraphs: []
      };

      // Process paragraphs - ensure each is separate
      if (Array.isArray(section.paragraphs)) {
        section.paragraphs.forEach((para, paraIdx) => {
          if (para.text?.trim()) {
            // Split text by double newlines if they were combined
            const paragraphs = para.text.split(/\n\s*\n/).filter(p => p.trim());
            paragraphs.forEach((p, idx) => {
              processedSection.paragraphs.push({
                id: `p${sectionCounter}_${paraIdx + 1 + idx}`,
                text: cleanTextFormatting(replaceCurlyQuotes(p.trim()))
              });
            });
          }
        });
      }

      // Process subsections
      if (Array.isArray(section.subsections)) {
        processedSection.subsections = [];
        let subsectionCounter = 1;

        section.subsections.forEach((subsec) => {
          if (!subsec.title || !subsec.paragraphs) return;

          const processedSubsection = {
            id: `section_${sectionCounter}_${subsectionCounter}`,
            title: cleanTextFormatting(subsec.title.trim()),
            paragraphs: []
          };

          if (Array.isArray(subsec.paragraphs)) {
            subsec.paragraphs.forEach((para, paraIdx) => {
              if (para.text?.trim()) {
                // Split text by double newlines if they were combined
                const paragraphs = para.text.split(/\n\s*\n/).filter(p => p.trim());
                paragraphs.forEach((p, idx) => {
                  processedSubsection.paragraphs.push({
                    id: `p${sectionCounter}_${subsectionCounter}_${paraIdx + 1 + idx}`,
                    text: cleanTextFormatting(replaceCurlyQuotes(p.trim()))
                  });
                });
              }
            });
          }

          // Process sub-subsections
          if (Array.isArray(subsec.subsubsections)) {
            processedSubsection.subsubsections = [];
            let subsubsectionCounter = 1;

            subsec.subsubsections.forEach((subsubsec) => {
              if (!subsubsec.title || !subsubsec.paragraphs) return;

              const processedSubSubsection = {
                id: `section_${sectionCounter}_${subsectionCounter}_${subsubsectionCounter}`,
                title: cleanTextFormatting(subsubsec.title.trim()),
                paragraphs: []
              };

              if (Array.isArray(subsubsec.paragraphs)) {
                subsubsec.paragraphs.forEach((para, paraIdx) => {
                  if (para.text?.trim()) {
                    // Split text by double newlines if they were combined
                    const paragraphs = para.text.split(/\n\s*\n/).filter(p => p.trim());
                    paragraphs.forEach((p, idx) => {
                      processedSubSubsection.paragraphs.push({
                        id: `p${sectionCounter}_${subsectionCounter}_${subsubsectionCounter}_${paraIdx + 1 + idx}`,
                        text: cleanTextFormatting(replaceCurlyQuotes(p.trim()))
                      });
                    });
                  }
                });
              }

              if (processedSubSubsection.paragraphs.length > 0) {
                processedSubsection.subsubsections.push(processedSubSubsection);
                subsubsectionCounter++;
              }
            });
          }

          if (processedSubsection.paragraphs.length > 0 || processedSubsection.subsubsections?.length > 0) {
            processedSection.subsections.push(processedSubsection);
            subsectionCounter++;
          }
        });
      }

      if (processedSection.paragraphs.length > 0 || processedSection.subsections?.length > 0) {
        result.content.sections.push(processedSection);
        sectionCounter++;
      }
    });
  }

  // Handle documents without sections
  else if (jsonObj.content?.paragraphs && Array.isArray(jsonObj.content.paragraphs)) {
    result.content.paragraphs = [];
    let paragraphCounter = 1;

    jsonObj.content.paragraphs.forEach((para) => {
      if (para.text?.trim()) {
        // Split text by double newlines if they were combined
        const paragraphs = para.text.split(/\n\s*\n/).filter(p => p.trim());
        paragraphs.forEach((p, idx) => {
          result.content.paragraphs.push({
            id: `p${paragraphCounter + idx}`,
            text: cleanTextFormatting(replaceCurlyQuotes(p.trim()))
          });
        });
        paragraphCounter += paragraphs.length;
      }
    });

    if (result.content.paragraphs.length === 0) {
      delete result.content.paragraphs;
    }
  }

  // Handle figures and tables
  if (jsonObj.content?.figures && Array.isArray(jsonObj.content.figures)) {
    result.content.figures = jsonObj.content.figures.map((fig, idx) => ({
      id: `figure_${idx + 1}`,
      caption: cleanTextFormatting((fig.caption || `Figure ${idx + 1}`).trim())
    }));
  }

  if (jsonObj.content?.tables && Array.isArray(jsonObj.content.tables)) {
    result.content.tables = jsonObj.content.tables.map((tbl, idx) => ({
      id: `table_${idx + 1}`,
      caption: cleanTextFormatting((tbl.caption || `Table ${idx + 1}`).trim())
    }));
  }

  return result;
}

async function callDeepSeekAPI(textChunk, chunkIndex, totalChunks, hasMarkers, currentSection, currentSubsection) {
  console.log(`    Making API call for chunk ${chunkIndex + 1}/${totalChunks}... (${textChunk.length} chars)`);

  // Generate the system prompt based on markers
  const systemPrompt = generateSystemPrompt(hasMarkers);

  let userPrompt;
  if (hasMarkers) {
    userPrompt = `CONTEXT:
    ${currentSection ? `Current Section: ${currentSection.title}` : 'No current section'}
    ${currentSubsection ? `Current Subsection: ${currentSubsection.title}` : ''}
    
    Convert this text chunk to JSON. Continue current section/subsection if no markers are present:
    ${textChunk}`;
  } else {
    userPrompt = `Convert this text chunk to JSON format. The document contains NO section markers, so return only paragraphs (no sections): \n\n${textChunk}`;
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: systemPrompt  // Now properly defined
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
      response_format: { type: 'json_object' }
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
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (response.choices && response.choices[0] && response.choices[0].message) {
            let contentString = response.choices[0].message.content.trim();

            // Try to parse the JSON response
            let jsonResult;
            try {
              jsonResult = JSON.parse(contentString);
            } catch (parseError) {
              // Try to extract JSON from markdown code blocks
              const jsonMatch = contentString.match(/```json\s*([\s\S]*?)```/);
              if (jsonMatch) {
                jsonResult = JSON.parse(jsonMatch[1]);
              } else {
                throw new Error('Could not parse JSON from response');
              }
            }
            console.log(`      Chunk ${chunkIndex + 1} processed successfully`);
            resolve(jsonResult);

          } else if (response.error) {
            console.error(`      API Error:`, response.error);
            reject(new Error(`API Error: ${response.error.message}`));
          } else {
            console.error(`      Unexpected response format`);
            reject(new Error('Unexpected API response format'));
          }
        } catch (error) {
          console.error(`      Parse error:`, error.message);
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`      Request error:`, error.message);
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.setTimeout(120000, () => {
      console.error(`      Request timeout for chunk ${chunkIndex + 1}`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Updated mergeJsonChunks function - replace the existing one
function mergeJsonChunks(jsonChunks, documentId, hasMarkers) {
  const mergedResult = {
    document_id: documentId,
    content: {
      sections: []
    }
  };

  if (!hasMarkers) {
    // Handle no-markers case - merge all paragraphs
    mergedResult.content.paragraphs = [];
    let paragraphCounter = 1;
    
    jsonChunks.forEach(chunk => {
      if (chunk.content?.paragraphs) {
        chunk.content.paragraphs.forEach(para => {
          mergedResult.content.paragraphs.push({
            ...para,
            id: `p${paragraphCounter}`
          });
          paragraphCounter++;
        });
      }
    });
    
    // If no paragraphs were found, remove the sections array and keep empty content
    if (mergedResult.content.paragraphs.length === 0) {
      delete mergedResult.content.sections;
    } else {
      delete mergedResult.content.sections;
    }
    
    return mergedResult;
  }

  let currentSection = null;
  let currentSubsection = null;
  let currentSubSubsection = null;

  jsonChunks.forEach(chunk => {
    if (chunk.content?.sections) {
      chunk.content.sections.forEach(section => {
        // Check if this continues an existing section
        const existingSection = mergedResult.content.sections.find(
          s => s.title === section.title
        );

        if (existingSection) {
          // Merge paragraphs
          if (section.paragraphs) {
            existingSection.paragraphs.push(...section.paragraphs);
          }
          
          // Merge subsections
          if (section.subsections) {
            section.subsections.forEach(sub => {
              const existingSub = existingSection.subsections?.find(
                s => s.title === sub.title
              );
              if (existingSub) {
                // Merge subsection paragraphs
                if (sub.paragraphs) {
                  existingSub.paragraphs.push(...sub.paragraphs);
                }
                
                // Merge sub-subsections
                if (sub.subsubsections) {
                  sub.subsubsections.forEach(subSub => {
                    const existingSubSub = existingSub.subsubsections?.find(
                      s => s.title === subSub.title
                    );
                    if (existingSubSub) {
                      // Merge sub-subsection paragraphs
                      if (subSub.paragraphs) {
                        existingSubSub.paragraphs.push(...subSub.paragraphs);
                      }
                    } else {
                      // New sub-subsection
                      if (!existingSub.subsubsections) {
                        existingSub.subsubsections = [];
                      }
                      existingSub.subsubsections.push(subSub);
                    }
                  });
                }
              } else {
                // New subsection
                if (!existingSection.subsections) {
                  existingSection.subsections = [];
                }
                existingSection.subsections.push(sub);
              }
            });
          }
        } else {
          // New section
          mergedResult.content.sections.push(section);
        }
      });
    }
  });

  return mergedResult;
}

async function processTextFile(filePath, fileIndex) {
  const originalFilename = path.basename(filePath, '.txt');
  console.log(`\nProcessing: ${originalFilename}.txt`);

  try {
    // Read the input file
    const inputText = fs.readFileSync(filePath, 'utf8');

    if (!inputText.trim()) {
      console.log(`  File is empty, creating minimal JSON structure`);
      const lang = await detectLanguage(inputText);
      const emptyResult = {
        document_id: `${originalFilename}_${lang}_001`,
        content: {
          abstract: null,
          sections: []
        }
      };
      const outputPath = path.join(OUTPUT_DIR, `${originalFilename}_${lang}_001.json`);
      fs.writeFileSync(outputPath, JSON.stringify(emptyResult, null, 2));
      return true;
    }

    // Generate document ID and output path
    const { documentId, outputPath } = await generateDocumentId(originalFilename, inputText);
    console.log(`  Document ID: ${documentId}`);

    // Check if the entire document has explicit section markers
    const hasMarkers = hasExplicitSectionMarkers(inputText);
    console.log(`  Section markers detected: ${hasMarkers ? 'YES' : 'NO'}`);

    // Simplified preprocessing - no automatic section detection
    const preprocessedText = preprocessText(inputText);
    console.log(`  Preprocessed text (markers only)`);

    const chunks = splitTextIntoChunks(preprocessedText, MAX_CHUNK_SIZE);
    console.log(`  Split into ${chunks.length} chunk(s)`);

    const jsonChunks = [];
    let currentSection = null;
    let currentSubsection = null;
    let sectionCounter = 1;
    let subsectionCounter = 1;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`  Processing chunk ${i + 1}/${chunks.length}...`);

      try {
        // Add context to the chunk
        let chunkWithContext = chunks[i];
        if (hasMarkers) {
          if (currentSection) {
            chunkWithContext = `[CONTINUE_SECTION:${currentSection.title}]\n${chunkWithContext}`;
          }
          if (currentSubsection) {
            chunkWithContext = `[CONTINUE_SUBSECTION:${currentSubsection.title}]\n${chunkWithContext}`;
          }
        }

        let chunkResult = await callDeepSeekAPI(
          chunkWithContext,
          i,
          chunks.length,
          hasMarkers,
          currentSection,
          currentSubsection
        );

        // Update section context for next chunk
        if (hasMarkers && chunkResult.content?.sections) {
          const lastSection = chunkResult.content.sections[chunkResult.content.sections.length - 1];
          if (lastSection) {
            currentSection = lastSection;
            if (lastSection.subsections && lastSection.subsections.length > 0) {
              currentSubsection = lastSection.subsections[lastSection.subsections.length - 1];
            } else {
              currentSubsection = null;
            }
          }
        }

        // Force no sections if document has no markers
        if (!hasMarkers && chunkResult.content) {
          // Move any paragraphs from sections to root level
          if (chunkResult.content.sections) {
            if (!chunkResult.content.paragraphs) {
              chunkResult.content.paragraphs = [];
            }

            chunkResult.content.sections.forEach(section => {
              if (section.paragraphs) {
                chunkResult.content.paragraphs.push(...section.paragraphs);
              }
              if (section.subsections) {
                section.subsections.forEach(sub => {
                  if (sub.paragraphs) {
                    chunkResult.content.paragraphs.push(...sub.paragraphs);
                  }
                });
              }
            });
            delete chunkResult.content.sections;
          }
        }

        jsonChunks.push(chunkResult);
        if (i < chunks.length - 1) {
          await delay(2000); // Rate limiting
        }
      } catch (chunkError) {
        console.error(`    Error processing chunk ${i + 1}: ${chunkError.message}`);
        // Push empty chunk to maintain array position
        jsonChunks.push({
          content: hasMarkers ? { sections: [] } : { paragraphs: [] }
        });
      }
    }

    if (jsonChunks.length === 0) {
      throw new Error('No chunks were successfully processed');
    }

    console.log(`  Merging ${jsonChunks.length} processed chunks...`);
    const finalResult = mergeJsonChunks(jsonChunks, documentId, hasMarkers);

    const normalizedResult = normalizeSectionStructure(finalResult);
    const validatedResult = validateAndFixJsonStructure(normalizedResult, documentId);

    fs.writeFileSync(outputPath, JSON.stringify(validatedResult, null, 2));
    console.log(`  JSON saved to: ${path.basename(outputPath)}`);

    // Show statistics
    const originalLength = inputText.length;
    const sectionsCount = validatedResult.content.sections ? validatedResult.content.sections.length : 0;
    const paragraphsCount = validatedResult.content.sections
      ? validatedResult.content.sections.reduce((count, section) => {
        return count +
          (section.paragraphs ? section.paragraphs.length : 0) +
          (section.subsections ? section.subsections.reduce((subCount, sub) => {
            return subCount + (sub.paragraphs ? sub.paragraphs.length : 0);
          }, 0) : 0);
      }, 0)
      : (validatedResult.content.paragraphs ? validatedResult.content.paragraphs.length : 0);
    const figuresCount = validatedResult.content.figures ? validatedResult.content.figures.length : 0;
    const tablesCount = validatedResult.content.tables ? validatedResult.content.tables.length : 0;

    console.log(`  Stats: ${originalLength} chars → ${sectionsCount} sections, ${paragraphsCount} paragraphs, ${figuresCount} figures, ${tablesCount} tables`);

    return true;

  } catch (error) {
    console.error(`  Error processing ${originalFilename}.txt:`, error.message);
    return false;
  }
}

async function processAllTextFiles() {
  console.log('='.repeat(80));
  console.log('CORPUS CONTENT TEXT TO JSON CONVERTER - IMPROVED MARKER DETECTION');
  console.log('='.repeat(80));

  try {
    // Check if input folder exists
    if (!fs.existsSync(INPUT_DIR)) {
      console.error(`Input folder '${INPUT_DIR}' does not exist!`);
      return;
    }

    // Get all text files
    const files = fs.readdirSync(INPUT_DIR);
    const textFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));

    if (textFiles.length === 0) {
      console.log(`No text files found in '${INPUT_DIR}' folder.`);
      return;
    }

    console.log(`Found ${textFiles.length} text file(s) to process:`);
    textFiles.forEach((file, index) => {
      const filePath = path.join(INPUT_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`  ${index + 1}. ${file} (${sizeKB} KB)`);
    });

    console.log(`\nConfiguration:`);
    console.log(`  Max chunk size: ${MAX_CHUNK_SIZE} characters`);
    console.log(`  Output folder: ${OUTPUT_DIR}`);
    console.log(`  Document ID format: filename_lang_XXX`);
    console.log(`  Section creation: MARKER-AWARE PROCESSING`);
    console.log(`  Supported markers: [NEW_SECTION], [NEW_SECTION_HEADER], [NEW_SUBSECTION], [NEW_SUBSECTION_HEADER], [NEW_SUBSUBSECTION], [NEW_SUBSUBSECTION_HEADER]`);
    console.log(`  Logic: Check entire file for markers, then process accordingly`);

    console.log('\nStarting text to JSON conversion...');

    let successful = 0;
    let failed = 0;
    const startTime = Date.now();

    // Process each file
    for (let i = 0; i < textFiles.length; i++) {
      const filePath = path.join(INPUT_DIR, textFiles[i]);
      const success = await processTextFile(filePath, i);

      if (success) {
        successful++;
      } else {
        failed++;
      }

      // Add delay between files
      if (i < textFiles.length - 1) {
        await delay(1000);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('CORPUS CONVERSION COMPLETE!');
    console.log(`Successfully processed: ${successful} files`);
    if (failed > 0) {
      console.log(`Failed to process: ${failed} files`);
    }
    console.log(`Total time: ${totalTime} seconds`);
    console.log(`JSON files saved in: ${OUTPUT_DIR}`);
    console.log('Files ready for corpus vectorization and translation system integration');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error during processing:', error.message);
  }
}
// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\nProcess interrupted by user.');
  console.log('Any completed files have been saved.');
  process.exit(0);
});
// Export functions for potential use in other scripts
module.exports = {
  processAllTextFiles,
  processTextFile,
  callDeepSeekAPI,
  preprocessText,
  hasExplicitSectionMarkers
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const allFiles = fs.readdirSync(INPUT_DIR);
    const selectedFiles = args.filter(name => allFiles.includes(name));
    if (selectedFiles.length === 0) {
      console.error('No matching files found in input directory.');
      console.log('Available files:', allFiles.join(', '));
      process.exit(1);
    }
    console.log(`Processing ${selectedFiles.length} specific file(s):`, selectedFiles.join(', '));
    (async () => {
      for (let i = 0; i < selectedFiles.length; i++) {
        const success = await processTextFile(path.join(INPUT_DIR, selectedFiles[i]), i);
        if (!success) {
          console.warn(`Failed to process: ${selectedFiles[i]}`);
        }
        if (i < selectedFiles.length - 1) await delay(1000);
      }
    })();
  } else {
    processAllTextFiles();
  }
}