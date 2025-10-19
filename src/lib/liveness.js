let loadingPromise;

export function loadLivenessModule() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Liveness module доступен только в браузере'));
  }

  if (window._livenessModuleReady) {
    return Promise.resolve(window._livenessModuleReady);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    if (window.Module && window.Module._nentendo) {
      window._livenessModuleReady = window.Module;
      resolve(window.Module);
      return;
    }

    const Module = window.Module || {};
    Module.locateFile = (path) => `/wasm/${path}`;
    Module.onRuntimeInitialized = () => {
      window._livenessModuleReady = Module;
      resolve(Module);
    };
    window.Module = Module;

    const script = document.createElement('script');
    script.src = '/wasm/Emscrippeng_test.js';
    script.async = true;
    script.onerror = () => reject(new Error('Не удалось загрузить модуль проверки подлинности'));

    document.body.appendChild(script);
  });

  return loadingPromise;
}

export async function evaluateLiveness(base64Image) {
  const Module = await loadLivenessModule();

  const encoder = new TextEncoder();
  const data = encoder.encode(base64Image);
  const pointer = Module._malloc(data.length + 1);
  Module.HEAPU8.set(data, pointer);
  Module.HEAPU8[pointer + data.length] = 0;
  const result = Module._nentendo(pointer);
  Module._free(pointer);
  return result;
}
