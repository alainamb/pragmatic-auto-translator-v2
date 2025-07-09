# Implementation Guide for Creating Vectors

## Overview
This guide shows you exactly what to change (and what NOT to change) to use the Pragamtic Auto-Translator vectorization notebook with your own corpus for machine translation research in a local development environment.

## Prerequisites Checklist
Before starting, ensure you have:
-✅ Python 3.8+ installed locally with Jupyter notebook support
-✅ Your corpus in JSON format with the required structure
-✅ Knowledge of your thematic domain (e.g., "gai", "climate", "immigration")
-✅ Files in English, Spanish and Simplified Chinese organized in separate folders
-✅ At least 4GB RAM available for model loading and processing
-✅ Stable internet connection for initial model download (~2GB)

## Installation Steps

### 1. Set Up Python Environment

Create and activate a virtual environment:

```
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate
```
### 2. Install dependencies

```
# Install required packages
pip install -r scripts/requirements.txt

# Start Jupyter notebook server
jupyter notebook
```

## Preparation Steps

### Project Structure Setpup

Organize your files in Google Drive as follows:

```
your-project/
├── corpora/
│   └── your_domain/              # CHANGE: your_domain (e.g., "climate", "immigration")
│       ├── eng/
│       │   ├── processed/
│       │   │   ├── your_domain-eng_item001.json
│       │   │   ├── your_domain-eng_item002.json
│       │   │   └── ...
│       │   └── your_domain-eng_corpus-database.json
│       ├── esp/
│       │   ├── processed/
│       │   │   ├── your_domain-esp_item001.json
│       │   │   ├── your_domain-esp_item002.json
│       │   │   └── ...
│       │   └── your_domain-esp_corpus-database.json
│       ├── zho/
│       │   ├── processed/
│       │   │   ├── your_domain-zho_item001.json
│       │   │   ├── your_domain-zho_item002.json
│       │   │   └── ...
│       │   └── your_domain-zho_corpus-database.json
│       └── vectors/              # Generated during processing
│           ├── your_domain-corpus-document-vectors.json
│           ├── your_domain-corpus-section-vectors.json
│           ├── your_domain-corpus-paragraph-vectors.json
│           └── visualizations/
├── scripts/
│   ├── config.py                 # CHANGE: Update domain settings
│   ├── requirements.txt
│   └── vectorization/
│       └── create_vectors_batch.ipynb
├── frontend/                     # Web visualization interface
│   ├── js/
│   │   └── visualizations.js
│   ├── data/                    # Generated visualization data
│   │   └── your_domain_visualization_data_YYYYMMDD_HHMMSS.json
│   └── visualizations.html
└── README.md
```

## Configuration Steps

### Initial Configuration (config.py)

**CHANGE THESE VALUES** for your project:

```python
# Domain and language settings
DOMAIN = 'your_domain'  # e.g., 'climate', 'immigration', 'wellness'
LANGUAGES = ['eng', 'esp', 'zho']  # Keep this if using Spanish and English

# Model settings - adjust based on your hardware
MODEL_NAME = 'jinaai/jina-embeddings-v3'
MODEL_DIMENSIONS = 1024
MAX_TEXT_LENGTH = 10000  # Adjust based on document length

# Processing settings
BATCH_SIZE = 16  # Reduce if you have memory issues
MAX_DOCUMENTS = None  # Set to number to limit processing during testing
```

## Converting JSON Corpus into Semantic Vectors

This section shows how to use the batch processing notebook to efficiently vectorize your entire corpus. The notebook processes multiple documents automatically and avoids re-processing documents that already have vectors.

### Pre-Processing Checklist

- ✅ **Your config.py file is configured** with your domain and languages
- ✅ Virtual environment activated with all dependencies installed
- ✅ Jupyter notebook server running locally
- ✅ Sufficient disk space to store vectors (typically 10-50MB per 100 documents)s

## Working with the Jupyter notebook (create_vectors_batch.ipynb)

You should not have to modify any of these steps.

### Part 1: Data Preparation and Planning

**LOCAL ENVIRONMENT SETUP - Run this FIRST!**
The notebook will automatically detect your project structure. Ensure you're running the notebook from within the project directory structure.

**STEP 1: LOAD THE REQUIRED LIBRARIES**
This step loads the libraries required to run the notebook.

**STEP 2: LOAD AND EXAMINE DATABASE STRUCTURE**
This step loads the JSON database files (e.g. gai-eng_corpus-database.json).

**STEP 3: LOAD UNPROCESSED DOCUMENTS FOR BATCH PROCESSING (WITHOUT RE-VECTORIZATION)**
The notebook automatically uses your domain settings from config.py to locate vector files:

```
# These files are automatically configured based on your DOMAIN setting in config.py
# No changes needed - the system uses:
# - your_domain-corpus-document-vectors.json
# - your_domain-corpus-section-vectors.json  
# - your_domain-corpus-paragraph-vectors.json
```

