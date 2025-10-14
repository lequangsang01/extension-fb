// facebook-content.js - Content script chuyên dụng cho Facebook
console.log('Facebook Friend Request Manager: Content script đã được tải');

let isCancelling = false;
let cancelCount = 0;
let processedCount = 0;
let cancelInterval = null;

// Các selector cho Facebook (có thể thay đổi theo thời gian)
const SELECTORS = {
    // Selector cho nút "Xem lời mời đã gửi"
    sentRequestsTab: '[data-testid="sent_requests_tab"], [aria-label*="đã gửi"], [aria-label*="sent"]',
    
    // Selector cho các nút "Hủy lời mời"
    cancelButtons: '[aria-label*="Hủy"], [aria-label*="Cancel"], [data-testid*="cancel"], button:has-text("Hủy"), button:has-text("Cancel")',
    
    // Selector cho danh sách lời mời
    requestItems: '[role="listitem"], .x1i10hfl, [data-testid*="friend_request"]',
    
    // Selector cho nút "Hủy" cụ thể
    cancelButton: 'button[aria-label*="Hủy"], button[aria-label*="Cancel"], [data-testid*="cancel_request"]'
};

// Hàm tìm element với nhiều selector
function findElement(selectors) {
    for (const selector of selectors.split(',')) {
        const element = document.querySelector(selector.trim());
        if (element) return element;
    }
    return null;
}

// Hàm tìm tất cả elements với nhiều selector
function findAllElements(selectors) {
    const elements = [];
    for (const selector of selectors.split(',')) {
        const found = document.querySelectorAll(selector.trim());
        elements.push(...found);
    }
    return elements;
}

// Hàm kiểm tra xem có phải trang lời mời kết bạn không
function isOnFriendRequestsPage() {
    return window.location.href.includes('/friends/requests') || 
           document.querySelector('[data-testid*="friend_request"]') ||
           document.querySelector('[aria-label*="lời mời"]');
}

// Hàm click vào tab "Xem lời mời đã gửi"
function clickSentRequestsTab() {
    const sentTab = findElement(SELECTORS.sentRequestsTab);
    if (sentTab) {
        sentTab.click();
        console.log('Đã click vào tab "Xem lời mời đã gửi"');
        return true;
    }
    return false;
}

// Hàm tìm và click nút hủy lời mời
function findAndCancelRequest() {
    // Tìm tất cả nút hủy có thể
    const cancelButtons = findAllElements(SELECTORS.cancelButton);
    
    for (const button of cancelButtons) {
        const buttonText = button.textContent?.toLowerCase() || '';
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        
        // Kiểm tra nếu đây là nút hủy lời mời
        if (buttonText.includes('hủy') || buttonText.includes('cancel') ||
            ariaLabel.includes('hủy') || ariaLabel.includes('cancel')) {
            
            // Scroll đến button để đảm bảo nó visible
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Click button
            button.click();
            console.log('Đã click hủy lời mời:', button.textContent || ariaLabel);
            
            // Highlight button để user thấy
            button.style.border = '2px solid #ff4444';
            button.style.backgroundColor = '#ffebee';
            
            return true;
        }
    }
    
    return false;
}

// Hàm hủy lời mời với delay
function cancelRequestsWithDelay(count) {
    processedCount = 0;
    cancelCount = count;
    
    const cancelNext = () => {
        if (!isCancelling || processedCount >= cancelCount) {
            if (isCancelling) {
                sendProgressUpdate(true);
            }
            return;
        }
        
        // Tìm và click nút hủy
        if (findAndCancelRequest()) {
            processedCount++;
            sendProgressUpdate(false);
            
            // Delay trước khi hủy tiếp
            setTimeout(cancelNext, 2000 + Math.random() * 1000); // 2-3 giây
        } else {
            // Không tìm thấy nút hủy, thử scroll xuống
            window.scrollBy(0, 300);
            setTimeout(cancelNext, 1000);
        }
    };
    
    cancelNext();
}

// Hàm gửi cập nhật tiến độ
function sendProgressUpdate(completed = false, error = null) {
    chrome.runtime.sendMessage({
        action: 'updateProgress',
        processed: processedCount,
        total: cancelCount,
        completed: completed,
        error: error
    });
}

// Hàm tạo notification
function createNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f44336' : '#4caf50'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">${type === 'error' ? '❌' : '✅'}</span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Lắng nghe tin nhắn từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Nhận tin nhắn:', request);
    
    switch (request.action) {
        case 'startCancelRequests':
            if (!isOnFriendRequestsPage()) {
                createNotification('Vui lòng mở trang facebook.com/friends/requests trước!', 'error');
                sendResponse({ success: false, error: 'Không phải trang lời mời kết bạn' });
                return;
            }
            
            isCancelling = true;
            cancelCount = request.count;
            
            // Thử click vào tab "Xem lời mời đã gửi" trước
            setTimeout(() => {
                clickSentRequestsTab();
                
                // Bắt đầu hủy sau 2 giây
                setTimeout(() => {
                    cancelRequestsWithDelay(cancelCount);
                }, 2000);
            }, 1000);
            
            createNotification(`Bắt đầu hủy ${request.count} lời mời kết bạn...`);
            sendResponse({ success: true });
            break;
            
        case 'stopCancelRequests':
            isCancelling = false;
            if (cancelInterval) {
                clearInterval(cancelInterval);
                cancelInterval = null;
            }
            
            createNotification(`Đã dừng! Đã hủy ${processedCount}/${cancelCount} lời mời.`);
            
            chrome.runtime.sendMessage({
                action: 'requestStopped',
                processed: processedCount,
                total: cancelCount
            });
            
            sendResponse({ success: true });
            break;
            
        case 'checkPage':
            const isOnPage = isOnFriendRequestsPage();
            sendResponse({ 
                success: true, 
                isOnFriendRequestsPage: isOnPage,
                url: window.location.href 
            });
            break;
            
        default:
            sendResponse({ success: false, error: 'Action không được hỗ trợ' });
    }
    
    return true;
});

// Thêm CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Kiểm tra trang khi load
if (isOnFriendRequestsPage()) {
    console.log('Đã phát hiện trang lời mời kết bạn Facebook');
    createNotification('Facebook Friend Request Manager đã sẵn sàng! 🎉');
}
