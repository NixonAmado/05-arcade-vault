// PostToolUse hook: corre `eslint --fix` sobre el archivo editado/escrito.
import { spawnSync } from "node:child_process";
import { extname, join } from "node:path";

const EXTS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".md"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const file = JSON.parse(raw || "{}").tool_input?.file_path;
if (!file || !EXTS.has(extname(file).toLowerCase())) process.exit(0);
if (/[\/](node_modules|\.next)[\/]/.test(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const bin = join(root, "node_modules", "eslint", "bin", "eslint.js");

const r = spawnSync(process.execPath, [bin, "--fix", "--no-warn-ignored", file], {
  cwd: root,
  encoding: "utf8",
});

// exit 2 => el error de lint llega a Claude para que lo corrija
if (r.status !== 0) {
  process.stderr.write((r.stdout || "") + (r.stderr || ""));
  process.exit(2);
}
