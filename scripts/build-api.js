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
      // Bundle everything into a single file
      splitting: false,
      // Ensure all dependencies are resolved
      resolveExtensions: [".ts", ".js", ".json"],
      // Define __dirname for bundled files
      banner: {
        js: `import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);`,
      },
    });
    
    console.log("API bundle built successfully: api/bundle.js");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

main();
