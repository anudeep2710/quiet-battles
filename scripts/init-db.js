"use strict";

const { initializeDatabase, readContent } = require("../db");

initializeDatabase()
  .then(readContent)
  .then((content) => {
    const chapterCount = content.seriesList.reduce((total, series) => total + series.chapters.length, 0);
    console.log("Neon database ready: " + content.seriesList.length + " Series, " +
      chapterCount + " Chapters, " + content.products.length + " product" + (content.products.length === 1 ? "" : "s") + ".");
  })
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  });
