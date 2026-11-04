"use strict";

const root = document.getElementById("app");
let content = null;
let cart = readCart();
let cartOpen = false;
let adminToken = sessionStorage.getItem("qbAdminToken") || "";
let adminMessage = "";
let noticeTimer = null;
let sizeSelection = {};

function readCart() {
  try { return JSON.parse(localStorage.getItem("qbCart") || "[]"); }
  catch { return []; }
}

function saveCart() {
  localStorage.setItem("qbCart", JSON.stringify(cart));
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
  });
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function currentRoute() {
  return (location.hash || "#home").slice(1).split("/");
}

function navLink(label, href) {
  return '<a href="' + href + '">' + label + "</a>";
}

function imageFrame(src, alt, className) {
  return '<div class="' + (className || "image-frame") + '"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy"></div>';
}

function getChapter(slug) {
  return content.series.chapters.find(function (item) { return item.slug === slug; }) || content.series.chapters[0];
}

function getProduct(slug) {
  return content.products.find(function (item) { return item.slug === slug; }) || content.products[0];
}

function renderHeader() {
  return '<div class="topline">A quieter kind of strength · Series 01 now open</div>' +
    '<header class="site-header"><div class="nav-wrap">' +
      '<a class="wordmark" href="#home" aria-label="Quiet Battles home">' + escapeHtml(content.brand.name) + '<sup>™</sup></a>' +
      '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>' +
      '<nav class="nav-links" id="main-nav" aria-label="Main navigation">' +
        navLink("The archive", "#archive") +
        navLink("Series 01", "#series") +
        navLink("Our note", "#belief") +
      '</nav>' +
      '<div class="nav-actions"><a href="#admin">Studio</a><button class="cart-trigger" type="button" data-cart-open>Bag <span class="cart-count">(' + cart.reduce(function (sum, item) { return sum + item.qty; }, 0) + ')</span></button></div>' +
    '</div></header>';
}

function renderFooter() {
  return '<footer class="site-footer"><div class="page">' +
    '<div class="footer-main">' +
      '<h2>For what<br>you carry.</h2>' +
      '<p class="footer-note">' + escapeHtml(content.brand.intro) + '</p>' +
      '<div class="footer-links"><a href="#archive">Explore the archive</a><a href="#product/' + escapeHtml(content.products[0].slug) + '">The Gentle Armor</a><a href="#admin">Studio access</a></div>' +
    '</div>' +
    '<div class="footer-bottom"><span>© 2026 ' + escapeHtml(content.brand.name) + '™</span><span>' + escapeHtml(content.brand.tagline) + '</span><span>Independent demo experience</span></div>' +
  '</div></footer>';
}

function chapterCards() {
  return content.series.chapters.map(function (chapter, index) {
    const marker = index === 0 ? "FULL CHAPTER" : "SERIES NOTE";
    return '<a class="chapter-card" href="#chapter/' + escapeHtml(chapter.slug) + '">' +
      '<span class="mono">' + escapeHtml(chapter.number) + ' <span aria-hidden="true">·</span> ' + marker + '</span>' +
      '<h3>' + escapeHtml(chapter.title) + '</h3>' +
      '<p>' + escapeHtml(chapter.excerpt) + '</p>' +
      '<span class="card-link">Read this chapter <span class="arrow">↗</span></span>' +
    '</a>';
  }).join("");
}

