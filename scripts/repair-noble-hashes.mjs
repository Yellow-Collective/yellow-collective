import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const rootHashesPath = path.join(
  projectRoot,
  "node_modules",
  "@noble",
  "hashes"
);
const rootHashesPackagePath = path.join(rootHashesPath, "package.json");
const nodeModulesPath = path.join(projectRoot, "node_modules");
const requiredExports = ["./sha2", "./utils", "./utils.js"];

const readPackage = (packagePath) => {
  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    return null;
  }
};

const hasRequiredExports = (packageJson) =>
  requiredExports.every((exportPath) =>
    Boolean(packageJson?.exports?.[exportPath])
  );

const assertSafeNestedPath = (hashesPath) => {
  const nestedPath = path.resolve(hashesPath);
  const allowedParent = path.resolve(nodeModulesPath);
  const relative = path.relative(allowedParent, nestedPath);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to repair unexpected path: ${nestedPath}`);
  }

  if (
    !nestedPath.endsWith(
      `${path.sep}node_modules${path.sep}@noble${path.sep}hashes`
    )
  ) {
    throw new Error(`Refusing to repair non-package path: ${nestedPath}`);
  }
};

const findNestedHashesPackages = (searchRoot) => {
  const packagePaths = [];

  if (!fs.existsSync(searchRoot)) {
    return packagePaths;
  }

  const walk = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const entryPath = path.join(directory, entry.name);

      if (entry.name === ".cache" || entry.name === ".next") {
        continue;
      }

      if (
        entry.name === "hashes" &&
        path.basename(path.dirname(entryPath)) === "@noble"
      ) {
        packagePaths.push(path.join(entryPath, "package.json"));
        continue;
      }

      walk(entryPath);
    }
  };

  walk(searchRoot);
  return packagePaths;
};

const rootHashesPackage = readPackage(rootHashesPackagePath);

if (!hasRequiredExports(rootHashesPackage)) {
  throw new Error(
    `Root @noble/hashes install does not export ${requiredExports.join(", ")}; run yarn install before building.`
  );
}

for (const packagePath of findNestedHashesPackages(nodeModulesPath)) {
  if (path.resolve(packagePath) === path.resolve(rootHashesPackagePath)) {
    continue;
  }

  const nestedHashesPackage = readPackage(packagePath);

  if (nestedHashesPackage && !hasRequiredExports(nestedHashesPackage)) {
    const nestedHashesPath = path.dirname(packagePath);
    assertSafeNestedPath(nestedHashesPath);
    fs.rmSync(nestedHashesPath, { recursive: true, force: true });
    console.log(
      `Removed stale nested @noble/hashes package without required exports: ${path.relative(
        projectRoot,
        nestedHashesPath
      )}`
    );
  }
}

await import("@noble/hashes/sha2");
await import("@noble/hashes/utils.js");
