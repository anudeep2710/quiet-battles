"use strict";

const { initializeDatabase, readContent } = require("../db");

initializeDatabase()
  .then(readContent)
  .then((content) => {
    console.log("Neon database ready: " + content.series.chapters.length +
      " chapters, " + content.products.length + " products.");
  })
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  });