function renderHome() {
  const product = content.products[0];
  const firstChapter = content.series.chapters[0];
  return '<main>' +
    '<section class="hero">' +
      '<div class="hero-copy">' +
        '<div class="eyebrow mono">' + escapeHtml(content.hero.eyebrow) + '</div>' +
        '<h1>' + content.hero.title.split("<br>").map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") + '</h1>' +
        '<p class="hero-description">' + escapeHtml(content.hero.description) + '</p>' +
        '<div class="hero-action-row"><a class="button" href="#archive">Enter the archive <span class="arrow">↗</span></a><span class="hero-caption">Stories stitched<br>into the everyday</span></div>' +
      '</div>' +
      '<div class="hero-image"><img src="' + escapeHtml(content.hero.image) + '" alt="A QUIET BATTLES editorial portrait" fetchpriority="high"><span class="hero-stamp">No battle is<br>too quiet to count.</span></div>' +
      '<span class="hero-thread" aria-hidden="true"></span>' +
    '</section>' +
    '<section class="page intro" id="belief">' +
      '<div class="intro-mark"><span class="stitch"></span><span class="eyebrow mono">' + escapeHtml(content.introduction.eyebrow) + '</span></div>' +
      '<div><h2>' + escapeHtml(content.introduction.title) + '</h2><p>' + escapeHtml(content.introduction.copy) + '</p></div>' +
    '</section>' +
    '<section class="page section">' +
      '<div class="section-head"><div><span class="mono section-label">A thought to keep</span><h2>Room to be<br>human.</h2></div><p>Clothing can be a small, daily act of care. A layer that lets you meet yourself where you are.</p></div>' +
      '<div class="belief-grid">' +
        imageFrame(firstChapter.image, "A quiet portrait from The Gentle Armor story", "belief-image") +
        '<div class="belief-note"><span class="mono">FIELD NOTE 001 · THE GENTLE ARMOR</span><blockquote>“You do not have to feel <em>ready</em> to begin.”</blockquote><div class="belief-foot"><p>We believe softness is something you can choose, especially on the days it takes effort.</p><span class="mono">QB / 01</span></div></div>' +
      '</div>' +
    '</section>' +
    '<section class="series-band"><div class="series-intro">' +
      '<div class="series-copy"><span class="mono section-label">' + escapeHtml(content.series.number) + ' · THE ARCHIVE</span><h2>' + escapeHtml(content.series.title) + '</h2><p class="subtitle">' + escapeHtml(content.series.subtitle) + '</p><p class="description">' + escapeHtml(content.series.description) + '</p><a class="button" href="#series">Open the series <span class="arrow">↗</span></a></div>' +
      '<figure class="series-image"><img src="' + escapeHtml(content.series.image) + '" alt="The Gentle Armor collection portrait" loading="lazy"><figcaption class="mono">A study in everyday courage</figcaption></figure>' +
    '</div><div class="page chapter-list">' + chapterCards() + '</div></section>' +
    '<section class="page section product-feature">' +
      '<div class="product-photo"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><span class="product-stamp mono">FIELD PIECE 001</span></div>' +
      '<div class="product-copy"><span class="mono section-label">FROM THE SERIES · CHAPTER 01</span><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.description) + '</p><div class="price">' + money(product.price) + '<small>Sample price · INR</small></div><div class="product-details">' + product.details.map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") + '</div><a class="button button-dark" href="#product/' + escapeHtml(product.slug) + '">View the piece <span class="arrow">↗</span></a></div>' +
    '</section>' +
  '</main>';
}

function renderArchive() {
  return '<main><section class="archive-hero"><div class="page"><span class="mono section-label">THE QUIET BATTLES ARCHIVE</span><h1 class="page-title">Stories to<br>wear with you.</h1><p class="lead">A growing collection of chapters, objects, and small reminders for the lives we are living between the lines.</p></div></section>' +
    '<section class="page archive-list"><article class="archive-item"><div class="archive-art"><img src="' + escapeHtml(content.series.image) + '" alt="Series 01 — The Gentle Armor" fetchpriority="high"><span class="hero-stamp">Series 01 · five chapters</span></div><div class="archive-copy"><span class="mono section-label">' + escapeHtml(content.series.number) + '</span><h2 class="page-title">' + escapeHtml(content.series.title) + '</h2><p>' + escapeHtml(content.series.subtitle) + '</p><p>' + escapeHtml(content.series.description) + '</p><a class="button button-dark" href="#series">Explore this series <span class="arrow">↗</span></a></div></article></section></main>';
}

