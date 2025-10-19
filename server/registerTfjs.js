const Module = require('module');

const originalLoad = Module._load;

Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === '@tensorflow/tfjs-node') {
    return originalLoad.call(this, '@tensorflow/tfjs', parent, isMain);
  }

  return originalLoad.call(this, request, parent, isMain);
};
