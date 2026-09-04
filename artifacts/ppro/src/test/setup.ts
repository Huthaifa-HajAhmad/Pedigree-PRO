import "@testing-library/jest-dom/vitest";

const mockStore = new Map<string, any>();

function createMockStore(tx: any) {
  return {
    transaction: tx,
    get: (key: string) => {
      const req: any = {};
      setTimeout(() => {
        req.result = mockStore.get(key);
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
    put: (val: any, key: string) => {
      mockStore.set(key, val);
      const req: any = {};
      setTimeout(() => {
        req.result = key;
        if (req.onsuccess) req.onsuccess();
        if (tx.oncomplete) tx.oncomplete();
      }, 0);
      return req;
    },
    getAllKeys: () => {
      const req: any = {};
      setTimeout(() => {
        req.result = Array.from(mockStore.keys());
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
    delete: (key: string) => {
      mockStore.delete(key);
      const req: any = {};
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
        if (tx.oncomplete) tx.oncomplete();
      }, 0);
      return req;
    },
    clear: () => {
      mockStore.clear();
      const req: any = {};
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
        if (tx.oncomplete) tx.oncomplete();
      }, 0);
      return req;
    },
  };
}

const dbMock: any = {
  createObjectStore: () => {},
  transaction: (_storeName: string, _mode: string) => {
    const tx: any = {};
    const store = createMockStore(tx);
    tx.objectStore = () => store;
    setTimeout(() => {
      if (tx.oncomplete) tx.oncomplete();
    }, 0);
    return tx;
  },
};

if (typeof globalThis.indexedDB === "undefined") {
  globalThis.indexedDB = {
    open: () => {
      const req: any = { result: dbMock };
      setTimeout(() => {
        if (req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
  } as any;
}