function renderSeries() {
  return '<main><section class="series-band"><div class="series-intro">' +
    '<div class="series-copy"><span class="mono section-label">' + escapeHtml(content.series.number) + ' · THE ARCHIVE</span><h1>' + escapeHtml(content.series.title) + '</h1><p class="subtitle">' + escapeHtml(content.series.subtitle) + '</p><p class="description">' + escapeHtml(content.series.description) + '</p><span class="hero-caption">Five chapters · One continuous thread</span></div>' +
    '<figure class="series-image"><img src="' + escapeHtml(content.series.image) + '" alt="The Gentle Armor series" fetchpriority="high"><figcaption class="mono">The Gentle Armor · 2026</figcaption></figure>' +
    '</div><div class="page chapter-list">' + chapterCards() + '</div></section>' +
    '<section class="page section"><div class="section-head"><div><span class="mono section-label">THE THREAD</span><h2>Keep what<br>helps.</h2></div><p>The series moves from beginning, to carrying, to letting in. Take the order as a suggestion. Start where you need to.</p></div><a class="button button-dark" href="#chapter/' + escapeHtml(content.series.chapters[0].slug) + '">Begin with Chapter 01 <span class="arrow">↗</span></a></section></main>';
}

function renderChapter(slug) {
  const chapter = getChapter(slug);
  const index = content.series.chapters.indexOf(chapter);
  const product = content.products.find(function (item) { return item.slug === chapter.productSlug; }) || content.products[0];
  const story = Array.isArray(chapter.story) ? chapter.story : [];
  const next = content.series.chapters[index + 1];
  const storyBlock = story.length
    ? '<div class="story-copy">' + story.map(function (paragraph, i) { return '<p' + (i === 0 ? ' class="dropcap"' : "") + '>' + escapeHtml(paragraph) + '</p>'; }).join("") + '</div>'
    : '<div class="story-copy"><p>' + escapeHtml(chapter.excerpt) + '</p><p class="chapter-note">This chapter is part of the series preview. The complete story is being shaped for the archive.</p></div>';

  return '<main class="chapter-page">' +
    '<section class="chapter-hero"><div class="chapter-heading"><span class="mono section-label">' + escapeHtml(content.series.number) + ' · ' + escapeHtml(chapter.number) + '</span><h1 class="page-title">' + escapeHtml(chapter.title) + '</h1><p class="excerpt">' + escapeHtml(chapter.excerpt) + '</p><span class="mono">THE GENTLE ARMOR · ' + String(index + 1).padStart(2, "0") + ' / ' + String(content.series.chapters.length).padStart(2, "0") + '</span></div><div class="chapter-visual"><img src="' + escapeHtml(chapter.image) + '" alt="' + escapeHtml(chapter.title) + '" fetchpriority="high"></div></section>' +
    '<section class="page story-layout"><aside class="story-aside"><span class="mono section-label">A NOTE FROM THE ARCHIVE</span><p>' + escapeHtml(content.series.subtitle) + '</p><span class="mono">READ AT YOUR OWN PACE</span></aside>' + storyBlock + '</section>' +
    '<section class="chapter-product"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><div class="chapter-product-copy"><span class="mono section-label">A PIECE FROM THIS CHAPTER</span><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.description) + '</p><a class="button button-dark" href="#product/' + escapeHtml(product.slug) + '">Meet the piece <span class="arrow">↗</span></a></div></section>' +
    '<div class="page">' + (next ? '<a class="chapter-next" href="#chapter/' + escapeHtml(next.slug) + '"><span><span class="mono section-label">NEXT IN THE SERIES</span><strong>' + escapeHtml(next.title) + '</strong></span><span class="arrow">↗</span></a>' : '<a class="chapter-next" href="#series"><span><span class="mono section-label">BACK TO THE SERIES</span><strong>' + escapeHtml(content.series.title) + '</strong></span><span class="arrow">↗</span></a>') + '</div>' +
  '</main>';
}

