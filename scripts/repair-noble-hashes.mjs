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
const viemNestedNoblePath = path.join(
  projectRoot,
  "node_modules",
  "viem",
  "node_modules",
  "@noble"
);
const viemNestedHashesPath = path.join(viemNestedNoblePath, "hashes");
const viemNestedHashesPackagePath = path.join(
  viemNestedHashesPath,
  "package.json"
);

const readPackage = (packagePath) => {
  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    return null;
  }
};

const hasSha2Export = (packageJson) =>
  Boolean(packageJson?.exports?.["./sha2"]);

const assertSafeNestedPath = () => {
  const nestedPath = path.resolve(viemNestedHashesPath);
  const allowedParent = path.resolve(viemNestedNoblePath);
  const relative = path.relative(allowedParent, nestedPath);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to repair unexpected path: ${nestedPath}`);
  }
};

const rootHashesPackage = readPackage(rootHashesPackagePath);

if (!hasSha2Export(rootHashesPackage)) {
  throw new Error(
    "Root @noble/hashes install does not export ./sha2; run yarn install before building."
  );
}

const nestedHashesPackage = readPackage(viemNestedHashesPackagePath);

if (nestedHashesPackage && !hasSha2Export(nestedHashesPackage)) {
  assertSafeNestedPath();
  fs.rmSync(viemNestedHashesPath, { recursive: true, force: true });
  console.log(
    "Removed stale viem nested @noble/hashes package without ./sha2 export."
  );
}

await import("@noble/hashes/sha2");
