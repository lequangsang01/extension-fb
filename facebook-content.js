// facebook-content.js - Content script chuyên dụng cho Facebook
console.log('Facebook Friend Request Manager: Content script đã được tải');

let isCancelling = false;
let cancelCount = 0;
let processedCount = 0;
let cancelInterval = null;

// Hàm gửi log đến background script
function sendLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage);
    
    // Gửi đến background script để hiển thị trong popup
    chrome.runtime.sendMessage({
        action: 'log',
        message: logMessage,
        type: type
    }).catch(() => {
        // Ignore errors if background script is not available
    });
}

// Hàm debug để kiểm tra các element trên trang
function debugPageElements() {
    sendLog('🔍 DEBUG: Kiểm tra các element trên trang...', 'debug');
    
    // Kiểm tra các tab có sẵn
    const tabs = document.querySelectorAll('[role="tab"], a[href*="requests"], button');
    sendLog(`📊 Tìm thấy ${tabs.length} tab/link có thể`, 'debug');
    
    tabs.forEach((tab, index) => {
        const text = tab.textContent?.trim() || '';
        const href = tab.href || '';
        const ariaLabel = tab.getAttribute('aria-label') || '';
        
        if (text || href.includes('sent') || ariaLabel.includes('đã gửi') || ariaLabel.includes('sent')) {
            sendLog(`Tab ${index + 1}: "${text}" | href: "${href}" | aria: "${ariaLabel}"`, 'debug');
        }
    });
    
    // Kiểm tra URL hiện tại
    sendLog(`📍 URL hiện tại: ${window.location.href}`, 'debug');
    
    // Kiểm tra tab đang active
    const activeTab = document.querySelector('[aria-selected="true"]');
    if (activeTab) {
        sendLog(`✅ Tab đang active: "${activeTab.textContent?.trim()}"`, 'debug');
    } else {
        sendLog('⚠️ Không tìm thấy tab nào đang active', 'warning');
    }
}

