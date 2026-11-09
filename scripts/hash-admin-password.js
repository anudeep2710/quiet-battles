"use strict";

const crypto = require("node:crypto");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const password = input.replace(/\r?\n$/, "");
  if (password.length < 12 || password.length > 128) {
    console.error("Use a password between 12 and 128 characters.");
    process.exitCode = 1;
    return;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  process.stdout.write(salt + ":" + hash + "\n");
});
