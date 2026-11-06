"use strict";

const root = document.getElementById("app");
let content = null;
let cart = readCart();
let cartOpen = false;
let adminToken = sessionStorage.getItem("qbAdminToken") || "";
let adminMessage = "";
let noticeTimer = null;
let sizeSelection = {};
let checkoutStep = "details";
let checkoutCustomer = {};
let checkoutOrder = null;
let checkoutMessage = "";
let adminOrders = [];
let adminOrdersLoaded = false;
let adminOrdersLoading = false;
let adminActiveTab = "brand";
const orderStatuses = ["Placed", "Confirmed", "Packed", "Shipped", "Completed", "Cancelled"];

function readCart() {
  try {
    const stored = JSON.parse(localStorage.getItem("qbCart") || "[]");
    return Array.isArray(stored) ? stored.filter(function (item) {
      return item && Number.isInteger(item.qty) && item.qty > 0 && typeof item.slug === "string";
    }) : [];
  }
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

function cartTotal() {
  return cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
}

function cartQuantity() {
  return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
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
  for (const series of content.seriesList) {
    const chapter = series.chapters.find(function (item) { return item.slug === slug; });
    if (chapter) return chapter;
  }
  return content.seriesList[0].chapters[0];
}

function getSeries(slug) {
  return content.seriesList.find(function (item) { return item.slug === slug; }) || content.seriesList[0];
}

function getChapterSeries(chapter) {
  return content.seriesList.find(function (item) { return item.chapters.includes(chapter); }) || content.seriesList[0];
}

function getProduct(slug) {
  return content.products.find(function (item) { return item.slug === slug; }) || content.products[0];
}

function renderHeader() {
  return '<div class="topline">A quieter kind of strength · ' + escapeHtml(content.seriesList[0].number) + ' now open</div>' +
    '<header class="site-header"><div class="nav-wrap">' +
      '<a class="wordmark" href="#home" aria-label="Quiet Battles home">' + escapeHtml(content.brand.name) + '<sup>™</sup></a>' +
      '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>' +
      '<nav class="nav-links" id="main-nav" aria-label="Main navigation">' +
        navLink("The archive", "#archive") +
        navLink(content.seriesList[0].number, "#series/" + escapeHtml(content.seriesList[0].slug)) +
        navLink("Our note", "#belief") +
      '</nav>' +
      '<div class="nav-actions"><a href="#admin">Studio</a><button class="cart-trigger" type="button" data-cart-open>Bag <span class="cart-count">(' + cartQuantity() + ')</span></button></div>' +
    '</div></header>';
}

function renderFooter() {
  return '<footer class="site-footer"><div class="page">' +
    '<div class="footer-main">' +
      '<h2>For what<br>you carry.</h2>' +
      '<p class="footer-note">' + escapeHtml(content.brand.intro) + '</p>' +
      '<div class="footer-links"><a href="#archive">Explore the archive</a><a href="#series/' + escapeHtml(getSeries().slug) + '">' + escapeHtml(getSeries().title) + '</a><a href="#admin">Studio access</a></div>' +
    '</div>' +
    '<div class="footer-bottom"><span>© 2026 ' + escapeHtml(content.brand.name) + '™</span><span>' + escapeHtml(content.brand.tagline) + '</span><span>Independent demo experience</span></div>' +
  '</div></footer>';
}

function chapterCards(series) {
  return series.chapters.map(function (chapter) {
    return '<a class="chapter-card" href="#chapter/' + escapeHtml(chapter.slug) + '">' +
      '<span class="mono">' + escapeHtml(chapter.number) + ' <span aria-hidden="true">·</span> CHAPTER CHAMBER</span>' +
      '<h3>' + escapeHtml(chapter.title) + '</h3>' +
      '<p>' + escapeHtml(chapter.excerpt) + '</p>' +
      '<span class="card-link">Read this chapter <span class="arrow">↗</span></span>' +
    '</a>';
  }).join("");
}

function renderHome() {
  const product = content.products[0];
  const series = getSeries();
  const firstChapter = series.chapters[0];
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
      '<div class="series-copy"><span class="mono section-label">' + escapeHtml(series.number) + ' · THE ARCHIVE</span><h2>' + escapeHtml(series.title) + '</h2><p class="subtitle">' + escapeHtml(series.subtitle) + '</p><p class="description">' + escapeHtml(series.description) + '</p><a class="button" href="#series/' + escapeHtml(series.slug) + '">Open the series <span class="arrow">↗</span></a></div>' +
      '<figure class="series-image"><img src="' + escapeHtml(series.image) + '" alt="The Gentle Armor collection portrait" loading="lazy"><figcaption class="mono">A study in everyday courage</figcaption></figure>' +
    '</div><div class="page chapter-list">' + chapterCards(series) + '</div></section>' +
    '<section class="page section product-feature">' +
      '<div class="product-photo"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><span class="product-stamp mono">FIELD PIECE 001</span></div>' +
      '<div class="product-copy"><span class="mono section-label">FROM THE SERIES · CHAPTER 01</span><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.description) + '</p><div class="price">' + money(product.price) + '<small>Sample price · INR</small></div><div class="product-details">' + product.details.map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") + '</div><a class="button button-dark" href="#product/' + escapeHtml(product.slug) + '">View the piece <span class="arrow">↗</span></a></div>' +
    '</section>' +
  '</main>';
}

function renderArchive() {
  const entries = content.seriesList.map(function (series) {
    return '<article class="archive-item"><div class="archive-art"><img src="' + escapeHtml(series.image) + '" alt="' + escapeHtml(series.number + ' — ' + series.title) + '" loading="lazy"><span class="hero-stamp">' + escapeHtml(series.number) + ' · ' + series.chapters.length + ' chapters</span></div><div class="archive-copy"><span class="mono section-label">' + escapeHtml(series.number) + '</span><h2 class="page-title">' + escapeHtml(series.title) + '</h2><p>' + escapeHtml(series.subtitle) + '</p><p>' + escapeHtml(series.description) + '</p><a class="button button-dark" href="#series/' + escapeHtml(series.slug) + '">Explore this series <span class="arrow">↗</span></a></div></article>';
  }).join("");
  return '<main><section class="archive-hero"><div class="page"><span class="mono section-label">THE QUIET BATTLES ARCHIVE</span><h1 class="page-title">Stories to<br>wear with you.</h1><p class="lead">A growing collection of chapters, objects, and small reminders for the lives we are living between the lines.</p></div></section>' +
    '<section class="page archive-list">' + entries + '</section></main>';
}

function renderSeries(slug) {
  const series = getSeries(slug);
  return '<main><section class="series-band"><div class="series-intro">' +
    '<div class="series-copy"><span class="mono section-label">' + escapeHtml(series.number) + ' · THE ARCHIVE</span><h1>' + escapeHtml(series.title) + '</h1><p class="subtitle">' + escapeHtml(series.subtitle) + '</p><p class="description">' + escapeHtml(series.description) + '</p><span class="hero-caption">' + series.chapters.length + ' chapters · One continuous thread</span></div>' +
    '<figure class="series-image"><img src="' + escapeHtml(series.image) + '" alt="' + escapeHtml(series.title) + ' series" fetchpriority="high"><figcaption class="mono">' + escapeHtml(series.title) + ' · 2026</figcaption></figure>' +
    '</div><div class="page chapter-list">' + chapterCards(series) + '</div></section>' +
    '<section class="page section"><div class="section-head"><div><span class="mono section-label">THE THREAD</span><h2>Keep what<br>helps.</h2></div><p>' + escapeHtml(series.description) + '</p></div><a class="button button-dark" href="#chapter/' + escapeHtml(series.chapters[0].slug) + '">Begin with ' + escapeHtml(series.chapters[0].number) + ' <span class="arrow">↗</span></a></section></main>';
}

function renderChapter(slug) {
  const chapter = getChapter(slug);
  const series = getChapterSeries(chapter);
  const index = series.chapters.indexOf(chapter);
  const product = content.products.find(function (item) { return item.slug === chapter.productSlug; }) || content.products[0];
  const story = Array.isArray(chapter.story) ? chapter.story : [];
  const next = series.chapters[index + 1];
  const artifactLabel = product.chapterSlug === chapter.slug ? "ARTIFACT FROM THIS CHAPTER" : "EXPLORE A SERIES ARTIFACT";
  const storyBlock = story.length
    ? '<div class="story-copy">' + story.map(function (paragraph, i) { return '<p' + (i === 0 ? ' class="dropcap"' : "") + '>' + escapeHtml(paragraph) + '</p>'; }).join("") + '</div>'
    : '<div class="story-copy"><p>' + escapeHtml(chapter.excerpt) + '</p><p class="chapter-note">This chapter is part of the series preview. The complete story is being shaped for the archive.</p></div>';

  return '<main class="chapter-page">' +
    '<section class="chapter-hero"><div class="chapter-heading"><span class="mono section-label">CHAPTER CHAMBER · ' + escapeHtml(series.number) + ' · ' + escapeHtml(chapter.number) + '</span><h1 class="page-title">' + escapeHtml(chapter.title) + '</h1><p class="excerpt">' + escapeHtml(chapter.excerpt) + '</p><span class="mono">' + escapeHtml(series.title) + ' · ' + String(index + 1).padStart(2, "0") + ' / ' + String(series.chapters.length).padStart(2, "0") + '</span></div><div class="chapter-visual"><img src="' + escapeHtml(chapter.image) + '" alt="' + escapeHtml(chapter.title) + '" fetchpriority="high"></div></section>' +
    '<section class="page story-layout"><aside class="story-aside"><span class="mono section-label">A NOTE FROM THE ARCHIVE</span><p>' + escapeHtml(series.subtitle) + '</p><span class="mono">READ AT YOUR OWN PACE</span></aside>' + storyBlock + '</section>' +
    '<section class="chapter-product"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><div class="chapter-product-copy"><span class="mono section-label">' + artifactLabel + '</span><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.description) + '</p><a class="button button-dark" href="#product/' + escapeHtml(product.slug) + '">Meet the artifact <span class="arrow">↗</span></a></div></section>' +
    '<div class="page">' + (next ? '<a class="chapter-next" href="#chapter/' + escapeHtml(next.slug) + '"><span><span class="mono section-label">NEXT IN THE SERIES</span><strong>' + escapeHtml(next.title) + '</strong></span><span class="arrow">↗</span></a>' : '<a class="chapter-next" href="#series/' + escapeHtml(series.slug) + '"><span><span class="mono section-label">BACK TO THE SERIES</span><strong>' + escapeHtml(series.title) + '</strong></span><span class="arrow">↗</span></a>') + '</div>' +
  '</main>';
}

function renderProduct(slug) {
  const product = getProduct(slug);
  const chapter = getChapter(product.chapterSlug);
  const series = getChapterSeries(chapter);
  const selection = sizeSelection[product.slug] || "";
  return '<main class="page product-page"><nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="#home">Home</a><span>/</span><a href="#archive">Archive</a><span>/</span><a href="#series/' + escapeHtml(series.slug) + '">' + escapeHtml(series.number) + '</a><span>/</span><a href="#chapter/' + escapeHtml(chapter.slug) + '">' + escapeHtml(chapter.number) + '</a><span>/</span><span>Artifact</span></nav>' +
    '<div class="product-detail-layout"><div class="product-gallery"><figure class="gallery-frame"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + ' front view" fetchpriority="high"></figure>' +
    (product.secondaryImage ? '<figure class="gallery-frame"><img src="' + escapeHtml(product.secondaryImage) + '" alt="' + escapeHtml(product.name) + ' back or detail view" loading="lazy"></figure>' : "") + '</div>' +
    '<section class="product-info"><span class="mono section-label">' + escapeHtml(product.category) + ' · SAMPLE PRODUCT</span><h1 class="page-title">' + escapeHtml(product.name) + '</h1><div class="price">' + money(product.price) + '<small>INR · sample price</small></div><p class="product-desc">' + escapeHtml(product.description) + '</p>' +
    '<div class="size-label"><span>Choose your size</span><button class="size-guide" type="button" data-size-guide>Size guide</button></div><div class="size-options">' + product.sizes.map(function (size) { return '<button class="size-option' + (selection === size ? " selected" : "") + '" type="button" data-size="' + escapeHtml(size) + '" data-product="' + escapeHtml(product.slug) + '" aria-pressed="' + (selection === size) + '">' + escapeHtml(size) + '</button>'; }).join("") + '</div><div class="size-help" id="size-help" aria-live="polite"></div>' +
    '<button class="button button-dark" type="button" data-add="' + escapeHtml(product.slug) + '">Add to bag <span class="arrow">↗</span></button><p class="shipping-note">DEMO ACQUISITION · DUMMY QR · NO REAL PAYMENT</p>' +
    '<div class="accordions"><details class="accordion" open><summary>About the piece</summary><p>' + escapeHtml(product.description) + '</p></details><details class="accordion"><summary>Details and care</summary><ul>' + product.details.map(function (detail) { return "<li>" + escapeHtml(detail) + "</li>"; }).join("") + '<li>Care information is sample copy for this prototype.</li></ul></details><details class="accordion"><summary>From the archive</summary><p>This piece accompanies <a href="#chapter/' + escapeHtml(product.chapterSlug) + '"><u>' + escapeHtml(getChapter(product.chapterSlug).title) + '</u></a>.</p></details></div>' +
    '</section></div></main>';
}

function checkoutSteps(active) {
  return '<ol class="acquisition-steps" aria-label="Checkout progress">' +
    [["details", "Details"], ["payment", "Demo payment"], ["complete", "Confirmation"]].map(function (step, index) {
      const state = step[0] === active ? " active" :
        (["details", "payment", "complete"].indexOf(step[0]) < ["details", "payment", "complete"].indexOf(active) ? " complete" : "");
      return '<li class="' + state.trim() + '"' + (step[0] === active ? ' aria-current="step"' : "") + '><span>0' + (index + 1) + '</span>' + step[1] + '</li>';
    }).join("") + '</ol>';
}

function checkoutLineItems(items, snapshot) {
  return items.map(function (item) {
    const price = snapshot ? item.unitPrice : item.price;
    return '<article class="checkout-line"><img src="' + escapeHtml(item.image) + '" alt=""><div><strong>' + escapeHtml(item.name) + '</strong><span>Size ' + escapeHtml(item.size) + ' · Qty ' + item.qty + '</span></div><b>' + money(price * item.qty) + '</b></article>';
  }).join("");
}

function checkoutSummary(items, subtotal, snapshot) {
  return '<aside class="checkout-summary" aria-label="Order summary"><span class="mono section-label">ACQUISITION LEDGER</span><h2>Your artifact</h2><div class="checkout-lines">' + checkoutLineItems(items, snapshot) + '</div>' +
    '<div class="checkout-total"><span>Demo subtotal</span><strong>' + money(subtotal) + '</strong></div><p>Shipping and taxes are not calculated in this assessment demonstration.</p></aside>';
}

function customerValue(name) {
  return escapeHtml(checkoutCustomer[name] || "");
}

function renderCheckout() {
  if (checkoutOrder) {
    return '<main class="checkout-page"><div class="page">' + checkoutSteps("complete") +
      '<section class="confirmation-chamber"><span class="confirmation-mark" aria-hidden="true">✓</span><span class="mono section-label">ACQUISITION RECORDED · DEMONSTRATION</span><h1>Your artifact<br>has a place.</h1><p>A demo order was saved to Neon and is now visible in Studio. No money was requested or transferred.</p>' +
      '<div class="confirmation-receipt"><span>Order reference</span><strong>' + escapeHtml(checkoutOrder.orderNumber) + '</strong><span>Status</span><strong>' + escapeHtml(checkoutOrder.status) + '</strong><span>Demo subtotal</span><strong>' + money(checkoutOrder.subtotal) + '</strong></div>' +
      '<a class="button button-dark" href="#archive">Return to the archive <span class="arrow">↗</span></a></section></div></main>';
  }

  if (!cart.length) {
    return '<main class="checkout-page"><div class="page"><section class="checkout-empty"><span class="mono section-label">ACQUISITION</span><h1>Your bag is quiet.</h1><p>Choose an artifact before beginning the demo acquisition.</p><a class="button button-dark" href="#archive">Explore the archive <span class="arrow">↗</span></a></section></div></main>';
  }

  const subtotal = cartTotal();
  if (checkoutStep === "payment") {
    return '<main class="checkout-page"><div class="page">' + checkoutSteps("payment") +
      '<div class="checkout-heading"><span class="mono section-label">ACQUISITION · DEMO PAYMENT</span><h1>A ritual of exchange.</h1><p>This QR is intentionally non-payable. Confirming it creates a demonstration order for the Studio workflow.</p></div>' +
      '<div class="checkout-layout"><section class="payment-chamber"><div class="qr-frame"><img src="/assets/demo-payment-qr.svg" alt="Dummy QR marked demo and not payable"></div>' +
        '<div class="payment-copy"><span class="mono section-label">DUMMY QR · NOT PAYABLE</span><h2>No money moves here.</h2><p>This screen demonstrates the payment step without connecting to UPI, a bank, or a payment gateway.</p>' +
        '<dl class="delivery-note"><div><dt>For</dt><dd>' + customerValue("name") + '</dd></div><div><dt>Delivery</dt><dd>' + customerValue("city") + ' · ' + customerValue("postalCode") + '</dd></div></dl>' +
        '<label class="demo-ack"><input type="checkbox" data-demo-ack> <span>I understand this is a demonstration and no payment will be made.</span></label><div class="checkout-message" role="status">' + escapeHtml(checkoutMessage) + '</div>' +
        '<div class="checkout-actions"><button class="button button-light" type="button" data-back-details>Back</button><button class="button button-dark" type="button" data-confirm-demo>Confirm demo payment <span class="arrow">↗</span></button></div></div></section>' +
        checkoutSummary(cart, subtotal, false) + '</div></div></main>';
  }

  return '<main class="checkout-page"><div class="page">' + checkoutSteps("details") +
    '<div class="checkout-heading"><span class="mono section-label">ACQUISITION · DELIVERY DETAILS</span><h1>Where should<br>it find you?</h1><p>Use sample information for this assessment. The submitted details are stored with the demo order in Neon.</p></div>' +
    '<div class="checkout-layout"><form class="checkout-form" id="checkout-details"><div class="checkout-field-grid">' +
      '<label><span>Full name</span><input name="name" autocomplete="name" value="' + customerValue("name") + '" maxlength="160" required></label>' +
      '<label><span>Email</span><input name="email" type="email" autocomplete="email" value="' + customerValue("email") + '" maxlength="160" required></label>' +
      '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" value="' + customerValue("phone") + '" minlength="6" maxlength="24" required></label>' +
      '<label><span>City</span><input name="city" autocomplete="address-level2" value="' + customerValue("city") + '" maxlength="160" required></label>' +
      '<label class="wide"><span>Delivery address</span><textarea name="address" autocomplete="street-address" maxlength="500" required>' + customerValue("address") + '</textarea></label>' +
      '<label><span>Postal code</span><input name="postalCode" autocomplete="postal-code" value="' + customerValue("postalCode") + '" minlength="3" maxlength="14" required></label>' +
      '<label class="honeypot" aria-hidden="true"><span>Website</span><input name="website" tabindex="-1" autocomplete="off"></label>' +
    '</div><p class="privacy-note">Assessment demo: do not enter sensitive or real customer information.</p><button class="button button-dark" type="submit">Continue to demo payment <span class="arrow">↗</span></button></form>' + checkoutSummary(cart, subtotal, false) + '</div></div></main>';
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
  return '<form class="admin-login" id="admin-login"><span class="mono section-label">CONTENT DESK · PRIVATE PREVIEW</span><h2>Studio access</h2><p>Sign in to manage the archive, products, images, and demonstration orders.</p>' +
    '<label class="admin-field"><span>Studio key</span><input type="password" name="key" autocomplete="current-password" required></label>' +
    '<div class="admin-status" role="status">' + escapeHtml(adminMessage) + '</div><button class="button button-dark" type="submit">Open the studio <span class="arrow">↗</span></button></form>';
}

function orderDate(value) {
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch { return String(value || ""); }
}

function adminOrderCards() {
  if (adminOrdersLoading) return '<div class="admin-card admin-empty"><h2>Opening the order ledger…</h2></div>';
  if (!adminOrdersLoaded) return '<div class="admin-card admin-empty"><h2>Order ledger</h2><p>Orders will appear here after the Studio connects to Neon.</p></div>';
  if (!adminOrders.length) return '<div class="admin-card admin-empty"><span class="mono section-label">ORDER LEDGER · 0</span><h2>No acquisitions yet.</h2><p>Complete the dummy QR checkout to create a demonstration order.</p></div>';
  return adminOrders.map(function (order) {
    const customer = order.customer || {};
    const lines = (order.items || []).map(function (item) {
      return '<div class="admin-order-line"><img src="' + escapeHtml(item.image) + '" alt=""><span><strong>' + escapeHtml(item.name) + '</strong><small>Size ' + escapeHtml(item.size) + ' · Qty ' + item.qty + '</small></span><b>' + money(item.lineTotal) + '</b></div>';
    }).join("");
    const statusOptions = orderStatuses.map(function (status) {
      return '<option value="' + status + '"' + (status === order.status ? " selected" : "") + '>' + status + '</option>';
    }).join("");
    return '<article class="admin-card admin-order"><div class="admin-order-head"><div><span class="mono section-label">' + escapeHtml(order.orderNumber) + '</span><h2>' + escapeHtml(customer.name) + '</h2><p>' + escapeHtml(orderDate(order.createdAt)) + '</p></div><span class="order-badge">' + escapeHtml(order.status) + '</span></div>' +
      '<div class="admin-order-grid"><section><h3>Artifact</h3>' + lines + '<div class="admin-order-total"><span>Demo subtotal</span><strong>' + money(order.subtotal) + '</strong></div></section>' +
      '<section class="admin-customer"><h3>Customer & delivery</h3><p><strong>' + escapeHtml(customer.email) + '</strong><br>' + escapeHtml(customer.phone) + '</p><p>' + escapeHtml(customer.address) + '<br>' + escapeHtml(customer.city) + ' · ' + escapeHtml(customer.postalCode) + '</p><span class="mono">PAYMENT · ' + escapeHtml(order.paymentStatus) + '</span></section></div>' +
      '<div class="admin-order-actions"><label><span>Order status</span><select data-order-status="' + escapeHtml(order.id) + '">' + statusOptions + '</select></label><button class="button button-dark" type="button" data-update-order="' + escapeHtml(order.id) + '">Save status</button><button class="remove-button" type="button" data-delete-order="' + escapeHtml(order.id) + '">Delete demo order</button></div></article>';
  }).join("");
}

function adminDashboard() {
  const seriesForms = content.seriesList.map(function (series, seriesIndex) {
    const chapterForms = series.chapters.map(function (chapter, index) {
      const fieldPath = "seriesList." + seriesIndex + ".chapters." + index;
      return '<article class="admin-chapter"><div class="admin-row-title"><h3>' + escapeHtml(chapter.number) + ' · ' + escapeHtml(chapter.title) + '</h3><button class="remove-button" type="button" data-remove-chapter="' + seriesIndex + ':' + index + '">Remove chapter</button></div>' +
      '<div class="admin-grid">' +
        field("Chapter number", fieldPath + ".number", chapter.number) +
        field("Title", fieldPath + ".title", chapter.title) +
        field("URL slug", fieldPath + ".slug", chapter.slug) +
        field("Linked product slug", fieldPath + ".productSlug", chapter.productSlug) +
      '</div>' +
      field("Short introduction", fieldPath + ".excerpt", chapter.excerpt, { textarea: true }) +
      field("Chapter image", fieldPath + ".image", chapter.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 2 MB)." }) +
      field("Story paragraphs", fieldPath + ".story", chapter.story || [], { textarea: true, kind: "paragraphs", hint: "Separate paragraphs with a blank line." }) +
      '</article>';
    }).join("");
    const seriesPath = "seriesList." + seriesIndex;
    return '<section class="admin-card"><div class="admin-row-title"><h2>' + escapeHtml(series.number) + ' · ' + escapeHtml(series.title) + '</h2><button class="remove-button" type="button" data-remove-series="' + seriesIndex + '">Remove series</button></div><div class="admin-grid">' +
      field("Series number", seriesPath + ".number", series.number) +
      field("Series title", seriesPath + ".title", series.title) +
      field("URL slug", seriesPath + ".slug", series.slug) +
      field("Subtitle", seriesPath + ".subtitle", series.subtitle) +
      field("Series image", seriesPath + ".image", series.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 2 MB)." }) +
      '</div>' + field("Series description", seriesPath + ".description", series.description, { textarea: true }) +
      '<div class="admin-row-title"><h3>Chapters · ' + series.chapters.length + '</h3><button class="button button-light" type="button" data-add-chapter="' + seriesIndex + '">Add chapter</button></div>' + chapterForms + '</section>';
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
      field("Product image", "products." + index + ".image", product.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 2 MB)." }) +
      field("Back or detail image", "products." + index + ".secondaryImage", product.secondaryImage || "", { upload: true, hint: "Optional second product view. Use a full image URL or upload a file (up to 2 MB)." }) +
      field("Details and care points", "products." + index + ".details", product.details, { textarea: true, kind: "lines", hint: "One detail per line." }) +
    '</article>';
  }).join("");

  function activeClass(name) { return adminActiveTab === name ? " active" : ""; }
  function selected(name) { return adminActiveTab === name ? "true" : "false"; }
  const savebar = adminActiveTab === "orders" ? "" :
    '<div class="admin-savebar"><span>Remember to save your changes before leaving this page.</span><div class="admin-actions"><span class="admin-status" id="admin-status" role="status">' + escapeHtml(adminMessage) + '</span><button class="button" type="submit">Save changes <span class="arrow">↗</span></button></div></div>';

  return '<div class="admin-shell"><div class="page">' +
    '<div class="admin-top"><div><span class="mono section-label">QUIET BATTLES · CONTENT & ORDER DESK</span><h1>Studio</h1></div><div><p>Content, media, and demo orders are saved to Neon Postgres.</p><button class="button button-light" type="button" data-logout>Sign out</button></div></div>' +
    '<div class="admin-tabs" role="tablist"><button class="admin-tab' + activeClass("brand") + '" type="button" data-tab="brand" role="tab" aria-selected="' + selected("brand") + '">Brand & home</button><button class="admin-tab' + activeClass("series") + '" type="button" data-tab="series" role="tab" aria-selected="' + selected("series") + '">Series & chapters</button><button class="admin-tab' + activeClass("products") + '" type="button" data-tab="products" role="tab" aria-selected="' + selected("products") + '">Products</button><button class="admin-tab' + activeClass("orders") + '" type="button" data-tab="orders" role="tab" aria-selected="' + selected("orders") + '">Orders <span>(' + adminOrders.length + ')</span></button></div>' +
    '<form id="admin-form">' +
      '<section class="admin-panel' + activeClass("brand") + '" data-panel="brand"><div class="admin-card"><h2>Brand introduction</h2><div class="admin-grid">' +
        field("Brand name", "brand.name", content.brand.name) +
        field("Tagline", "brand.tagline", content.brand.tagline) +
      '</div>' + field("Brand introduction", "brand.intro", content.brand.intro, { textarea: true }) +
      '<div class="admin-card"><h2>Homepage hero</h2><div class="admin-grid">' +
        field("Eyebrow", "hero.eyebrow", content.hero.eyebrow) +
        field("Headline (type <br> for a line break)", "hero.title", content.hero.title) +
      '</div>' + field("Supporting copy", "hero.description", content.hero.description, { textarea: true }) +
      field("Hero image", "hero.image", content.hero.image, { upload: true, hint: "Use a full image URL or upload a PNG, JPG, or WebP file (up to 2 MB)." }) +
      '</div><div class="admin-card"><h2>Our note</h2><div class="admin-grid">' + field("Section label", "introduction.eyebrow", content.introduction.eyebrow) + field("Heading", "introduction.title", content.introduction.title) + '</div>' + field("Copy", "introduction.copy", content.introduction.copy, { textarea: true }) + '</div></section>' +
      '<section class="admin-panel' + activeClass("series") + '" data-panel="series"><div class="admin-row-title"><h2>Archive Series · ' + content.seriesList.length + '</h2><button class="button button-dark" type="button" data-add-series>Add series</button></div>' + seriesForms + '</section>' +
      '<section class="admin-panel' + activeClass("products") + '" data-panel="products"><div class="admin-card"><div class="admin-row-title"><h2>Product catalogue · ' + content.products.length + '</h2><button class="button button-light" type="button" data-add-product>Add product</button></div>' + productForms + '</div></section>' +
      '<section class="admin-panel' + activeClass("orders") + '" data-panel="orders"><div class="admin-row-title"><div><span class="mono section-label">NEON ORDER RECORDS</span><h2>Order ledger · ' + adminOrders.length + '</h2></div><button class="button button-light" type="button" data-refresh-orders>Refresh orders</button></div><div class="admin-status order-admin-status" role="status">' + escapeHtml(adminMessage) + '</div>' + adminOrderCards() + '</section>' + savebar +
    '</form></div></div>';
}

function renderCart() {
  if (!cartOpen) return "";
  const lines = cart.map(function (item, index) {
    return '<article class="cart-line"><img src="' + escapeHtml(item.image) + '" alt=""><div><h3>' + escapeHtml(item.name) + '</h3><p>SIZE ' + escapeHtml(item.size) + '</p><div class="qty-controls"><button type="button" aria-label="Decrease quantity" data-cart-dec="' + index + '">−</button><span>' + item.qty + '</span><button type="button" aria-label="Increase quantity" data-cart-inc="' + index + '">+</button></div></div><span class="cart-price">' + money(item.price * item.qty) + '</span></article>';
  }).join("");
  const total = cartTotal();
  return '<button class="cart-backdrop" type="button" aria-label="Close bag" data-cart-close></button><aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="cart-head"><h2 id="cart-title">Your bag <span class="mono">(' + cartQuantity() + ')</span></h2><button class="icon-button" type="button" data-cart-close aria-label="Close bag">×</button></div>' +
    '<div class="cart-items">' + (lines || '<div class="cart-empty">Nothing in your bag yet.<br>Find a piece that feels like you.</div>') + '</div>' +
    (cart.length ? '<div class="cart-summary"><div class="cart-total"><span>Demo subtotal</span><strong>' + money(total) + '</strong></div><button type="button" class="button button-dark" data-demo-checkout>Begin acquisition <span class="arrow">↗</span></button><small>Dummy QR · no real payment is requested</small></div>' : "") +
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
  else if (route[0] === "series") main = renderSeries(route[1]);
  else if (route[0] === "chapter") main = renderChapter(route[1]);
  else if (route[0] === "product") main = renderProduct(route[1]);
  else if (route[0] === "checkout") main = renderCheckout();
  else if (route[0] === "admin") main = '<main>' + (adminToken ? adminDashboard() : '<div class="admin-shell"><div class="page">' + adminLogin() + '</div></div>') + '</main>';
  else main = renderHome();
  root.innerHTML = renderHeader() + main + renderFooter() + renderCart() + renderNotice();
  const pageTitle = route[0] === "admin" ? "Studio" :
    route[0] === "checkout" ? "Acquisition" :
    route[0] === "archive" ? "The Archive" :
    route[0] === "series" ? getSeries(route[1]).title :
    route[0] === "chapter" ? getChapter(route[1]).title :
    route[0] === "product" ? getProduct(route[1]).name : "Wear Your Battles";
  document.title = pageTitle + " · QUIET BATTLES™";
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.content = route[0] === "chapter" ? getChapter(route[1]).excerpt :
      route[0] === "product" ? getProduct(route[1]).description :
      route[0] === "series" ? getSeries(route[1]).description :
      "QUIET BATTLES makes considered everyday clothing for the stories we carry quietly. Wear your battles.";
  }
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
      checkoutOrder = null;
      checkoutStep = "details";
      saveCart();
      cartOpen = true;
      render();
    });
  });
  const sizeGuide = document.querySelector("[data-size-guide]");
  if (sizeGuide) sizeGuide.addEventListener("click", function () { showNotice("Size guide: XS  ·  S  ·  M  ·  L  ·  XL"); });
  const checkout = document.querySelector("[data-demo-checkout]");
  if (checkout) checkout.addEventListener("click", function () {
    cartOpen = false;
    checkoutMessage = "";
    if (location.hash === "#checkout") render();
    else location.hash = "#checkout";
  });

  const checkoutDetails = document.getElementById("checkout-details");
  if (checkoutDetails) checkoutDetails.addEventListener("submit", function (event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(checkoutDetails));
    if (values.website) return;
    checkoutCustomer = {
      name: values.name, email: values.email, phone: values.phone,
      address: values.address, city: values.city, postalCode: values.postalCode
    };
    checkoutStep = "payment";
    checkoutMessage = "";
    render();
    window.scrollTo(0, 0);
  });
  const backToDetails = document.querySelector("[data-back-details]");
  if (backToDetails) backToDetails.addEventListener("click", function () {
    checkoutStep = "details";
    checkoutMessage = "";
    render();
  });
  const confirmDemo = document.querySelector("[data-confirm-demo]");
  if (confirmDemo) confirmDemo.addEventListener("click", async function () {
    const acknowledgement = document.querySelector("[data-demo-ack]");
    if (!acknowledgement || !acknowledgement.checked) {
      checkoutMessage = "Confirm that you understand this is a no-payment demonstration.";
      const message = document.querySelector(".checkout-message");
      if (message) message.textContent = checkoutMessage;
      return;
    }
    confirmDemo.disabled = true;
    confirmDemo.textContent = "Recording acquisition…";
    checkoutMessage = "";
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: checkoutCustomer,
          items: cart.map(function (item) { return { slug: item.slug, size: item.size, qty: item.qty }; }),
          demoAcknowledged: true
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The demonstration order could not be recorded.");
      checkoutOrder = result.order;
      checkoutStep = "complete";
      cart = [];
      saveCart();
      render();
      window.scrollTo(0, 0);
    } catch (error) {
      checkoutMessage = error.message;
      confirmDemo.disabled = false;
      confirmDemo.innerHTML = 'Confirm demo payment <span class="arrow">↗</span>';
      const message = document.querySelector(".checkout-message");
      if (message) message.textContent = checkoutMessage;
    }
  });

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
      adminOrders = [];
      adminOrdersLoaded = false;
      adminActiveTab = "brand";
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
    adminOrders = [];
    adminOrdersLoaded = false;
    adminActiveTab = "brand";
    adminMessage = "You have signed out.";
    render();
  });

  document.querySelectorAll("[data-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      adminActiveTab = tab.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach(function (item) {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll("[data-panel]").forEach(function (panel) {
        panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab);
      });
      const savebar = document.querySelector(".admin-savebar");
      if (savebar) savebar.classList.toggle("hide", adminActiveTab === "orders");
      if (adminActiveTab === "orders" && !adminOrdersLoaded && !adminOrdersLoading) loadAdminOrders();
    });
  });

  const refreshOrders = document.querySelector("[data-refresh-orders]");
  if (refreshOrders) refreshOrders.addEventListener("click", function () {
    adminOrdersLoaded = false;
    loadAdminOrders();
  });
  document.querySelectorAll("[data-update-order]").forEach(function (button) {
    button.addEventListener("click", function () {
      const select = document.querySelector('[data-order-status="' + CSS.escape(button.dataset.updateOrder) + '"]');
      updateAdminOrder(button.dataset.updateOrder, select.value, button);
    });
  });
  document.querySelectorAll("[data-delete-order]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (window.confirm("Delete this demonstration order from Neon?")) deleteAdminOrder(button.dataset.deleteOrder, button);
    });
  });

  document.querySelectorAll("[data-field]").forEach(function (input) {
    input.addEventListener("input", function () { updateField(input); });
    input.addEventListener("change", function () { updateField(input); });
  });
  document.querySelectorAll("[data-upload]").forEach(function (input) {
    input.addEventListener("change", function () { uploadImage(input); });
  });
  const addSeries = document.querySelector("[data-add-series]");
  if (addSeries) addSeries.addEventListener("click", function () {
    const index = content.seriesList.length + 1;
    const first = getSeries();
    const slug = "new-series-" + Date.now();
    content.seriesList.push({
      slug: slug, number: "SERIES " + String(index).padStart(2, "0"), title: "Untitled series",
      subtitle: "A new story in the archive.", description: "Edit this series introduction in Studio.", image: first.image,
      chapters: [{ number: "CHAPTER 01", slug: slug + "-first-chapter", title: "Untitled chapter",
        excerpt: "Edit this chapter introduction in Studio.", image: first.image,
        productSlug: content.products[0].slug, story: [] }]
    });
    adminMessage = "New Series added to the draft. Edit its details and save changes.";
    render();
    document.querySelector('[data-tab="series"]').click();
  });
  document.querySelectorAll("[data-remove-series]").forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.removeSeries);
      const series = content.seriesList[index];
      if (content.seriesList.length <= 1) adminMessage = "Keep at least one Series in the archive.";
      else if (content.products.some(function (product) { return series.chapters.some(function (chapter) { return chapter.slug === product.chapterSlug; }); })) {
        adminMessage = "Move or remove products linked to this Series before removing it.";
      } else {
        content.seriesList.splice(index, 1);
        adminMessage = "Series removed from the draft. Save changes to keep it.";
      }
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-add-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      const series = content.seriesList[Number(button.dataset.addChapter)];
      const number = "CHAPTER " + String(series.chapters.length + 1).padStart(2, "0");
      series.chapters.push({ number: number, slug: "new-chapter-" + Date.now(), title: "Untitled chapter", excerpt: "", image: series.image, productSlug: content.products[0].slug, story: [] });
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-remove-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      const indices = button.dataset.removeChapter.split(":").map(Number);
      const series = content.seriesList[indices[0]];
      const chapter = series.chapters[indices[1]];
      if (series.chapters.length <= 1) {
        adminMessage = "Keep at least one chapter in the series.";
      } else if (content.products.some(function (product) { return product.chapterSlug === chapter.slug; })) {
        adminMessage = "Move or remove the product linked to this chapter first.";
      } else {
        series.chapters.splice(indices[1], 1);
        adminMessage = "Chapter removed from the draft. Save changes to keep it.";
      }
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-add-product]").forEach(function (button) {
    button.addEventListener("click", function () {
      content.products.push({ slug: "new-piece-" + Date.now(), name: "New field piece", category: getSeries().number, description: "", price: 0, image: "/assets/soft-armor.svg", secondaryImage: "", sizes: ["XS", "S", "M", "L", "XL"], details: [], chapterSlug: getSeries().chapters[0].slug });
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
      const product = content.products[Number(button.dataset.removeProduct)];
      if (content.seriesList.some(function (series) { return series.chapters.some(function (chapter) { return chapter.productSlug === product.slug; }); })) {
        adminMessage = "Link chapters to another product before removing this one.";
      } else {
        content.products.splice(Number(button.dataset.removeProduct), 1);
        adminMessage = "Product removed from the draft. Save changes to keep it.";
      }
      render();
      document.querySelector('[data-tab="products"]').click();
    });
  });
  const adminForm = document.getElementById("admin-form");
  if (adminForm) adminForm.addEventListener("submit", saveAdminContent);
  if (currentRoute()[0] === "admin" && adminToken && !adminOrdersLoaded && !adminOrdersLoading) loadAdminOrders();
}

