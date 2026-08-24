// Metro in a monorepo needs to be told two things, or @notch/core resolves to
// nothing: which folders to watch beyond this project, and where to look for
// modules once hoisting has moved them to the workspace root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// packages/core is TypeScript source, so Metro must watch it to pick up edits.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Without this, Metro walks up the tree and can find two copies of React —
// the classic monorepo "Invalid hook call" failure.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
