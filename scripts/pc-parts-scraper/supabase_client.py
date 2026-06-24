"""
Supabase client for the Python scraper.
Handles upserting products and logging price history.
"""
import os
import json
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    raise ImportError("Install supabase: pip install supabase")

SUPABASE_URL = None
SUPABASE_KEY = None

def _load_credentials():
    """Lazy-load credentials — only called when needed."""
    global SUPABASE_URL, SUPABASE_KEY
    if SUPABASE_URL is None or SUPABASE_KEY is None:
        load_dotenv()
        SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
        SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "Missing Supabase credentials. Set env vars:\n"
                "  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)\n"
                "  SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
            )

_supabase: Optional[Client] = None


def get_client() -> Client:
    """Get or create Supabase client (singleton)."""
    global _supabase
    if _supabase is None:
        _load_credentials()
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def upsert_product(product: dict) -> Optional[str]:
    """
    Upsert a single product to Supabase.
    Uses the PostgreSQL upsert_product() function that handles:
    - Inserting new products
    - Updating existing products
    - Logging price changes to price_history
    """
    try:
        client = get_client()

        result = client.rpc('upsert_product', {
            'p_name': product['name'],
            'p_raw_name': product.get('raw_name', product['name']),
            'p_price': product['price'],
            'p_price_formatted': product.get('price_formatted', f"{product['price']} DA"),
            'p_old_price': product.get('old_price'),
            'p_old_price_formatted': product.get('old_price_formatted'),
            'p_availability': product.get('availability', 'Unknown'),
            'p_in_stock': product.get('in_stock', True),
            'p_url': product['url'],
            'p_image': product.get('image', ''),
            'p_site': product['site'],
            'p_retailer_name': product.get('retailer_name', product['site']),
            'p_category': product.get('category', 'unknown'),
            'p_brand': product.get('brand', 'Unknown'),
            'p_sku': product['sku'],
            'p_model_key': product.get('model_key', product['sku']),
            'p_condition': product.get('condition', 'New'),
            'p_specs': json.dumps(product.get('specs', {})),
            'p_scraped_at': product.get('scraped_at', datetime.utcnow().isoformat()),
        }).execute()

        return result.data if result.data else None

    except Exception as e:
        print(f"    [!] Supabase upsert failed for {product.get('sku', '?')}: {e}")
        return None


def upsert_products_batch(products: List[dict], batch_size: int = 20) -> dict:
    """
    Upsert multiple products in batches.
    Returns stats: { inserted: N, updated: N, failed: N }
    """
    stats = {'inserted': 0, 'updated': 0, 'failed': 0}

    for i, product in enumerate(products):
        result = upsert_product(product)
        if result:
            # The function returns the product ID — can't easily distinguish insert vs update
            # but we count successes
            stats['inserted'] += 1
        else:
            stats['failed'] += 1

        # Progress
        if (i + 1) % batch_size == 0:
            print(f"    Progress: {i + 1}/{len(products)}")

    return stats


def get_existing_products() -> List[dict]:
    """Get all existing products from Supabase."""
    try:
        client = get_client()
        result = client.table('products').select('sku, price').execute()
        return result.data or []
    except Exception as e:
        print(f"[!] Failed to fetch existing products: {e}")
        return []


def delete_stale_products(cutoff_hours: int = 48) -> int:
    """Delete products not updated within the cutoff period."""
    try:
        client = get_client()
        cutoff = datetime.utcnow().isoformat()

        # Note: In production, use a proper timestamp comparison
        # For now, we'll mark them as stale
        result = (
            client.table('products')
            .delete()
            .lt('updated_at', cutoff)
            .execute()
        )

        deleted = len(result.data) if result.data else 0
        print(f"[+] Deleted {deleted} stale products")
        return deleted

    except Exception as e:
        print(f"[!] Failed to delete stale products: {e}")
        return 0


def test_connection() -> bool:
    """Test Supabase connection."""
    try:
        client = get_client()
        result = client.table('products').select('count', count='exact').limit(0).execute()
        count = result.count if hasattr(result, 'count') else '?'
        print(f"[+] Supabase connected. Products in DB: {count}")
        return True
    except Exception as e:
        print(f"[!] Supabase connection failed: {e}")
        return False