async function loadAdminOrders() {
  if (!adminToken || adminOrdersLoading) return;
  adminOrdersLoading = true;
  try {
    const response = await fetch("/api/admin/orders", { headers: { Authorization: "Bearer " + adminToken } });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        adminToken = "";
        sessionStorage.removeItem("qbAdminToken");
      }
      throw new Error(result.error || "Orders could not be loaded.");
    }
    adminOrders = result.orders;
    adminOrdersLoaded = true;
    adminMessage = adminOrders.length ? "Order ledger updated." : "No demonstration orders yet.";
  } catch (error) {
    adminOrdersLoaded = true;
    adminMessage = error.message;
  } finally {
    adminOrdersLoading = false;
    render();
  }
}

async function updateAdminOrder(id, status, button) {
  button.disabled = true;
  try {
    const response = await fetch("/api/admin/orders/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken },
      body: JSON.stringify({ status: status })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The order status could not be updated.");
    adminOrders = adminOrders.map(function (order) { return order.id === id ? result.order : order; });
    adminMessage = result.order.orderNumber + " moved to " + result.order.status + ".";
    render();
  } catch (error) {
    adminMessage = error.message;
    button.disabled = false;
    const status = document.querySelector(".order-admin-status");
    if (status) status.textContent = adminMessage;
  }
}

async function deleteAdminOrder(id, button) {
  button.disabled = true;
  try {
    const response = await fetch("/api/admin/orders/" + encodeURIComponent(id), {
      method: "DELETE", headers: { Authorization: "Bearer " + adminToken }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The demonstration order could not be deleted.");
    adminOrders = adminOrders.filter(function (order) { return order.id !== id; });
    adminMessage = result.orderNumber + " deleted from the demo ledger.";
    render();
  } catch (error) {
    adminMessage = error.message;
    button.disabled = false;
    const status = document.querySelector(".order-admin-status");
    if (status) status.textContent = adminMessage;
  }
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
  if (file.size > 2 * 1024 * 1024) {
    adminMessage = "Images must be 2 MB or smaller.";
    render();
    return;
  }
  const tabName = input.dataset.upload.split(".")[0] === "products" ? "products" :
    input.dataset.upload.split(".")[0] === "seriesList" ? "series" : "brand";
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
    adminMessage = "Saved to Neon Postgres.";
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
  .then(function (response) { if (!response.ok) throw new Error("The content service is unavailable."); return response.json(); })
  .then(function (data) { content = data; render(); })
  .catch(function () {
    root.innerHTML = '<main class="page" style="padding:80px 0"><span class="mono">The archive is offline.</span><p>Please try again shortly.</p></main>';
  });