function renderProduct(slug) {
  const product = getProduct(slug);
  const selection = sizeSelection[product.slug] || "";
  return '<main class="page product-page"><nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="#home">Home</a><span>/</span><a href="#archive">Archive</a><span>/</span><a href="#series">Series 01</a><span>/</span><span>' + escapeHtml(product.name) + '</span></nav>' +
    '<div class="product-detail-layout"><figure class="product-gallery"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" fetchpriority="high"></figure>' +
    '<section class="product-info"><span class="mono section-label">' + escapeHtml(product.category) + ' · SAMPLE PRODUCT</span><h1 class="page-title">' + escapeHtml(product.name) + '</h1><div class="price">' + money(product.price) + '<small>INR · sample price</small></div><p class="product-desc">' + escapeHtml(product.description) + '</p>' +
    '<div class="size-label"><span>Choose your size</span><button class="size-guide" type="button" data-size-guide>Size guide</button></div><div class="size-options">' + product.sizes.map(function (size) { return '<button class="size-option' + (selection === size ? " selected" : "") + '" type="button" data-size="' + escapeHtml(size) + '" data-product="' + escapeHtml(product.slug) + '" aria-pressed="' + (selection === size) + '">' + escapeHtml(size) + '</button>'; }).join("") + '</div><div class="size-help" id="size-help" aria-live="polite"></div>' +
    '<button class="button button-dark" type="button" data-add="' + escapeHtml(product.slug) + '">Add to bag <span class="arrow">↗</span></button><p class="shipping-note">DEMONSTRATION CART · NO PAYMENT OR ORDER IS CREATED</p>' +
    '<div class="accordions"><details class="accordion" open><summary>About the piece</summary><p>' + escapeHtml(product.description) + '</p></details><details class="accordion"><summary>Details and care</summary><ul>' + product.details.map(function (detail) { return "<li>" + escapeHtml(detail) + "</li>"; }).join("") + '<li>Care information is sample copy for this prototype.</li></ul></details><details class="accordion"><summary>From the archive</summary><p>This piece accompanies <a href="#chapter/' + escapeHtml(product.chapterSlug) + '"><u>' + escapeHtml(getChapter(product.chapterSlug).title) + '</u></a>.</p></details></div>' +
    '</section></div></main>';
}

function field(label, path, value, options) {
  const config = options || {};
  const attrs = ' data-field="' + escapeHtml(path) + '"' + (config.kind ? ' data-kind="' + escapeHtml(config.kind) + '"' : "");
  const val = config.kind === "paragraphs" ? (Array.isArray(value) ? value.join("\n\n") : "") :
    config.kind === "list" ? (Array.isArray(value) ? value.join(", ") : "") :
    config.kind === "lines" ? (Array.isArray(value) ? value.join("\n") : "") : value;
  return '<label class="admin-field"><span>' + escapeHtml(label) + '</span>' +
    (config.textarea
      ? '<textarea' + attrs + '>' + escapeHtml(val) + '</textarea>'
      : '<input type="' + (config.type || "text") + '"' + attrs + ' value="' + escapeHtml(val) + '"' + (config.type === "number" ? ' min="0" step="1"' : "") + '>') +
    (config.upload ? '<small>Replace image: <input type="file" accept="image/png,image/jpeg,image/webp" data-upload="' + escapeHtml(path) + '"></small>' : "") +
    (config.hint ? "<small>" + escapeHtml(config.hint) + "</small>" : "") +
  '</label>';
}

function adminLogin() {
  return '<form class="admin-login" id="admin-login"><span class="mono section-label">CONTENT DESK · PRIVATE PREVIEW</span><h2>Studio access</h2><p>Sign in to update the series, chapters, product details, and images for this local demo.</p>' +
    '<label class="admin-field"><span>Studio key</span><input type="password" name="key" autocomplete="current-password" required></label>' +
    '<div class="demo-key">Local demo key: quietbattles-demo</div><div class="admin-status" role="status">' + escapeHtml(adminMessage) + '</div><button class="button button-dark" type="submit">Open the studio <span class="arrow">↗</span></button></form>';
}

