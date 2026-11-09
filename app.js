
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQs3dVUTF9eYVt5aGsZm8yu2Kyugv6EbLeh3NQer_EXXVfB1DTcvoyuk5xOKnB6BMbYfxkwqyPcyXgn/pub?output=csv';

document.addEventListener('DOMContentLoaded', fetchProducts);

// تحويل روابط Google Drive إلى روابط مناسبة لعرض الصور
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

// تحليل CSV مع مراعاة الفواصل داخل النصوص المقتبسة
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
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
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

async function fetchProducts() {
    const grid = document.getElementById('products-grid');

    if (!grid) return;

    try {
        grid.innerHTML = '<p class="loading">جاري تحميل المنتجات والأسعار...</p>';

        const response = await fetch(CSV_URL);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const csvData = await response.text();
        const rows = parseCSV(csvData);

        if (rows.length < 2) {
            grid.innerHTML = '<p>لا توجد منتجات متاحة حالياً.</p>';
            return;
        }

        const headers = rows[0].map(header => header.trim());

        const products = rows.slice(1).map(row => {
            const item = {};

            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });

            return item;
        });

        grid.innerHTML = '';

        let displayedProducts = 0;

        products.forEach(product => {
            if (!product.Title) return;

            // تجاهل المنتجات غير المتاحة
            if (
                product.Status &&
                product.Status.trim().toLowerCase() !== 'available'
            ) {
                return;
            }

            const title = product.Title.trim();
            const description = product.Description || '';
            const price = product.Price || 'تواصل معنا';
            const imgUrl = getDirectImageUrl(product.Image_URL);

            const whatsappMsg = encodeURIComponent(
                `مرحباً، أريد الاستفسار عن شراء ${title} بسعر ${price} ج.م`
            );

            const whatsappUrl =
                `https://wa.me/201028593131?text=${whatsappMsg}`;

            const card = document.createElement('div');
            card.className = 'card';

            const image = document.createElement('img');
            image.alt = title;
            image.loading = 'lazy';
            image.referrerPolicy = 'no-referrer';
            image.src = imgUrl || 'https://placehold.co/600x400?text=4T+Lift';

            image.onerror = function () {
                this.onerror = null;
                this.src = 'https://placehold.co/600x400?text=4T+Lift';
            };

            const body = document.createElement('div');
            body.className = 'card-body';

            const heading = document.createElement('h3');
            heading.className = 'card-title';
            heading.textContent = title;

            const desc = document.createElement('p');
            desc.className = 'card-desc';
            desc.textContent = description;

            const priceElement = document.createElement('div');
            priceElement.className = 'price-tag';
            priceElement.textContent = price === 'تواصل معنا'
                ? price
                : `${price} ج.م`;

            const button = document.createElement('a');
            button.href = whatsappUrl;
            button.target = '_blank';
            button.rel = 'noopener noreferrer';
            button.className = 'btn-whatsapp';
            button.textContent = 'اطلب الآن عبر WhatsApp';

            body.appendChild(heading);
            body.appendChild(desc);
            body.appendChild(priceElement);
            body.appendChild(button);

            card.appendChild(image);
            card.appendChild(body);

            grid.appendChild(card);

            displayedProducts++;
        });

        if (displayedProducts === 0) {
            grid.innerHTML = '<p>لا توجد منتجات متاحة حالياً.</p>';
        }

    } catch (error) {
        console.error('حدث خطأ أثناء تحميل البيانات:', error);

        grid.innerHTML = `
            <p class="loading">
                تعذر تحميل المنتجات. يرجى المحاولة مرة أخرى لاحقاً.
            </p>
        `;
    }
}
