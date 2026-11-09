"use strict";

const root = document.getElementById("app");
let content = null;
let cart = readCart();
let cartOpen = false;
let cartReturnFocus = false;
let adminToken = sessionStorage.getItem("qbAdminToken") || "";
let adminMessage = "";
let adminSetupConfigured = null;
let adminAccessLoaded = false;
let adminAccessLoading = false;
let adminAccessError = "";
let adminSessionChecked = !adminToken;
let noticeTimer = null;
let noticeMessage = "";
let sizeSelection = {};
let checkoutStep = "details";
let checkoutCustomer = {};
let checkoutOrder = null;
let checkoutMessage = "";
let adminDraft = null;
let authSubmittedValues = null;
let adminOrders = [];
let adminOrdersLoaded = false;
let adminOrdersLoading = false;
let adminCustomers = [];
let adminCustomersLoaded = false;
let adminCustomersLoading = false;
let adminActiveTab = "brand";
let customerToken = sessionStorage.getItem("qbCustomerToken") || "";
let customer = null;
let customerOrders = [];
let customerLoading = Boolean(customerToken);
let authMessage = "";
let catalogFilter = "All";
let catalogSort = "featured";
let quickAddSlug = "";
const checkoutAuthPendingKey = "qbCheckoutAuthPending";
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

function clearCheckoutState() {
  checkoutStep = "details";
  checkoutCustomer = {};
  checkoutOrder = null;
  checkoutMessage = "";
  sessionStorage.removeItem(checkoutAuthPendingKey);
}

function cloneContent(value) {
  return structuredClone(value);
}

function syncCartWithContent(nextContent) {
  let removed = false;
  let priceChanged = false;
  const nextCart = [];
  cart.forEach(function (item) {
    const product = nextContent.products.find(function (entry) { return entry.slug === item.slug; });
    if (!product || !product.sizes.includes(item.size)) {
      removed = true;
      return;
    }
    const existing = nextCart.find(function (entry) { return entry.slug === item.slug && entry.size === item.size; });
    if (existing) {
      existing.qty = Math.min(10, existing.qty + item.qty);
      removed = true;
      return;
    }
    if (Number(item.price) !== Number(product.price)) priceChanged = true;
    item.name = product.name;
    item.image = product.image;
    item.price = Number(product.price);
    item.qty = Math.min(10, item.qty);
    nextCart.push(item);
  });
  cart = nextCart;
  saveCart();
  return { removed: removed, priceChanged: priceChanged };
}

function addProductToCart(product, size) {
  const existing = cart.find(function (item) { return item.slug === product.slug && item.size === size; });
  if (existing && existing.qty >= 10) {
    showNotice("Maximum quantity per size is 10.");
    return false;
  }
  if (existing) existing.qty += 1;
  else cart.push({ slug: product.slug, name: product.name, image: product.image, size: size, price: Number(product.price), qty: 1 });
  checkoutOrder = null;
  checkoutStep = "details";
  saveCart();
  cartOpen = true;
  cartReturnFocus = true;
  return true;
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
  let pathname = location.pathname;
  if (location.hash) {
    const legacyRoute = decodeURIComponent(location.hash.slice(1)).replace(/^\/+|\/+$/g, "");
    pathname = !legacyRoute || legacyRoute === "home" ? "/" : "/" + legacyRoute;
    history.replaceState(null, "", pathname + location.search);
  }
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "");
    history.replaceState(null, "", pathname + location.search);
  }
  if (pathname === "/home") {
    pathname = "/";
    history.replaceState(null, "", pathname + location.search);
  }
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return segments.length ? segments : ["home"];
}

function navLink(label, href) {
  return '<a href="' + href + '">' + label + "</a>";
}

function finishRouteChange() {
  const route = currentRoute();
  if (!["checkout", "login", "signup"].includes(route[0])) sessionStorage.removeItem(checkoutAuthPendingKey);
  cartOpen = false;
  cartReturnFocus = false;
  quickAddSlug = "";
  render();
  if (route[0] === "belief") {
    requestAnimationFrame(function () {
      const intro = document.getElementById("belief");
      if (intro) intro.scrollIntoView({ behavior: "smooth" });
    });
  } else {
    window.scrollTo(0, 0);
  }
}

function navigateTo(path) {
  const target = new URL(path, location.origin);
  if (target.origin !== location.origin) return;
  if (target.pathname === location.pathname && target.search === location.search) {
    const route = currentRoute();
    if (route[0] === "belief") {
      const intro = document.getElementById("belief");
      if (intro) intro.scrollIntoView({ behavior: "smooth" });
    } else if (route[0] === "home") {
      window.scrollTo(0, 0);
    }
    return;
  }
  history.pushState(null, "", target.pathname + target.search);
  finishRouteChange();
}

