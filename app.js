const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQs3dVUTF9eYVt5aGsZm8yu2Kyugv6EbLeh3NQer_EXXVfB1DTcvoyuk5xOKnB6BMbYfxkwqyPcyXgn/pub?output=csv';

const WHATSAPP_NUMBER = '201028593131';

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
// HELPERS
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
    return rawPrice && rawPrice.trim() ? rawPrice.trim() : 'Contact for Price';
}

function detectCategoryGroup(product) {
    const text = `${product.Title || ''} ${product.Description || ''}`.toLowerCase();
    if (text.includes('assembly') || text.includes('set') || text.includes('unit')) {
        return 'assemblies';
    }
    return 'cams';
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
        if (activeCategory === 'spares') {
            if (item._spares.length === 0) return false;
        } else if (activeCategory !== 'all' && item._group !== activeCategory) {
            return false;
        }

        if (!searchQuery) return true;

        const sparesText = item._spares
            .map(s => `${s.name} ${s.description}`)
            .join(' ')
            .toLowerCase();

        const haystack = `${item.ID} ${item.Title} ${item.Description} ${sparesText}`.toLowerCase();
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
// CREATE PRODUCT CARD
// =========================

function createProductCard(product) {
    const title = product.Title.trim();
    const description = product.Description || '';
    const sku = (product.ID || product.Folder_ID || '').trim();
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
    category.textContent = `4T LIFT • ${sku || 'COMPONENT'}`;

    const heading = document.createElement('h3');
    heading.className = 'product-title';
    heading.textContent = title;
    heading.addEventListener('click', () => openProductModal(product));

    const desc = document.createElement('p');
    desc.className = 'product-description';
    desc.textContent = description;

    // Spare parts box linked via ID
    if (spares.length > 0) {
        const sparesBox = document.createElement('div');
        sparesBox.className = 'spares-box';

        const sparesTitle = document.createElement('div');
        sparesTitle.className = 'spares-box-title';
        sparesTitle.textContent = `Spare Parts (${spares.length})`;

        const sparesTags = document.createElement('div');
        sparesTags.className = 'spares-tags';

        spares.forEach(sp => {
            const chip = document.createElement('span');
            chip.className = 'spare-chip';
            chip.textContent = `${sp.name} (${sp.priceLabel})`;
            sparesTags.appendChild(chip);
        });

        sparesBox.appendChild(sparesTitle);
        sparesBox.appendChild(sparesTags);
        body.appendChild(category);
        body.appendChild(heading);
        body.appendChild(desc);
        body.appendChild(sparesBox);
    } else {
        body.appendChild(category);
        body.appendChild(heading);
        body.appendChild(desc);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const priceElement = document.createElement('div');
    priceElement.className = 'product-price';

    const priceValue = document.createElement('span');
    priceValue.textContent = priceLabel;

    const priceNote = document.createElement('small');
    priceNote.textContent = 'MAIN UNIT PRICE';

    priceElement.appendChild(priceValue);
    priceElement.appendChild(priceNote);

    const actions = document.createElement('div');
    actions.className = 'product-actions';

    const detailsBtn = document.createElement('button');
    detailsBtn.type = 'button';
    detailsBtn.className = 'btn-details';
    detailsBtn.textContent = spares.length > 0 ? `Parts (${spares.length})` : 'Details';
    detailsBtn.addEventListener('click', () => openProductModal(product));

    const orderBtn = document.createElement('button');
    orderBtn.type = 'button';
    orderBtn.className = 'product-order';
    orderBtn.textContent = '+ Order';
    orderBtn.addEventListener('click', () => {
        addToOrderBag({
            id: `prod-${sku}-${title}`,
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
    const sku = (product.ID || '4T-STD').trim();
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
                <span class="product-category">4T LIFT COMPONENT • ID: ${escapeHtml(sku)}</span>
                <h3 class="product-title" id="modal-title" style="margin-top:6px;">${escapeHtml(title)}</h3>
                <p class="product-description" style="margin-top:10px;">${escapeHtml(product.Description || '')}</p>
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
            <h4>Spare Parts for ${escapeHtml(title)} (${spares.length})</h4>
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
        if (spares.length === 0) {
            sparesList.innerHTML = `<p class="cart-item-meta">No individual spare parts listed for this unit.</p>`;
        } else {
            spares.forEach(sp => {
                const row = document.createElement('div');
                row.className = 'spare-part-row';

                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${escapeHtml(sp.imageUrl || 'https://placehold.co/80x80?text=Part')}"
                             alt="${escapeHtml(sp.name)}"
                             style="width:52px; height:52px; object-fit:contain; background:#fff; border:1px solid #E1E5EA; padding:4px; border-radius:4px;">
                        <div>
                            <strong>${escapeHtml(sp.name)}</strong>
                            ${sp.description ? `<div class="cart-item-meta">${escapeHtml(sp.description)}</div>` : ''}
                            <div class="cart-item-meta" style="color:#F47721; font-weight:700;">${escapeHtml(sp.priceLabel)}</div>
                        </div>
                    </div>
                    <button type="button" class="spare-add-btn">+ Add Part</button>
                `;

                row.querySelector('.spare-add-btn').addEventListener('click', () => {
                    addToOrderBag({
                        id: sp.id,
                        name: `${sp.name} (Spare for ${title})`,
                        sku: `${sku}-SP`,
                        price: sp.price,
                        priceLabel: sp.priceLabel
                    });
                    closeProductModal();
                    openOrderBag();
                });

                sparesList.appendChild(row);
            });
        }
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
// LOAD PRODUCTS & GROUP SPARE PARTS BY ID
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

        const items = rows.slice(1).map(row => {
            const item = {};
            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });

        const availableItems = items.filter(item => {
            if (!item.Title || !item.Title.trim()) return false;
            const status = (item.Status || '').trim().toLowerCase();
            return !status || status === 'available';
        });

        // Separate main products from spare parts using Type column (or first row per ID fallback)
        const seenIds = new Set();
        const mainProducts = [];
        const spareRows = [];

        availableItems.forEach(item => {
            const type = (item.Type || '').trim().toLowerCase();
            const groupId = (item.ID || item.Folder_ID || '').trim();

            if (type === 'spare' || type === 'spare part' || type === 'part') {
                spareRows.push(item);
            } else if (type === 'product' || type === 'main') {
                mainProducts.push(item);
                if (groupId) seenIds.add(groupId);
            } else {
                // Fallback if Type column isn't added yet: first occurrence of ID is Product, subsequent rows with same ID are Spare Parts
                if (groupId && seenIds.has(groupId)) {
                    spareRows.push(item);
                } else {
                    mainProducts.push(item);
                    if (groupId) seenIds.add(groupId);
                }
            }
        });

        allProducts = mainProducts.map(prod => {
            const groupId = (prod.ID || prod.Folder_ID || '').trim();
            const matchedSpares = spareRows
                .filter(sp => (sp.ID || sp.Folder_ID || '').trim() === groupId && groupId !== '')
                .map((sp, idx) => ({
                    id: `${groupId}-sp-${idx}-${sp.Title.trim()}`,
                    name: sp.Title.trim(),
                    description: (sp.Description || '').trim(),
                    price: parsePriceNumber(sp.Price),
                    priceLabel: formatPriceLabel(sp.Price),
                    imageUrl: getDirectImageUrl(sp.Image_URL)
                }));

            return {
                ...prod,
                _group: detectCategoryGroup(prod),
                _spares: matchedSpares
            };
        });

        if (countElement) {
            countElement.textContent = String(allProducts.length).padStart(2, '0');
        }

        if (allProducts.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    No products available at the moment.
                </div>
            `;
            return;
        }

        renderFilteredProducts();

        // Hero image from first product
        const heroImage = document.getElementById('hero-product-image');
        const placeholder = document.querySelector('.image-placeholder');

        if (heroImage && allProducts[0].Image_URL) {
            heroImage.src = getDirectImageUrl(allProducts[0].Image_URL);
            heroImage.hidden = false;

            heroImage.onload = () => {
                if (placeholder) placeholder.style.display = 'none';
            };

            heroImage.onerror = () => {
                heroImage.hidden = true;
                if (placeholder) placeholder.style.display = 'flex';
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
