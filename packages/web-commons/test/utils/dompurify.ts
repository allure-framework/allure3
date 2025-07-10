import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost'
});

const window = dom.window as unknown as Window & typeof globalThis;

export const sanitizer = DOMPurify(window); 