root.addEventListener("click", function (event) {
  const link = event.target.closest && event.target.closest('a[href^="/"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
  const target = new URL(link.href, location.href);
  if (target.origin !== location.origin) return;
  event.preventDefault();
  navigateTo(target.pathname + target.search);
});

function imageFrame(src, alt, className) {
  return '<div class="' + (className || "image-frame") + '"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy"></div>';
}

function getChapter(slug) {
  for (const series of content.seriesList) {
    const chapter = series.chapters.find(function (item) { return item.slug === slug; });
    if (chapter) return chapter;
  }
  return null;
}

function getSeries(slug) {
  if (!slug) return content.seriesList[0] || null;
  return content.seriesList.find(function (item) { return item.slug === slug; }) || null;
}

function getChapterSeries(chapter) {
  return content.seriesList.find(function (item) { return item.chapters.includes(chapter); }) || content.seriesList[0];
}

function getProduct(slug) {
  if (!slug) return content.products[0] || null;
  return content.products.find(function (item) { return item.slug === slug; }) || null;
}

function renderHeader() {
  const accountLabel = customer ? "My archive" : "Sign in";
  const accountHref = customer ? "/account" : "/login";
  return '<div class="topline">A quieter kind of strength · ' + escapeHtml(content.seriesList[0].number) + ' now open</div>' +
    '<header class="site-header"><div class="nav-wrap">' +
      '<a class="wordmark" href="/" aria-label="Quiet Battles home">' + escapeHtml(content.brand.name) + '<sup>™</sup></a>' +
      '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>' +
      '<nav class="nav-links" id="main-nav" aria-label="Main navigation">' +
        navLink("The archive", "/archive") +
        navLink(content.seriesList[0].number, "/series/" + escapeHtml(content.seriesList[0].slug)) +
        navLink("Artifacts", "/artifacts") +
        navLink("Our note", "/belief") +
        '<a class="mobile-account-link" href="' + accountHref + '">' + accountLabel + '</a>' +
      '</nav>' +
      '<div class="nav-actions"><a href="' + accountHref + '">' + accountLabel + '</a><a class="studio-link" href="/admin">Studio</a><button class="cart-trigger" type="button" data-cart-open>Bag <span class="cart-count">(' + cartQuantity() + ')</span></button></div>' +
    '</div></header>';
}

function renderFooter() {
  return '<footer class="site-footer"><div class="page">' +
    '<div class="footer-main">' +
      '<h2>For what<br>you carry.</h2>' +
      '<p class="footer-note">' + escapeHtml(content.brand.intro) + '</p>' +
      '<div class="footer-links"><a href="/archive">Explore the archive</a><a href="/artifacts">Meet the artifacts</a><a href="' + (customer ? '/account' : '/login') + '">' + (customer ? 'My private archive' : 'Sign in') + '</a><a href="/admin">Studio access</a></div>' +
    '</div>' +
    '<div class="footer-bottom"><span>© 2026 ' + escapeHtml(content.brand.name) + '™</span><span>' + escapeHtml(content.brand.tagline) + '</span><span>STORIES FOR THE EVERYDAY</span></div>' +
  '</div></footer>';
}

function chapterCards(series) {
  return series.chapters.map(function (chapter) {
    return '<a class="chapter-card" href="/chapter/' + escapeHtml(chapter.slug) + '">' +
      '<span class="mono">' + escapeHtml(chapter.number) + ' <span aria-hidden="true">·</span> CHAPTER CHAMBER</span>' +
      '<h3>' + escapeHtml(chapter.title) + '</h3>' +
      '<p>' + escapeHtml(chapter.excerpt) + '</p>' +
      '<span class="card-link">Read this chapter <span class="arrow">↗</span></span>' +
    '</a>';
  }).join("");
}

function renderHome() {
  const series = getSeries();
  const firstChapter = series.chapters[0];
  const product = getProduct(firstChapter.productSlug) || content.products[0];
  return '<main>' +
    '<section class="hero">' +
      '<div class="hero-copy">' +
        '<div class="eyebrow mono">' + escapeHtml(content.hero.eyebrow) + '</div>' +
        '<h1>' + content.hero.title.split("<br>").map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") + '</h1>' +
        '<p class="hero-description">' + escapeHtml(content.hero.description) + '</p>' +
        '<div class="hero-action-row"><a class="button" href="/archive">Enter the archive <span class="arrow">↗</span></a><span class="hero-caption">Stories stitched<br>into the everyday</span></div>' +
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
        imageFrame(firstChapter.image, "A quiet portrait from " + series.title, "belief-image") +
        '<div class="belief-note"><span class="mono">FIELD NOTE ' + escapeHtml(firstChapter.number) + ' · ' + escapeHtml(series.title) + '</span><blockquote>“You do not have to feel <em>ready</em> to begin.”</blockquote><div class="belief-foot"><p>We believe softness is something you can choose, especially on the days it takes effort.</p><span class="mono">QB / 01</span></div></div>' +
      '</div>' +
    '</section>' +
    '<section class="series-band"><div class="series-intro">' +
      '<div class="series-copy"><span class="mono section-label">' + escapeHtml(series.number) + ' · THE ARCHIVE</span><h2>' + escapeHtml(series.title) + '</h2><p class="subtitle">' + escapeHtml(series.subtitle) + '</p><p class="description">' + escapeHtml(series.description) + '</p><a class="button" href="/series/' + escapeHtml(series.slug) + '">Open the series <span class="arrow">↗</span></a></div>' +
      '<figure class="series-image"><img src="' + escapeHtml(series.image) + '" alt="' + escapeHtml(series.title) + ' collection portrait" loading="lazy"><figcaption class="mono">' + escapeHtml(series.title) + '</figcaption></figure>' +
    '</div><div class="page chapter-list">' + chapterCards(series) + '</div></section>' +
    '<section class="page section product-feature">' +
      '<div class="product-photo"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><span class="product-stamp mono">FIELD PIECE 001</span></div>' +
      '<div class="product-copy"><span class="mono section-label">FROM THE SERIES · ' + escapeHtml(firstChapter.number) + '</span><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.description) + '</p><div class="price">' + money(product.price) + '<small>Illustrative price · INR</small></div><div class="product-details">' + product.details.map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") + '</div><a class="button button-dark" href="/product/' + escapeHtml(product.slug) + '">View the piece <span class="arrow">↗</span></a></div>' +
    '</section>' +
  '</main>';
}

function renderArchive() {
  const entries = content.seriesList.map(function (series) {
    return '<article class="archive-item"><div class="archive-art"><img src="' + escapeHtml(series.image) + '" alt="' + escapeHtml(series.number + ' — ' + series.title) + '" loading="lazy"><span class="hero-stamp">' + escapeHtml(series.number) + ' · ' + series.chapters.length + ' chapters</span></div><div class="archive-copy"><span class="mono section-label">' + escapeHtml(series.number) + '</span><h2 class="page-title">' + escapeHtml(series.title) + '</h2><p>' + escapeHtml(series.subtitle) + '</p><p>' + escapeHtml(series.description) + '</p><a class="button button-dark" href="/series/' + escapeHtml(series.slug) + '">Explore this series <span class="arrow">↗</span></a></div></article>';
  }).join("");
  return '<main><section class="archive-hero"><div class="page"><span class="mono section-label">THE QUIET BATTLES ARCHIVE</span><h1 class="page-title">Stories to<br>wear with you.</h1><p class="lead">A growing collection of chapters, objects, and small reminders for the lives we are living between the lines.</p></div></section>' +
    '<section class="page archive-list">' + entries + '</section></main>';
}

function renderNotFound() {
  return '<main class="page not-found"><span class="mono section-label">THE ARCHIVE · 404</span><h1 class="page-title">This page is no longer here.</h1><p>The link may have changed. Return to the Archive to find your way.</p><a class="button button-dark" href="/archive">Open the Archive <span class="arrow">↗</span></a></main>';
}

function catalogCard(product, index) {
  const quickOpen = quickAddSlug === product.slug;
  const sizes = product.sizes.map(function (size) {
    return '<button type="button" data-quick-size="' + escapeHtml(size) + '" data-quick-product="' + escapeHtml(product.slug) + '">' + escapeHtml(size) + '</button>';
  }).join("");
  return '<article class="catalog-card" data-product-kind="' + escapeHtml(product.kind) + '">' +
    '<div class="catalog-media"><a href="/product/' + escapeHtml(product.slug) + '" aria-label="View ' + escapeHtml(product.name) + '"><img class="catalog-front" src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + ' front view" loading="' + (index < 4 ? 'eager' : 'lazy') + '">' +
      (product.secondaryImage ? '<img class="catalog-back" src="' + escapeHtml(product.secondaryImage) + '" alt="' + escapeHtml(product.name) + ' back view" loading="lazy">' : '') + '</a>' +
      '<div class="catalog-badges"><span>' + escapeHtml(product.kind) + '</span></div>' +
      '<button class="quick-add-trigger" type="button" data-quick-open="' + escapeHtml(product.slug) + '" aria-expanded="' + String(quickOpen) + '">' + (quickOpen ? 'Close' : 'Quick add') + ' <span aria-hidden="true">' + (quickOpen ? '−' : '+') + '</span></button>' +
      '<div class="quick-add-panel' + (quickOpen ? ' open' : '') + '" aria-hidden="' + String(!quickOpen) + '"' + (quickOpen ? '' : ' inert') + '><div><span class="mono">Choose size</span><a href="/product/' + escapeHtml(product.slug) + '">View details ↗</a></div><div class="quick-size-grid">' + sizes + '</div></div>' +
    '</div>' +
    '<div class="catalog-card-meta"><div><span class="mono">' + escapeHtml(product.category) + '</span><h2><a href="/product/' + escapeHtml(product.slug) + '">' + escapeHtml(product.name) + '</a></h2></div><strong>' + money(product.price) + '</strong></div>' +
  '</article>';
}

function renderArtifacts() {
  const featuredSeries = content.seriesList[0];
  const featuredChapter = featuredSeries.chapters[featuredSeries.chapters.length - 1];
  const featuredChapterSlugs = new Set(featuredSeries.chapters.map(function (chapter) { return chapter.slug; }));
  const heroProduct = content.products.find(function (product) { return featuredChapterSlugs.has(product.chapterSlug); }) || content.products[0];
  const kinds = ["All"].concat(Array.from(new Set(content.products.map(function (product) { return product.kind; }))));
  let products = content.products.filter(function (product) { return catalogFilter === "All" || product.kind === catalogFilter; });
  products = products.slice();
  if (catalogSort === "price-low") products.sort(function (a, b) { return a.price - b.price; });
  else if (catalogSort === "price-high") products.sort(function (a, b) { return b.price - a.price; });
  else if (catalogSort === "name") products.sort(function (a, b) { return a.name.localeCompare(b.name); });
  const filterButtons = kinds.map(function (kind) {
    return '<button type="button" data-catalog-filter="' + escapeHtml(kind) + '" aria-pressed="' + String(catalogFilter === kind) + '">' + escapeHtml(kind) + '</button>';
  }).join("");
  let cards = "";
  products.forEach(function (product, index) {
    cards += catalogCard(product, index);
    if (index === 3 && products.length > 4) {
      cards += '<aside class="catalog-interlude"><div><span class="mono">FIELD NOTE · ' + escapeHtml(featuredChapter.number) + '</span><blockquote>' + escapeHtml(featuredChapter.excerpt) + '</blockquote><a href="/chapter/' + escapeHtml(featuredChapter.slug) + '">Read ' + escapeHtml(featuredChapter.title) + ' <span class="arrow">↗</span></a></div><img src="' + escapeHtml(featuredChapter.image) + '" alt="A portrait from ' + escapeHtml(featuredSeries.title) + '" loading="lazy"></aside>';
    }
  });
  const productCount = content.products.length;
  const chapterCount = content.seriesList.reduce(function (total, series) { return total + series.chapters.length; }, 0);
  const heroIndex = String(content.products.indexOf(heroProduct) + 1).padStart(2, "0");
  const indexMax = String(productCount).padStart(2, "0");
  return '<main class="shop-page"><section class="shop-hero"><div class="shop-hero-copy"><span class="mono">' + escapeHtml(featuredSeries.number) + ' · COMPLETE ARTIFACT INDEX</span><h1>Wear what<br>stayed.</h1><p>' + productCount + ' objects for the private work of continuing. Begin with the story, or choose the shape you need today.</p><div><button class="button shop-primary" type="button" data-scroll-catalogue>Shop the drop <span class="arrow">↓</span></button><a href="/series/' + escapeHtml(featuredSeries.slug) + '">Read the Series</a></div></div><div class="shop-hero-visual"><img src="' + escapeHtml(featuredSeries.image) + '" alt="' + escapeHtml(featuredSeries.title) + ' campaign portrait" fetchpriority="high"><a class="floating-artifact" href="/product/' + escapeHtml(heroProduct.slug) + '"><img src="' + escapeHtml(heroProduct.image) + '" alt="' + escapeHtml(heroProduct.name) + '"><span><b>Featured · Artifact ' + heroIndex + '</b>' + escapeHtml(heroProduct.name) + ' · ' + money(heroProduct.price) + '</span></a><span class="shop-index">01—' + indexMax + '</span></div></section>' +
    '<div class="drop-ticker" aria-label="Collection information"><div><span>' + productCount + ' artifacts</span><span>' + chapterCount + ' chapters</span><span>Front + back views</span><span>Dummy QR checkout</span><span>' + productCount + ' artifacts</span><span>' + chapterCount + ' chapters</span><span>Front + back views</span><span>Dummy QR checkout</span></div></div>' +
     '<section class="catalogue" id="catalogue"><header class="catalogue-head page"><div><span class="mono section-label">THE COMPLETE DROP</span><h2>All artifacts</h2><p><strong>' + products.length + '</strong> of ' + content.products.length + ' objects</p></div><div class="catalogue-controls"><nav class="catalog-filters" aria-label="Filter artifacts">' + filterButtons + '</nav><label class="catalog-sort"><span>Sort</span><select data-catalog-sort><option value="featured"' + (catalogSort === 'featured' ? ' selected' : '') + '>Featured</option><option value="name"' + (catalogSort === 'name' ? ' selected' : '') + '>Name: A to Z</option><option value="price-low"' + (catalogSort === 'price-low' ? ' selected' : '') + '>Price: low to high</option><option value="price-high"' + (catalogSort === 'price-high' ? ' selected' : '') + '>Price: high to low</option></select></label></div></header><div class="catalog-grid">' + (cards || '<div class="catalog-empty">No artifacts in this category yet.</div>') + '</div></section></main>';
}

function customerOrderCards() {
  if (!customerOrders.length) {
    return '<div class="account-empty"><span class="mono section-label">ACQUISITION LEDGER · 0</span><h2>Nothing recorded yet.</h2><p>After you confirm a non-payable test order, its record will appear here.</p><a class="button button-dark" href="/artifacts">Meet the artifacts <span class="arrow">↗</span></a></div>';
  }
  return customerOrders.map(function (order) {
    const lines = (order.items || []).map(function (item) {
      return '<div class="account-order-line"><img src="' + escapeHtml(item.image) + '" alt=""><span><strong>' + escapeHtml(item.name) + '</strong><small>Size ' + escapeHtml(item.size) + ' · Qty ' + item.qty + '</small></span><b>' + money(item.lineTotal) + '</b></div>';
    }).join("");
    return '<article class="account-order"><header><div><span class="mono">' + escapeHtml(order.orderNumber) + '</span><h3>' + escapeHtml(orderDate(order.createdAt)) + '</h3></div><span class="order-badge">' + escapeHtml(order.status) + '</span></header>' + lines + '<footer><span>Dummy QR · ' + escapeHtml(order.paymentStatus) + '</span><strong>' + money(order.subtotal) + '</strong></footer></article>';
  }).join("");
}

function renderAccount() {
  if (customerLoading) {
    return '<main class="account-page"><div class="page account-loading"><span class="mono section-label">PRIVATE ARCHIVE</span><h1>Finding your thread…</h1></div></main>';
  }
  if (!customer) return renderAuth("login");
  const firstName = customer.name.trim().split(/\s+/)[0];
  return '<main class="account-page"><section class="page account-heading"><div><span class="mono section-label">PRIVATE ARCHIVE · ' + escapeHtml(orderDate(customer.createdAt)) + '</span><h1>Welcome back,<br>' + escapeHtml(firstName) + '.</h1><p>What you chose, when you chose it, and the chapters that travelled with you.</p></div><aside><span class="mono">ARCHIVE HOLDER</span><strong>' + escapeHtml(customer.name) + '</strong><a href="mailto:' + escapeHtml(customer.email) + '">' + escapeHtml(customer.email) + '</a><button class="text-button" type="button" data-customer-logout>Sign out</button></aside></section><section class="page account-ledger"><div class="account-ledger-head"><div><span class="mono section-label">YOUR ACQUISITIONS</span><h2>Objects with<br>a date attached.</h2></div><a class="button button-light" href="/artifacts">View all artifacts</a></div>' + customerOrderCards() + '</section></main>';
}

function renderAuth(mode) {
  if (customer) return renderAccount();
  const signup = mode === "signup";
  return '<main class="auth-page"><section class="auth-visual"><div><span class="mono section-label">A PRIVATE PLACE IN THE ARCHIVE</span><blockquote>“Keep a record of what carried you.”</blockquote><p>Your account connects each order to one quiet, personal ledger.</p></div></section><section class="auth-panel"><form class="auth-form" id="customer-auth" data-auth-mode="' + (signup ? 'signup' : 'login') + '"><span class="mono section-label">' + (signup ? 'OPEN YOUR ARCHIVE' : 'RETURN TO YOUR ARCHIVE') + '</span><h1>' + (signup ? 'Begin<br>quietly.' : 'Welcome<br>back.') + '</h1><p>' + (signup ? 'Create a private archive for your order history.' : 'Sign in to revisit your order history.') + '</p>' +
    (signup ? '<label><span>Your name</span><input name="name" autocomplete="name" minlength="2" maxlength="80" required></label>' : '') +
    '<label><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label><label><span>Password</span><input name="password" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" minlength="8" maxlength="128" required></label>' +
    (signup ? '<label><span>Confirm password</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>' : '') +
    '<div class="auth-message" role="status">' + escapeHtml(authMessage) + '</div><button class="button button-dark" type="submit">' + (signup ? 'Create private archive' : 'Sign in') + ' <span class="arrow">↗</span></button><p class="auth-switch">' + (signup ? 'Already have an archive? <a href="/login">Sign in</a>' : 'New here? <a href="/signup">Create your archive</a>') + '</p><small>Use sample details and a unique password. No real payment is collected.</small></form></section></main>';
}

function renderSeries(slug) {
  const series = getSeries(slug);
  if (!series) return renderNotFound();
  return '<main><section class="series-band"><div class="series-intro">' +
    '<div class="series-copy"><span class="mono section-label">' + escapeHtml(series.number) + ' · THE ARCHIVE</span><h1>' + escapeHtml(series.title) + '</h1><p class="subtitle">' + escapeHtml(series.subtitle) + '</p><p class="description">' + escapeHtml(series.description) + '</p><span class="hero-caption">' + series.chapters.length + ' chapters · One continuous thread</span></div>' +
    '<figure class="series-image"><img src="' + escapeHtml(series.image) + '" alt="' + escapeHtml(series.title) + ' series" fetchpriority="high"><figcaption class="mono">' + escapeHtml(series.title) + ' · 2026</figcaption></figure>' +
    '</div><div class="page chapter-list">' + chapterCards(series) + '</div></section>' +
    '<section class="page section"><div class="section-head"><div><span class="mono section-label">THE THREAD</span><h2>Keep what<br>helps.</h2></div><p>' + escapeHtml(series.description) + '</p></div><a class="button button-dark" href="/chapter/' + escapeHtml(series.chapters[0].slug) + '">Begin with ' + escapeHtml(series.chapters[0].number) + ' <span class="arrow">↗</span></a></section></main>';
}

function renderChapter(slug) {
  const chapter = getChapter(slug);
  if (!chapter) return renderNotFound();
  const series = getChapterSeries(chapter);
  const index = series.chapters.indexOf(chapter);
  const product = getProduct(chapter.productSlug);
  if (!product) return renderNotFound();
  const story = Array.isArray(chapter.story) ? chapter.story : [];
  const next = series.chapters[index + 1];
  const artifactLabel = product.chapterSlug === chapter.slug ? "ARTIFACT FROM THIS CHAPTER" : "EXPLORE A SERIES ARTIFACT";
  const storyBlock = story.length
    ? '<div class="story-copy">' + story.map(function (paragraph, i) { return '<p' + (i === 0 ? ' class="dropcap"' : "") + '>' + escapeHtml(paragraph) + '</p>'; }).join("") + '</div>'
    : '<div class="story-copy"><p>' + escapeHtml(chapter.excerpt) + '</p><p class="chapter-note">This chapter is part of the series preview. The complete story is being shaped for the archive.</p></div>';

  return '<main class="chapter-page">' +
    '<section class="chapter-hero"><div class="chapter-heading"><span class="mono section-label">CHAPTER CHAMBER · ' + escapeHtml(series.number) + ' · ' + escapeHtml(chapter.number) + '</span><h1 class="page-title">' + escapeHtml(chapter.title) + '</h1><p class="excerpt">' + escapeHtml(chapter.excerpt) + '</p><span class="mono">' + escapeHtml(series.title) + ' · ' + String(index + 1).padStart(2, "0") + ' / ' + String(series.chapters.length).padStart(2, "0") + '</span></div><div class="chapter-visual"><img src="' + escapeHtml(chapter.image) + '" alt="' + escapeHtml(chapter.title) + '" fetchpriority="high"></div></section>' +
    '<section class="page story-layout"><aside class="story-aside"><span class="mono section-label">A NOTE FROM THE ARCHIVE</span><p>' + escapeHtml(series.subtitle) + '</p><span class="mono">READ AT YOUR OWN PACE</span></aside>' + storyBlock + '</section>' +
    '<section class="chapter-product"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy"><div class="chapter-product-copy"><span class="mono section-label">' + artifactLabel + '</span><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.description) + '</p><a class="button button-dark" href="/product/' + escapeHtml(product.slug) + '">Meet the artifact <span class="arrow">↗</span></a></div></section>' +
    '<div class="page">' + (next ? '<a class="chapter-next" href="/chapter/' + escapeHtml(next.slug) + '"><span><span class="mono section-label">NEXT IN THE SERIES</span><strong>' + escapeHtml(next.title) + '</strong></span><span class="arrow">↗</span></a>' : '<a class="chapter-next" href="/series/' + escapeHtml(series.slug) + '"><span><span class="mono section-label">BACK TO THE SERIES</span><strong>' + escapeHtml(series.title) + '</strong></span><span class="arrow">↗</span></a>') + '</div>' +
  '</main>';
}

function renderProduct(slug) {
  const product = getProduct(slug);
  if (!product) return renderNotFound();
  const chapter = getChapter(product.chapterSlug);
  if (!chapter) return renderNotFound();
  const series = getChapterSeries(chapter);
  const selection = sizeSelection[product.slug] || "";
  const related = content.products.filter(function (item) { return item.slug !== product.slug; }).sort(function (a, b) {
    return Number(b.kind === product.kind) - Number(a.kind === product.kind);
  }).slice(0, 3);
  return '<main class="page product-page"><nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="/">Home</a><span>/</span><a href="/archive">Archive</a><span>/</span><a href="/series/' + escapeHtml(series.slug) + '">' + escapeHtml(series.number) + '</a><span>/</span><a href="/chapter/' + escapeHtml(chapter.slug) + '">' + escapeHtml(chapter.number) + '</a><span>/</span><span>Artifact</span></nav>' +
    '<div class="product-detail-layout"><div class="product-gallery"><figure class="gallery-frame"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + ' front view" fetchpriority="high"></figure>' +
    (product.secondaryImage ? '<figure class="gallery-frame"><img src="' + escapeHtml(product.secondaryImage) + '" alt="' + escapeHtml(product.name) + ' back or detail view" loading="lazy"></figure>' : "") + '</div>' +
    '<section class="product-info"><span class="mono section-label">' + escapeHtml(product.category) + ' · CONCEPT PIECE</span><h1 class="page-title">' + escapeHtml(product.name) + '</h1><div class="price">' + money(product.price) + '<small>Illustrative price · INR</small></div><p class="product-desc">' + escapeHtml(product.description) + '</p>' +
    '<div class="size-label"><span>Choose your size</span><button class="size-guide" type="button" data-size-guide="' + escapeHtml(product.slug) + '">Size guide</button></div><div class="size-options">' + product.sizes.map(function (size) { return '<button class="size-option' + (selection === size ? " selected" : "") + '" type="button" data-size="' + escapeHtml(size) + '" data-product="' + escapeHtml(product.slug) + '" aria-pressed="' + (selection === size) + '">' + escapeHtml(size) + '</button>'; }).join("") + '</div><div class="size-help" id="size-help" aria-live="polite"></div>' +
    '<button class="button button-dark" type="button" data-add="' + escapeHtml(product.slug) + '">Add to bag <span class="arrow">↗</span></button><p class="shipping-note">TEST ORDER · NON-PAYABLE QR · NO PAYMENT</p>' +
    '<div class="accordions"><details class="accordion" open><summary>About the piece</summary><p>' + escapeHtml(product.description) + '</p></details><details class="accordion"><summary>Details and care</summary><ul>' + product.details.map(function (detail) { return "<li>" + escapeHtml(detail) + "</li>"; }).join("") + '<li>Care information is sample copy for this prototype.</li></ul></details><details class="accordion"><summary>From the archive</summary><p>This piece accompanies <a href="/chapter/' + escapeHtml(product.chapterSlug) + '"><u>' + escapeHtml(getChapter(product.chapterSlug).title) + '</u></a>.</p></details></div>' +
    '</section></div><section class="related-products"><header><span class="mono section-label">KEEP EXPLORING</span><h2>Carry it together.</h2><a href="/artifacts">View all ' + content.products.length + ' artifacts <span class="arrow">↗</span></a></header><div class="related-grid">' + related.map(function (item, index) { return catalogCard(item, index); }).join("") + '</div></section></main>';
}

function checkoutSteps(active) {
  const steps = [["account", "Account"], ["details", "Details"], ["review", "Order review"], ["payment", "Dummy QR"], ["complete", "Confirmation"]];
  return '<ol class="acquisition-steps" aria-label="Checkout progress">' +
    steps.map(function (step, index) {
      const state = step[0] === active ? " active" :
        (steps.findIndex(function (item) { return item[0] === step[0]; }) < steps.findIndex(function (item) { return item[0] === active; }) ? " complete" : "");
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
    '<div class="checkout-total"><span>Order subtotal</span><strong>' + money(subtotal) + '</strong></div><p>Shipping and taxes are not included in these illustrative prices.</p></aside>';
}

function renderCheckoutReview() {
  return '<main class="checkout-page"><div class="page">' + checkoutSteps("review") +
    '<div class="checkout-heading"><span class="mono section-label">ACQUISITION · REVIEW</span><h1>Check the details.</h1><p>Review the delivery information and order total before continuing.</p></div>' +
    '<div class="checkout-layout"><section class="review-chamber"><div class="review-address"><span class="mono section-label">DELIVERY DETAILS</span><h2>' + customerValue("name") + '</h2><p>' + customerValue("email") + '<br>' + customerValue("phone") + '</p><address>' + customerValue("address") + '<br>' + customerValue("city") + ' · ' + customerValue("postalCode") + '</address><button class="button button-light" type="button" data-back-details>Edit delivery details</button></div>' +
    '<div class="checkout-message" role="status">' + escapeHtml(checkoutMessage) + '</div><button class="button button-dark" type="button" data-continue-payment>Continue to dummy QR <span class="arrow">↗</span></button></section>' + checkoutSummary(cart, cartTotal(), false) + '</div></div></main>';
}

function customerValue(name) {
  const accountValue = customer && (name === "name" || name === "email") ? customer[name] : "";
  return escapeHtml(checkoutCustomer[name] || accountValue || "");
}

function renderCheckoutAccount() {
  return '<main class="checkout-page"><div class="page">' + checkoutSteps("account") +
    '<div class="checkout-heading"><span class="mono section-label">CHECKOUT · ACCOUNT REQUIRED</span><h1>Keep your<br>place.</h1><p>Create an archive account or sign in to continue. You can browse and add items before signing in; every order must belong to an account.</p></div>' +
    '<div class="checkout-layout"><section class="checkout-account-gate"><span class="mono section-label">YOUR BAG IS SAVED</span><h2>Continue to checkout.</h2><p>Your selected artifacts will be waiting after you sign in.</p>' + (checkoutMessage ? '<p class="checkout-message" role="status">' + escapeHtml(checkoutMessage) + '</p>' : '') + '<div class="checkout-account-actions"><a class="button button-dark" href="/signup">Create account <span class="arrow">↗</span></a><a class="button button-light" href="/login">I already have an account</a></div><p class="checkout-account-note">Guest checkout is unavailable. Sign in or create an account to place an order.</p></section>' + checkoutSummary(cart, cartTotal(), false) + '</div></div></main>';
}

function renderCheckout() {
  if (checkoutOrder) {
    return '<main class="checkout-page"><div class="page">' + checkoutSteps("complete") +
      '<section class="confirmation-chamber"><span class="confirmation-mark" aria-hidden="true">✓</span><span class="mono section-label">TEST ORDER RECORDED</span><h1>Your artifact<br>has a place.</h1><p>An order record was saved to Neon and is visible in Studio. No payment was requested, verified, or transferred.</p>' +
      '<div class="confirmation-receipt"><span>Order reference</span><strong>' + escapeHtml(checkoutOrder.orderNumber) + '</strong><span>Status</span><strong>' + escapeHtml(checkoutOrder.status) + '</strong><span>Test subtotal</span><strong>' + money(checkoutOrder.subtotal) + '</strong></div>' +
      (customer ? '<div class="confirmation-actions"><a class="button button-dark" href="/account">View my private archive <span class="arrow">↗</span></a><a class="button button-light" href="/artifacts">Return to artifacts</a></div>' : '<a class="button button-dark" href="/archive">Return to the archive <span class="arrow">↗</span></a>') + '</section></div></main>';
  }

  if (!cart.length) {
    sessionStorage.removeItem(checkoutAuthPendingKey);
    return '<main class="checkout-page"><div class="page"><section class="checkout-empty"><span class="mono section-label">CHECKOUT</span><h1>Your bag is quiet.</h1><p>Choose an artifact before continuing to checkout.</p><a class="button button-dark" href="/artifacts">Shop artifacts <span class="arrow">↗</span></a></section></div></main>';
  }

  if (customerLoading) {
    return '<main class="checkout-page"><div class="page">' + checkoutSteps("account") + '<section class="checkout-account-gate checkout-account-loading"><span class="mono section-label">PRIVATE ARCHIVE</span><h1>Checking your archive…</h1><p>Your bag is saved while we confirm your sign-in.</p></section></div></main>';
  }

  if (!customer) {
    sessionStorage.setItem(checkoutAuthPendingKey, "true");
    return renderCheckoutAccount();
  }

  sessionStorage.removeItem(checkoutAuthPendingKey);
  const subtotal = cartTotal();
  if (checkoutStep === "review") return renderCheckoutReview();
  if (checkoutStep === "payment") {
    return '<main class="checkout-page"><div class="page">' + checkoutSteps("payment") +
      '<div class="checkout-heading"><span class="mono section-label">ACQUISITION · TEST QR</span><h1>A ritual of exchange.</h1><p>This QR cannot accept payment. Confirming records an order for Studio; no payment occurs.</p></div>' +
      '<div class="checkout-layout"><section class="payment-chamber"><div class="qr-frame"><img src="/assets/test-payment-qr.svg" alt="Test QR marked not payable"></div>' +
        '<div class="payment-copy"><span class="mono section-label">TEST QR · NOT PAYABLE</span><h2>No money moves here.</h2><p>This screen records a test order without connecting to UPI, a bank, or a payment provider.</p>' +
        '<dl class="delivery-note"><div><dt>For</dt><dd>' + customerValue("name") + '</dd></div><div><dt>Delivery</dt><dd>' + customerValue("city") + ' · ' + customerValue("postalCode") + '</dd></div></dl>' +
        '<label class="payment-ack"><input type="checkbox" data-payment-ack> <span>I understand no payment will be made. This only records a test order.</span></label><div class="checkout-message" role="status">' + escapeHtml(checkoutMessage) + '</div>' +
        '<div class="checkout-actions"><button class="button button-light" type="button" data-back-details>Back</button><button class="button button-dark" type="button" data-confirm-order>Confirm test order <span class="arrow">↗</span></button></div></div></section>' +
        checkoutSummary(cart, subtotal, false) + '</div></div></main>';
  }

  return '<main class="checkout-page"><div class="page">' + checkoutSteps("details") +
    '<div class="checkout-heading"><span class="mono section-label">ACQUISITION · DELIVERY DETAILS</span><h1>Where should<br>it find you?</h1><p>Use sample information; these details are stored with the test order in Neon.</p></div>' +
    '<div class="checkout-layout"><form class="checkout-form" id="checkout-details">' + (checkoutMessage ? '<p class="checkout-message" role="status">' + escapeHtml(checkoutMessage) + '</p>' : '') + '<div class="checkout-field-grid">' +
      '<label><span>Full name</span><input name="name" autocomplete="name" value="' + customerValue("name") + '" maxlength="160" required></label>' +
      '<label><span>Email</span><input name="email" type="email" autocomplete="email" value="' + customerValue("email") + '" maxlength="160" required></label>' +
      '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" value="' + customerValue("phone") + '" minlength="6" maxlength="24" required></label>' +
      '<label><span>City</span><input name="city" autocomplete="address-level2" value="' + customerValue("city") + '" maxlength="160" required></label>' +
      '<label class="wide"><span>Delivery address</span><textarea name="address" autocomplete="street-address" maxlength="500" required>' + customerValue("address") + '</textarea></label>' +
      '<label><span>Postal code</span><input name="postalCode" autocomplete="postal-code" value="' + customerValue("postalCode") + '" minlength="3" maxlength="14" required></label>' +
      '<label class="honeypot" aria-hidden="true"><span>Website</span><input name="website" tabindex="-1" autocomplete="off"></label>' +
    '</div><p class="privacy-note">Use sample details only. Do not enter real personal or delivery information.</p><button class="button button-dark" type="submit">Continue to test QR <span class="arrow">↗</span></button></form>' + checkoutSummary(cart, subtotal, false) + '</div></div></main>';
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
  return '<form class="admin-login" id="admin-login"><span class="mono section-label">CONTENT DESK · PRIVATE ACCESS</span><h2>Studio access</h2><p>Use your admin email, password, and Studio key to manage the archive, products, images, and test orders.</p>' +
    '<label class="admin-field"><span>Admin email</span><input type="email" name="email" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
    '<label class="admin-field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>' +
    '<label class="admin-field"><span>Studio key</span><input type="password" name="key" autocomplete="off" required></label>' +
    '<div class="admin-status" role="status">' + escapeHtml(adminMessage) + '</div><button class="button button-dark" type="submit">Open the studio <span class="arrow">↗</span></button></form>';
}

function adminSetup() {
  return '<form class="admin-login" id="admin-setup"><span class="mono section-label">CONTENT DESK · FIRST ACCESS</span><h2>Create the Studio account</h2><p>This one-time setup creates the owner account for the content desk. Keep the Studio key private; it is checked securely and is not stored with your account.</p>' +
    '<label class="admin-field"><span>Account email</span><input type="email" name="email" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required></label>' +
    '<label class="admin-field"><span>Account password</span><input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="128" required><small>Use at least 12 characters.</small></label>' +
    '<label class="admin-field"><span>Confirm password</span><input type="password" name="confirmPassword" autocomplete="new-password" minlength="12" maxlength="128" required></label>' +
    '<label class="admin-field"><span>Studio key</span><input type="password" name="key" autocomplete="off" maxlength="512" required></label>' +
    '<div class="admin-status" role="status">' + escapeHtml(adminMessage) + '</div><button class="button button-dark" type="submit">Create owner account <span class="arrow">↗</span></button></form>';
}

function renderAdminAccess() {
  if (adminToken && adminSessionChecked) return adminDashboard();
  let title = "Studio access";
  let message = "Checking the one-time setup status…";
  let retry = "";
  if (adminAccessError) {
    title = "Studio unavailable";
    message = adminAccessError;
    retry = '<button class="button button-dark" type="button" data-retry-admin-access>Try again <span class="arrow">↗</span></button>';
  } else if (adminToken) {
    title = "Checking your session";
    message = "Please wait while Studio verifies this browser session.";
  }
  if (adminToken || !adminAccessLoaded || adminAccessError) {
    return '<div class="admin-shell"><div class="page"><section class="admin-login admin-access-message"><span class="mono section-label">CONTENT DESK · PRIVATE ACCESS</span><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p>' + retry + '</section></div></div>';
  }
  return '<div class="admin-shell"><div class="page">' + (adminSetupConfigured ? adminLogin() : adminSetup()) + '</div></div>';
}

async function loadAdminAccess() {
  if (adminAccessLoading || adminAccessLoaded) return;
  adminAccessLoading = true;
  adminAccessError = "";
  try {
    const response = await fetch("/api/admin/setup-status");
    if (!response.ok) throw new Error("Could not check Studio setup.");
    const status = await response.json();
    adminSetupConfigured = Boolean(status.configured);
    if (adminToken) {
      const sessionResponse = await fetch("/api/admin/session", { headers: { Authorization: "Bearer " + adminToken } });
      if (sessionResponse.ok) {
        adminSessionChecked = true;
      } else {
        adminToken = "";
        sessionStorage.removeItem("qbAdminToken");
        adminSessionChecked = true;
        adminMessage = "Your Studio session expired. Sign in again.";
      }
    } else {
      adminSessionChecked = true;
    }
  } catch {
    adminAccessError = "Studio setup could not be checked. Try again when the connection is available.";
  } finally {
    adminAccessLoading = false;
    adminAccessLoaded = true;
    if (content && currentRoute()[0] === "admin") render();
  }
}

function orderDate(value) {
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch { return String(value || ""); }
}

function adminOrderCards() {
  if (adminOrdersLoading) return '<div class="admin-card admin-empty"><h2>Opening the order ledger…</h2></div>';
  if (!adminOrdersLoaded) return '<div class="admin-card admin-empty"><h2>Order ledger</h2><p>Orders will appear here after the Studio connects to Neon.</p></div>';
  if (!adminOrders.length) return '<div class="admin-card admin-empty"><span class="mono section-label">ORDER LEDGER · 0</span><h2>No acquisitions yet.</h2><p>Complete the non-payable test checkout to create an order record.</p></div>';
  return adminOrders.map(function (order) {
    const customer = order.customer || {};
    const lines = (order.items || []).map(function (item) {
      return '<div class="admin-order-line"><img src="' + escapeHtml(item.image) + '" alt=""><span><strong>' + escapeHtml(item.name) + '</strong><small>Size ' + escapeHtml(item.size) + ' · Qty ' + item.qty + '</small></span><b>' + money(item.lineTotal) + '</b></div>';
    }).join("");
    const statusOptions = orderStatuses.map(function (status) {
      return '<option value="' + status + '"' + (status === order.status ? " selected" : "") + '>' + status + '</option>';
    }).join("");
    return '<article class="admin-card admin-order"><div class="admin-order-head"><div><span class="mono section-label">' + escapeHtml(order.orderNumber) + '</span><h2>' + escapeHtml(customer.name) + '</h2><p>' + escapeHtml(orderDate(order.createdAt)) + '</p></div><span class="order-badge">' + escapeHtml(order.status) + '</span></div>' +
      '<div class="admin-order-grid"><section><h3>Artifact</h3>' + lines + '<div class="admin-order-total"><span>Test subtotal</span><strong>' + money(order.subtotal) + '</strong></div></section>' +
      '<section class="admin-customer"><h3>Customer & delivery</h3><p><strong>' + escapeHtml(customer.email) + '</strong><br>' + escapeHtml(customer.phone) + '</p><p>' + escapeHtml(customer.address) + '<br>' + escapeHtml(customer.city) + ' · ' + escapeHtml(customer.postalCode) + '</p><span class="mono">PAYMENT · ' + escapeHtml(order.paymentStatus) + '</span></section></div>' +
      '<div class="admin-order-actions"><label><span>Order status</span><select data-order-status="' + escapeHtml(order.id) + '">' + statusOptions + '</select></label><button class="button button-dark" type="button" data-update-order="' + escapeHtml(order.id) + '">Save status</button><button class="remove-button" type="button" data-delete-order="' + escapeHtml(order.id) + '">Delete order</button></div></article>';
  }).join("");
}

function adminCustomerCards() {
  if (adminCustomersLoading) return '<div class="admin-card admin-empty"><h2>Opening the customer archive…</h2></div>';
  if (!adminCustomersLoaded) return '<div class="admin-card admin-empty"><h2>Customer archive</h2><p>Customer accounts will appear here after Studio connects to Neon.</p></div>';
  if (!adminCustomers.length) return '<div class="admin-card admin-empty"><span class="mono section-label">CUSTOMER ARCHIVE · 0</span><h2>No private archives yet.</h2><p>Create an account from the storefront to review account records.</p></div>';
  return '<div class="admin-customer-list">' + adminCustomers.map(function (item) {
    return '<article class="admin-card admin-customer-record"><div><span class="mono section-label">ARCHIVE HOLDER · ' + escapeHtml(orderDate(item.createdAt)) + '</span><h2>' + escapeHtml(item.name) + '</h2><a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a></div><div class="customer-record-meta"><strong>' + Number(item.orderCount || 0) + '</strong><span>linked order' + (Number(item.orderCount || 0) === 1 ? '' : 's') + '</span></div><button class="remove-button" type="button" data-delete-customer="' + escapeHtml(item.id) + '">Delete account</button></article>';
  }).join("") + '</div>';
}

function adminDashboard() {
  const draft = adminDraft || content;
  const seriesForms = draft.seriesList.map(function (series, seriesIndex) {
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
      field("Chapter image", fieldPath + ".image", chapter.image, { upload: true, hint: "Use an images.unsplash.com URL or upload a PNG, JPG, or WebP image (up to 2 MB)." }) +
      field("Story paragraphs", fieldPath + ".story", chapter.story || [], { textarea: true, kind: "paragraphs", hint: "Separate paragraphs with a blank line." }) +
      '</article>';
    }).join("");
    const seriesPath = "seriesList." + seriesIndex;
    return '<section class="admin-card"><div class="admin-row-title"><h2>' + escapeHtml(series.number) + ' · ' + escapeHtml(series.title) + '</h2><button class="remove-button" type="button" data-remove-series="' + seriesIndex + '">Remove series</button></div><div class="admin-grid">' +
      field("Series number", seriesPath + ".number", series.number) +
      field("Series title", seriesPath + ".title", series.title) +
      field("URL slug", seriesPath + ".slug", series.slug) +
      field("Subtitle", seriesPath + ".subtitle", series.subtitle) +
      field("Series image", seriesPath + ".image", series.image, { upload: true, hint: "Use an images.unsplash.com URL or upload a PNG, JPG, or WebP image (up to 2 MB)." }) +
      '</div>' + field("Series description", seriesPath + ".description", series.description, { textarea: true }) +
      '<div class="admin-row-title"><h3>Chapters · ' + series.chapters.length + '</h3><button class="button button-light" type="button" data-add-chapter="' + seriesIndex + '">Add chapter</button></div>' + chapterForms + '</section>';
  }).join("");

  const productForms = draft.products.map(function (product, index) {
    return '<article class="admin-product"><div class="admin-row-title"><h3>Product ' + String(index + 1).padStart(2, "0") + '</h3><button class="remove-button" type="button" data-remove-product="' + index + '">Remove product</button></div>' +
      '<div class="admin-grid">' +
        field("Product name", "products." + index + ".name", product.name) +
        field("Product type", "products." + index + ".kind", product.kind) +
        field("URL slug", "products." + index + ".slug", product.slug) +
        field("Category line", "products." + index + ".category", product.category) +
        field("Price in INR", "products." + index + ".price", product.price, { type: "number" }) +
        field("Sizes", "products." + index + ".sizes", product.sizes, { kind: "list", hint: "Separate sizes with commas." }) +
        field("Linked chapter slug", "products." + index + ".chapterSlug", product.chapterSlug) +
      '</div>' +
      field("Description", "products." + index + ".description", product.description, { textarea: true }) +
      field("Product image", "products." + index + ".image", product.image, { upload: true, hint: "Use an images.unsplash.com URL or upload a PNG, JPG, or WebP image (up to 2 MB)." }) +
      field("Back or detail image", "products." + index + ".secondaryImage", product.secondaryImage || "", { upload: true, hint: "Optional second product view. Use an images.unsplash.com URL or upload an image (up to 2 MB)." }) +
      field("Details and care points", "products." + index + ".details", product.details, { textarea: true, kind: "lines", hint: "One detail per line." }) +
    '</article>';
  }).join("");

  function activeClass(name) { return adminActiveTab === name ? " active" : ""; }
  function selected(name) { return adminActiveTab === name ? "true" : "false"; }
  const savebar = ["orders", "customers"].includes(adminActiveTab) ? "" :
    '<div class="admin-savebar"><span>Remember to save your changes before leaving this page.</span><div class="admin-actions"><span class="admin-status" id="admin-status" role="status">' + escapeHtml(adminMessage) + '</span><button class="button" type="submit">Save changes <span class="arrow">↗</span></button></div></div>';

  return '<div class="admin-shell"><div class="page">' +
    '<div class="admin-top"><div><span class="mono section-label">QUIET BATTLES · CONTENT & ORDER DESK</span><h1>Studio</h1></div><div><p>Content, media, customer accounts, and test orders are saved to Neon Postgres.</p><button class="button button-light" type="button" data-logout>Sign out</button></div></div>' +
    '<div class="admin-tabs" role="group" aria-label="Studio sections"><button class="admin-tab' + activeClass("brand") + '" type="button" data-tab="brand" aria-pressed="' + selected("brand") + '">Brand & home</button><button class="admin-tab' + activeClass("series") + '" type="button" data-tab="series" aria-pressed="' + selected("series") + '">Series & chapters</button><button class="admin-tab' + activeClass("products") + '" type="button" data-tab="products" aria-pressed="' + selected("products") + '">Products</button><button class="admin-tab' + activeClass("orders") + '" type="button" data-tab="orders" aria-pressed="' + selected("orders") + '">Orders <span>(' + adminOrders.length + ')</span></button><button class="admin-tab' + activeClass("customers") + '" type="button" data-tab="customers" aria-pressed="' + selected("customers") + '">Customers <span>(' + adminCustomers.length + ')</span></button></div>' +
    '<form id="admin-form">' +
      '<section class="admin-panel' + activeClass("brand") + '" data-panel="brand"><div class="admin-card"><h2>Brand introduction</h2><div class="admin-grid">' +
        field("Brand name", "brand.name", draft.brand.name) +
        field("Tagline", "brand.tagline", draft.brand.tagline) +
      '</div>' + field("Brand introduction", "brand.intro", draft.brand.intro, { textarea: true }) +
      '<div class="admin-card"><h2>Homepage hero</h2><div class="admin-grid">' +
        field("Eyebrow", "hero.eyebrow", draft.hero.eyebrow) +
        field("Headline (type <br> for a line break)", "hero.title", draft.hero.title) +
      '</div>' + field("Supporting copy", "hero.description", draft.hero.description, { textarea: true }) +
      field("Hero image", "hero.image", draft.hero.image, { upload: true, hint: "Use an images.unsplash.com URL or upload a PNG, JPG, or WebP image (up to 2 MB)." }) +
      '</div><div class="admin-card"><h2>Our note</h2><div class="admin-grid">' + field("Section label", "introduction.eyebrow", draft.introduction.eyebrow) + field("Heading", "introduction.title", draft.introduction.title) + '</div>' + field("Copy", "introduction.copy", draft.introduction.copy, { textarea: true }) + '</div></section>' +
      '<section class="admin-panel' + activeClass("series") + '" data-panel="series"><div class="admin-row-title"><h2>Archive Series · ' + draft.seriesList.length + '</h2><button class="button button-dark" type="button" data-add-series>Add series</button></div>' + seriesForms + '</section>' +
      '<section class="admin-panel' + activeClass("products") + '" data-panel="products"><div class="admin-card"><div class="admin-row-title"><h2>Product catalogue · ' + draft.products.length + '</h2><button class="button button-light" type="button" data-add-product>Add product</button></div>' + productForms + '</div></section>' +
      '<section class="admin-panel' + activeClass("orders") + '" data-panel="orders"><div class="admin-row-title"><div><span class="mono section-label">NEON ORDER RECORDS</span><h2>Order ledger · ' + adminOrders.length + '</h2></div><button class="button button-light" type="button" data-refresh-orders>Refresh orders</button></div><div class="admin-status order-admin-status" role="status">' + escapeHtml(adminMessage) + '</div>' + adminOrderCards() + '</section>' +
      '<section class="admin-panel' + activeClass("customers") + '" data-panel="customers"><div class="admin-row-title"><div><span class="mono section-label">NEON CUSTOMER RECORDS</span><h2>Private archives · ' + adminCustomers.length + '</h2></div><button class="button button-light" type="button" data-refresh-customers>Refresh customers</button></div><div class="admin-status customer-admin-status" role="status">' + escapeHtml(adminMessage) + '</div>' + adminCustomerCards() + '</section>' + savebar +
    '</form></div></div>';
}

function renderCart() {
  if (!cartOpen) return "";
  const lines = cart.map(function (item, index) {
    return '<article class="cart-line"><img src="' + escapeHtml(item.image) + '" alt=""><div><h3>' + escapeHtml(item.name) + '</h3><p>SIZE ' + escapeHtml(item.size) + '</p><div class="qty-controls"><button type="button" aria-label="Decrease quantity" data-cart-dec="' + index + '">−</button><span>' + item.qty + '</span><button type="button" aria-label="Increase quantity" data-cart-inc="' + index + '">+</button></div></div><span class="cart-price">' + money(item.price * item.qty) + '</span></article>';
  }).join("");
  const total = cartTotal();
  return '<button class="cart-backdrop" type="button" aria-label="Close bag" data-cart-close></button><aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="cart-head"><h2 id="cart-title">Your bag <span class="mono">(' + cartQuantity() + ')</span></h2><button class="icon-button" type="button" data-cart-close aria-label="Close bag">×</button></div>' +
    '<div class="cart-items">' + (lines || '<div class="cart-empty">Nothing in your bag yet.<br>Find a piece that feels like you.<a href="/artifacts">Shop artifacts ↗</a></div>') + '</div>' +
    (cart.length ? '<div class="cart-summary"><div class="cart-total"><span>Order subtotal</span><strong>' + money(total) + '</strong></div><button type="button" class="button button-dark" data-checkout>Continue to checkout <span class="arrow">↗</span></button><small>Sign in or create an account to place an order.</small></div>' : "") +
  '</aside>';
}

function renderNotice() {
  return noticeTimer ? '<div class="notice" role="status" id="notice">' + escapeHtml(noticeMessage) + '</div>' : "";
}

function showNotice(message) {
  noticeMessage = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(function () {
    noticeTimer = null;
    noticeMessage = "";
    const el = document.getElementById("notice");
    if (el) el.remove();
  }, 2800);
  let el = document.getElementById("notice");
  if (!el) {
    el = document.createElement("div");
    el.className = "notice";
    el.id = "notice";
    el.setAttribute("role", "status");
    root.appendChild(el);
  }
  el.textContent = message;
}

function focusCart(selector) {
  if (!cartOpen) return;
  const dialog = document.querySelector(".cart-drawer");
  const target = dialog && (selector ? dialog.querySelector(selector) : dialog.querySelector("[data-cart-close]"));
  if (target) target.focus();
}

function closeCart() {
  cartOpen = false;
  render();
  if (cartReturnFocus) {
    const opener = document.querySelector("[data-cart-open]");
    if (opener) opener.focus();
  }
  cartReturnFocus = false;
}

function render() {
  if (!content) {
    root.innerHTML = '<main class="page" style="padding:80px 0">Opening the archive…</main>';
    return;
  }
  const existingCheckoutForm = document.getElementById("checkout-details");
  const checkoutValues = existingCheckoutForm ? Object.fromEntries(new FormData(existingCheckoutForm)) : null;
  const route = currentRoute();
  if (route[0] === "admin" && !adminAccessLoaded) loadAdminAccess();
  let main;
  if (route[0] === "archive") main = renderArchive();
  else if (route[0] === "artifacts") main = renderArtifacts();
  else if (route[0] === "series") main = renderSeries(route[1] || content.seriesList[0].slug);
  else if (route[0] === "chapter") main = renderChapter(route[1]);
  else if (route[0] === "product") main = renderProduct(route[1]);
  else if (route[0] === "checkout") main = renderCheckout();
  else if (route[0] === "login") main = renderAuth("login");
  else if (route[0] === "signup") main = renderAuth("signup");
  else if (route[0] === "account") main = renderAccount();
  else if (route[0] === "admin") main = '<main>' + renderAdminAccess() + '</main>';
  else if (["", "home", "belief"].includes(route[0])) main = renderHome();
  else main = renderNotFound();
  root.innerHTML = renderHeader() + main + renderFooter() + renderCart() + renderNotice();
  if (checkoutValues) {
    const nextCheckoutForm = document.getElementById("checkout-details");
    if (nextCheckoutForm) Object.keys(checkoutValues).forEach(function (name) {
      const input = nextCheckoutForm.elements.namedItem(name);
      if (input) input.value = checkoutValues[name];
    });
  }
  document.querySelectorAll(".site-header, main, .site-footer").forEach(function (element) { element.inert = cartOpen; });
  const pageTitle = route[0] === "admin" ? "Studio" :
    route[0] === "checkout" ? "Acquisition" :
    route[0] === "artifacts" ? "Artifacts" :
    route[0] === "login" ? "Sign In" :
    route[0] === "signup" ? "Create Your Archive" :
    route[0] === "account" ? "My Private Archive" :
    route[0] === "archive" ? "The Archive" :
    route[0] === "series" ? ((getSeries(route[1]) || {}).title || "Not Found") :
    route[0] === "chapter" ? ((getChapter(route[1]) || {}).title || "Not Found") :
    route[0] === "product" ? ((getProduct(route[1]) || {}).name || "Not Found") :
    ["", "home", "belief"].includes(route[0]) ? "Wear Your Battles" : "Page Not Found";
  document.title = pageTitle + " · QUIET BATTLES™";
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.content = route[0] === "chapter" ? ((getChapter(route[1]) || {}).excerpt || "") :
      route[0] === "product" ? ((getProduct(route[1]) || {}).description || "") :
      route[0] === "series" ? ((getSeries(route[1]) || {}).description || "") :
      "QUIET BATTLES makes considered everyday clothing for the stories we carry quietly. Wear your battles.";
  }
  bindEvents();
  if (cartOpen) focusCart();
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
    button.addEventListener("click", function () { cartReturnFocus = true; cartOpen = true; render(); focusCart(); });
  });
  document.querySelectorAll("[data-cart-close]").forEach(function (button) {
    button.addEventListener("click", closeCart);
  });
  document.querySelectorAll("[data-cart-inc]").forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.cartInc);
      if (cart[index].qty >= 10) {
        showNotice("Maximum quantity per size is 10.");
        return;
      }
      cart[index].qty += 1;
      saveCart();
      render();
      focusCart('[data-cart-inc="' + index + '"]');
    });
  });
  document.querySelectorAll("[data-cart-dec]").forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.cartDec);
      cart[index].qty -= 1;
      if (cart[index].qty <= 0) cart.splice(index, 1);
      saveCart();
      render();
      focusCart(cart[index] ? '[data-cart-dec="' + index + '"]' : "[data-cart-close]");
    });
  });
  document.querySelectorAll("[data-catalog-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      catalogFilter = button.dataset.catalogFilter;
      quickAddSlug = "";
      render();
    });
  });
  const scrollCatalogue = document.querySelector("[data-scroll-catalogue]");
  if (scrollCatalogue) scrollCatalogue.addEventListener("click", function () {
    const catalogue = document.getElementById("catalogue");
    if (catalogue) catalogue.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const catalogSortSelect = document.querySelector("[data-catalog-sort]");
  if (catalogSortSelect) catalogSortSelect.addEventListener("change", function () {
    catalogSort = catalogSortSelect.value;
    quickAddSlug = "";
    render();
  });
  document.querySelectorAll("[data-quick-open]").forEach(function (button) {
    button.addEventListener("click", function () {
      quickAddSlug = quickAddSlug === button.dataset.quickOpen ? "" : button.dataset.quickOpen;
      render();
    });
  });
  document.querySelectorAll("[data-quick-size]").forEach(function (button) {
    button.addEventListener("click", function () {
      const product = getProduct(button.dataset.quickProduct);
      if (!product || !addProductToCart(product, button.dataset.quickSize)) return;
      quickAddSlug = "";
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
      if (addProductToCart(product, size)) render();
    });
  });
  const sizeGuide = document.querySelector("[data-size-guide]");
  if (sizeGuide) sizeGuide.addEventListener("click", function () {
    const product = getProduct(sizeGuide.dataset.sizeGuide);
    if (!product) return;
    const sizes = product.sizes.join(" · ");
    const fitNote = product.sizes.length === 1 && product.sizes[0] === "ONE SIZE"
      ? "One size. See the product details for fit and adjustment information."
      : "Available sizes: " + sizes + ". Garment measurements are pending approved product specifications.";
    showNotice(fitNote);
  });
  const checkout = document.querySelector("[data-checkout]");
  if (checkout) checkout.addEventListener("click", function () {
    cartOpen = false;
    checkoutMessage = "";
    if (location.pathname === "/checkout") render();
    else navigateTo("/checkout");
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
    checkoutStep = "review";
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
  const continuePayment = document.querySelector("[data-continue-payment]");
  if (continuePayment) continuePayment.addEventListener("click", function () {
    checkoutStep = "payment";
    checkoutMessage = "";
    render();
    window.scrollTo(0, 0);
  });
  const confirmOrder = document.querySelector("[data-confirm-order]");
  if (confirmOrder) confirmOrder.addEventListener("click", async function () {
    const acknowledgement = document.querySelector("[data-payment-ack]");
    if (!acknowledgement || !acknowledgement.checked) {
      checkoutMessage = "Confirm that no payment will be made to record this test order.";
      const message = document.querySelector(".checkout-message");
      if (message) message.textContent = checkoutMessage;
      return;
    }
    confirmOrder.disabled = true;
    confirmOrder.textContent = "Recording order…";
    checkoutMessage = "";
    try {
      const orderHeaders = { "Content-Type": "application/json" };
      if (customerToken) orderHeaders.Authorization = "Bearer " + customerToken;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: orderHeaders,
        body: JSON.stringify({
          customer: checkoutCustomer,
          items: cart.map(function (item) { return { slug: item.slug, size: item.size, qty: item.qty }; }),
          expectedSubtotal: cartTotal(),
          noPaymentAcknowledged: true
        })
      });
      const result = await response.json();
      if (!response.ok && response.status === 409) {
        const latest = await fetch("/api/content");
        if (latest.ok) {
          const latestContent = await latest.json();
          const sync = syncCartWithContent(latestContent);
          content = latestContent;
          checkoutStep = "review";
          checkoutMessage = sync.removed
            ? "A product or selected size changed. Review the updated bag before continuing."
            : "Prices changed. Review the updated total before continuing.";
          render();
          window.scrollTo(0, 0);
          return;
        }
      }
      if (!response.ok && response.status === 401) {
        customerToken = "";
        customer = null;
        customerOrders = [];
        customerLoading = false;
        sessionStorage.removeItem("qbCustomerToken");
        clearCheckoutState();
        checkoutMessage = "Your session expired. Sign in again to continue checkout.";
        sessionStorage.setItem(checkoutAuthPendingKey, "true");
        navigateTo("/login");
        return;
      }
      if (!response.ok) throw new Error(result.error || "The test order could not be recorded.");
      checkoutOrder = result.order;
      if (customer) customerOrders = [result.order].concat(customerOrders.filter(function (order) { return order.id !== result.order.id; }));
      checkoutStep = "complete";
      cart = [];
      saveCart();
      render();
      window.scrollTo(0, 0);
    } catch (error) {
      checkoutMessage = error.message;
      confirmOrder.disabled = false;
      confirmOrder.innerHTML = 'Confirm test order <span class="arrow">↗</span>';
      const message = document.querySelector(".checkout-message");
      if (message) message.textContent = checkoutMessage;
    }
  });

  const customerAuth = document.getElementById("customer-auth");
  if (customerAuth) customerAuth.addEventListener("submit", async function (event) {
    event.preventDefault();
    const mode = customerAuth.dataset.authMode;
    const values = Object.fromEntries(new FormData(customerAuth));
    authSubmittedValues = { name: values.name || "", email: values.email || "" };
    if (mode === "signup" && values.password !== values.confirmPassword) {
      authMessage = "The two passwords do not match.";
      const message = customerAuth.querySelector(".auth-message");
      if (message) message.textContent = authMessage;
      return;
    }
    const button = customerAuth.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = mode === "signup" ? "Opening your archive…" : "Finding your archive…";
    authMessage = "";
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, email: values.email, password: values.password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your private archive could not be opened.");
      customerToken = result.token;
      customer = result.customer;
      customerOrders = result.orders || [];
      customerLoading = false;
      sessionStorage.setItem("qbCustomerToken", customerToken);
      const returnToCheckout = sessionStorage.getItem(checkoutAuthPendingKey) === "true";
      const checkoutNotice = checkoutMessage;
      clearCheckoutState();
      authMessage = "";
      authSubmittedValues = null;
      if (returnToCheckout) {
        sessionStorage.setItem(checkoutAuthPendingKey, "true");
        checkoutMessage = checkoutNotice;
      }
      navigateTo(returnToCheckout ? "/checkout" : "/account");
    } catch (error) {
      authMessage = error.message;
      render();
      const restoredForm = document.getElementById("customer-auth");
      if (restoredForm && authSubmittedValues) {
        if (restoredForm.elements.namedItem("name")) restoredForm.elements.namedItem("name").value = authSubmittedValues.name;
        if (restoredForm.elements.namedItem("email")) restoredForm.elements.namedItem("email").value = authSubmittedValues.email;
      }
    }
  });

  const customerLogout = document.querySelector("[data-customer-logout]");
  if (customerLogout) customerLogout.addEventListener("click", async function () {
    customerLogout.disabled = true;
    if (customerToken) await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + customerToken } }).catch(function () {});
    customerToken = "";
    customer = null;
    customerOrders = [];
    customerLoading = false;
    sessionStorage.removeItem("qbCustomerToken");
    clearCheckoutState();
    authMessage = "You have signed out of your private archive.";
    navigateTo("/login");
  });

  const retryAdminAccess = document.querySelector("[data-retry-admin-access]");
  if (retryAdminAccess) retryAdminAccess.addEventListener("click", function () {
    adminAccessLoaded = false;
    adminSetupConfigured = null;
    adminAccessError = "";
    render();
  });

  const setup = document.getElementById("admin-setup");
  if (setup) setup.addEventListener("submit", async function (event) {
    event.preventDefault();
    adminMessage = "";
    const values = new FormData(setup);
    const email = values.get("email");
    const password = values.get("password");
    const confirmPassword = values.get("confirmPassword");
    const key = values.get("key");
    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password, confirmPassword: confirmPassword, key: key })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create the Studio account.");
      adminSetupConfigured = true;
      adminToken = result.token;
      adminSessionChecked = true;
      sessionStorage.setItem("qbAdminToken", adminToken);
      adminDraft = cloneContent(content);
      adminOrders = [];
      adminOrdersLoaded = false;
      adminCustomers = [];
      adminCustomersLoaded = false;
      adminActiveTab = "brand";
      adminMessage = "Studio account created.";
      render();
    } catch (error) {
      adminMessage = error.message;
      const status = setup.querySelector(".admin-status");
      if (status) status.textContent = adminMessage;
      setup.elements.namedItem("password").value = "";
      setup.elements.namedItem("confirmPassword").value = "";
      setup.elements.namedItem("key").value = "";
    }
  });

  const login = document.getElementById("admin-login");
  if (login) login.addEventListener("submit", async function (event) {
    event.preventDefault();
    adminMessage = "";
    const credentials = new FormData(login);
    const email = credentials.get("email");
    const password = credentials.get("password");
    const key = credentials.get("key");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email, password: password, key: key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      adminToken = result.token;
      adminSessionChecked = true;
      sessionStorage.setItem("qbAdminToken", adminToken);
      adminDraft = cloneContent(content);
      adminOrders = [];
      adminOrdersLoaded = false;
      adminCustomers = [];
      adminCustomersLoaded = false;
      adminActiveTab = "brand";
      adminMessage = "Studio opened.";
      render();
    } catch (error) {
      adminMessage = error.message;
      login.querySelector(".admin-status").textContent = adminMessage;
      login.elements.namedItem("password").value = "";
      login.elements.namedItem("key").value = "";
    }
  });

  const logout = document.querySelector("[data-logout]");
  if (logout) logout.addEventListener("click", async function () {
    await fetch("/api/admin/logout", { method: "POST", headers: { Authorization: "Bearer " + adminToken } }).catch(function () {});
    adminToken = "";
    adminSessionChecked = true;
    sessionStorage.removeItem("qbAdminToken");
    adminDraft = null;
    adminOrders = [];
    adminOrdersLoaded = false;
    adminCustomers = [];
    adminCustomersLoaded = false;
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
        item.setAttribute("aria-pressed", String(active));
      });
      document.querySelectorAll("[data-panel]").forEach(function (panel) {
        panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab);
      });
      const savebar = document.querySelector(".admin-savebar");
      if (savebar) savebar.classList.toggle("hide", ["orders", "customers"].includes(adminActiveTab));
      if (adminActiveTab === "orders" && !adminOrdersLoaded && !adminOrdersLoading) loadAdminOrders();
      if (adminActiveTab === "customers" && !adminCustomersLoaded && !adminCustomersLoading) loadAdminCustomers();
    });
  });

  const refreshOrders = document.querySelector("[data-refresh-orders]");
  if (refreshOrders) refreshOrders.addEventListener("click", function () {
    adminOrdersLoaded = false;
    loadAdminOrders();
  });
  const refreshCustomers = document.querySelector("[data-refresh-customers]");
  if (refreshCustomers) refreshCustomers.addEventListener("click", function () {
    adminCustomersLoaded = false;
    loadAdminCustomers();
  });
  document.querySelectorAll("[data-update-order]").forEach(function (button) {
    button.addEventListener("click", function () {
      const select = document.querySelector('[data-order-status="' + CSS.escape(button.dataset.updateOrder) + '"]');
      updateAdminOrder(button.dataset.updateOrder, select.value, button);
    });
  });
  document.querySelectorAll("[data-delete-order]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (window.confirm("Delete this order from Neon?")) deleteAdminOrder(button.dataset.deleteOrder, button);
    });
  });
  document.querySelectorAll("[data-delete-customer]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (window.confirm("Delete this customer account? Linked orders will remain in the order ledger.")) deleteAdminCustomer(button.dataset.deleteCustomer, button);
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
    const index = adminDraft.seriesList.length + 1;
    const first = adminDraft.seriesList[0];
    const slug = "new-series-" + Date.now();
    adminDraft.seriesList.push({
      slug: slug, number: "SERIES " + String(index).padStart(2, "0"), title: "Untitled series",
      subtitle: "A new story in the archive.", description: "Edit this series introduction in Studio.", image: first.image,
      chapters: [{ number: "CHAPTER 01", slug: slug + "-first-chapter", title: "Untitled chapter",
        excerpt: "Edit this chapter introduction in Studio.", image: first.image,
        productSlug: adminDraft.products[0].slug, story: [] }]
    });
    adminMessage = "New Series added to the draft. Edit its details and save changes.";
    render();
    document.querySelector('[data-tab="series"]').click();
  });
  document.querySelectorAll("[data-remove-series]").forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.removeSeries);
      const series = adminDraft.seriesList[index];
      if (adminDraft.seriesList.length <= 1) adminMessage = "Keep at least one Series in the archive.";
      else if (adminDraft.products.some(function (product) { return series.chapters.some(function (chapter) { return chapter.slug === product.chapterSlug; }); })) {
        adminMessage = "Move or remove products linked to this Series before removing it.";
      } else {
        adminDraft.seriesList.splice(index, 1);
        adminMessage = "Series removed from the draft. Save changes to keep it.";
      }
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-add-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      const series = adminDraft.seriesList[Number(button.dataset.addChapter)];
      const number = "CHAPTER " + String(series.chapters.length + 1).padStart(2, "0");
      series.chapters.push({ number: number, slug: "new-chapter-" + Date.now(), title: "Untitled chapter", excerpt: "", image: series.image, productSlug: adminDraft.products[0].slug, story: [] });
      render();
      document.querySelector('[data-tab="series"]').click();
    });
  });
  document.querySelectorAll("[data-remove-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      const indices = button.dataset.removeChapter.split(":").map(Number);
      const series = adminDraft.seriesList[indices[0]];
      const chapter = series.chapters[indices[1]];
      if (series.chapters.length <= 1) {
        adminMessage = "Keep at least one chapter in the series.";
      } else if (adminDraft.products.some(function (product) { return product.chapterSlug === chapter.slug; })) {
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
      adminDraft.products.push({ slug: "new-piece-" + Date.now(), name: "New field piece", kind: "Layers", category: adminDraft.seriesList[0].number, description: "", price: 0, image: "/assets/soft-armor.svg", secondaryImage: "", sizes: ["XS", "S", "M", "L", "XL"], details: [], chapterSlug: adminDraft.seriesList[0].chapters[0].slug });
      render();
      document.querySelector('[data-tab="products"]').click();
    });
  });
  document.querySelectorAll("[data-remove-product]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (adminDraft.products.length <= 1) {
        adminMessage = "Keep at least one product in the catalogue.";
        render();
        document.querySelector('[data-tab="products"]').click();
        return;
      }
      const product = adminDraft.products[Number(button.dataset.removeProduct)];
      if (adminDraft.seriesList.some(function (series) { return series.chapters.some(function (chapter) { return chapter.productSlug === product.slug; }); })) {
        adminMessage = "Link chapters to another product before removing this one.";
      } else {
        adminDraft.products.splice(Number(button.dataset.removeProduct), 1);
        adminMessage = "Product removed from the draft. Save changes to keep it.";
      }
      render();
      document.querySelector('[data-tab="products"]').click();
    });
  });
  const adminForm = document.getElementById("admin-form");
  if (adminForm) adminForm.addEventListener("submit", saveAdminContent);
  if (currentRoute()[0] === "admin" && adminToken && adminActiveTab === "orders" && !adminOrdersLoaded && !adminOrdersLoading) loadAdminOrders();
  if (currentRoute()[0] === "admin" && adminToken && adminActiveTab === "customers" && !adminCustomersLoaded && !adminCustomersLoading) loadAdminCustomers();
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
    adminMessage = adminOrders.length ? "Order ledger updated." : "No orders yet.";
  } catch (error) {
    adminOrdersLoaded = true;
    adminMessage = error.message;
  } finally {
    adminOrdersLoading = false;
    render();
  }
}

