import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create a DOM environment for DOMPurify
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost'
});

// Make DOMPurify available globally
global.DOMPurify = DOMPurify(dom.window);
global.window = dom.window;
global.document = dom.window.document; 