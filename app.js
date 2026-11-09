// رابط Opensheet المجاني للوصول إلى Google Sheets بدون API Key
const SHEET_ID = 'YOUR_SPREADSHEET_ID'; 
const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
});

async function fetchProducts() {
    const grid = document.getElementById('products-grid');
    try {
        const response = await fetch(API_URL);
        const products = await response.json();
        
        grid.innerHTML = '';

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'card';
            
            // تجهيز رابط الواتساب للطلب المباشر
            const whatsappMsg = encodeURIComponent(`مرحباً، أريد الاستفسار عن شراء ${product.Title} بسعر ${product.Price} ج.م`);
            const whatsappUrl = `https://wa.me/201000000000?text=${whatsappMsg}`;

            card.innerHTML = `
                <img src="${product.Image_URL}" alt="${product.Title}" onerror="this.src='https://via.placeholder.com/300x200?text=4T+Lift'">
                <div class="card-body">
                    <h3 class="card-title">${product.Title}</h3>
                    <p class="card-desc">${product.Description}</p>
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