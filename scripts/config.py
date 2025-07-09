# ==============================================================================
# PRAGMATIC AUTO-TRANSLATOR - PYTHON CONFIGURATION
# Local development configuration for vectorization, clustering, and analysis
# ==============================================================================

import os
import sys
import json
from pathlib import Path

print("Initializing local Pragmatic Auto-Translator environment...")

# ==============================================================================
# PROJECT STRUCTURE CONFIGURATION
# ==============================================================================

# Assumes config.py is in scripts/ folder
current_dir = Path(__file__).parent
BASE_DIR = current_dir.parent

# ==============================================================================
# DOMAIN AND LANGUAGE SETTINGS
# ==============================================================================

# Supported languages
LANGUAGES = ['eng', 'esp', 'zho']

# Primary domain for this session
DOMAIN = 'gai'

# Multi-domain support (comment out domains not being processed)
DOMAINS = [
    'gai',           # Generative AI domain
    # 'wellness',    # Personal wellness domain
    # 'immigration',  # Immigration policy domain
    # 'climate'     # Climate change domain  
]

# ==============================================================================
# PATH CONFIGURATION
# ==============================================================================

def get_domain_paths(domain=None):
    """Get all paths for a specific domain"""
    if domain is None:
        domain = DOMAIN
    
    base_domain_dir = BASE_DIR / 'corpora' / domain
    
    paths = {
        'base': base_domain_dir,
        'vectors': base_domain_dir / 'vectors',
        'knowledge_graphs': base_domain_dir / 'knowledge-graphs',
        'visualizations': base_domain_dir / 'vectors' / 'visualizations'
    }
    
    # Language-specific paths
    for lang in LANGUAGES:
        lang_dir = base_domain_dir / lang
        paths[f'{lang}'] = {
            'base': lang_dir,
            'for_processing': lang_dir / 'for-processing',
            'submissions': lang_dir / 'submissions', 
            'processed': lang_dir / 'processed',
            't9n_testing': lang_dir / 't9n-testing',
            'database': lang_dir / f'{domain}-{lang}_corpus-database.json'
        }
    
    return paths

# Current domain paths
PATHS = get_domain_paths(DOMAIN)

# ==============================================================================
# EMBEDDING MODEL SETTINGS
# ==============================================================================

MODEL_NAME = 'jinaai/jina-embeddings-v3'
MODEL_TRUST_REMOTE_CODE = True
MODEL_TASK = 'retrieval.passage'
MODEL_DIMENSIONS = 1024
MAX_TEXT_LENGTH = 10000  # Safe for all languages: ~2.5K tokens (eng/esp), ~5-10K tokens (zho-chn)

# ==============================================================================
# VECTORIZATION SETTINGS
# ==============================================================================

# Vector granularity levels
CREATE_DOCUMENT_VECTORS = True
CREATE_SECTION_VECTORS = True
CREATE_PARAGRAPH_VECTORS = True

# Processing settings
BATCH_SIZE = 16  # Adjust based on available memory
SHOW_PROGRESS = True
VERBOSE = True
MAX_DOCUMENTS = None  # Set to number to limit processing

# ==============================================================================
# OUTPUT FILES
# ==============================================================================

def get_output_files(domain=None):
    """Get output filenames for a specific domain"""
    if domain is None:
        domain = DOMAIN
    
    return {
        'document_vectors': f'{domain}-corpus-document-vectors.json',
        'section_vectors': f'{domain}-corpus-section-vectors.json', 
        'paragraph_vectors': f'{domain}-corpus-paragraph-vectors.json',
        # 'vector_data_js': f'{domain}-vector-data.js',  # Commented out - can be created later for vector visualization
        'clusters_multilingual': f'{domain}-multilingual-clusters.json',
        'knowledge_graph': f'{domain}-multilingual.graphml'
    }

OUTPUT_FILES = get_output_files(DOMAIN)

# ==============================================================================
# CLUSTERING SETTINGS
# ==============================================================================

CLUSTERING_METHODS = ['kmeans', 'hierarchical', 'dbscan']
DEFAULT_N_CLUSTERS = 8
MIN_CLUSTER_SIZE = 3
SIMILARITY_THRESHOLD = 0.7

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

def ensure_directories(domain=None):
    """Create necessary directories if they don't exist"""
    paths = get_domain_paths(domain)
    
    # Create main directories
    for path_key in ['base', 'vectors', 'knowledge_graphs', 'visualizations']:
        paths[path_key].mkdir(parents=True, exist_ok=True)
    
    # Create language-specific directories
    for lang in LANGUAGES:
        for sub_path in paths[lang].values():
            if isinstance(sub_path, Path):
                sub_path.parent.mkdir(parents=True, exist_ok=True)

