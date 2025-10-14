// popup.js - Logic cho popup extension
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessage');
    const changeColorBtn = document.getElementById('changeColor');
    const getPageInfoBtn = document.getElementById('getPageInfo');
    const saveDataBtn = document.getElementById('saveData');
    const loadDataBtn = document.getElementById('loadData');
    const status = document.getElementById('status');

    // Hàm cập nhật trạng thái
    function updateStatus(message) {
        status.textContent = message;
        status.style.background = 'rgba(76, 175, 80, 0.3)';
        setTimeout(() => {
            status.style.background = 'rgba(255, 255, 255, 0.1)';
        }, 2000);
    }

    // Gửi tin nhắn đến content script
    sendMessageBtn.addEventListener('click', async () => {
        const message = messageInput.value.trim();
        if (!message) {
            updateStatus('Vui lòng nhập tin nhắn!');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'showMessage',
                message: message
            });
            updateStatus('Tin nhắn đã được gửi!');
            messageInput.value = '';
        } catch (error) {
            updateStatus('Lỗi: ' + error.message);
        }
    });

    // Đổi màu trang web
    changeColorBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'changeColor'
            });
            updateStatus('Màu trang đã được thay đổi!');
        } catch (error) {
            updateStatus('Lỗi: ' + error.message);
        }
    });

    // Lấy thông tin trang web
    getPageInfoBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pageInfo = {
                title: tab.title,
                url: tab.url,
                timestamp: new Date().toLocaleString('vi-VN')
            };
            
            updateStatus(`Trang: ${pageInfo.title}`);
            
            // Lưu thông tin vào storage
            await chrome.storage.local.set({ 'lastPageInfo': pageInfo });
        } catch (error) {
            updateStatus('Lỗi: ' + error.message);
        }
    });

    // Lưu dữ liệu
    saveDataBtn.addEventListener('click', async () => {
        const data = {
            savedAt: new Date().toLocaleString('vi-VN'),
            message: messageInput.value.trim() || 'Không có tin nhắn',
            randomNumber: Math.floor(Math.random() * 1000)
        };

        try {
            await chrome.storage.local.set({ 'userData': data });
            updateStatus('Dữ liệu đã được lưu!');
        } catch (error) {
            updateStatus('Lỗi lưu dữ liệu: ' + error.message);
        }
    });

    // Tải dữ liệu
    loadDataBtn.addEventListener('click', async () => {
        try {
            const result = await chrome.storage.local.get(['userData', 'lastPageInfo']);
            
            if (result.userData) {
                updateStatus(`Dữ liệu: ${result.userData.message} (${result.userData.savedAt})`);
                messageInput.value = result.userData.message;
            } else {
                updateStatus('Không có dữ liệu được lưu');
            }
        } catch (error) {
            updateStatus('Lỗi tải dữ liệu: ' + error.message);
        }
    });

    // Tải dữ liệu khi mở popup
    loadDataBtn.click();
});
