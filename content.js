// content.js - Content script để tương tác với trang web
console.log('Extension Demo: Content script đã được tải');

// Tạo notification overlay
function createNotification(message) {
    // Xóa notification cũ nếu có
    const existingNotification = document.getElementById('extension-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Tạo notification mới
    const notification = document.createElement('div');
    notification.id = 'extension-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🚀</span>
                <span>${message}</span>
            </div>
        </div>
    `;

    // Thêm CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Tự động ẩn sau 3 giây
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Đổi màu nền trang web
function changePageColor() {
    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    ];
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.background = randomColor;
    document.body.style.transition = 'background 0.5s ease';
}

// Thêm hiệu ứng hover cho các link
function addHoverEffects() {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

// Lắng nghe tin nhắn từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Nhận tin nhắn:', request);
    
    switch (request.action) {
        case 'showMessage':
            createNotification(`Tin nhắn: ${request.message}`);
            sendResponse({ success: true });
            break;
            
        case 'changeColor':
            changePageColor();
            createNotification('Màu trang đã được thay đổi!');
            sendResponse({ success: true });
            break;
            
        default:
            sendResponse({ success: false, error: 'Action không được hỗ trợ' });
    }
    
    return true; // Giữ kết nối mở để gửi response bất đồng bộ
});

// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', function() {
    console.log('Extension Demo: Trang đã được tải');
    addHoverEffects();
    
    // Hiển thị thông báo chào mừng
    setTimeout(() => {
        createNotification('Extension Demo đã sẵn sàng! 🎉');
    }, 1000);
});

// Thêm hiệu ứng cho các button
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON') {
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = 'scale(1)';
        }, 150);
    }
});