def verify_corpus_databases(domain=None):
    """Check that corpus database files exist and can be loaded correctly"""
    if domain is None:
        domain = DOMAIN
    
    paths = get_domain_paths(domain)
    
    print(f"\n🔍 VERIFYING CORPUS DATABASES FOR DOMAIN: {domain.upper()}")
    print("-" * 50)
    
    all_good = True
    for language in LANGUAGES:
        db_file = paths[language]['database']
        
        if not db_file.exists():
            print(f"❌ {language.upper()}: File not found")
            all_good = False
            continue
            
        try:
            with open(db_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle different JSON structures
            if isinstance(data, dict) and 'documents' in data:
                count = len(data['documents'])
            elif isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict):
                count = len(data)
            else:
                count = 0
                print(f"⚠️ {language.upper()}: Unexpected JSON structure")
                all_good = False
                continue
            
            print(f"✅ {language.upper()}: {count} documents")
            
        except Exception as e:
            print(f"❌ {language.upper()}: Error reading - {e}")
            all_good = False
    
    return all_good

def load_all_databases(domain=None):
    """Load document metadata from all language corpus databases for multilingual processing"""
    if domain is None:
        domain = DOMAIN
    
    paths = get_domain_paths(domain)
    all_documents = {}
    
    print(f"\n📚 LOADING ALL CORPUS DATABASES FOR DOMAIN: {domain.upper()}")
    print("-" * 50)
    
    for language in LANGUAGES:
        db_file = paths[language]['database']
        
        if not db_file.exists():
            print(f"❌ {language.upper()}: File not found - {db_file}")
            continue
            
        try:
            with open(db_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle different JSON structures
            if isinstance(data, dict) and 'documents' in data:
                # Structure: {"documents": {"doc_id": {...}, ...}}
                documents = data['documents']
            elif isinstance(data, list):
                # Structure: [{"doc_id": "...", ...}, ...]
                documents = {doc.get('doc_id', f"doc_{i}"): doc for i, doc in enumerate(data)}
            elif isinstance(data, dict):
                # Structure: {"doc_id": {...}, ...} (direct dict of documents)
                documents = data
            else:
                print(f"⚠️ {language.upper()}: Unexpected JSON structure")
                continue
            
            all_documents[language] = documents
            print(f"✅ {language.upper()}: {len(documents)} documents loaded")
            
        except Exception as e:
            print(f"❌ {language.upper()}: Error loading - {e}")
            continue
    
    total_docs = sum(len(docs) for docs in all_documents.values())
    print(f"\n📊 TOTAL: {total_docs} documents across {len(all_documents)} languages")
    print("-" * 50)
    
    return all_documents

def show_project_structure(domain=None):
    """Display the current project structure"""
    if domain is None:
        domain = DOMAIN
    
    print(f"\n📂 PROJECT STRUCTURE FOR DOMAIN: {domain.upper()}")
    print("="*60)
    print(f"""
{BASE_DIR}/
├── corpora/
│   └── {domain}/""")
    
    # Show language directories
    for i, lang in enumerate(LANGUAGES):
        connector = "└──" if i == len(LANGUAGES) - 1 else "├──"
        print(f"""│       {connector} {lang}/
│       │   ├── for-processing/
│       │   ├── submissions/
│       │   ├── processed/
│       │   ├── t9n-testing/
│       │   └── {domain}-{lang}_corpus-database.json ✅""")
    
    print(f"""│       ├── vectors/                    🎯 (generated files)
│       │   ├── {domain}-corpus-document-vectors.json
│       │   ├── {domain}-corpus-section-vectors.json
│       │   ├── {domain}-corpus-paragraph-vectors.json
│       │   └── visualizations/
│       └── knowledge-graphs/           🕸️ (generated graphs)
│           ├── {domain}-multilingual.graphml
│           └── cluster-mappings.json
├── scripts/                           📝 (analysis notebooks)
│   ├── config.py
│   ├── vectorization/
│   │   └── create_vectors_batch.ipynb
│   └── clustering/""")
    
    # Show clustering notebooks
    for i, lang in enumerate(LANGUAGES):
        lang_name = get_language_info()[lang]['name']
        connector = "│       ├──"
        print(f"{connector} clusters-{lang}.ipynb      # {lang_name} monolingual clustering")
    
    print(f"""│       ├── clusters-multilingual.ipynb
│       └── clusters-analysis.ipynb
└── frontend/                          🌐 (web interface)""")
    
    print("="*60)

def get_language_info():
    """Get human-readable language information"""
    return {
        'eng': {'name': 'English', 'code': 'en'},
        'esp': {'name': 'Spanish', 'code': 'es'}
    }

def initialize_project(domain=None, verbose=True):
    """Initialize project directories and verify setup"""
    if domain is None:
        domain = DOMAIN
    
    if verbose:
        print("\n" + "="*60)
        print("🚀 PRAGMATIC AUTO-TRANSLATOR INITIALIZATION")
        print("="*60)
        print(f"Domain: {domain.upper()}")
        print(f"Languages: {', '.join([get_language_info()[lang]['name'] for lang in LANGUAGES])}")
        print(f"Model: {MODEL_NAME}")
        print(f"Dimensions: {MODEL_DIMENSIONS}")
        print(f"Base directory: {BASE_DIR}")
    
    # Create directories
    ensure_directories(domain)
    
    # Verify corpus files
    corpus_ready = verify_corpus_databases(domain)
    
    if verbose:
        if corpus_ready:
            print(f"\n✅ All corpus files found - ready for processing!")
        else:
            print(f"\n⚠️ Some corpus files missing - check file paths")
        
        print("="*60)
    
    return corpus_ready