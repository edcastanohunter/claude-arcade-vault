const { execSync } = require("child_process");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input && input.tool_input.file_path;
    if (!filePath) return;

    const match = filePath.match(/\.(tsx?|jsx?|md)$/i);
    if (!match) return;

    const isMarkdown = /\.md$/i.test(filePath);

    execSync(`npx prettier --write "${filePath}"`, { stdio: "inherit" });
    if (!isMarkdown) {
      execSync(`npx eslint --fix "${filePath}"`, { stdio: "inherit" });
    }
  } catch {
    // Never block the tool call on formatting/lint failures.
  }
});