async function loadAdminCustomers() {
  if (!adminToken || adminCustomersLoading) return;
  adminCustomersLoading = true;
  try {
    const response = await fetch("/api/admin/customers", { headers: { Authorization: "Bearer " + adminToken } });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        adminToken = "";
        sessionStorage.removeItem("qbAdminToken");
      }
      throw new Error(result.error || "Customers could not be loaded.");
    }
    adminCustomers = result.customers;
    adminCustomersLoaded = true;
    adminMessage = adminCustomers.length ? "Customer archive updated." : "No customer accounts yet.";
  } catch (error) {
    adminCustomersLoaded = true;
    adminMessage = error.message;
  } finally {
    adminCustomersLoading = false;
    render();
  }
}

async function deleteAdminCustomer(id, button) {
  button.disabled = true;
  try {
    const response = await fetch("/api/admin/customers/" + encodeURIComponent(id), {
      method: "DELETE", headers: { Authorization: "Bearer " + adminToken }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The customer account could not be deleted.");
    adminCustomers = adminCustomers.filter(function (item) { return item.id !== id; });
    adminMessage = result.email + " deleted from the customer archive.";
    render();
  } catch (error) {
    adminMessage = error.message;
    button.disabled = false;
    const status = document.querySelector(".customer-admin-status");
    if (status) status.textContent = adminMessage;
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
    if (!response.ok) throw new Error(result.error || "The order could not be deleted.");
    adminOrders = adminOrders.filter(function (order) { return order.id !== id; });
    adminMessage = result.orderNumber + " deleted from the order ledger.";
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
  let target = adminDraft;
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
    adminMessage = "Image uploaded. Save changes to publish it on the site.";
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
  const selectedTab = adminActiveTab;
  const status = document.getElementById("admin-status");
  if (status) status.textContent = "Saving…";
  try {
    const response = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken }, body: JSON.stringify(adminDraft) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        adminToken = "";
        sessionStorage.removeItem("qbAdminToken");
      }
      throw new Error(result.error || "Changes could not be saved.");
    }
    adminMessage = "Saved to Neon Postgres.";
    content = cloneContent(adminDraft);
    adminDraft = cloneContent(content);
    render();
    const tab = document.querySelector('[data-tab="' + selectedTab + '"]');
    if (tab) tab.click();
    document.getElementById("admin-status").textContent = adminMessage;
  } catch (error) {
    adminMessage = error.message;
    const statusAgain = document.getElementById("admin-status");
    if (statusAgain) statusAgain.textContent = adminMessage;
  }
}