The notebook identifies which documents already have vectors and only processes documents that do not yet have vectors.

### Part 2: Function and Model Setup

**STEP 4: DEFINE TEXT EXTRACTION FUNCTIONS (STANDARDIZED)**
This step defines the text extraction from the JSON content files (e.g. gai-eng_corpus-item001.json).

This section then tests extraction from a document from your corpus:

```
# Test with your first document
def test_your_domain_extraction():
    """
    Test the extraction with your specific document structure
    """
    print(f"\n🧪 TESTING {DOMAIN.upper()} EXTRACTION")
    print(f"=" * 60)
    
    try:
        # Load a sample document (automatically uses first available document)
        sample_docs = list(loaded_docs)
        if sample_docs:
            test_doc = sample_docs[0]
            doc_id = test_doc.get('document_id', 'unknown')
            print(f"📄 Testing with: {doc_id}")
            
            # Extract content
            extracted = extract_document_content(test_doc)
            
            # Display results
            print(f"\n📊 EXTRACTION RESULTS:")
            print(f"   • Title: {extracted['title']}")
            print(f"   • Sections: {len(extracted['sections'])}")
            print(f"   • Paragraphs: {len(extracted['paragraphs'])}")
            print(f"   • Word count: {extracted['statistics']['document_length_words']:,}")
            
            return extracted
        else:
            print("❌ No documents available for testing")
            return None
            
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return None

# Run the test
print("🚀 Running extraction test...")
test_result = test_your_domain_extraction()
```

**STEP 5: DEFINE VECTORIZATION FUNCTIONS**
This step defines the structure for the vectors and associated data to be stored in these files:

```
your_domain-corpus-document-vectors.json
your_domain-corpus-section-vectors.json  
your_domain-corpus-paragraph-vectors.json
```

**STEP 6: INITIALIZE THE MULTILINGUAL EMBEDDING MODEL**
This step initializes the jina-embeddings-v3 model. The model is downloaded (2GB) when the JINA is initialized for the first time.

### Part 3: Execution and Output

**STEP 7: BATCH PROCESS DOCUMENTS**
This document batch processes the documents that do not yet have vectors and appends vectors to these files:

```
your_domain-corpus-document-vectors.json
your_domain-corpus-section-vectors.json  
your_domain-corpus-paragraph-vectors.json
```

**STEP 8: GENERATE JSON VISUALIZATION REPORT**
This step creates visualization data that integrates with the frontend web interface:

```
# The notebook automatically generates:
# - PCA 2D and 3D projections of your vectors
# - Language distribution statistics  
# - Interactive visualization data in JSON format
# 
# Output file are copied to:
# frontend/data/{domain}_visualization_data_{timestamp}.json
# 
# This file is automatically loaded by:
# frontend/js/visualizations.js for display in visualizations.html
```

## Implementation Sequence

### Phase 1: Environment Setup (5 minutes)
1. Activate Python virtual environment
2. Install dependencies: pip install -r scripts/requirements.txt
3. Start Jupyter: jupyter notebook
4. Open create_vectors_batch.ipynb

### Phase 2: Configuration Verification (3 minutes)
1. Execute "Local Environment Setup" cell
2. Execute Step 1 (Load Libraries)
3. Execute Step 2 (Load Database Structure) - **IMPORTANT: Confirm it finds all your documents**
4. Review document count and structure

### Phase 3: Processing Analysis (2 minutes)
1. Execute Step 3 (Load Unprocessed Documents)
2 Review how many documents need vectorization
3. Estimate processing time (≈1-2 minutes per vector on average hardware)

### Phase 4: Content Verification (3 minutes)
1. Execute Step 4 (Text Extraction Functions)
2. Run test extraction on sample document
3. Verify content structure matches expectations

### Phase 5: Model Loading (5 minutes after first download is complete)
1. Execute Step 6 (Initialize Model)
2. **Note:** First run downloads ~2GB jina-embeddings-v3 model (20+ minutes)
3. Verify model loads successfully with correct dimensions

### Phase 6: Batch Processing (variable time)
1. Execute Step 7 (Batch Process Documents) - May take 20-120 minutes depending on corpus size
2. Monitor progress bars and status messages
3. Review final statistics

### Phase 7: Visualization Generation (2 minutes)
1. Execute Step 8 (Generate Visualization Data)
2. Verify JSON file created in corpora/gai/vectors/visualizations/
3. **Copy** the JSON file to frontend/data/
4. Adjust JS code to load most recent JSON file
5. Open frontend/visualizations.html in browser to view results

## Local Hardware Considerations

### Memory Requirements
- Minimum: 4GB RAM for small corpora (<100 documents)
- Recommended: 8GB+ RAM for larger corpora (>500 documents)
- Processing: ~1GB additional per 100 documents during processing

