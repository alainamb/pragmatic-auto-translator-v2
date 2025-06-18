# Implementation Guide: Adapting the Notebooks to Your Corpus

## Overview

This guide shows you exactly what to change (and what NOT to change) to use the corpus-graph-document-translation notebooks with your own corpus for machine translation research.

## Prerequisites Checklist

Before starting, ensure you have:

- ✅ **Your corpus in JSON format** with the required structure
- ✅ **Knowledge of your thematic domain** (e.g., "gai", "climate", "immigration")
- ✅ **Files in Spanish and English** organized in separate folders
- ✅ **Google Colab access** (recommended for the workshop environment)

## Preparation Steps

### Google Drive Folder Setup

Organize your files in Google Drive as follows:

```
your-project/
├── corpora/
│   └── your_domain/              # CHANGE: your_domain
│       ├── eng/
│       │   └── processed/
│       │       └── your_domain-eng_database.json    # CHANGE: your_domain
│       └── esp/
│           └── processed/
│               └── your_domain-esp_database.json    # CHANGE: your_domain
├── scripts/
├── vectors/
│   └── your_domain/              # CHANGE: your_domain
└── visualizations/
    └── your_domain/              # CHANGE: your_domain
```

### Required Files

Add copies of **config.py** and **create_vectors_batch.ipynb** to your **scripts** folder.

### Initial Configuration (config.py)

**CHANGE THESE VALUES** for your project:

```python
# Base project directory on Google Drive
BASE_DIR = '/content/drive/MyDrive/Classroom/Auto-Traductor - UNAM-SMA/Proyectos/pragmatic-auto-translator'

# Domain and language settings
DOMAIN = 'your_domain'  # e.g., 'climate', 'immigration'
LANGUAGES = ['eng', 'esp']  # Keep this if using Spanish and English

# Model settings
# You can update the number of characters under 'MAX_TEXT_LENGTH'
MAX_TEXT_LENGTH = 8000

# OUTPUT FILES
# Update the names of the files so that they begin with your domain
DOCUMENT_VECTORS_FILE = 'your_domain-document-vectors.json'
SECTION_VECTORS_FILE = 'your_domain-section-vectors.json'
PARAGRAPH_VECTORS_FILE = 'your_domain-paragraph-vectors.json'
```

## Converting JSON Corpus into Semantic Vectors

This section shows how to use the batch processing notebook to efficiently vectorize your entire corpus. The notebook processes multiple documents automatically and avoids re-processing documents that already have vectors.

### Pre-Processing Checklist

- ✅ **Your config.py file is configured** with your domain and languages
- ✅ **Using Google Colab with GPU activated** (Runtime → Change runtime type → T4 GPU)
- ✅ **Sufficient Google Drive space** to store vectors

## Customization Steps

### Working with the Jupyter notebook (create_vectors_batch.ipynb)

**GOOGLE COLAB SETUP - Run this FIRST!**

```python
# Update the 'project_path' to the root level of the project folder on your personal Drive
project_path = '/content/drive/MyDrive/Classroom/Auto-Traductor - UNAM-SMA/Proyectos/pragmatic-auto-translator'
```

### Step 3: Load Unprocessed Documents

**Block 2: Isolate unprocessed documents**

```python
# Define the three vector files we expect; update these to match your file naming instructions
vector_files = {
    'documents': 'your_domain-document-vectors.json',
    'sections': 'your_domain-section-vectors.json',
    'paragraphs': 'your_domain-paragraph-vectors.json'
}
```

### Step 4: Flexible Text Extraction Functions

**Block 2: Test and verify extraction of one document**

Update this section for text extraction of a document of your choosing:

**Snippet 1:**
```python
# Test specifically with your chosen document
def test_your-domain_item001():
    """
    Test the extraction with your specific document structure
    """
    print(f"\n🧪 TESTING your-domain_item EXTRACTION")
    print(f"=" * 60)
    
    try:
        # Load the document (adjust path as needed)
        doc_id = "your-domain_item001"
        lang = "eng"
```

**Snippet 2:**
```python
# Specific checks for this document
print(f"\n✅ SPECIFIC CHECKS FOR your-domain_item:")
# Replace the number with the expected number of sections/subsections/subsubsections in your document
print(f" • Expected X sections: {'✓' if len(extracted['sections']) == X else '✗'} (found {len(extracted['sections'])})")
```

**Snippet 3:**
```python
# Run the test
print("🚀 Running extraction test...")
result = test_your-domain_item001()
```

### Step 8: Generate Jina-V3 HTML Visualization Report

