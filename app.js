const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQs3dVUTF9eYVt5aGsZm8yu2Kyugv6EbLeh3NQer_EXXVfB1DTcvoyuk5xOKnB6BMbYfxkwqyPcyXgn/pub?output=csv';

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
});

async function fetchProducts() {
    const grid = document.getElementById('products-grid');
    try {
        const response = await fetch(CSV_URL);
        const data = await response.text();
        
        const rows = data.split('\n').map(row => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/));
        const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
        
        const products = rows.slice(1).filter(r => r.length > 1).map(row => {
            let item = {};
            headers.forEach((header, index) => {
                let val = row[index] ? row[index].trim() : '';
                item[header] = val.replace(/^"|"$/g, '');
            });
            return item;
        });

        grid.innerHTML = '';

        products.forEach(product => {
            if (!product.Title) return;

            const card = document.createElement('div');
            card.className = 'card';
            
            // معالجة رابط جوجل درايف لاستخراج الـ ID وعرض الصورة مباشرة
            let imgUrl = product.Image_URL;
            if (imgUrl && imgUrl.includes('drive.google.com')) {
                const match = imgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || imgUrl.match(/id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    imgUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
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
 
