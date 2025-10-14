// background.js - Service Worker cho extension
console.log('Extension Demo: Background script đã được khởi tạo');

// Lắng nghe khi extension được cài đặt
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension Demo: Đã được cài đặt', details);
    
    // Tạo context menu
    chrome.contextMenus.create({
        id: 'extension-demo',
        title: '🚀 Extension Demo',
        contexts: ['page', 'selection']
    });
    
    chrome.contextMenus.create({
        id: 'highlight-text',
        title: 'Highlight văn bản',
        contexts: ['selection'],
        parentId: 'extension-demo'
    });
    
    chrome.contextMenus.create({
        id: 'get-page-info',
        title: 'Lấy thông tin trang',
        contexts: ['page'],
        parentId: 'extension-demo'
    });
    
    // Khởi tạo storage với dữ liệu mặc định
    chrome.storage.local.set({
        'extensionData': {
            installDate: new Date().toISOString(),
            version: '1.0',
            usageCount: 0
        }
    });
});

// Lắng nghe khi context menu được click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('Context menu clicked:', info);
    
    switch (info.menuItemId) {
        case 'highlight-text':
            if (info.selectionText) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'highlightText',
                    text: info.selectionText
                });
            }
            break;
            
        case 'get-page-info':
            chrome.tabs.sendMessage(tab.id, {
                action: 'getPageInfo'
            });
            break;
    }
});

// Lắng nghe khi tab được cập nhật
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('Tab updated:', tab.url);
        
        // Tăng số lần sử dụng
        chrome.storage.local.get(['extensionData'], (result) => {
            if (result.extensionData) {
                result.extensionData.usageCount++;
                chrome.storage.local.set({ 'extensionData': result.extensionData });
            }
        });
    }
});

// Lắng nghe tin nhắn từ content script hoặc popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background nhận tin nhắn:', request);
    
    switch (request.action) {
        case 'getUsageStats':
            chrome.storage.local.get(['extensionData'], (result) => {
                sendResponse({
                    success: true,
                    data: result.extensionData || { usageCount: 0 }
                });
            });
            return true; // Giữ kết nối mở
            
        case 'resetData':
            chrome.storage.local.clear(() => {
                sendResponse({ success: true });
            });
            return true;
            
        case 'exportData':
            chrome.storage.local.get(null, (data) => {
                const exportData = {
                    timestamp: new Date().toISOString(),
                    data: data
                };
                sendResponse({
                    success: true,
                    exportData: JSON.stringify(exportData, null, 2)
                });
            });
            return true;
            
        default:
            sendResponse({ success: false, error: 'Action không được hỗ trợ' });
    }
});

// Lắng nghe khi extension được bật/tắt
chrome.management.onEnabled.addListener((extensionInfo) => {
    if (extensionInfo.id === chrome.runtime.id) {
        console.log('Extension Demo: Đã được bật');
    }
});

chrome.management.onDisabled.addListener((extensionInfo) => {
    if (extensionInfo.id === chrome.runtime.id) {
        console.log('Extension Demo: Đã được tắt');
    }
});

// Xử lý alarm (có thể dùng cho các tác vụ định kỳ)
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);
    
    if (alarm.name === 'dailyStats') {
        // Cập nhật thống kê hàng ngày
        chrome.storage.local.get(['extensionData'], (result) => {
            if (result.extensionData) {
                result.extensionData.lastActiveDate = new Date().toISOString();
                chrome.storage.local.set({ 'extensionData': result.extensionData });
            }
        });
    }
});

// Tạo alarm hàng ngày
chrome.alarms.create('dailyStats', {
    delayInMinutes: 1,
    periodInMinutes: 1440 // 24 giờ
});

// Xử lý khi có lỗi
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension Demo: Service worker đang tạm dừng');
});

// Lắng nghe khi có tab mới được tạo
chrome.tabs.onCreated.addListener((tab) => {
    console.log('Tab mới được tạo:', tab.id);
});