async function loadCustomerSession() {
  if (!customerToken) {
    customerLoading = false;
    return;
  }
  customerLoading = true;
  try {
    const response = await fetch("/api/auth/me", { headers: { Authorization: "Bearer " + customerToken } });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        customerToken = "";
        sessionStorage.removeItem("qbCustomerToken");
        clearCheckoutState();
      }
      throw new Error(result.error || "Your private archive could not be opened.");
    }
    customer = result.customer;
    customerOrders = result.orders || [];
    authMessage = "";
  } catch (error) {
    customer = null;
    customerOrders = [];
    authMessage = error.message;
  } finally {
    customerLoading = false;
    render();
  }
}

window.addEventListener("popstate", finishRouteChange);

window.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && cartOpen) {
    closeCart();
    return;
  }
  if (event.key === "Tab" && cartOpen) {
    const dialog = document.querySelector(".cart-drawer");
    const focusable = dialog ? Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (item) { return !item.hidden && item.getAttribute("aria-hidden") !== "true"; }) : [];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
});

fetch("/api/content")
  .then(function (response) { if (!response.ok) throw new Error("The content service is unavailable."); return response.json(); })
  .then(function (data) {
    content = data;
    const cartSync = syncCartWithContent(content);
    if (cartSync.removed) checkoutMessage = "A product or size in your bag is no longer available. Review your bag before checkout.";
    else if (cartSync.priceChanged) checkoutMessage = "Product prices were updated from the current catalogue.";
    if (adminToken) adminDraft = cloneContent(content);
    render();
    if (currentRoute()[0] === "belief") {
      requestAnimationFrame(function () {
        const intro = document.getElementById("belief");
        if (intro) intro.scrollIntoView();
      });
    }
    if (customerToken) loadCustomerSession(); else customerLoading = false;
  })
  .catch(function () {
    root.innerHTML = '<main class="page" style="padding:80px 0"><span class="mono">The archive is offline.</span><p>Please try again shortly.</p></main>';
  });
