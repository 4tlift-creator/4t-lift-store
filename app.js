
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQs3dVUTF9eYVt5aGsZm8yu2Kyugv6EbLeh3NQer_EXXVfB1DTcvoyuk5xOKnB6BMbYfxkwqyPcyXgn/pub?output=csv';

const WHATSAPP_NUMBER = '201028593131';

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
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
// CREATE PRODUCT CARD
// =========================

function createProductCard(product) {
    const title = product.Title.trim();
    const description = product.Description || '';

    const price = product.Price
        ? `${product.Price} EGP`
        : 'Contact for Price';

    const imageUrl = getDirectImageUrl(product.Image_URL);

    const message = encodeURIComponent(
        `Hello, I am interested in ${title}. Price: ${price}.`
    );

    const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

    const card = document.createElement('article');
    card.className = 'product-card';

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image';

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

    // Product details
    const body = document.createElement('div');
    body.className = 'product-body';

    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = '4T LIFT / ELEVATOR COMPONENTS';

    const heading = document.createElement('h3');
    heading.className = 'product-title';
    heading.textContent = title;

    const desc = document.createElement('p');
    desc.className = 'product-description';
    desc.textContent = description;

    // Product footer
    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const priceElement = document.createElement('div');
    priceElement.className = 'product-price';

    const priceValue = document.createElement('span');
    priceValue.textContent = price;

    const priceNote = document.createElement('small');
    priceNote.textContent = 'PRODUCT PRICE';

    priceElement.appendChild(priceValue);
    priceElement.appendChild(priceNote);

    const orderButton = document.createElement('a');
    orderButton.className = 'product-order';
    orderButton.href = whatsappUrl;
    orderButton.target = '_blank';
    orderButton.rel = 'noopener noreferrer';
    orderButton.textContent = 'ORDER NOW ↗';

    footer.appendChild(priceElement);
    footer.appendChild(orderButton);

    body.appendChild(category);
    body.appendChild(heading);
    body.appendChild(desc);
    body.appendChild(footer);

    card.appendChild(imageContainer);
    card.appendChild(body);

    return card;
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
                <p>Loading our products...</p>
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

        const availableProducts = products.filter(product => {
            if (!product.Title || !product.Title.trim()) {
                return false;
            }

            const status = (product.Status || '').trim().toLowerCase();

            return !status || status === 'available';
        });

        grid.innerHTML = '';

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

        availableProducts.forEach(product => {
            const card = createProductCard(product);
            grid.appendChild(card);
        });

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
                Unable to load products.
                Please try again later.
            </div>
        `;

        if (countElement) {
            countElement.textContent = '00';
        }
    }
}
