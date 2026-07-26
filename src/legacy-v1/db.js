/* ============================================================
   Philosophy Reading Journal — IndexedDB Storage Layer
   Uses the 'idb' library for a clean Promise-based API.
   All data stays local in the browser.
   ============================================================ */

import { openDB } from 'idb';

const DB_NAME = 'philosophy-journal';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Books store
        if (!db.objectStoreNames.contains('books')) {
          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('archived', 'archived');
          bookStore.createIndex('createdAt', 'createdAt');
        }

        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('bookId', 'bookId');
          noteStore.createIndex('category', 'category');
          noteStore.createIndex('createdAt', 'createdAt');
        }

        // Reading sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('bookId', 'bookId');
          sessionStore.createIndex('date', 'date');
        }

        // PDFs store (binary data)
        if (!db.objectStoreNames.contains('pdfs')) {
          const pdfStore = db.createObjectStore('pdfs', { keyPath: 'id' });
          pdfStore.createIndex('bookId', 'bookId');
        }

        // PDF annotations store
        if (!db.objectStoreNames.contains('pdfAnnotations')) {
          const annotStore = db.createObjectStore('pdfAnnotations', { keyPath: 'id' });
          annotStore.createIndex('pdfId', 'pdfId');
          annotStore.createIndex('page', 'page');
        }

        // Art gallery store
        if (!db.objectStoreNames.contains('artworks')) {
          const artStore = db.createObjectStore('artworks', { keyPath: 'id' });
          artStore.createIndex('createdAt', 'createdAt');
        }

        // Drawings/whiteboard store
        if (!db.objectStoreNames.contains('drawings')) {
          const drawStore = db.createObjectStore('drawings', { keyPath: 'id' });
          drawStore.createIndex('bookId', 'bookId');
          drawStore.createIndex('noteId', 'noteId');
        }

        // App state store (key-value for settings, last position, etc.)
        if (!db.objectStoreNames.contains('appState')) {
          db.createObjectStore('appState', { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

// ─── Generic CRUD helpers ────────────────────────────────────

export async function getAll(storeName) {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function getById(storeName, id) {
  const db = await getDB();
  return db.get(storeName, id);
}

export async function put(storeName, item) {
  const db = await getDB();
  return db.put(storeName, item);
}

export async function deleteItem(storeName, id) {
  const db = await getDB();
  return db.delete(storeName, id);
}

export async function getAllByIndex(storeName, indexName, value) {
  const db = await getDB();
  return db.getAllFromIndex(storeName, indexName, value);
}

export async function clearStore(storeName) {
  const db = await getDB();
  return db.clear(storeName);
}

// ─── App State helpers (key-value store) ─────────────────────

export async function getState(key, defaultValue = null) {
  const db = await getDB();
  const result = await db.get('appState', key);
  return result ? result.value : defaultValue;
}

export async function setState(key, value) {
  const db = await getDB();
  return db.put('appState', { key, value });
}

// ─── Book-specific helpers ───────────────────────────────────

export async function getActiveBooks() {
  const db = await getDB();
  const all = await db.getAll('books');
  return all.filter(b => !b.archived);
}

export async function getArchivedBooks() {
  const db = await getDB();
  const all = await db.getAll('books');
  return all.filter(b => b.archived);
}

// ─── Notes by book ───────────────────────────────────────────

export async function getNotesByBook(bookId) {
  return getAllByIndex('notes', 'bookId', bookId);
}

// ─── Sessions by book ────────────────────────────────────────

export async function getSessionsByBook(bookId) {
  return getAllByIndex('sessions', 'bookId', bookId);
}

// ─── PDF helpers ─────────────────────────────────────────────

export async function getPDFByBook(bookId) {
  const pdfs = await getAllByIndex('pdfs', 'bookId', bookId);
  return pdfs.length > 0 ? pdfs[0] : null;
}

export async function getAnnotationsByPDF(pdfId) {
  return getAllByIndex('pdfAnnotations', 'pdfId', pdfId);
}

// ─── Export all data ─────────────────────────────────────────

export async function exportAllData() {
  const db = await getDB();
  const data = {
    version: DB_VERSION,
    exportDate: new Date().toISOString(),
    books: await db.getAll('books'),
    notes: await db.getAll('notes'),
    sessions: await db.getAll('sessions'),
    artworks: await db.getAll('artworks'),
    drawings: await db.getAll('drawings'),
    appState: await db.getAll('appState')
  };
  // Note: PDFs and images are excluded from export due to size
  return data;
}

// ─── Import data ─────────────────────────────────────────────

export async function importData(data) {
  const db = await getDB();
  const tx = db.transaction(['books', 'notes', 'sessions', 'artworks', 'drawings', 'appState'], 'readwrite');
  
  if (data.books) for (const item of data.books) await tx.objectStore('books').put(item);
  if (data.notes) for (const item of data.notes) await tx.objectStore('notes').put(item);
  if (data.sessions) for (const item of data.sessions) await tx.objectStore('sessions').put(item);
  if (data.artworks) for (const item of data.artworks) await tx.objectStore('artworks').put(item);
  if (data.drawings) for (const item of data.drawings) await tx.objectStore('drawings').put(item);
  if (data.appState) for (const item of data.appState) await tx.objectStore('appState').put(item);
  
  await tx.done;
}

export default {
  getAll, getById, put, deleteItem, getAllByIndex, clearStore,
  getState, setState,
  getActiveBooks, getArchivedBooks,
  getNotesByBook, getSessionsByBook,
  getPDFByBook, getAnnotationsByPDF,
  exportAllData, importData
};
