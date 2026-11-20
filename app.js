const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQs3dVUTF9eYVt5aGsZm8yu2Kyugv6EbLeh3NQer_EXXVfB1DTcvoyuk5xOKnB6BMbYfxkwqyPcyXgn/pub?output=csv';

const WHATSAPP_NUMBER = '01028593131';

let allProducts = [];
let activeCategory = 'all';
let searchQuery = '';
let orderBag = [];

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupCatalogControls();
    setupModal();
    setupOrderBag();
    renderOrderBag();
    fetchProducts();
});


// =========================
// NAVIGATION
// =========================

function setupNavigation() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('.nav-links');

    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
}


// =========================
// GOOGLE DRIVE IMAGE URL
// =========================

function getDirectImageUrl(url) {
    if (!url) return '';

    url = url.trim();

    if (url.includes('drive.google.com')) {
        const match =
            url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
            url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

        if (match && match[1]) {
            return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
        }
    }

    return url;
}


// =========================
// CSV PARSER
// =========================

function parseCSV(csv) {
    const rows = [];
    let row = [];
    let cell = '';
    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const next = csv[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            cell += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            row.push(cell.trim());
            cell = '';
        } else if (
            (char === '\n' || char === '\r') &&
            !insideQuotes
        ) {
            if (char === '\r' && next === '\n') i++;

            row.push(cell.trim());

            if (row.some(value => value !== '')) {
                rows.push(row);
            }

            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }

    if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
    }

    return rows;
}


// =========================
// SPARE PARTS & CATEGORY HELPERS
// =========================

function parsePriceNumber(rawPrice) {
    if (!rawPrice) return 0;
    const cleaned = String(rawPrice).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function formatPriceLabel(rawPrice) {
    const num = parsePriceNumber(rawPrice);
    if (num > 0) return `${num} EGP`;
    return rawPrice && rawPrice.trim() ? rawPrice.trim() : 'Price on Request';
}

function detectCategoryGroup(product) {
    const text = `${product.Title || ''} ${product.Category || ''} ${product.Description || ''}`.toLowerCase();
    if (text.includes('spare') || text.includes('switch') || text.includes('roller') || text.includes('sensor') || text.includes('bracket')) {
        return 'spares';
    }
    if (text.includes('assembly') || text.includes('set') || text.includes('kit') || text.includes('unit')) {
        return 'assemblies';
    }
    return 'cams';
}

/**
 * Parses Spare_Parts column from sheet if provided:
 * Example format in Sheet: "Micro Switch (120 EGP) | Cam Roller (180 EGP) | Mounting Bracket"
 * Falls back to helpful default spare parts per product if Spare_Parts column is empty.
 */
function parseSpareParts(product) {
    const raw = (product.Spare_Parts || product.Spares || '').trim();

    if (raw) {
        return raw.split('|').map((entry, idx) => {
            const clean = entry.trim();
            const priceMatch = clean.match(/\(([^)]+)\)/);
            const priceLabel = priceMatch ? priceMatch[1].trim() : 'On Inquiry';
            const name = clean.replace(/\([^)]+\)/, '').trim() || `Spare Part ${idx + 1}`;
            const numericPrice = parsePriceNumber(priceLabel);

            return {
                id: `${(product.SKU || product.Title || 'item').replace(/\s+/g, '-')}-sp-${idx}`,
                name,
                price: numericPrice,
                priceLabel: numericPrice > 0 ? `${numericPrice} EGP` : priceLabel,
                parentTitle: product.Title.trim()
            };
        });
    }

    // Default spare parts suggestions when Spare_Parts column is not yet filled in CSV
    const baseTitle = (product.Title || 'Component').trim();
    return [
        {
            id: `${baseTitle}-sp-1`,
            name: `Replacement Micro Switch (${baseTitle})`,
            price: 0,
            priceLabel: 'Ask Price',
            parentTitle: baseTitle
        },
        {
            id: `${baseTitle}-sp-2`,
            name: `Wear Roller & Pin Kit (${baseTitle})`,
            price: 0,
            priceLabel: 'Ask Price',
            parentTitle: baseTitle
        },
        {
            id: `${baseTitle}-sp-3`,
            name: `Heavy-Duty Mounting Bracket`,
            price: 0,
            priceLabel: 'Ask Price',
            parentTitle: baseTitle
        }
    ];
}


// =========================
// CATALOG SEARCH & FILTER
// =========================

function setupCatalogControls() {
    const searchInput = document.getElementById('product-search');
    const filterButtons = document.querySelectorAll('.filter-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderFilteredProducts();
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.category || 'all';
            renderFilteredProducts();
        });
    });
}