function adminDashboard() {
  const chapterForms = content.series.chapters.map(function (chapter, index) {
    return '<article class="admin-chapter"><div class="admin-row-title"><h3>' + escapeHtml(chapter.number) + ' · ' + escapeHtml(chapter.title) + '</h3><button class="remove-button" type="button" data-remove-chapter="' + index + '">Remove chapter</button></div>' +
      '<div class="admin-grid">' +
        field("Chapter number", "series.chapters." + index + ".number", chapter.number) +
        field("Title", "series.chapters." + index + ".title", chapter.title) +
        field("URL slug", "series.chapters." + index + ".slug", chapter.slug) +
        field("Linked product slug", "series.chapters." + index + ".productSlug", chapter.productSlug) +
      '</div>' +
      field("Short introduction", "series.chapters." + index + ".excerpt", chapter.excerpt, { textarea: true }) +
      field("Chapter image", "series.chapters." + index + ".image", chapter.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 5 MB)." }) +
      field("Story paragraphs", "series.chapters." + index + ".story", chapter.story || [], { textarea: true, kind: "paragraphs", hint: "Separate paragraphs with a blank line. Leave blank for a series preview." }) +
    '</article>';
  }).join("");

  const productForms = content.products.map(function (product, index) {
    return '<article class="admin-product"><div class="admin-row-title"><h3>Product ' + String(index + 1).padStart(2, "0") + '</h3><button class="remove-button" type="button" data-remove-product="' + index + '">Remove product</button></div>' +
      '<div class="admin-grid">' +
        field("Product name", "products." + index + ".name", product.name) +
        field("URL slug", "products." + index + ".slug", product.slug) +
        field("Category line", "products." + index + ".category", product.category) +
        field("Price in INR", "products." + index + ".price", product.price, { type: "number" }) +
        field("Sizes", "products." + index + ".sizes", product.sizes, { kind: "list", hint: "Separate sizes with commas." }) +
        field("Linked chapter slug", "products." + index + ".chapterSlug", product.chapterSlug) +
      '</div>' +
      field("Description", "products." + index + ".description", product.description, { textarea: true }) +
      field("Product image", "products." + index + ".image", product.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 5 MB)." }) +
      field("Details and care points", "products." + index + ".details", product.details, { textarea: true, kind: "lines", hint: "One detail per line." }) +
    '</article>';
  }).join("");

  return '<div class="admin-shell"><div class="page">' +
    '<div class="admin-top"><div><span class="mono section-label">QUIET BATTLES · CONTENT DESK</span><h1>Studio</h1></div><div><p>Content is saved to the local SQLite database.<br>Uploaded images are stored in the local uploads folder.</p><button class="button button-light" type="button" data-logout>Sign out</button></div></div>' +
    '<div class="admin-tabs" role="tablist"><button class="admin-tab active" type="button" data-tab="brand" role="tab" aria-selected="true">Brand & home</button><button class="admin-tab" type="button" data-tab="series" role="tab" aria-selected="false">Series & chapters</button><button class="admin-tab" type="button" data-tab="products" role="tab" aria-selected="false">Products</button></div>' +
    '<form id="admin-form">' +
      '<section class="admin-panel active" data-panel="brand"><div class="admin-card"><h2>Brand introduction</h2><div class="admin-grid">' +
        field("Brand name", "brand.name", content.brand.name) +
        field("Tagline", "brand.tagline", content.brand.tagline) +
      '</div>' + field("Brand introduction", "brand.intro", content.brand.intro, { textarea: true }) +
      '<div class="admin-card"><h2>Homepage hero</h2><div class="admin-grid">' +
        field("Eyebrow", "hero.eyebrow", content.hero.eyebrow) +
        field("Headline (type <br> for a line break)", "hero.title", content.hero.title) +
      '</div>' + field("Supporting copy", "hero.description", content.hero.description, { textarea: true }) +
      field("Hero image", "hero.image", content.hero.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 5 MB)." }) +
      '</div><div class="admin-card"><h2>Our note</h2><div class="admin-grid">' + field("Section label", "introduction.eyebrow", content.introduction.eyebrow) + field("Heading", "introduction.title", content.introduction.title) + '</div>' + field("Copy", "introduction.copy", content.introduction.copy, { textarea: true }) + '</div></section>' +
      '<section class="admin-panel" data-panel="series"><div class="admin-card"><h2>Series details</h2><div class="admin-grid">' +
        field("Series number", "series.number", content.series.number) +
        field("Series title", "series.title", content.series.title) +
        field("Subtitle", "series.subtitle", content.series.subtitle) +
        field("Series image", "series.image", content.series.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 5 MB)." }) +
      '</div>' + field("Series description", "series.description", content.series.description, { textarea: true }) +
      '<div class="admin-row-title"><h2>Chapters · ' + content.series.chapters.length + '</h2><button class="button button-light" type="button" data-add-chapter>Add chapter</button></div>' + chapterForms + '</div></section>' +
      '<section class="admin-panel" data-panel="products"><div class="admin-card"><div class="admin-row-title"><h2>Product catalogue · ' + content.products.length + '</h2><button class="button button-light" type="button" data-add-product>Add product</button></div>' + productForms + '</div></section>' +
      '<div class="admin-savebar"><span>Remember to save your changes before leaving this page.</span><div class="admin-actions"><span class="admin-status" id="admin-status" role="status">' + escapeHtml(adminMessage) + '</span><button class="button" type="submit">Save changes <span class="arrow">↗</span></button></div></div>' +
    '</form></div></div>';
}

