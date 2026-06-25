import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

async function main() {
  console.log("Building API bundle...");
  
  try {
    await build({
      entryPoints: [join(rootDir, "api", "index.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: join(rootDir, "api", "bundle.js"),
      sourcemap: true,
      target: "node22",
      splitting: false,
      resolveExtensions: [".ts", ".js", ".json"],
      // Use globalThis instead of const to avoid redeclaration conflicts
      banner: {
        js: `import { createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
const require = createRequire(import.meta.url);
globalThis.__filename = _fileURLToPath(import.meta.url);
globalThis.__dirname = _dirname(globalThis.__filename);`,
      },
    });
    
    console.log("API bundle built successfully: api/bundle.js");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

main();