// Các selector cho Facebook (cập nhật để phù hợp với giao diện hiện tại)
const SELECTORS = {
    // Selector cho nút "Xem lời mời đã gửi" - nhiều cách tìm
    sentRequestsTab: [
        '[data-testid="sent_requests_tab"]',
        '[aria-label*="đã gửi"]',
        '[aria-label*="sent"]',
        '[aria-label*="Sent"]',
        'a[href*="sent"]',
        'div[role="tab"]',
        'span',
        'button',
        '[role="tablist"] a[href*="sent"]',
        '[role="tablist"] button',
        '[role="tablist"] div[role="tab"]'
    ].join(', '),
    
    // Selector cho các nút "Hủy lời mời" - cải thiện
    cancelButtons: [
        '[aria-label*="Hủy"]',
        '[aria-label*="Cancel"]',
        '[data-testid*="cancel"]',
        'button',
        '[role="button"]',
        'a',
        'span',
        'div[role="button"]'
    ].join(', '),
    
    // Selector cho danh sách lời mời
    requestItems: [
        '[role="listitem"]',
        '.x1i10hfl',
        '[data-testid*="friend_request"]',
        '[data-testid*="request"]',
        'div[role="article"]'
    ].join(', '),
    
    // Selector cho nút "Hủy" cụ thể - cải thiện
    cancelButton: [
        'button[aria-label*="Hủy"]',
        'button[aria-label*="Cancel"]',
        '[data-testid*="cancel_request"]',
        '[role="button"][aria-label*="Hủy"]',
        '[role="button"][aria-label*="Cancel"]',
        'a[aria-label*="Hủy"]',
        'a[aria-label*="Cancel"]',
        'button',
        '[role="button"]',
        'a',
        'span',
        'div[role="button"]',
        'div',
        // Selector cho các element có data-testid
        '[data-testid*="cancel"]',
        '[data-testid*="remove"]',
        '[data-testid*="delete"]'
    ].join(', ')
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

// Hàm tự động mở tab "Xem lời mời đã gửi" khi vào trang
function autoOpenSentRequestsTab() {
    sendLog('🚀 Tự động mở tab "Xem lời mời đã gửi"...', 'info');
    
    // Chờ một chút để trang load hoàn toàn
    setTimeout(() => {
        const success = clickSentRequestsTab();
        if (success) {
            sendLog('✅ Đã tự động mở tab "Xem lời mời đã gửi"', 'success');
        } else {
            sendLog('⚠️ Không thể tự động mở tab, bạn có thể click thủ công', 'warning');
        }
    }, 2000);
}

// Hàm kiểm tra xem đã ở tab "Xem lời mời đã gửi" chưa
function isOnSentRequestsTab() {
    // Kiểm tra URL
    const currentUrl = window.location.href;
    if (currentUrl.includes('sent')) {
        sendLog('✅ Đã ở tab "Xem lời mời đã gửi" (theo URL)', 'success');
        return true;
    }
    
    // Kiểm tra tab đang active
    const activeTab = document.querySelector('[aria-selected="true"]');
    if (activeTab) {
        const activeText = activeTab.textContent?.toLowerCase() || '';
        if (activeText.includes('đã gửi') || activeText.includes('sent')) {
            sendLog('✅ Đã ở tab "Xem lời mời đã gửi" (theo aria-selected)', 'success');
            return true;
        }
    }
    
    // Kiểm tra các tab có sẵn
    const allTabs = document.querySelectorAll('[role="tab"], a[href*="sent"], button');
    for (const tab of allTabs) {
        const tabText = tab.textContent?.toLowerCase() || '';
        const tabHref = tab.href || '';
        
        if ((tabText.includes('đã gửi') || tabText.includes('sent') || tabHref.includes('sent')) &&
            (tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active'))) {
            sendLog('✅ Đã ở tab "Xem lời mời đã gửi" (theo class active)', 'success');
            return true;
        }
    }
    
    return false;
}

// Hàm kiểm tra và tự động mở tab nếu cần
function checkAndAutoOpenTab() {
    if (isOnSentRequestsTab()) {
        sendLog('✅ Tab "Xem lời mời đã gửi" đã mở, không cần mở lại', 'info');
        return true;
    } else {
        sendLog('📍 Chưa ở tab "Xem lời mời đã gửi", sẽ tự động mở...', 'info');
        autoOpenSentRequestsTab();
        return false;
    }
}

// Hàm kiểm tra xem có phải trang lời mời kết bạn không
function isOnFriendRequestsPage() {
    return window.location.href.includes('/friends/requests') || 
           document.querySelector('[data-testid*="friend_request"]') ||
           document.querySelector('[aria-label*="lời mời"]');
}

// Hàm click vào tab "Xem lời mời đã gửi" - cải thiện
function clickSentRequestsTab() {
    sendLog('🔍 Đang tìm tab "Xem lời mời đã gửi"...', 'debug');
    
    // Kiểm tra xem đã ở tab này chưa
    if (isOnSentRequestsTab()) {
        sendLog('✅ Đã ở tab "Xem lời mời đã gửi" rồi, không cần click', 'info');
        return true;
    }
    
    // Thử nhiều cách tìm tab
    const methods = [
        // Cách 1: Tìm bằng selector cụ thể
        () => {
            const sentTab = findElement(SELECTORS.sentRequestsTab);
            if (sentTab) {
                sendLog(`✅ Tìm thấy tab bằng selector: ${sentTab.tagName}`, 'success');
                return sentTab;
            }
            return null;
        },
        
        // Cách 2: Tìm bằng text content
        () => {
            const allElements = document.querySelectorAll('*');
            for (const element of allElements) {
                const text = element.textContent?.toLowerCase() || '';
                if ((text.includes('đã gửi') || text.includes('sent')) && 
                    (element.tagName === 'A' || element.tagName === 'BUTTON' || element.getAttribute('role') === 'tab')) {
                    sendLog(`✅ Tìm thấy tab bằng text: "${text}"`, 'success');
                    return element;
                }
            }
            return null;
        },
        
        // Cách 3: Tìm trong tablist
        () => {
            const tablist = document.querySelector('[role="tablist"]');
            if (tablist) {
                const tabs = tablist.querySelectorAll('[role="tab"], a, button');
                for (const tab of tabs) {
                    const text = tab.textContent?.toLowerCase() || '';
                    if (text.includes('đã gửi') || text.includes('sent')) {
                        sendLog(`✅ Tìm thấy tab trong tablist: "${text}"`, 'success');
                        return tab;
                    }
                }
            }
            return null;
        },
        
        // Cách 4: Tìm bằng href
        () => {
            const links = document.querySelectorAll('a[href*="sent"]');
            if (links.length > 0) {
                sendLog(`✅ Tìm thấy ${links.length} link có chứa "sent"`, 'success');
                return links[0];
            }
            return null;
        }
    ];
    
    // Thử từng cách
    for (let i = 0; i < methods.length; i++) {
        const element = methods[i]();
        if (element) {
            try {
                // Scroll đến element
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Click element
                element.click();
                sendLog(`✅ Đã click vào tab "Xem lời mời đã gửi" (cách ${i + 1})`, 'success');
                
                // Không highlight để tránh khó nhìn
                
                return true;
            } catch (error) {
                sendLog(`❌ Lỗi click tab (cách ${i + 1}): ${error.message}`, 'error');
            }
        }
    }
    
    sendLog('❌ Không tìm thấy tab "Xem lời mời đã gửi" bằng bất kỳ cách nào', 'error');
    sendLog('💡 Gợi ý: Hãy đảm bảo bạn đang ở trang facebook.com/friends/requests', 'warning');
    return false;
}

// Hàm tìm và click nút hủy lời mời - đơn giản hóa
function findAndCancelRequest() {
    sendLog(`🔍 Đang tìm thẻ span có text "Hủy lời mời"... (${processedCount + 1}/${cancelCount})`, 'debug');
    
    // Tìm kiếm cụ thể các thẻ span có text "Hủy lời mời"
    const cancelSpans = findSpanCancelButtons();
    if (cancelSpans.length > 0) {
        sendLog(`🎯 Tìm thấy ${cancelSpans.length} thẻ span "Hủy lời mời"`, 'info');
        
        for (const spanInfo of cancelSpans) {
            // Scroll đến element
            spanInfo.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Thử click
            if (clickSpanOrParent(spanInfo)) {
                sendLog(`✅ Đã click hủy lời mời thành công!`, 'success');
                return true;
            }
        }
    }
    
    sendLog('❌ Không tìm thấy thẻ span "Hủy lời mời" nào', 'warning');
    return false;
}

// Hàm debug tất cả elements trên trang
function debugAllElements() {
    sendLog('🔍 DEBUG: Tìm kiếm tất cả elements có text "Hủy"...', 'debug');
    
    // Tìm tất cả elements có chứa text "Hủy"
    const allElements = document.querySelectorAll('*');
    const cancelElements = [];
    
    allElements.forEach(element => {
        const text = element.textContent?.trim() || '';
        if (text.toLowerCase().includes('hủy') || text.toLowerCase().includes('cancel')) {
            cancelElements.push({
                element: element,
                text: text,
                tagName: element.tagName,
                role: element.getAttribute('role') || '',
                ariaLabel: element.getAttribute('aria-label') || '',
                className: element.className || '',
                id: element.id || ''
            });
        }
    });
    
    sendLog(`📊 Tìm thấy ${cancelElements.length} elements có chứa "Hủy"`, 'debug');
    
    // Hiển thị chi tiết các elements
    cancelElements.forEach((item, index) => {
        if (index < 10) { // Chỉ hiển thị 10 elements đầu
            sendLog(`Element ${index + 1}: "${item.text}" | ${item.tagName} | role: ${item.role} | aria: ${item.ariaLabel}`, 'debug');
        }
    });
    
    if (cancelElements.length > 10) {
        sendLog(`... và ${cancelElements.length - 10} elements khác`, 'debug');
    }
}

// Hàm tìm kiếm cụ thể các thẻ span có text "Hủy lời mời"
function findSpanCancelButtons() {
    sendLog('🔍 Tìm kiếm cụ thể các thẻ span có text "Hủy lời mời"...', 'debug');
    
    const allSpans = document.querySelectorAll('span');
    const cancelSpans = [];
    
    allSpans.forEach(span => {
        const text = span.textContent?.trim() || '';
        
        // Tìm chính xác text "Hủy lời mời" hoặc "Cancel request"
        if (text === 'Hủy lời mời' || text === 'Cancel request') {
            cancelSpans.push({
                element: span,
                text: text,
                parent: span.parentElement,
                parentTag: span.parentElement?.tagName || '',
                parentRole: span.parentElement?.getAttribute('role') || '',
                parentClass: span.parentElement?.className || ''
            });
        }
    });
    
    sendLog(`📊 Tìm thấy ${cancelSpans.length} thẻ span có text chính xác "Hủy lời mời"`, 'debug');
    
    // Hiển thị chi tiết các span
    cancelSpans.forEach((item, index) => {
        sendLog(`Span ${index + 1}: "${item.text}" | Parent: ${item.parentTag} | Role: ${item.parentRole}`, 'debug');
    });
    
    return cancelSpans;
}

// Hàm click vào span hoặc parent element của nó
function clickSpanOrParent(spanInfo) {
    const { element: span, parent } = spanInfo;
    
    // Thử click vào span trước
    try {
        span.click();
        sendLog(`✅ Đã click vào span: "${span.textContent}"`, 'success');
        return true;
    } catch (error) {
        sendLog(`⚠️ Không thể click span, thử click parent...`, 'warning');
    }
    
    // Nếu không click được span, thử click vào parent
    if (parent) {
        try {
            parent.click();
            sendLog(`✅ Đã click vào parent element: ${parent.tagName}`, 'success');
            return true;
        } catch (error) {
            sendLog(`❌ Không thể click parent: ${error.message}`, 'error');
        }
    }
    
    return false;
}

// Hàm hủy lời mời với delay
function cancelRequestsWithDelay(count) {
    processedCount = 0;
    cancelCount = count;
    
    sendLog(`🚀 Bắt đầu hủy ${count} lời mời kết bạn...`, 'success');
    
    const cancelNext = () => {
        if (!isCancelling || processedCount >= cancelCount) {
            if (isCancelling) {
                sendLog(`✅ Hoàn thành! Đã hủy ${processedCount}/${cancelCount} lời mời`, 'success');
                sendProgressUpdate(true);
            }
            return;
        }
        
        // Tìm và click nút hủy
        if (findAndCancelRequest()) {
            processedCount++;
            sendLog(`✅ Đã hủy lời mời ${processedCount}/${cancelCount}`, 'success');
            sendProgressUpdate(false);
            
            // Delay trước khi hủy tiếp
            const delay = 2000 + Math.random() * 1000; // 2-3 giây
            sendLog(`⏳ Chờ ${Math.round(delay/1000)}s trước khi tiếp tục...`, 'debug');
            setTimeout(cancelNext, delay);
        } else {
            // Không tìm thấy nút hủy, thử scroll xuống
            sendLog('📜 Scroll xuống để tìm thêm lời mời...', 'debug');
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
    sendLog(`📨 Nhận tin nhắn: ${request.action}`, 'debug');
    
    switch (request.action) {
        case 'startCancelRequests':
            if (!isOnFriendRequestsPage()) {
                sendLog('❌ Không phải trang lời mời kết bạn Facebook', 'error');
                createNotification('Vui lòng mở trang facebook.com/friends/requests trước!', 'error');
                sendResponse({ success: false, error: 'Không phải trang lời mời kết bạn' });
                return;
            }
            
            isCancelling = true;
            cancelCount = request.count;
            
            sendLog(`🎯 Bắt đầu hủy ${request.count} lời mời kết bạn`, 'info');
            
            // Kiểm tra và đảm bảo đang ở tab "Xem lời mời đã gửi"
            setTimeout(() => {
                if (isOnSentRequestsTab()) {
                    sendLog('✅ Đã ở tab "Xem lời mời đã gửi", bắt đầu hủy...', 'success');
                    cancelRequestsWithDelay(cancelCount);
                } else {
                    sendLog('⚠️ Chưa ở tab "Xem lời mời đã gửi", đang mở...', 'warning');
                    const tabOpened = clickSentRequestsTab();
                    
                    if (tabOpened) {
                        // Chờ tab mở rồi mới bắt đầu hủy
                        setTimeout(() => {
                            cancelRequestsWithDelay(cancelCount);
                        }, 3000);
                    } else {
                        sendLog('❌ Không thể mở tab "Xem lời mời đã gửi"', 'error');
                    }
                }
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
            
            sendLog(`⏹️ Đã dừng! Đã hủy ${processedCount}/${cancelCount} lời mời`, 'warning');
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
            sendLog(`🔍 Kiểm tra trang: ${isOnPage ? 'Đúng trang' : 'Sai trang'}`, 'debug');
            sendResponse({ 
                success: true, 
                isOnFriendRequestsPage: isOnPage,
                url: window.location.href 
            });
            break;
            
        default:
            sendLog(`❌ Action không được hỗ trợ: ${request.action}`, 'error');
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
    sendLog('✅ Đã phát hiện trang lời mời kết bạn Facebook', 'success');
    createNotification('Facebook Friend Request Manager đã sẵn sàng! 🎉');
    
    // Debug các element trên trang
    setTimeout(() => {
        debugPageElements();
    }, 1000);
    
    // Tự động mở tab "Xem lời mời đã gửi" sau 3 giây (chỉ nếu chưa mở)
    setTimeout(() => {
        checkAndAutoOpenTab();
    }, 3000);
} else {
    sendLog('ℹ️ Content script đã được tải nhưng chưa ở trang lời mời kết bạn', 'info');
}

// Lắng nghe thay đổi URL để tự động mở tab khi chuyển trang
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        sendLog(`🔄 URL đã thay đổi: ${lastUrl}`, 'debug');
        
        if (isOnFriendRequestsPage()) {
            sendLog('📍 Đã chuyển đến trang lời mời kết bạn, kiểm tra tab...', 'info');
            setTimeout(() => {
                checkAndAutoOpenTab();
            }, 2000);
        }
    }
});

urlObserver.observe(document, { subtree: true, childList: true });