function renderCart() {
  if (!cartOpen) return "";
  const lines = cart.map(function (item, index) {
    return '<article class="cart-line"><img src="' + escapeHtml(item.image) + '" alt=""><div><h3>' + escapeHtml(item.name) + '</h3><p>SIZE ' + escapeHtml(item.size) + '</p><div class="qty-controls"><button type="button" aria-label="Decrease quantity" data-cart-dec="' + index + '">−</button><span>' + item.qty + '</span><button type="button" aria-label="Increase quantity" data-cart-inc="' + index + '">+</button></div></div><span class="cart-price">' + money(item.price * item.qty) + '</span></article>';
  }).join("");
  const total = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  return '<button class="cart-backdrop" type="button" aria-label="Close bag" data-cart-close></button><aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="cart-head"><h2 id="cart-title">Your bag <span class="mono">(' + cart.reduce(function (sum, item) { return sum + item.qty; }, 0) + ')</span></h2><button class="icon-button" type="button" data-cart-close aria-label="Close bag">×</button></div>' +
    '<div class="cart-items">' + (lines || '<div class="cart-empty">Nothing in your bag yet.<br>Find a piece that feels like you.</div>') + '</div>' +
    (cart.length ? '<div class="cart-summary"><div class="cart-total"><span>Sample subtotal</span><strong>' + money(total) + '</strong></div><button type="button" class="button button-dark" data-demo-checkout>Continue <span class="arrow">↗</span></button><small>Preview only · checkout is not connected</small></div>' : "") +
  '</aside>';
}

function renderNotice() {
  return noticeTimer ? '<div class="notice" role="status" id="notice"></div>' : "";
}

function showNotice(message) {
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(function () {
    noticeTimer = null;
    const el = document.getElementById("notice");
    if (el) el.remove();
  }, 2800);
  render();
  const el = document.getElementById("notice");
  if (el) el.textContent = message;
}

