const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

module.exports = function loadTs(name, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "../src", /\.tsx?$/.test(name) ? name : `${name}.ts`);
  if (cache.has(filename)) return cache.get(filename).exports;
  const result = { exports: {} };
  cache.set(filename, result);
  const localRequire = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith(".")) return module.exports(path.resolve(path.dirname(filename), id), mocks, cache);
    throw new Error(`Unexpected native dependency in pure test: ${id}`);
  };
  const source = fs.readFileSync(filename, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("module", "exports", "require", code)(result, result.exports, localRequire);
  return result.exports;
};