function renderFilteredProducts() {
    const grid = document.getElementById('products-grid');
    const countElement = document.getElementById('product-count');
    if (!grid) return;

    const filtered = allProducts.filter(item => {
        const matchesCategory = activeCategory === 'all' || item._group === activeCategory;
        if (!matchesCategory) return false;

        if (!searchQuery) return true;

        const sparesText = item._spares.map(s => s.name).join(' ').toLowerCase();
        const haystack = `${item.Title} ${item.Description} ${item.SKU || ''} ${item.Compatibility || ''} ${sparesText}`.toLowerCase();
        return haystack.includes(searchQuery);
    });

    if (countElement) {
        countElement.textContent = String(filtered.length).padStart(2, '0');
    }

    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p>No matching products or spare parts found.</p>
                <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello 4T Lift, I am looking for: ${searchQuery || 'an elevator part'}`)}"
                   target="_blank" rel="noopener noreferrer" class="btn-primary">
                    Ask Team on WhatsApp (01028593131) ↗
                </a>
            </div>
        `;
        return;
    }

    filtered.forEach(product => {
        grid.appendChild(createProductCard(product));
    });
}


// =========================
// CREATE PRODUCT CARD WITH SPARE PARTS
// =========================

function createProductCard(product) {
    const title = product.Title.trim();
    const description = product.Description || 'Precision elevator component built for reliable performance.';
    const sku = (product.SKU || '').trim();
    const priceNum = parsePriceNumber(product.Price);
    const priceLabel = formatPriceLabel(product.Price);
    const imageUrl = getDirectImageUrl(product.Image_URL);
    const spares = product._spares || [];

    const card = document.createElement('article');
    card.className = 'product-card';

    // Image box
    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image';
    imageContainer.addEventListener('click', () => openProductModal(product));

    const status = document.createElement('span');
    status.className = 'product-status';
    status.textContent = 'AVAILABLE';

    const image = document.createElement('img');
    image.src = imageUrl || 'https://placehold.co/600x400?text=4T+Lift';
    image.alt = title;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.onerror = function () {
        this.onerror = null;
        this.src = 'https://placehold.co/600x400?text=4T+Lift';
    };

    imageContainer.appendChild(image);
    imageContainer.appendChild(status);

    if (sku) {
        const skuBadge = document.createElement('span');
        skuBadge.className = 'product-sku';
        skuBadge.textContent = sku;
        imageContainer.appendChild(skuBadge);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'product-body';

    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = product.Category || '4T LIFT / ELEVATOR & SPARES';

    const heading = document.createElement('h3');
    heading.className = 'product-title';
    heading.textContent = title;
    heading.addEventListener('click', () => openProductModal(product));

    const desc = document.createElement('p');
    desc.className = 'product-description';
    desc.textContent = description;

    // Spare parts preview box
    const sparesBox = document.createElement('div');
    sparesBox.className = 'spares-box';

    const sparesTitle = document.createElement('div');
    sparesTitle.className = 'spares-box-title';
    sparesTitle.textContent = `Available Spare Parts (${spares.length})`;

    const sparesTags = document.createElement('div');
    sparesTags.className = 'spares-tags';

    spares.slice(0, 3).forEach(sp => {
        const chip = document.createElement('span');
        chip.className = 'spare-chip';
        chip.textContent = sp.name;
        sparesTags.appendChild(chip);
    });

    sparesBox.appendChild(sparesTitle);
    sparesBox.appendChild(sparesTags);

    // Footer with price & online order actions
    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const priceElement = document.createElement('div');
    priceElement.className = 'product-price';

    const priceValue = document.createElement('span');
    priceValue.textContent = priceLabel;

    const priceNote = document.createElement('small');
    priceNote.textContent = 'UNIT PRICE';

    priceElement.appendChild(priceValue);
    priceElement.appendChild(priceNote);

    const actions = document.createElement('div');
    actions.className = 'product-actions';

    const detailsBtn = document.createElement('button');
    detailsBtn.type = 'button';
    detailsBtn.className = 'btn-details';
    detailsBtn.textContent = 'Parts & Specs';
    detailsBtn.addEventListener('click', () => openProductModal(product));

    const orderBtn = document.createElement('button');
    orderBtn.type = 'button';
    orderBtn.className = 'product-order';
    orderBtn.textContent = '+ Order';
    orderBtn.addEventListener('click', () => {
        addToOrderBag({
            id: `prod-${sku || title}`,
            name: title,
            sku: sku || '4T-ITEM',
            price: priceNum,
            priceLabel
        });
        openOrderBag();
    });

    actions.appendChild(detailsBtn);
    actions.appendChild(orderBtn);

    footer.appendChild(priceElement);
    footer.appendChild(actions);

    body.appendChild(category);
    body.appendChild(heading);
    body.appendChild(desc);
    body.appendChild(sparesBox);
    body.appendChild(footer);

    card.appendChild(imageContainer);
    card.appendChild(body);

    return card;
}


// =========================
// PRODUCT & SPARE PARTS MODAL
// =========================

function setupModal() {
    const backdrop = document.getElementById('product-modal');
    const closeBtn = document.getElementById('modal-close');

    if (!backdrop || !closeBtn) return;

    closeBtn.addEventListener('click', closeProductModal);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeProductModal();
    });
}

