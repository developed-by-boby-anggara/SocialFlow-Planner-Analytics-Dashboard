/**
 * SocialFlow V3 - Core Kernel & Data Layer
 * File: modules/core.js
 * Lingkungan: Browser Runtime (React 18 UMD + Babel Standalone + Firebase Compat)
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  // 1. Safe Diagnostic Logger
  const Logger = {
    info: (tag, msg) => console.log(`%c[SF-INFO][${tag}]`, 'color: #0284c7; font-weight: bold;', msg),
    warn: (tag, msg) => console.warn(`[SF-WARN][${tag}]`, msg),
    error: (tag, msg, err) => {
      console.error(`[SF-ERROR][${tag}] ${msg}`, err ? (err.message || err.code || '') : '');
    }
  };

  // 2. Event Bus Ringan
  const listeners = new Map();
  const EventBus = {
    on: (eventName, callback) => {
      if (typeof callback !== 'function') return () => {};
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      const handlers = listeners.get(eventName);
      handlers.add(callback);
      return () => handlers.delete(callback);
    },
    emit: (eventName, payload) => {
      if (!listeners.has(eventName)) return;
      const handlers = listeners.get(eventName);
      handlers.forEach((callback) => {
        try {
          callback(payload);
        } catch (err) {
          Logger.error('EventBus', `Gagal mengeksekusi listener untuk event: ${eventName}`, err);
        }
      });
    }
  };

  // 3. Workspace Context
  const CONTEXT_STORAGE_KEY = 'sf_active_context';
  let currentContext = {
    workspaceId: 'default-workspace',
    workspaceName: 'Personal Workspace',
    role: 'owner',
    activePlatform: 'All'
  };

  try {
    const cachedContext = localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (cachedContext) {
      currentContext = { ...currentContext, ...JSON.parse(cachedContext) };
    }
  } catch (e) {
    Logger.warn('Context', 'Gagal membaca cache context, menggunakan default.');
  }

  const Context = {
    get: () => ({ ...currentContext }),
    set: (partial) => {
      currentContext = { ...currentContext, ...partial };
      try {
        localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(currentContext));
      } catch (e) {
        Logger.warn('Context', 'Gagal menyimpan context ke localStorage.');
      }
      EventBus.emit('context:changed', currentContext);
    }
  };

  // 4. Module Registry
  const moduleInstances = new Map();
  const moduleMetadata = new Map();

  const Registry = {
    register: (id, factory, meta = {}) => {
      if (moduleInstances.has(id)) {
        Logger.warn('Registry', `Modul ${id} sudah terdaftar.`);
        return false;
      }
      try {
        moduleMetadata.set(id, {
          id,
          name: meta.name || id,
          version: meta.version || '1.0.0',
          dependencies: meta.dependencies || [],
          status: 'registered'
        });

        const instance = factory({
          context: Context,
          events: EventBus,
          data: DataAdapter,
          logger: {
            info: (msg) => Logger.info(id, msg),
            warn: (msg) => Logger.warn(id, msg),
            error: (msg, err) => Logger.error(id, msg, err)
          }
        });

        moduleInstances.set(id, instance);
        moduleMetadata.get(id).status = 'active';
        Logger.info('Registry', `Modul [${id}] berhasil diinisialisasi.`);
        EventBus.emit('module:registered', { id });
        return true;
      } catch (err) {
        if (moduleMetadata.has(id)) {
          moduleMetadata.get(id).status = 'failed';
        }
        Logger.error('Registry', `Gagal menginisialisasi modul [${id}]`, err);
        return false;
      }
    },
    get: (id) => moduleInstances.get(id),
    list: () => Array.from(moduleMetadata.values())
  };

  // 5. Firebase Data Adapter
  let activeSubscriptions = new Map();

  const DataAdapter = {
    getDb: () => {
      if (window.firestoreDb) return window.firestoreDb;
      if (window.firebase && window.firebase.firestore) {
        return window.firebase.firestore();
      }
      return null;
    },

    subscribeContents: (onSuccess, onError) => {
      const db = DataAdapter.getDb();
      if (!db) {
        Logger.warn('DataAdapter', 'Firestore belum aktif, membaca dari cache lokal.');
        try {
          const localData = JSON.parse(localStorage.getItem('sf_contents') || '[]');
          onSuccess(localData);
        } catch (e) {
          onSuccess([]);
        }
        return () => {};
      }

      if (activeSubscriptions.has('contents')) {
        activeSubscriptions.get('contents')();
        activeSubscriptions.delete('contents');
      }

      try {
        const unsubscribe = db.collection('contents')
          .orderBy('createdAt', 'desc')
          .onSnapshot(
            (snapshot) => {
              const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              try {
                localStorage.setItem('sf_contents', JSON.stringify(data));
              } catch (_) {}
              onSuccess(data);
            },
            (err) => {
              Logger.error('DataAdapter', 'Listener Firestore contents error', err);
              try {
                const localData = JSON.parse(localStorage.getItem('sf_contents') || '[]');
                onSuccess(localData);
              } catch (_) {
                if (onError) onError(err);
              }
            }
          );

        activeSubscriptions.set('contents', unsubscribe);
        return () => {
          unsubscribe();
          activeSubscriptions.delete('contents');
        };
      } catch (err) {
        Logger.error('DataAdapter', 'Gagal memasang snapshot listener', err);
        if (onError) onError(err);
        return () => {};
      }
    },

    saveContent: async (contentPayload) => {
      const db = DataAdapter.getDb();
      const ctx = Context.get();

      const payload = {
        ...contentPayload,
        workspaceId: contentPayload.workspaceId || ctx.workspaceId,
        updatedAt: new Date().toISOString()
      };

      if (!payload.createdAt) {
        payload.createdAt = new Date().toISOString();
      }

      if (db) {
        try {
          const docId = payload.id || `cnt-${Date.now()}`;
          payload.id = docId;
          await db.collection('contents').doc(docId).set(payload, { merge: true });
          Logger.info('DataAdapter', `Konten [${docId}] berhasil disimpan.`);
          EventBus.emit('content:saved', payload);
          return { success: true, id: docId, source: 'firestore' };
        } catch (err) {
          Logger.error('DataAdapter', 'Gagal menulis ke Firestore, menyimpan ke lokal.', err);
        }
      }

      try {
        const localData = JSON.parse(localStorage.getItem('sf_contents') || '[]');
        const existingIdx = localData.findIndex(item => item.id === payload.id);
        if (existingIdx >= 0) {
          localData[existingIdx] = payload;
        } else {
          payload.id = payload.id || `cnt-${Date.now()}`;
          localData.unshift(payload);
        }
        localStorage.setItem('sf_contents', JSON.stringify(localData));
        EventBus.emit('content:saved', payload);
        return { success: true, id: payload.id, source: 'localStorage' };
      } catch (localErr) {
        return { success: false, error: localErr.message };
      }
    },

    deleteContent: async (contentId) => {
      const db = DataAdapter.getDb();
      if (db) {
        try {
          await db.collection('contents').doc(contentId).delete();
          Logger.info('DataAdapter', `Konten [${contentId}] berhasil dihapus.`);
        } catch (err) {
          Logger.error('DataAdapter', 'Gagal menghapus dari Firestore.', err);
        }
      }

      try {
        const localData = JSON.parse(localStorage.getItem('sf_contents') || '[]');
        const updated = localData.filter(item => item.id !== contentId);
        localStorage.setItem('sf_contents', JSON.stringify(updated));
        EventBus.emit('content:deleted', { id: contentId });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  };

  SF.Core = {
    Logger,
    EventBus,
    Context,
    Registry,
    DataAdapter
  };

  Logger.info('Core', 'SocialFlow V3 Kernel Core initialized successfully.');

})(window);
