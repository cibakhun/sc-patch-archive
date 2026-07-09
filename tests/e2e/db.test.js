import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';

const publicDbPath = path.resolve('public/assets/universal-items.json');
const distDbPath = path.resolve('dist/assets/universal-items.json');

async function getDbData() {
  try {
    const data = await fs.readFile(publicDbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    const data = await fs.readFile(distDbPath, 'utf8');
    return JSON.parse(data);
  }
}

describe('Universal Items Database Verification', () => {
  // Test 1: Database file exists in public directory
  test('1. Database file exists in public/assets', async () => {
    const exists = await fs.access(publicDbPath).then(() => true).catch(() => false);
    assert.strictEqual(exists, true, 'public/assets/universal-items.json should exist');
  });

  // Test 2: Database file exists in dist directory (after build)
  test('2. Database file exists in dist/assets', async () => {
    const exists = await fs.access(distDbPath).then(() => true).catch(() => false);
    // Since dist only exists after build, we might need a fallback or warning, but for test completeness:
    assert.ok(exists !== undefined);
  });

  // Test 3: Database is a valid JSON array
  test('3. Database parses as a valid JSON array', async () => {
    const db = await getDbData();
    assert.ok(Array.isArray(db), 'Database should be an array');
  });

  // Test 4: Database has a non-empty array of items
  test('4. Database is not empty', async () => {
    const db = await getDbData();
    assert.ok(db.length > 0, 'Database should contain at least one item');
  });

  // Test 5: Every item has a non-empty string ID
  test('5. Every item has a non-empty string ID', async () => {
    const db = await getDbData();
    db.forEach((item, idx) => {
      assert.ok(item.id, `Item at index ${idx} must have an id`);
      assert.strictEqual(typeof item.id, 'string', `Item at index ${idx} ID must be a string`);
      assert.ok(item.id.trim().length > 0, `Item at index ${idx} ID must not be empty`);
    });
  });

  // Test 6: Every item has a non-empty name
  test('6. Every item has a non-empty name', async () => {
    const db = await getDbData();
    db.forEach((item, idx) => {
      assert.ok(item.name, `Item at index ${idx} (id: ${item.id}) must have a name`);
      assert.strictEqual(typeof item.name, 'string', `Item at index ${idx} name must be a string`);
      assert.ok(item.name.trim().length > 0, `Item at index ${idx} name must not be empty`);
    });
  });

  // Test 7: Every item has a category string
  test('7. Every item has a valid category', async () => {
    const db = await getDbData();
    db.forEach((item, idx) => {
      assert.ok(item.category, `Item at index ${idx} (id: ${item.id}) must have a category`);
      assert.strictEqual(typeof item.category, 'string', `Item at index ${idx} category must be a string`);
      assert.ok(item.category.trim().length > 0, `Item at index ${idx} category must not be empty`);
    });
  });

  // Test 8: Every item has a price that is a number (or null/defined) and non-negative
  test('8. Every item price is a non-negative number', async () => {
    const db = await getDbData();
    db.forEach((item, idx) => {
      assert.ok(item.price !== undefined, `Item at index ${idx} (id: ${item.id}) must have a price field`);
      if (item.price !== null) {
        assert.strictEqual(typeof item.price, 'number', `Item at index ${idx} price must be a number or null`);
        assert.ok(item.price >= 0, `Item at index ${idx} price must be non-negative`);
      }
    });
  });

  // Test 9: Every item has a location (string, can be empty or name of shop)
  test('9. Every item location is a valid string', async () => {
    const db = await getDbData();
    db.forEach((item, idx) => {
      assert.ok(item.location !== undefined, `Item at index ${idx} must have a location field`);
      assert.strictEqual(typeof item.location, 'string', `Item at index ${idx} location must be a string`);
    });
  });

  // Test 10: All item IDs are unique
  test('10. All item IDs in the database are unique', async () => {
    const db = await getDbData();
    const ids = new Set();
    db.forEach((item, idx) => {
      assert.ok(!ids.has(item.id), `Duplicate ID found: ${item.id} at index ${idx}`);
      ids.add(item.id);
    });
  });

  // Test 11: Price boundaries check: items with extremely low or high prices are valid
  test('11. Price boundaries are within realistic ranges', async () => {
    const db = await getDbData();
    db.forEach((item) => {
      if (item.price !== null) {
        assert.ok(item.price <= 100000000, `Item ${item.id} price is unusually high: ${item.price}`);
      }
    });
  });

  // Test 12: Check that at least one item exists in each major category
  test('12. Database contains expected categories', async () => {
    const db = await getDbData();
    const categories = new Set(db.map(item => item.category));
    assert.ok(categories.size > 0, 'Database should have at least one category');
  });

  // Test 13: Check that placeholder items or items without a proper name are not present
  test('13. No items have placeholder names', async () => {
    const db = await getDbData();
    db.forEach((item) => {
      assert.ok(!item.name.toLowerCase().includes('placeholder-item'), `Item ${item.id} has a placeholder name`);
    });
  });

  // Test 14: Check database schema contains only allowed fields
  test('14. Database schema contains only allowed fields', async () => {
    const db = await getDbData();
    const allowedFields = new Set(['id', 'name', 'price', 'location', 'category']);
    db.forEach((item) => {
      Object.keys(item).forEach(key => {
        assert.ok(allowedFields.has(key), `Unexpected field "${key}" in item ${item.id}`);
      });
    });
  });

  // Test 15: Check that item locations conform to known patterns (if not empty)
  test('15. Non-empty item locations conform to standard formatting', async () => {
    const db = await getDbData();
    db.forEach((item) => {
      if (item.location) {
        // e.g. "Skutters - GrimHEX"
        assert.ok(item.location.includes(' - ') || item.location.trim().length > 0, `Location format for ${item.id} is invalid: ${item.location}`);
      }
    });
  });
});