function openProductModal(product) {
    const backdrop = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    if (!backdrop || !content) return;

    const title = product.Title.trim();
    const sku = (product.SKU || '4T-STD').trim();
    const priceNum = parsePriceNumber(product.Price);
    const priceLabel = formatPriceLabel(product.Price);
    const imgSrc = getDirectImageUrl(product.Image_URL) || 'https://placehold.co/600x400?text=4T+Lift';
    const spares = product._spares || [];

    content.innerHTML = `
        <div class="modal-grid">
            <div class="modal-img-box">
                <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(title)}">
            </div>
            <div>
                <span class="product-category">${escapeHtml(product.Category || '4T LIFT COMPONENT')} • SKU: ${escapeHtml(sku)}</span>
                <h3 class="product-title" id="modal-title" style="margin-top:6px;">${escapeHtml(title)}</h3>
                <p class="product-description" style="margin-top:10px;">${escapeHtml(product.Description || '')}</p>
                ${product.Compatibility ? `<p class="product-description"><strong>Compatibility:</strong> ${escapeHtml(product.Compatibility)}</p>` : ''}
                <div style="margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                    <div class="product-price">
                        <span>${escapeHtml(priceLabel)}</span>
                        <small>MAIN COMPONENT</small>
                    </div>
                    <button type="button" class="btn-primary" id="modal-add-main">
                        Add Main Unit to Order
                    </button>
                </div>
            </div>
        </div>

        <div class="modal-spares-section">
            <h4>Spare Parts for ${escapeHtml(title)}</h4>
            <div id="modal-spares-list"></div>
        </div>
    `;

    const addMainBtn = document.getElementById('modal-add-main');
    if (addMainBtn) {
        addMainBtn.addEventListener('click', () => {
            addToOrderBag({
                id: `prod-${sku}-${title}`,
                name: title,
                sku,
                price: priceNum,
                priceLabel
            });
            closeProductModal();
            openOrderBag();
        });
    }

    const sparesList = document.getElementById('modal-spares-list');
    if (sparesList) {
        spares.forEach(sp => {
            const row = document.createElement('div');
            row.className = 'spare-part-row';

            row.innerHTML = `
                <div>
                    <strong>${escapeHtml(sp.name)}</strong>
                    <div class="cart-item-meta">For: ${escapeHtml(title)} • ${escapeHtml(sp.priceLabel)}</div>
                </div>
                <button type="button" class="spare-add-btn">+ Add Part</button>
            `;

            row.querySelector('.spare-add-btn').addEventListener('click', () => {
                addToOrderBag({
                    id: sp.id,
                    name: sp.name,
                    sku: `SP-${sku}`,
                    price: sp.price,
                    priceLabel: sp.priceLabel
                });
                closeProductModal();
                openOrderBag();
            });

            sparesList.appendChild(row);
        });
    }

    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
}

function closeProductModal() {
    const backdrop = document.getElementById('product-modal');
    if (!backdrop) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
}


// =========================
// INSTANT ORDER BAG (WHATSAPP 01028593131)
// =========================

function setupOrderBag() {
    const trigger = document.getElementById('cart-trigger');
    const closeBtn = document.getElementById('cart-close');
    const overlay = document.getElementById('drawer-overlay');
    const form = document.getElementById('checkout-form');

    if (trigger) trigger.addEventListener('click', openOrderBag);
    if (closeBtn) closeBtn.addEventListener('click', closeOrderBag);
    if (overlay) overlay.addEventListener('click', closeOrderBag);

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (orderBag.length === 0) return;

            const customerName = document.getElementById('customer-name')?.value.trim() || '';
            const customerNote = document.getElementById('customer-note')?.value.trim() || '';

            const lines = [
                'Hello 4T Lift, I would like to place an order:',
                ''
            ];

            let subtotal = 0;

            orderBag.forEach((item, index) => {
                const lineTotal = item.price > 0 ? item.price * item.qty : 0;
                subtotal += lineTotal;
                const priceInfo = item.price > 0
                    ? `${item.price} EGP x ${item.qty} = ${lineTotal} EGP`
                    : `${item.priceLabel} x ${item.qty}`;
                lines.push(`${index + 1}. ${item.name} [${item.sku}] — ${priceInfo}`);
            });

            lines.push('');
            lines.push(`Estimated Total: ${subtotal > 0 ? `${subtotal} EGP` : 'To be confirmed'}`);

            if (customerName) lines.push(`Customer / Company: ${customerName}`);
            if (customerNote) lines.push(`Notes / Location: ${customerNote}`);

            const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        });
    }
}