function render() {
  if (!content) {
    root.innerHTML = '<main class="page" style="padding:80px 0">Opening the archive…</main>';
    return;
  }
  const route = currentRoute();
  let main;
  if (route[0] === "archive") main = renderArchive();
  else if (route[0] === "series") main = renderSeries();
  else if (route[0] === "chapter") main = renderChapter(route[1]);
  else if (route[0] === "product") main = renderProduct(route[1]);
  else if (route[0] === "admin") main = '<main>' + (adminToken ? adminDashboard() : '<div class="admin-shell"><div class="page">' + adminLogin() + '</div></div>') + '</main>';
  else main = renderHome();
  root.innerHTML = renderHeader() + main + renderFooter() + renderCart() + renderNotice();
  document.title = route[0] === "admin" ? "Studio · QUIET BATTLES™" : "QUIET BATTLES™ — Wear Your Battles";
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener("error", function () {
      const frame = img.parentElement;
      if (frame) frame.classList.add("image-missing");
      img.remove();
    }, { once: true });
  });

  const toggle = document.querySelector(".menu-toggle");
  if (toggle) toggle.addEventListener("click", function () {
    const nav = document.getElementById("main-nav");
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
  });

  document.querySelectorAll("[data-cart-open]").forEach(function (button) {
    button.addEventListener("click", function () { cartOpen = true; render(); });
  });
  document.querySelectorAll("[data-cart-close]").forEach(function (button) {
    button.addEventListener("click", function () { cartOpen = false; render(); });
  });
  document.querySelectorAll("[data-cart-inc]").forEach(function (button) {
    button.addEventListener("click", function () { cart[Number(button.dataset.cartInc)].qty += 1; saveCart(); render(); });
  });
  document.querySelectorAll("[data-cart-dec]").forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.cartDec);
      cart[index].qty -= 1;
      if (cart[index].qty <= 0) cart.splice(index, 1);
      saveCart();
      render();
    });
  });
  document.querySelectorAll("[data-size]").forEach(function (button) {
    button.addEventListener("click", function () {
      sizeSelection[button.dataset.product] = button.dataset.size;
      document.querySelectorAll("[data-size]").forEach(function (item) {
        const selected = item.dataset.size === button.dataset.size && item.dataset.product === button.dataset.product;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      const help = document.getElementById("size-help");
      if (help) help.textContent = "";
    });
  });
  document.querySelectorAll("[data-add]").forEach(function (button) {
    button.addEventListener("click", function () {
      const product = getProduct(button.dataset.add);
      const size = sizeSelection[product.slug];
      const help = document.getElementById("size-help");
      if (!size) {
        if (help) help.textContent = "Choose a size to add this piece to your bag.";
        return;
      }
      const existing = cart.find(function (item) { return item.slug === product.slug && item.size === size; });
      if (existing) existing.qty += 1;
      else cart.push({ slug: product.slug, name: product.name, image: product.image, size: size, price: Number(product.price), qty: 1 });
      saveCart();
      cartOpen = true;
      render();
    });
  });
  const sizeGuide = document.querySelector("[data-size-guide]");
  if (sizeGuide) sizeGuide.addEventListener("click", function () { showNotice("Size guide: XS  ·  S  ·  M  ·  L  ·  XL"); });
  const checkout = document.querySelector("[data-demo-checkout]");
  if (checkout) checkout.addEventListener("click", function () { showNotice("This demo bag does not create an order or take payment."); });

  const login = document.getElementById("admin-login");
  if (login) login.addEventListener("submit", async function (event) {
    event.preventDefault();
    adminMessage = "";
    const key = new FormData(login).get("key");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      adminToken = result.token;
      sessionStorage.setItem("qbAdminToken", adminToken);
      adminMessage = "Studio opened.";
      render();
    } catch (error) {
      adminMessage = error.message;
      render();
    }
  });

  const logout = document.querySelector("[data-logout]");
  if (logout) logout.addEventListener("click", async function () {
    await fetch("/api/admin/logout", { method: "POST", headers: { Authorization: "Bearer " + adminToken } }).catch(function () {});
    adminToken = "";
    sessionStorage.removeItem("qbAdminToken");
    adminMessage = "You have signed out.";
    render();
  });

  document.querySelectorAll("[data-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll("[data-tab]").forEach(function (item) {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll("[data-panel]").forEach(function (panel) {
        panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab);
      });
    });
  });

  document.querySelectorAll("[data-field]").forEach(function (input) {
    input.addEventListener("input", function () { updateField(input); });
    input.addEventListener("change", function () { updateField(input); });
  });
  document.querySelectorAll("[data-upload]").forEach(function (input) {
    input.addEventListener("change", function () { uploadImage(input); });
  });
  document.querySelectorAll("[data-add-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      const number = "CHAPTER " + String(content.series.chapters.length + 1).padStart(2, "0");
      content.series.chapters.push({ number: number, slug: "new-chapter-" + Date.now(), title: "Untitled chapter", excerpt: "", image: content.series.image, productSlug: content.products[0].slug, story: [] });
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-remove-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (content.series.chapters.length <= 1) {
        adminMessage = "Keep at least one chapter in the series.";
        render();
        document.querySelector('[data-tab="series"]').click();
        return;
      }
      content.series.chapters.splice(Number(button.dataset.removeChapter), 1);
      adminMessage = "Chapter removed from the draft. Save changes to keep it.";
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-add-product]").forEach(function (button) {
    button.addEventListener("click", function () {
      content.products.push({ slug: "new-piece-" + Date.now(), name: "New field piece", category: "SERIES 01", description: "", price: 0, image: "/assets/soft-armor.svg", sizes: ["XS", "S", "M", "L", "XL"], details: [], chapterSlug: content.series.chapters[0] ? content.series.chapters[0].slug : "" });
      render();
      document.querySelector('[data-tab="products"]').click();
    });
  });
  document.querySelectorAll("[data-remove-product]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (content.products.length <= 1) {
        adminMessage = "Keep at least one product in the catalogue.";
        render();
        document.querySelector('[data-tab="products"]').click();
        return;
      }
      content.products.splice(Number(button.dataset.removeProduct), 1);
      adminMessage = "Product removed from the draft. Save changes to keep it.";
      render();
      document.querySelector('[data-tab="products"]').click();
    });
  });
  const adminForm = document.getElementById("admin-form");
  if (adminForm) adminForm.addEventListener("submit", saveAdminContent);
}

