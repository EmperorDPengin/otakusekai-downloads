// Mac only: gives the app a free "ad-hoc" signature. Without any signature, macOS on Apple Silicon calls a downloaded app "damaged".
const { execFileSync } = require("child_process");
const path = require("path");
exports.default = async function (context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
};
