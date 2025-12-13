const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const projectRoot = path.join(__dirname, "..");
const srcDir = fs.existsSync(path.join(projectRoot, "src"))
    ? path.join(projectRoot, "src")
    : projectRoot;

function resolveSrc(file) {
    return path.join(srcDir, file);
}

function stubModule(absPath, exportsObj) {
    const m = new Module(absPath);
    m.filename = absPath;
    m.loaded = true;
    m.exports = exportsObj;
    require.cache[absPath] = m;
}

function clearModule(absPath) {
    delete require.cache[absPath];
}

module.exports = { resolveSrc, stubModule, clearModule };