### Processing Speed
- CPU: Modern multi-core processor recommended
- Storage: SSD recommended for faster I/O during batch processing
- Network: Stable connection needed only for initial model download

### Optimization Tips
- Reduce BATCH_SIZE in config.py if experiencing memory issues
- Close other applications during processing
- Use MAX_DOCUMENTS setting for testing with smaller subsets

## Common Errors and Solutions

### "ModuleNotFoundError" for sentence-transformers or other packages
- Ensure virtual environment is activated
- Run: pip install -r scripts/requirements.txt
- Restart Jupyter kernel: Kernel → Restart

### "Model download failed" or network errors
- Check internet connection stability
- The jina-embeddings-v3 model (~2GB) downloads on first use
- Consider using mobile hotspot if institutional network blocks downloads

### "Insufficient memory" errors
- Reduce BATCH_SIZE in config.py (try 8 or 4)
- Close other applications
- Free up memory
- Process in smaller batches using MAX_DOCUMENTS setting

### "Documents not found" errors
- Verify config.py has correct DOMAIN setting
- Check that corpus database files exist and contain valid JSON
- Ensure you're running notebook from correct directory

### Processing is very slow
- Expected: 1-2 minutes per document on average hardware
- Monitor memory usage - high usage indicates need for smaller batches
- Large documents (>10,000 words) take proportionally longer

## Expected Results
Upon completing processing, you will have:

### Generated Vector Files
- **3 updated JSON files** with vectors for your entire corpus:
  - your_domain-document-vectors.json
  - your_domain-section-vectors.json
  - your_domain-paragraph-vectors.json

### Visualization Data
- your_domain_visualization_data_YYYYMMDD_HHMMSS.json: Interactive visualization data
- Statistics: Language distribution and corpus metrics
- PCA projections: 2D and 3D reduced-dimension visualizations

### Web Interface Ready
After you've copied the file to the appropriate location and updated the JS:
- View corpus statistics and vector distribution patterns
- Open frontend/visualizations.html in your browser
- Explore interactive charts showing cross-lingual clustering

## Batch Processing Advantages

### Efficiency
- **Incremental processing:** Only processes new documents
- **Memory optimization:** Processes in configurable batches
- **Progress tracking:** Detailed progress bars and status updates

### Robustness
- **Error handling:** Continues processing even if individual documents fail
- **Resume capability:** Can restart and continue from where it left off
- **Validation:** Built-in content validation and error reporting

### Research Integration
- **Multiple granularities:** Document, section, and paragraph vectors
- **Cross-lingual support:** Optimized for Spanish-English-Simplified Chinese translation research
- **Visualization ready:** Automatic generation of research visualization data

## Success Tips

1. **Start small:** Test with MAX_DOCUMENTS=5 before processing full corpus
2. **Monitor resources:** Watch memory usage during initial runs
3. **Validate extraction:** Always test text extraction before full processing
4. **Save progress:** Vector files save automatically - no manual intervention needed
5. **Use visualizations:** Review generated charts to verify vector quality
6. **Document changes:** Keep notes on any domain-specific modifications

## Integration with Translation Pipeline
The generated vectors are designed to integrate with:

### Corpus-informed Translation
- **Document-level context:** Full document vectors for translation context
- **Section alignment:** Section vectors for maintaining document structure
- **Fine-grained reference:** Paragraph vectors for detailed translation memory

Quality Assessment
- **Cross-lingual clustering:** Visualize semantic similarity across languages
- **Coverage analysis:** Identify gaps in multilingua coverage
- **Domain coherence:** Verify thematic consistency within your corpus

## Troubleshooting Local Environment

### Python Environment Issues

```
# Reset virtual environment if needed
deactivate
rm -rf venv
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r scripts/requirements.txt
```

### Jupyter Kernel Issues

```
# Reinstall Jupyter kernel
python -m ipykernel install --user --name=venv
# Then select 'venv' kernel in Jupyter
```

### Permission Errors
- Ensure you have write permissions to project directory
- On macOS/Linux, may need: `chmod -R 755 your-project/`

## When to Use This Notebook
- **Research corpora:** Multi-document collections requiring systematic vectorization
- **Translation preparation:** Creating corpus-informed translation resources
- **Cross-lingual analysis:** Generating vectors for semantic similarity research
- **Educational purposes:** Teaching corpus-based translation methodologies

## Contributing
This implementation guide is part of the Pragmatic Auto-Translation research project. Please contact us to contribute to this research: https://alainamb.github.io/pragmatic-auto-translator-v2/frontend/contact.html

## License
This project is part of ongoing automatic translation research. Please cite appropriately if using in academic work.

---
*Note: This guide is optimized for local development environments and does not require external cloud services or specialized cloud computing resources.*