function updateField(input) {
  const parts = input.dataset.field.split(".");
  let value = input.value;
  if (input.dataset.kind === "paragraphs") value = value.split(/\n\s*\n/).map(function (item) { return item.trim(); }).filter(Boolean);
  else if (input.dataset.kind === "list") value = value.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  else if (input.dataset.kind === "lines") value = value.split(/\n/).map(function (item) { return item.trim(); }).filter(Boolean);
  else if (input.type === "number") value = Number(value || 0);
  let target = content;
  for (let i = 0; i < parts.length - 1; i += 1) target = target[parts[i]];
  target[parts[parts.length - 1]] = value;
}

async function uploadImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    adminMessage = "Images must be 5 MB or smaller.";
    render();
    return;
  }
  const tabName = input.dataset.upload.split(".")[0] === "products" ? "products" :
    input.dataset.upload.split(".")[0] === "series" ? "series" : "brand";
  const status = document.getElementById("admin-status");
  if (status) status.textContent = "Uploading image…";
  const dataUrl = await new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  try {
    const response = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken }, body: JSON.stringify({ data: dataUrl }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Image upload failed.");
    const fieldInput = document.querySelector('[data-field="' + CSS.escape(input.dataset.upload) + '"]');
    if (fieldInput) {
      fieldInput.value = result.url;
      updateField(fieldInput);
    }
    adminMessage = "Image uploaded. Save changes to publish it in the demo.";
    render();
    const tab = document.querySelector('[data-tab="' + tabName + '"]');
    if (tab) tab.click();
  } catch (error) {
    adminMessage = error.message;
    const statusAgain = document.getElementById("admin-status");
    if (statusAgain) statusAgain.textContent = adminMessage;
  }
}

async function saveAdminContent(event) {
  event.preventDefault();
  const status = document.getElementById("admin-status");
  if (status) status.textContent = "Saving…";
  try {
    const response = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken }, body: JSON.stringify(content) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        adminToken = "";
        sessionStorage.removeItem("qbAdminToken");
      }
      throw new Error(result.error || "Changes could not be saved.");
    }
    adminMessage = "Saved to the local content file.";
    render();
    document.querySelector('[data-tab="brand"]').click();
    document.getElementById("admin-status").textContent = adminMessage;
  } catch (error) {
    adminMessage = error.message;
    const statusAgain = document.getElementById("admin-status");
    if (statusAgain) statusAgain.textContent = adminMessage;
  }
}

window.addEventListener("hashchange", function () {
  const route = currentRoute();
  cartOpen = false;
  render();
  if (route[0] === "belief") {
    requestAnimationFrame(function () {
      const intro = document.getElementById("belief");
      if (intro) intro.scrollIntoView({ behavior: "smooth" });
    });
  } else {
    window.scrollTo(0, 0);
  }
});

window.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && cartOpen) {
    cartOpen = false;
    render();
  }
});

fetch("/api/content")
  .then(function (response) { if (!response.ok) throw new Error("The local content service is unavailable."); return response.json(); })
  .then(function (data) { content = data; render(); })
  .catch(function () {
    root.innerHTML = '<main class="page" style="padding:80px 0"><span class="mono">The archive is offline.</span><p>Start the local demo server to open the site.</p></main>';
  });
