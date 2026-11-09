const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQs3dVUTF9eYVt5aGsZm8yu2Kyugv6EbLeh3NQer_EXXVfB1DTcvoyuk5xOKnB6BMbYfxkwqyPcyXgn/pub?output=csv';

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
});

async function fetchProducts() {
    const grid = document.getElementById('products-grid');
    try {
        const response = await fetch(CSV_URL);
        const data = await response.text();
        
        const rows = data.split('\n').map(row => row.split(','));
        const headers = rows[0].map(h => h.trim());
        
        const products = rows.slice(1).filter(r => r.length > 1).map(row => {
            let item = {};
            headers.forEach((header, index) => {
                item[header] = row[index] ? row[index].trim() : '';
            });
            return item;
        });

        grid.innerHTML = '';

        products.forEach(product => {
            if (!product.Title) return;

            const card = document.createElement('div');
            card.className = 'card';
            
            // تحويل رابط جوجل درايف تلقائياً للعرض المباشر
            let imgUrl = product.Image_URL;
            if (imgUrl.includes('drive.google.com/file/d/')) {
                const fileIdMatch = imgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (fileIdMatch && fileIdMatch[1]) {
                    imgUrl = `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
                }
            }

            const whatsappMsg = encodeURIComponent(`مرحباً، أريد الاستفسار عن شراء ${product.Title} بسعر ${product.Price} ج.م`);
            const whatsappUrl = `https://wa.me/201028593131?text=${whatsappMsg}`;

            card.innerHTML = `
                <img src="${imgUrl}" alt="${product.Title}" onerror="this.src='https://via.placeholder.com/300x200?text=4T+Lift'">
                <div class="card-body">
                    <h3 class="card-title">${product.Title}</h3>
                    <p class="card-desc">${product.Description || ''}</p>
                    <div class="price-tag">${product.Price} ج.م</div>
                    <a href="${whatsappUrl}" target="_blank" class="btn-whatsapp">اطلب الآن عبر WhatsApp</a>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('حدث خطأ أثناء تحميل البيانات:', error);
        grid.innerHTML = '<p>تعذر تحميل البيانات، يرجى التأكد من إعدادات Google Sheet.</p>';
    }
}
