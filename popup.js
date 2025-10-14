// popup.js - Logic cho Facebook Friend Request Manager
document.addEventListener('DOMContentLoaded', function() {
    const cancelCountInput = document.getElementById('cancelCount');
    const startCancelBtn = document.getElementById('startCancel');
    const stopCancelBtn = document.getElementById('stopCancel');
    const goToRequestsBtn = document.getElementById('goToRequests');
    const refreshPageBtn = document.getElementById('refreshPage');
    const status = document.getElementById('status');
    const progressFill = document.getElementById('progressFill');
    const processedSpan = document.getElementById('processed');
    const remainingSpan = document.getElementById('remaining');

    let isRunning = false;
    let processedCount = 0;
    let totalCount = 0;

    // Hàm cập nhật trạng thái
    function updateStatus(message, isError = false) {
        status.textContent = message;
        status.style.background = isError ? 'rgba(244, 67, 54, 0.3)' : 'rgba(76, 175, 80, 0.3)';
        setTimeout(() => {
            status.style.background = 'rgba(255, 255, 255, 0.1)';
        }, 3000);
    }

    // Hàm cập nhật progress bar
    function updateProgress(processed, total) {
        const percentage = total > 0 ? (processed / total) * 100 : 0;
        progressFill.style.width = percentage + '%';
        processedSpan.textContent = `Đã xử lý: ${processed}`;
        remainingSpan.textContent = `Còn lại: ${total - processed}`;
    }

    // Kiểm tra trang hiện tại có phải Facebook không
    async function checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.url && tab.url.includes('facebook.com')) {
                updateStatus('✅ Đã phát hiện Facebook! Sẵn sàng hoạt động.');
                return true;
            } else {
                updateStatus('⚠️ Vui lòng mở Facebook trước khi sử dụng extension.', true);
                return false;
            }
        } catch (error) {
            updateStatus('❌ Lỗi kiểm tra trang: ' + error.message, true);
            return false;
        }
    }

    // Mở trang lời mời kết bạn
    goToRequestsBtn.addEventListener('click', async () => {
        try {
            await chrome.tabs.create({
                url: 'https://www.facebook.com/friends/requests'
            });
            updateStatus('🔗 Đang mở trang lời mời kết bạn...');
        } catch (error) {
            updateStatus('❌ Lỗi mở trang: ' + error.message, true);
        }
    });

    // Làm mới trang hiện tại
    refreshPageBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.reload(tab.id);
            updateStatus('🔄 Đang làm mới trang...');
        } catch (error) {
            updateStatus('❌ Lỗi làm mới trang: ' + error.message, true);
        }
    });

    // Bắt đầu hủy lời mời
    startCancelBtn.addEventListener('click', async () => {
        const count = parseInt(cancelCountInput.value);
        
        if (!count || count < 1 || count > 100) {
            updateStatus('❌ Vui lòng nhập số lượng hợp lệ (1-100)', true);
            return;
        }

        const isOnFacebook = await checkCurrentPage();
        if (!isOnFacebook) {
            return;
        }

        try {
            isRunning = true;
            processedCount = 0;
            totalCount = count;
            
            startCancelBtn.disabled = true;
            stopCancelBtn.disabled = false;
            cancelCountInput.disabled = true;
            
            updateStatus(`🚀 Bắt đầu hủy ${count} lời mời kết bạn...`);
            updateProgress(0, totalCount);

            // Gửi tin nhắn đến content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startCancelRequests',
                count: count
            });

        } catch (error) {
            updateStatus('❌ Lỗi bắt đầu hủy: ' + error.message, true);
            resetButtons();
        }
    });

    // Dừng hủy lời mời
    stopCancelBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'stopCancelRequests'
            });
            
            updateStatus(`⏹️ Đã dừng! Đã hủy ${processedCount}/${totalCount} lời mời.`);
            resetButtons();
        } catch (error) {
            updateStatus('❌ Lỗi dừng: ' + error.message, true);
        }
    });

    // Reset trạng thái buttons
    function resetButtons() {
        isRunning = false;
        startCancelBtn.disabled = false;
        stopCancelBtn.disabled = true;
        cancelCountInput.disabled = false;
    }

    // Lắng nghe tin nhắn từ content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateProgress') {
            processedCount = request.processed;
            updateProgress(processedCount, totalCount);
            
            if (request.completed) {
                updateStatus(`✅ Hoàn thành! Đã hủy ${processedCount} lời mời kết bạn.`);
                resetButtons();
            } else if (request.error) {
                updateStatus(`❌ Lỗi: ${request.error}`, true);
                resetButtons();
            } else {
                updateStatus(`🔄 Đang hủy lời mời... (${processedCount}/${totalCount})`);
            }
        }
        
        if (request.action === 'requestStopped') {
            updateStatus(`⏹️ Đã dừng! Đã hủy ${processedCount}/${totalCount} lời mời.`);
            resetButtons();
        }
    });

    // Kiểm tra trang khi mở popup
    checkCurrentPage();
    
    // Load settings từ storage
    chrome.storage.local.get(['lastCancelCount'], (result) => {
        if (result.lastCancelCount) {
            cancelCountInput.value = result.lastCancelCount;
        }
    });

    // Save settings khi thay đổi
    cancelCountInput.addEventListener('change', () => {
        chrome.storage.local.set({ 'lastCancelCount': cancelCountInput.value });
    });
});