# ==============================================================================
# UNIVERSAL CONFIG - WORKS IN BOTH COLAB AND LOCAL ENVIRONMENTS
# Matches UNAM Auto-Traductor project structure
# ==============================================================================

import os
import sys
from pathlib import Path

# ==============================================================================
# ENVIRONMENT DETECTION
# ==============================================================================

def detect_environment():
    """Auto-detect if running in Colab or local environment"""
    try:
        import google.colab
        return 'colab'
    except ImportError:
        return 'local'

ENVIRONMENT = detect_environment()
print(f"🌍 Environment detected: {ENVIRONMENT.upper()}")

# ==============================================================================
# ENVIRONMENT-SPECIFIC SETUP
# ==============================================================================

if ENVIRONMENT == 'colab':
    # Colab-specific setup
    print("🔗 Setting up Google Colab environment...")
    
    # Mount Google Drive
    try:
        from google.colab import drive
        drive.mount('/content/drive')
        print("✅ Google Drive mounted")
        
        # Use your existing project structure
        BASE_DIR = '/content/drive/MyDrive/Classroom/Auto-Traductor - UNAM-SMA/Proyectos/pragmatic-auto-translator'
        
        # Create new directories (scripts and vectors)
        Path(f"{BASE_DIR}/scripts").mkdir(parents=True, exist_ok=True)
        Path(f"{BASE_DIR}/vectors").mkdir(parents=True, exist_ok=True)
        Path(f"{BASE_DIR}/vectors/gai").mkdir(parents=True, exist_ok=True)
        
        print(f"📁 Using project structure: {BASE_DIR}")
        
    except Exception as e:
        print(f"❌ Drive mount failed: {e}")
        # Fallback to simpler structure
        BASE_DIR = '/content'
        
else:
    # Local environment setup
    print("💻 Setting up local environment...")
    BASE_DIR = '..'  # Go up one level from scripts/ folder

# ==============================================================================
# DOMAIN AND LANGUAGE SETTINGS
# ==============================================================================

DOMAIN = 'gai'
LANGUAGES = ['eng', 'esp']

# ==============================================================================
# PATH CONFIGURATION (Using your existing structure)
# ==============================================================================

CORPORA_DIR = f'{BASE_DIR}/corpora/{DOMAIN}'
VECTORS_DIR = f'{BASE_DIR}/vectors/{DOMAIN}'

# Ensure vectors directory exists
Path(VECTORS_DIR).mkdir(parents=True, exist_ok=True)

# ==============================================================================
# MODEL SETTINGS
# ==============================================================================

MODEL_NAME = 'jinaai/jina-embeddings-v3'
MODEL_TRUST_REMOTE_CODE = True
MODEL_TASK = 'retrieval.passage'
MODEL_DIMENSIONS = 1024
MAX_TEXT_LENGTH = 8000

# ==============================================================================
# VECTOR SETTINGS
# ==============================================================================

CREATE_DOCUMENT_VECTORS = True
CREATE_SECTION_VECTORS = True
CREATE_PARAGRAPH_VECTORS = True

# ==============================================================================
# OUTPUT FILES
# ==============================================================================

DOCUMENT_VECTORS_FILE = 'gai-document-vectors.json'
SECTION_VECTORS_FILE = 'gai-section-vectors.json'
PARAGRAPH_VECTORS_FILE = 'gai-paragraph-vectors.json'
VECTOR_DATA_JS_FILE = 'gai-vector-data.js'

# ==============================================================================
# PROCESSING SETTINGS
# ==============================================================================

SHOW_PROGRESS = True
VERBOSE = True
MAX_DOCUMENTS = None

# ==============================================================================
# ENVIRONMENT-SPECIFIC UTILITIES
# ==============================================================================

def show_project_structure():
    """Display the current project structure"""
    print("\n📂 PROJECT STRUCTURE:")
    print("="*60)
    if ENVIRONMENT == 'colab':
        structure = f"""
{BASE_DIR}/
├── corpora/
│   └── gai/
│       ├── eng/
│       │   ├── submissions/
│       │   ├── processed/
│       │   └── gai-eng_database.json ✅
│       └── esp/
│           ├── submissions/
│           ├── processed/
│           └── gai-esp_database.json ✅
├── scripts/                    📝 (notebooks go here)
│   └── create_vectors_single.ipynb
└── vectors/                    🎯 (generated files)
    └── gai/
        ├── gai-document-vectors.json
        ├── gai-section-vectors.json
        ├── gai-paragraph-vectors.json
        └── gai-vector-data.js
        """
    else:
        structure = f"""
{BASE_DIR}/
├── scripts/                    📝 (you are here)
│   ├── config.py
│   ├── requirements.txt
│   └── create_vectors_single.ipynb
├── corpora/
│   └── gai/ (your corpus files)
└── vectors/
    └── gai/ (generated files)
        """
    print(structure)
    print("="*60)

def download_vectors():
    """Colab helper: Download generated vector files"""
    if ENVIRONMENT == 'colab':
        from google.colab import files
        
        vector_files = [
            f"{VECTORS_DIR}/{DOCUMENT_VECTORS_FILE}",
            f"{VECTORS_DIR}/{SECTION_VECTORS_FILE}",
            f"{VECTORS_DIR}/{PARAGRAPH_VECTORS_FILE}",
            f"{VECTORS_DIR}/{VECTOR_DATA_JS_FILE}"
        ]
        
        print("📥 Downloading vector files for local use...")
        downloaded_count = 0
        for file_path in vector_files:
            if Path(file_path).exists():
                files.download(file_path)
                print(f"   ✅ Downloaded: {Path(file_path).name}")
                downloaded_count += 1
            else:
                print(f"   ⚠️ Not found: {Path(file_path).name}")
        
        print(f"\n📊 Downloaded {downloaded_count} vector files")
        print("💡 Upload these to your local project's vectors/gai/ folder")
        
    else:
        print("ℹ️ Files saved locally - no download needed")

# ==============================================================================
# VERIFY STRUCTURE
# ==============================================================================

def verify_corpus_files():
    """Check that corpus files exist"""
    print("\n🔍 VERIFYING CORPUS FILES:")
    print("-" * 40)
    
    all_good = True
    for language in LANGUAGES:
        db_file = f"{CORPORA_DIR}/{language}/{DOMAIN}-{language}_database.json"
        if Path(db_file).exists():
            print(f"✅ {language.upper()}: {db_file}")
        else:
            print(f"❌ {language.upper()}: Missing {db_file}")
            all_good = False
    
    return all_good

# ==============================================================================
# DISPLAY CONFIGURATION
# ==============================================================================

print("\n" + "="*60)
print("🔧 UNAM AUTO-TRADUCTOR CONFIGURATION")
print("="*60)
print(f"Environment: {ENVIRONMENT}")
print(f"Domain: {DOMAIN}")
print(f"Languages: {', '.join(LANGUAGES)}")
print(f"Model: {MODEL_NAME}")
print(f"Dimensions: {MODEL_DIMENSIONS}")
print(f"Corpora directory: {CORPORA_DIR}")
print(f"Vectors directory: {VECTORS_DIR}")

# Auto-verify corpus files
corpus_ready = verify_corpus_files()

if corpus_ready:
    print(f"\n✅ All corpus files found - ready for vectorization!")
else:
    print(f"\n⚠️ Some corpus files missing - check file paths")

print("="*60)