function openOrderBag() {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('drawer-overlay')?.classList.add('open');
}

function closeOrderBag() {
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('open');
}

function addToOrderBag(item) {
    const existing = orderBag.find(entry => entry.id === item.id);
    if (existing) {
        existing.qty += 1;
    } else {
        orderBag.push({ ...item, qty: 1 });
    }
    renderOrderBag();
}

function updateItemQty(id, delta) {
    const target = orderBag.find(entry => entry.id === id);
    if (!target) return;
    target.qty += delta;
    if (target.qty <= 0) {
        orderBag = orderBag.filter(entry => entry.id !== id);
    }
    renderOrderBag();
}

function renderOrderBag() {
    const container = document.getElementById('cart-items');
    const badge = document.getElementById('cart-count');
    const subtotalEl = document.getElementById('cart-subtotal');

    const totalQty = orderBag.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = orderBag.reduce((sum, item) => sum + (item.price > 0 ? item.price * item.qty : 0), 0);

    if (badge) badge.textContent = String(totalQty);
    if (subtotalEl) subtotalEl.textContent = `${subtotal} EGP`;

    if (!container) return;

    if (orderBag.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="min-height:120px;">
                Your order bag is empty. Add any component or spare part to order on WhatsApp (01028593131).
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    orderBag.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';

        row.innerHTML = `
            <div>
                <div class="cart-item-title">${escapeHtml(item.name)}</div>
                <div class="cart-item-meta">${escapeHtml(item.sku)} • ${escapeHtml(item.priceLabel)}</div>
            </div>
            <div class="cart-qty-controls">
                <button type="button" class="qty-btn minus" aria-label="Decrease quantity">−</button>
                <span>${item.qty}</span>
                <button type="button" class="qty-btn plus" aria-label="Increase quantity">+</button>
            </div>
        `;

        row.querySelector('.minus').addEventListener('click', () => updateItemQty(item.id, -1));
        row.querySelector('.plus').addEventListener('click', () => updateItemQty(item.id, 1));

        container.appendChild(row);
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// =========================
// LOAD PRODUCTS
// =========================

async function fetchProducts() {
    const grid = document.getElementById('products-grid');
    const countElement = document.getElementById('product-count');

    if (!grid) return;

    try {
        grid.innerHTML = `
            <div class="loading-state">
                <div class="loader"></div>
                <p>Loading our products & spare parts...</p>
            </div>
        `;

        const response = await fetch(CSV_URL);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const csvData = await response.text();
        const rows = parseCSV(csvData);

        if (rows.length < 2) {
            throw new Error('No product data found.');
        }

        const headers = rows[0].map(header =>
            header.replace(/^\uFEFF/, '').trim()
        );

        const products = rows.slice(1).map(row => {
            const item = {};
            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });

        const availableProducts = products
            .filter(product => {
                if (!product.Title || !product.Title.trim()) return false;
                const status = (product.Status || '').trim().toLowerCase();
                return !status || status === 'available';
            })
            .map(product => ({
                ...product,
                _group: detectCategoryGroup(product),
                _spares: parseSpareParts(product)
            }));

        allProducts = availableProducts;

        if (countElement) {
            countElement.textContent = String(availableProducts.length).padStart(2, '0');
        }

        if (availableProducts.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    No products available at the moment.
                </div>
            `;
            return;
        }

        renderFilteredProducts();

        // Use the first product image in the hero section
        const heroImage = document.getElementById('hero-product-image');
        const placeholder = document.querySelector('.image-placeholder');

        if (heroImage && availableProducts[0].Image_URL) {
            heroImage.src = getDirectImageUrl(availableProducts[0].Image_URL);
            heroImage.hidden = false;

            heroImage.onload = () => {
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            };

            heroImage.onerror = () => {
                heroImage.hidden = true;
                if (placeholder) {
                    placeholder.style.display = 'flex';
                }
            };
        }

    } catch (error) {
        console.error('Product loading error:', error);

        grid.innerHTML = `
            <div class="error-state">
                Unable to load products right now. Order directly on WhatsApp: 01028593131.
            </div>
        `;

        if (countElement) {
            countElement.textContent = '00';
        }
    }
}
