import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

export class MockElement {
  constructor(tagName, id = '', className = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = {
      set: new Set(className.split(' ').filter(Boolean)),
      add: (c) => {
        this.classList.set.add(c);
        this.className = Array.from(this.classList.set).join(' ');
        this.attributes['class'] = this.className;
      },
      remove: (c) => {
        this.classList.set.delete(c);
        this.className = Array.from(this.classList.set).join(' ');
        this.attributes['class'] = this.className;
      },
      contains: (c) => this.classList.set.has(c),
      has: (c) => this.classList.set.has(c)
    };
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this._value = '';
    this._innerHTML = '';
    this._textContent = '';
    this.style = {};
    this.parentNode = null;
  }
  
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') {
      this.className = String(value);
      this.classList.set = new Set(this.className.split(' ').filter(Boolean));
    }
    if (name === 'id') {
      this.id = String(value);
    }
  }
  
  getAttribute(name) {
    return this.attributes[name] || null;
  }
  
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'class') {
      this.className = '';
      this.classList.set.clear();
    }
  }
  
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  get innerHTML() {
    return this.children.map(c => c.outerHTML).join('');
  }
  
  set innerHTML(val) {
    this._innerHTML = '';
    this.children = [];
    this._parseHTMLAndAddChildren(val);
  }

  get outerHTML() {
    if (this.tagName === '#TEXT') {
      return this._textContent || '';
    }
    const attrs = Object.entries(this.attributes)
      .map(([name, val]) => ` ${name}="${val}"`)
      .join('');
    const inner = this.innerHTML;
    if (this.tagName === 'IMG' || this.tagName === 'INPUT' || this.tagName === 'BR' || this.tagName === 'HR') {
      return `<${this.tagName.toLowerCase()}${attrs}>`;
    }
    return `<${this.tagName.toLowerCase()}${attrs}>${inner}</${this.tagName.toLowerCase()}>`;
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    return this.children.map(c => c.textContent).join('').trim();
  }
  
  set textContent(val) {
    this._textContent = val;
    this._innerHTML = '';
    this.children = [];
  }

  get value() { return this._value; }
  set value(val) {
    this._value = val;
    this.setAttribute('value', val);
    this.dispatchEvent('input');
    this.dispatchEvent('change');
  }

  addEventListener(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  removeEventListener(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== cb);
    }
  }

  dispatchEvent(event) {
    const handlers = this.listeners[event];
    if (handlers) {
      handlers.forEach(cb => cb({ target: this, preventDefault: () => {} }));
    }
  }

  click() {
    this.dispatchEvent('click');
  }

  querySelector(selector) {
    return this._find(selector, false);
  }

  querySelectorAll(selector) {
    return this._find(selector, true);
  }

  _find(selector, all) {
    const results = [];
    const search = (node) => {
      if (node !== this && matches(node, selector)) {
        results.push(node);
        if (!all) return true;
      }
      for (const child of node.children) {
        if (search(child) && !all) return true;
      }
      return false;
    };
    search(this);
    return all ? results : (results[0] || null);
  }

  _parseHTMLAndAddChildren(html) {
    let index = 0;
    const length = html.length;

    const parseNodes = () => {
      const nodes = [];
      while (index < length) {
        const nextTag = html.indexOf('<', index);
        if (nextTag === -1) {
          const text = html.slice(index).trim();
          if (text) {
            const textNode = new MockElement('#text');
            textNode.textContent = text;
            nodes.push(textNode);
          }
          index = length;
          break;
        }

        if (nextTag > index) {
          const text = html.slice(index, nextTag).trim();
          if (text) {
            const textNode = new MockElement('#text');
            textNode.textContent = text;
            nodes.push(textNode);
          }
        }

        index = nextTag;

        if (html.startsWith('</', index)) {
          break;
        }

        if (html.startsWith('<!--', index)) {
          const endComment = html.indexOf('-->', index);
          if (endComment !== -1) {
            index = endComment + 3;
          } else {
            index = length;
          }
          continue;
        }

        const tagClose = html.indexOf('>', index);
        if (tagClose === -1) {
          index = length;
          break;
        }

        const tagContent = html.slice(index + 1, tagClose);
        index = tagClose + 1;

        let spaceIdx = tagContent.search(/\s/);
        let tagName = spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx);
        const selfClosing = tagName.endsWith('/') || tagContent.endsWith('/');
        if (selfClosing && tagName.endsWith('/')) {
          tagName = tagName.slice(0, -1);
        }
        tagName = tagName.trim();

        const el = new MockElement(tagName);

        const attrsStr = spaceIdx === -1 ? '' : tagContent.slice(spaceIdx);
        const attrRegex = /([a-z0-9\-]+)=(['"])(.*?)\2/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
          el.setAttribute(attrMatch[1], attrMatch[3]);
        }

        const tagUpper = tagName.toUpperCase();
        if (!selfClosing && tagUpper !== 'IMG' && tagUpper !== 'INPUT' && tagUpper !== 'BR' && tagUpper !== 'HR') {
          const children = parseNodes();
          children.forEach(child => el.appendChild(child));

          if (index < length && html.startsWith('</', index)) {
            const closeTagEnd = html.indexOf('>', index);
            if (closeTagEnd !== -1) {
              index = closeTagEnd + 1;
            } else {
              index = length;
            }
          }
        }

        nodes.push(el);
      }
      return nodes;
    };

    const parsed = parseNodes();
    parsed.forEach(child => this.appendChild(child));
  }
}