**Snippet 1:**
```python
# Put visualizations folder at same level as vectors folder (go up two levels from vectors/your_domain)
# Update to reflect your folder structure
output_dir = Path(VECTORS_DIR).parent.parent / "visualizations/your_domain"
```

**Snippet 2:**
```python
# Update report name to reflect your domain
output_file = output_dir / f"jina_v3_your_domain-corpus_visualization_{timestamp}.html"
```

## Steps You Should NOT Modify

- **STEP 1:** LOAD THE REQUIRED LIBRARIES
- **STEP 2:** LOAD AND EXAMINE DATABASE STRUCTURE
- **STEP 3:** LOAD UNPROCESSED DOCUMENTS FOR BATCH PROCESSING (Block 1: Helper functions)
- **STEP 4:** FLEXIBLE TEXT EXTRACTION FUNCTIONS (Block 1: Extract text)
- **STEP 5:** DEFINE VECTORIZATION FUNCTIONS (SCHEMA-COMPLIANT)
- **STEP 6:** INITIALIZE THE MULTILINGUAL EMBEDDING MODEL
- **GPU & MEMORY DIAGNOSTIC** (Run after STEP 6 - Model Loading)
- **STEP 7:** SMART BATCH PROCESSING WITH JINA-V3 (EFFICIENT OUTPUT)

## Implementation Sequence

### Phase 1: Preparation (2 minutes)
1. Confirm the individual notebook already works with your corpus
2. Activate GPU in Colab (Runtime → Change runtime type → T4 GPU)
3. Ensure sufficient Drive space

### Phase 2: Quick Verification (3 minutes)
1. Execute Cell 1 (Universal Configuration)
2. Execute Step 1 (Load Libraries)
3. Execute Step 2 (Verify corpus) - **IMPORTANT**: Confirm it finds all your documents

### Phase 3: Pre-Processing Analysis (2 minutes)
1. Execute Step 3 (Identify unprocessed documents)
2. Review how many documents need vectorization
3. Estimate processing time (≈2-3 minutes per document)

### Phase 4: Complete Processing (variable time)
1. Execute Step 6 (Load jina-v3 model)
2. Execute Step 7 (Batch processing) - **May take 20-60 minutes**
3. Execute Step 8 (Generate visualizations)

## Common Errors and Solutions

### "No GPU available" or "Insufficient memory"
- Activate GPU: Runtime → Change runtime type → T4 GPU
- Restart session: Runtime → Restart and run all
- Process in smaller batches if issues persist

### "Documents not found"
- Confirm exact folder structure
- Check that config.py has correct DOMAIN

### "Documents already processed"
- This is normal - the notebook automatically avoids re-processing
- To re-process, delete files in vectors/your_domain/
- Message "No processing needed" means everything is ready

### Very slow processing
- Confirm GPU is activated and model uses it
- Verify stable internet connection
- Consider processing in separate sessions for very large corpora

## Expected Results

Upon completing processing, you will have:

- **3 updated JSON files** with vectors for your entire corpus:
  - your_domain-document-vectors.json
  - your_domain-section-vectors.json
  - your_domain-paragraph-vectors.json

- **Interactive HTML report** showing distribution and clustering
- **Normalized jina-v3 vectors** (1024 dimensions) optimized for translation
- **Complete corpus coverage** for corpus-informed translation

## Batch Processing Advantages

### Efficiency
- Automatically processes only new documents
- Avoids duplication and unnecessary re-processing
- Leverages GPU for accelerated processing

### Robustness
- Continues processing even if some documents fail
- Saves incremental progress to JSON files
- Provides detailed reports of successes and errors

### Scalability
- Handles corpora of any size
- Memory optimized for Colab environments
- Visualizations automatically adapt to content

## Success Tips

1. **Test individually first**: Never use batch processing without confirming individual processing works
2. **Always activate GPU**: Batch processing requires GPU for efficiency
3. **Monitor progress**: Check progress bars and status messages
4. **Save frequently**: Vectors save automatically, but download important files
5. **Use visualizations**: HTML report helps verify vector quality
6. **Be patient**: Large corpora may take 1-2 hours, but progress saves automatically

## When to Use This Notebook

- For **multi-document corpora** where manual processing would be tedious
- When you need **complete and consistent vectors** for your entire corpus
- To **update existing corpora** with new documents

Batch processing is designed to be your primary vectorization tool once you've validated your configuration with the individual notebook.

## Contributing

This implementation guide is part of the corpus-graph-document-translation research project. For questions, issues, or contributions, please refer to the main project repository.

## License

This project is part of ongoing machine translation research. Please cite appropriately if using in academic work.
