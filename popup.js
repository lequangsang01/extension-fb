// popup.js - Logic cho Facebook Friend Request Manager
document.addEventListener('DOMContentLoaded', function() {
    const cancelCountInput = document.getElementById('cancelCount');
    const startCancelBtn = document.getElementById('startCancel');
    const stopCancelBtn = document.getElementById('stopCancel');
    const goToRequestsBtn = document.getElementById('goToRequests');
    const refreshPageBtn = document.getElementById('refreshPage');
    const clearLogsBtn = document.getElementById('clearLogs');
    const status = document.getElementById('status');
    const progressFill = document.getElementById('progressFill');
    const processedSpan = document.getElementById('processed');
    const remainingSpan = document.getElementById('remaining');
    const logContainer = document.getElementById('logContainer');
    const igStartBtn = document.getElementById('igStart');
    const igStopBtn = document.getElementById('igStop');
    const igUnfollowCountInput = document.getElementById('igUnfollowCount');
    const igSavedStartBtn = document.getElementById('igSavedStart');
    const igSavedStopBtn = document.getElementById('igSavedStop');
    const igSavedCountInput = document.getElementById('igSavedCount');

    let isRunning = false;
    let processedCount = 0;
    let totalCount = 0;
    let logCount = 0;

    // Hàm thêm log entry
    function addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('vi-VN');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span> ${message}
        `;
        
        logContainer.appendChild(logEntry);
        logCount++;
        
        // Giới hạn số lượng log entries (giữ lại 50 entries gần nhất)
        if (logCount > 50) {
            const firstEntry = logContainer.firstChild;
            if (firstEntry && firstEntry.classList.contains('log-entry')) {
                logContainer.removeChild(firstEntry);
                logCount--;
            }
        }
        
        // Auto scroll xuống cuối
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Hàm cập nhật trạng thái
    function updateStatus(message, isError = false) {
        status.textContent = message;
        status.style.background = isError ? 'rgba(244, 67, 54, 0.3)' : 'rgba(76, 175, 80, 0.3)';
        
        // Thêm vào log
        addLog(message, isError ? 'error' : 'info');
        
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
            addLog('🔍 Đang kiểm tra trang hiện tại...', 'debug');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            addLog(`📍 URL hiện tại: ${tab.url}`, 'debug');
            
            if (tab.url && tab.url.includes('facebook.com')) {
                if (tab.url.includes('/friends/requests')) {
                    addLog('✅ Đã phát hiện trang lời mời kết bạn Facebook!', 'success');
                    updateStatus('✅ Đã phát hiện trang lời mời kết bạn! Sẵn sàng hoạt động.');
                } else {
                    addLog('⚠️ Đang ở Facebook nhưng chưa phải trang lời mời kết bạn', 'warning');
                    updateStatus('⚠️ Vui lòng truy cập facebook.com/friends/requests');
                }
                return true;
            } else {
                addLog('❌ Không phải trang Facebook', 'error');
                updateStatus('⚠️ Vui lòng mở Facebook trước khi sử dụng extension.', true);
                return false;
            }
        } catch (error) {
            addLog(`❌ Lỗi kiểm tra trang: ${error.message}`, 'error');
            updateStatus('❌ Lỗi kiểm tra trang: ' + error.message, true);
            return false;
        }
    }

    // Mở trang lời mời kết bạn
    goToRequestsBtn.addEventListener('click', async () => {
        try {
            addLog('🔗 Đang mở trang lời mời kết bạn...', 'info');
            await chrome.tabs.create({
                url: 'https://www.facebook.com/friends/requests'
            });
            updateStatus('🔗 Đang mở trang lời mời kết bạn...');
        } catch (error) {
            addLog(`❌ Lỗi mở trang: ${error.message}`, 'error');
            updateStatus('❌ Lỗi mở trang: ' + error.message, true);
        }
    });

    // Làm mới trang hiện tại
    refreshPageBtn.addEventListener('click', async () => {
        try {
            addLog('🔄 Đang làm mới trang...', 'info');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.reload(tab.id);
            updateStatus('🔄 Đang làm mới trang...');
        } catch (error) {
            addLog(`❌ Lỗi làm mới trang: ${error.message}`, 'error');
            updateStatus('❌ Lỗi làm mới trang: ' + error.message, true);
        }
    });

    // Xóa log
    clearLogsBtn.addEventListener('click', () => {
        logContainer.innerHTML = '<div class="log-entry info">Log đã được xóa!</div>';
        logCount = 1;
        addLog('🗑️ Đã xóa tất cả log', 'info');
    });

    // Bắt đầu hủy follow Instagram
    igStartBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
                addLog('❌ Không phải Instagram. Hãy mở instagram.com trước.', 'error');
                updateStatus('❌ Hãy mở instagram.com trước.', true);
                return;
            }
            const countVal = parseInt(igUnfollowCountInput.value);
            const count = Number.isFinite(countVal) && countVal > 0 ? countVal : undefined;
            igStartBtn.disabled = true;
            igStopBtn.disabled = false;
            addLog(`🚀 Bắt đầu hủy follow Instagram${count ? ` (${count})` : ' (tới hết)'}`, 'success');
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startUnfollowInstagram',
                count
            });
        } catch (e) {
            addLog(`❌ Lỗi khi bắt đầu IG: ${e.message}`, 'error');
        }
    });

    // Dừng hủy follow Instagram
    igStopBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
                addLog('⚠️ Không ở Instagram.', 'warning');
                return;
            }
            await chrome.tabs.sendMessage(tab.id, { action: 'stopUnfollowInstagram' });
            addLog('⏹️ Đã yêu cầu dừng Instagram', 'warning');
        } catch (e) {
            addLog(`❌ Lỗi khi dừng IG: ${e.message}`, 'error');
        } finally {
            igStartBtn.disabled = false;
            igStopBtn.disabled = true;
        }
    });

    // Bắt đầu xóa bài đã lưu Instagram
    igSavedStartBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
                addLog('❌ Hãy mở instagram.com trước khi xóa bài đã lưu.', 'error');
                updateStatus('❌ Hãy mở instagram.com trước.', true);
                return;
            }
            if (!tab.url.includes('/saved/')) {
                addLog('⚠️ Hãy mở trang saved/all-posts.', 'warning');
                updateStatus('⚠️ Hãy mở trang saved/all-posts.', true);
                return;
            }
            const countVal = parseInt(igSavedCountInput.value);
            const count = Number.isFinite(countVal) && countVal > 0 ? countVal : undefined;
            igSavedStartBtn.disabled = true;
            igSavedStopBtn.disabled = false;
            addLog(`🗑️ Bắt đầu xóa bài đã lưu${count ? ` (${count})` : ' (tới hết)'}`, 'success');
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startDeleteSavedPosts',
                count
            });
        } catch (e) {
            addLog(`❌ Lỗi khi bắt đầu xóa IG saved: ${e.message}`, 'error');
            igSavedStartBtn.disabled = false;
            igSavedStopBtn.disabled = true;
        }
    });

    igSavedStopBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
                addLog('⚠️ Không ở Instagram.', 'warning');
                return;
            }
            await chrome.tabs.sendMessage(tab.id, { action: 'stopDeleteSavedPosts' });
            addLog('⏹️ Đã yêu cầu dừng xóa bài đã lưu', 'warning');
        } catch (e) {
            addLog(`❌ Lỗi khi dừng xóa IG saved: ${e.message}`, 'error');
        } finally {
            igSavedStartBtn.disabled = false;
            igSavedStopBtn.disabled = true;
        }
    });

    // Bắt đầu hủy lời mời
    startCancelBtn.addEventListener('click', async () => {
        const count = parseInt(cancelCountInput.value);
        
        addLog(`🎯 Người dùng muốn hủy ${count} lời mời kết bạn`, 'info');
        
        if (!count || count < 1 || count > 100) {
            addLog('❌ Số lượng không hợp lệ (phải từ 1-100)', 'error');
            updateStatus('❌ Vui lòng nhập số lượng hợp lệ (1-100)', true);
            return;
        }

        const isOnFacebook = await checkCurrentPage();
        if (!isOnFacebook) {
            addLog('❌ Không thể bắt đầu vì không ở trang Facebook', 'error');
            return;
        }

        try {
            isRunning = true;
            processedCount = 0;
            totalCount = count;
            
            startCancelBtn.disabled = true;
            stopCancelBtn.disabled = false;
            cancelCountInput.disabled = true;
            
            addLog(`🚀 Bắt đầu quá trình hủy ${count} lời mời kết bạn...`, 'success');
            updateStatus(`🚀 Bắt đầu hủy ${count} lời mời kết bạn...`);
            updateProgress(0, totalCount);

            // Gửi tin nhắn đến content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            addLog(`📤 Gửi lệnh đến content script (tab ID: ${tab.id})`, 'debug');
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startCancelRequests',
                count: count
            });

        } catch (error) {
            addLog(`❌ Lỗi bắt đầu hủy: ${error.message}`, 'error');
            updateStatus('❌ Lỗi bắt đầu hủy: ' + error.message, true);
            resetButtons();
        }
    });

    // Dừng hủy lời mời
    stopCancelBtn.addEventListener('click', async () => {
        try {
            addLog('⏹️ Người dùng yêu cầu dừng quá trình hủy lời mời', 'warning');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'stopCancelRequests'
            });
            
            addLog(`⏹️ Đã dừng! Đã hủy ${processedCount}/${totalCount} lời mời.`, 'warning');
            updateStatus(`⏹️ Đã dừng! Đã hủy ${processedCount}/${totalCount} lời mời.`);
            resetButtons();
        } catch (error) {
            addLog(`❌ Lỗi dừng: ${error.message}`, 'error');
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
            if (typeof request.total === 'number') {
                totalCount = request.total;
            }
            updateProgress(processedCount, totalCount);
            
            if (request.completed) {
                addLog(`✅ Hoàn thành! Đã hủy ${processedCount} lời mời kết bạn.`, 'success');
                updateStatus(`✅ Hoàn thành! Đã hủy ${processedCount} lời mời kết bạn.`);
                resetButtons();
                igStartBtn.disabled = false;
                igStopBtn.disabled = true;
                igSavedStartBtn.disabled = false;
                igSavedStopBtn.disabled = true;
            } else if (request.error) {
                addLog(`❌ Lỗi từ content script: ${request.error}`, 'error');
                updateStatus(`❌ Lỗi: ${request.error}`, true);
                resetButtons();
                igStartBtn.disabled = false;
                igStopBtn.disabled = true;
                igSavedStartBtn.disabled = false;
                igSavedStopBtn.disabled = true;
            } else {
                addLog(`🔄 Đang hủy lời mời... (${processedCount}/${totalCount})`, 'info');
                updateStatus(`🔄 Đang hủy lời mời... (${processedCount}/${totalCount})`);
            }
        }
        
        if (request.action === 'requestStopped') {
            addLog(`⏹️ Content script đã dừng! Đã hủy ${processedCount}/${totalCount} lời mời.`, 'warning');
            updateStatus(`⏹️ Đã dừng! Đã hủy ${processedCount}/${totalCount} lời mời.`);
            resetButtons();
        }
        
        if (request.action === 'log') {
            addLog(request.message, request.type || 'info');
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