function matches(node, selector) {
  if (!selector) return false;
  const parts = selector.match(/^([a-z0-9\-]+)?(#([a-z0-9\-]+))?(\.([a-z0-9\-]+))?(\[([a-z0-9\-]+)=(['"])(.*?)\8\])?$/i);
  if (!parts) {
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
    return node.tagName === selector.toUpperCase();
  }
  const tag = parts[1];
  const id = parts[3];
  const className = parts[5];
  const attrName = parts[7];
  const attrVal = parts[9];
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  if (id && node.id !== id) return false;
  if (className && !node.classList.contains(className)) return false;
  if (attrName && node.getAttribute(attrName) !== attrVal) return false;
  return true;
}

export async function setupMockDOM(htmlPath, jsonDbPath) {
  const htmlContent = await fs.readFile(htmlPath, 'utf8');
  const dbContent = await fs.readFile(jsonDbPath, 'utf8');
  const dbData = JSON.parse(dbContent);

  const elements = {
    'uif-app': new MockElement('div', 'uif-app', 'uif-container'),
    'uif-search-input': new MockElement('input', 'uif-search-input'),
    'uif-category-list': new MockElement('div', 'uif-category-list'),
    'uif-stats-count': new MockElement('div', 'uif-stats-count'),
    'uif-sort-select': new MockElement('select', 'uif-sort-select'),
    'uif-results-grid': new MockElement('div', 'uif-results-grid'),
    'uif-heading': new MockElement('h1')
  };
  elements['uif-stats-count'].textContent = 'Loading Database...';
  elements['uif-heading'].textContent = 'Universal Item Finder';

  const option1 = new MockElement('option');
  option1.value = 'name_asc';
  option1.textContent = 'Name (A-Z)';
  const option2 = new MockElement('option');
  option2.value = 'price_asc';
  option2.textContent = 'Price (Low-High)';
  const option3 = new MockElement('option');
  option3.value = 'price_desc';
  option3.textContent = 'Price (High-Low)';
  
  elements['uif-sort-select'].appendChild(option1);
  elements['uif-sort-select'].appendChild(option2);
  elements['uif-sort-select'].appendChild(option3);
  elements['uif-sort-select'].value = 'name_asc';

  const window = {
    location: { href: 'http://localhost/item-finder.html' },
    addEventListener: () => {}
  };

  const document = {
    readyState: 'complete',
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      if (selector === 'body') return new MockElement('body');
      if (selector.startsWith('#')) {
        return this.getElementById(selector.slice(1));
      }
      for (const el of Object.values(elements)) {
        if (matches(el, selector)) return el;
        const found = el.querySelector(selector);
        if (found) return found;
      }
      return null;
    },
    querySelectorAll(selector) {
      const all = [];
      for (const el of Object.values(elements)) {
        if (matches(el, selector)) all.push(el);
        all.push(...el.querySelectorAll(selector));
      }
      return all;
    },
    createElement(tagName) {
      return new MockElement(tagName);
    },
    addEventListener(event, cb) {
      if (event === 'DOMContentLoaded') {
        setTimeout(cb, 0);
      }
    }
  };

  const result = {
    elements,
    document,
    dbData,
    runScript: async (scriptPath) => {
      const code = await fs.readFile(scriptPath, 'utf8');
      const context = vm.createContext({
        window,
        document,
        fetch: (url) => global.fetch(url),
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
      });
      vm.runInContext(code, context);
    },
    async wait(ms = 10) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };

  const fetchMock = async (url) => {
    if (url === '/assets/universal-items.json') {
      return {
        ok: true,
        json: async () => result.dbData
      };
    }
    throw new Error(`Fetch not mocked for URL: ${url}`);
  };

  global.window = window;
  global.document = document;
  global.fetch = fetchMock;

  return result;
}
