import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';

const htmlPath = path.resolve('dist/item-finder.html');

async function getHtmlContent() {
  return await fs.readFile(htmlPath, 'utf8');
}

describe('Built Layout Structure Verification', () => {
  // Test 1: HTML file exists
  test('1. dist/item-finder.html exists', async () => {
    const exists = await fs.access(htmlPath).then(() => true).catch(() => false);
    assert.strictEqual(exists, true, 'dist/item-finder.html should exist after build');
  });

  // Test 2: HTML doctype is present
  test('2. HTML has correct doctype definition', async () => {
    const html = await getHtmlContent();
    assert.ok(/^<!DOCTYPE html>/i.test(html.trim()), 'HTML must start with <!DOCTYPE html>');
  });

  // Test 3: head tag is present
  test('3. head tag is present in HTML document', async () => {
    const html = await getHtmlContent();
    assert.ok(/<head[^>]*>/i.test(html) && /<\/head>/i.test(html), 'head tag must be present');
  });

  // Test 4: title is present and correct
  test('4. Page title is set correctly', async () => {
    const html = await getHtmlContent();
    const match = html.match(/<title>([\s\S]*?)<\/title>/i);
    assert.ok(match, 'Title tag must be present');
    assert.strictEqual(match[1].trim(), 'Universal Item Finder | Star Citizen');
  });

  // Test 5: Viewport meta tag is present
  test('5. Viewport meta tag is present', async () => {
    const html = await getHtmlContent();
    assert.ok(/<meta[^>]+name=["']viewport["']/i.test(html), 'Viewport meta tag must be defined');
    assert.ok(/content=["'][^"']*width=device-width/i.test(html), 'Viewport width must be device-width');
  });

  // Test 6: Charset meta tag is present
  test('6. Charset meta tag is present', async () => {
    const html = await getHtmlContent();
    assert.ok(/<meta[^>]+charset=["']utf-8["']/i.test(html) || /<meta[^>]+charset=["']UTF-8["']/i.test(html), 'UTF-8 charset meta tag must be defined');
  });

  // Test 7: Stylesheet link is present
  test('7. Stylesheet link is present', async () => {
    const html = await getHtmlContent();
    assert.ok(/<link[^>]+rel=["']stylesheet["']/i.test(html) || /<style[^>]*>/i.test(html), 'Must reference a stylesheet or have inline styles');
  });

  // Test 8: Main layout container exists with id uif-app
  test('8. Main container uif-app exists in the DOM', async () => {
    const html = await getHtmlContent();
    assert.ok(/id=["']uif-app["']/i.test(html), 'Container element with ID "uif-app" must be present');
  });

  // Test 9: Search input with id uif-search-input exists
  test('9. Search input element exists', async () => {
    const html = await getHtmlContent();
    assert.ok(/id=["']uif-search-input["']/i.test(html), 'Search input with ID "uif-search-input" must be present');
  });

  // Test 10: Category list container with id uif-category-list exists
  test('10. Category list element exists', async () => {
    const html = await getHtmlContent();
    assert.ok(/id=["']uif-category-list["']/i.test(html), 'Category list with ID "uif-category-list" must be present');
  });

  // Test 11: Stats counter container with id uif-stats-count exists
  test('11. Stats counter element exists', async () => {
    const html = await getHtmlContent();
    assert.ok(/id=["']uif-stats-count["']/i.test(html), 'Stats counter with ID "uif-stats-count" must be present');
  });

  // Test 12: Sort dropdown select element exists
  test('12. Sort select dropdown exists', async () => {
    const html = await getHtmlContent();
    assert.ok(/id=["']uif-sort-select["']/i.test(html), 'Sort select with ID "uif-sort-select" must be present');
  });

  // Test 13: Results grid container with id uif-results-grid exists
  test('13. Results grid element exists', async () => {
    const html = await getHtmlContent();
    assert.ok(/id=["']uif-results-grid["']/i.test(html), 'Results grid with ID "uif-results-grid" must be present');
  });

  // Test 14: Main tag with class item-finder-page exists
  test('14. Page contains main container item-finder-page', async () => {
    const html = await getHtmlContent();
    assert.ok(/class=["']item-finder-page["']/i.test(html) || /class=["'][^"']*item-finder-page[^"']*["']/i.test(html), 'main container with class item-finder-page must be present');
  });

  // Test 15: Client JS script is loaded
  test('15. Script for item-finder-app.js is referenced', async () => {
    const html = await getHtmlContent();
    assert.ok(/src=["'][^"']*item-finder-app\.js["']/i.test(html), 'Must include script tag referencing item-finder-app.js');
  });
});
