"""
seed_corpus.py — Seeds the ChromaDB resume store with examples from data/ JSON files.

Usage:
  cd embedding-service
  python -m scripts.seed_corpus
"""

import json
import os
import sys
import logging

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.resume_store import get_resume_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Path to the data directory (relative to repo root)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")


def load_corpus_files() -> list:
    """Load all JSON resume corpus files from the data/ directory."""
    all_examples = []

    if not os.path.exists(DATA_DIR):
        logger.error(f"Data directory not found: {DATA_DIR}")
        return all_examples

    json_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    logger.info(f"Found {len(json_files)} JSON corpus files in {DATA_DIR}")

    for filename in sorted(json_files):
        filepath = os.path.join(DATA_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, list):
                # Add source file info and unique IDs
                for i, example in enumerate(data):
                    domain = example.get("domain", "Unknown")
                    level = example.get("experienceLevel", "Entry")
                    example["id"] = f"{os.path.splitext(filename)[0]}_{level.lower()}_{i}"
                    all_examples.append(example)

                logger.info(f"  ✓ {filename}: {len(data)} examples loaded")
            else:
                logger.warning(f"  ✗ {filename}: Expected a JSON array, skipping")

        except json.JSONDecodeError as e:
            logger.error(f"  ✗ {filename}: JSON parse error: {e}")
        except Exception as e:
            logger.error(f"  ✗ {filename}: Error: {e}")

    return all_examples


def main():
    logger.info("=" * 60)
    logger.info("PlaceMates Resume Corpus Seeder")
    logger.info("=" * 60)

    # Load all examples from data/ JSON files
    examples = load_corpus_files()
    if not examples:
        logger.error("No resume examples found. Exiting.")
        sys.exit(1)

    logger.info(f"\nTotal examples loaded: {len(examples)}")

    # Count by domain
    domain_counts: dict = {}
    for ex in examples:
        domain = ex.get("domain", "Unknown")
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
    
    logger.info("\nDomain distribution:")
    for domain, count in sorted(domain_counts.items()):
        logger.info(f"  {domain}: {count}")

    # Seed ChromaDB
    logger.info("\nSeeding ChromaDB...")
    store = get_resume_store()

    # Process in batches of 10
    batch_size = 10
    total_added = 0
    for i in range(0, len(examples), batch_size):
        batch = examples[i : i + batch_size]
        added = store.add_examples(batch)
        total_added += added
        logger.info(f"  Batch {i // batch_size + 1}: {added} added (total: {total_added})")

    logger.info(f"\n✅ Seeding complete! {total_added} new examples added.")
    logger.info(f"   ChromaDB total: {store.count()} examples")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
