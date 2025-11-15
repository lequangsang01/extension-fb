// instagram-content.js - Tự động hủy follow trên Instagram
console.log('Instagram Unfollow Manager: Content script đã được tải');

let igIsRunning = false;
let igProcessed = 0;
let igTarget = Infinity; // chạy tới hết mặc định
let igAttemptsWithoutNew = 0;

let igSavedRunning = false;
let igSavedProcessed = 0;
let igSavedTarget = Infinity;
const igSavedVisited = new Set();

function igSendLog(message, type = 'info') {
	console.log(`[IG] ${message}`);
	try {
		chrome.runtime.sendMessage({ action: 'log', message: `[IG] ${message}`, type });
	} catch (_) {}
}

function igCreateNotification(message, type = 'info') {
	const el = document.createElement('div');
	el.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: ${type === 'error' ? '#f44336' : '#4caf50'};
		color: white;
		padding: 12px 16px;
		border-radius: 10px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		z-index: 2147483647;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		font-size: 13px;
	`;
	el.textContent = message;
	document.body.appendChild(el);
	setTimeout(() => el.remove(), 2500);
}

function igIsOnInstagram() {
	return location.hostname.includes('instagram.com');
}

// Tìm các nút "Following" (hoặc "Đang theo dõi")
function igFindFollowingButtons() {
	const buttons = Array.from(document.querySelectorAll('button'));
	return buttons.filter((btn) => {
		const txt = (btn.textContent || '').trim().toLowerCase();
		if (!txt) return false;
		// Các biến thể phổ biến
		return txt === 'following' || txt === 'đang theo dõi';
	});
}

// Chờ popup xác nhận rồi click "Unfollow"
async function igConfirmUnfollow() {
	const timeoutMs = 4000;
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		// Instagram popup button thường có text 'Unfollow'
		const confirmButtons = Array.from(document.querySelectorAll('button')).filter((b) => {
			const t = (b.textContent || '').trim().toLowerCase();
			return t === 'unfollow';
		});
		if (confirmButtons.length > 0) {
			confirmButtons[0].click();
			return true;
		}
		// Một số giao diện có class như _a9-- _ap36 _a9-_
		const classButtons = Array.from(document.querySelectorAll('button._a9--._ap36._a9-_'));
		if (classButtons.length > 0) {
			classButtons[0].click();
			return true;
		}
		await new Promise((r) => setTimeout(r, 120));
	}
	return false;
}

async function igProcessOne() {
	// Luôn tìm mới mỗi lần để tránh stale elements
	const followingButtons = igFindFollowingButtons();
	if (followingButtons.length === 0) {
		return false;
	}
	// Click nút đầu tiên trên màn hình
	const btn = followingButtons[0];
	btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
	await new Promise((r) => setTimeout(r, 150));
	btn.click();
	const ok = await igConfirmUnfollow();
	if (ok) {
		igProcessed++;
		igSendProgress(false);
		igSendLog(`Đã unfollow: ${igProcessed}`, 'success');
		return true;
	}
	return false;
}

function igSendProgress(completed = false, error = null) {
	try {
		chrome.runtime.sendMessage({
			action: 'updateProgress',
			processed: igProcessed,
			total: Number.isFinite(igTarget) ? igTarget : igProcessed,
			completed,
			error
		});
	} catch (_) {}
}

async function igScrollForMore() {
	// Thử scroll trong modal (nếu đang ở danh sách following dạng popup), nếu không thì scroll trang
	const modalScroll = document.querySelector('[role="dialog"] [style*="overflow"]') ||
		document.querySelector('[role="dialog"] [class*="x"] [style*="overflow"]');
	if (modalScroll && modalScroll.scrollHeight > modalScroll.clientHeight) {
		modalScroll.scrollBy({ top: modalScroll.clientHeight * 0.9, behavior: 'smooth' });
	} else {
		window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
	}
	await new Promise((r) => setTimeout(r, 600));
}

async function igRunLoop() {
	igSendLog('Bắt đầu hủy follow Instagram...', 'info');
	igCreateNotification('Bắt đầu hủy follow Instagram...');
	igAttemptsWithoutNew = 0;

	while (igIsRunning && (igProcessed < igTarget)) {
		const ok = await igProcessOne();
		if (!igIsRunning) break;

		if (ok) {
			igAttemptsWithoutNew = 0;
			// delay ngẫu nhiên nhẹ để tránh bị rate-limit
			const delay = 1200 + Math.random() * 800;
			await new Promise((r) => setTimeout(r, delay));
			continue;
		}

		igAttemptsWithoutNew++;
		if (igAttemptsWithoutNew >= 3) {
			// Thử scroll nạp thêm
			await igScrollForMore();
			// Nếu vẫn không có, thử thêm 2 vòng
			const okAfterScroll = await igProcessOne();
			if (!okAfterScroll) {
				igAttemptsWithoutNew++;
			} else {
				igAttemptsWithoutNew = 0;
			}
		}

		// Nếu đã thử nhiều lần mà không còn nút nào => kết thúc
		if (igAttemptsWithoutNew >= 5) {
			igSendLog('Không còn nút "Following" nào. Kết thúc.', 'warning');
			break;
		}
	}

	igIsRunning = false;
	igSendProgress(true);
	igCreateNotification(`Hoàn tất. Đã unfollow: ${igProcessed}`, 'success');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'startUnfollowInstagram') {
		if (!igIsOnInstagram()) {
			igCreateNotification('Vui lòng mở instagram.com trước!', 'error');
			sendResponse({ success: false, error: 'Not on Instagram' });
			return true;
		}
		if (igIsRunning) {
			sendResponse({ success: false, error: 'Đang chạy' });
			return true;
		}
		igProcessed = 0;
		igTarget = typeof request.count === 'number' && request.count > 0 ? request.count : Infinity;
		igIsRunning = true;
		igSendProgress(false);
		igRunLoop();
		sendResponse({ success: true });
		return true;
	}
	if (request.action === 'stopUnfollowInstagram') {
		igIsRunning = false;
		igCreateNotification(`Đã dừng. Đã unfollow: ${igProcessed}`);
		sendResponse({ success: true });
		return true;
	}
	if (request.action === 'startDeleteSavedPosts') {
		if (!igIsOnSavedPostsPage()) {
			igCreateNotification('Vui lòng mở trang saved/all-posts trước!', 'error');
			sendResponse({ success: false, error: 'Not on saved posts page' });
			return true;
		}
		if (igSavedRunning) {
			sendResponse({ success: false, error: 'Đang xóa bài đã lưu' });
			return true;
		}
		igSavedProcessed = 0;
		igSavedVisited.clear();
		igSavedTarget = typeof request.count === 'number' && request.count > 0 ? request.count : Infinity;
		igSavedRunning = true;
		igSendSavedProgress(false);
		igRunDeleteSavedLoop();
		sendResponse({ success: true });
		return true;
	}
	if (request.action === 'stopDeleteSavedPosts') {
		igSavedRunning = false;
		igCreateNotification(`Đã dừng xóa bài đã lưu. Đã xóa: ${igSavedProcessed}`);
		sendResponse({ success: true });
		return true;
	}
	return false;
});

// Thông báo sẵn sàng khi ở Instagram
if (igIsOnInstagram()) {
	igSendLog('Instagram Unfollow Manager sẵn sàng', 'success');
}

// ====== Xóa bài viết đã lưu (Saved posts) ======

function igIsOnSavedPostsPage() {
	return location.pathname.includes('/saved/all-posts');
}

function igFindNextSavedLink() {
	const candidates = Array.from(document.querySelectorAll('a[href^="/p/"]:not([data-ig-saved-processed])'));
	return candidates.find((link) => {
		const href = link.getAttribute('href');
		return href && !igSavedVisited.has(href);
	}) || null;
}

async function igWaitForDialog(timeout = 5000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const dialog = document.querySelector('[role="dialog"]') || document.querySelector('div[aria-label="Close"]')?.parentElement;
		if (dialog) return dialog;
		await new Promise((r) => setTimeout(r, 100));
	}
	return null;
}

async function igClickRemoveButton(timeout = 5000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const titleNodes = Array.from(document.querySelectorAll('title'));
		const removeNode = titleNodes.find((t) => t.textContent?.trim().toLowerCase() === 'remove');
		if (removeNode) {
			const clickable =
				removeNode.closest('button, [role="button"], div[role="button"]') ||
				removeNode.parentElement?.closest('button, [role="button"], div[role="button"]');
			if (clickable) {
				clickable.click();
				return true;
			}
		}
		await new Promise((r) => setTimeout(r, 120));
	}
	return false;
}

async function igCloseSavedDialog(timeout = 5000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		let closeBtn =
			document.querySelector('button[aria-label="Close"]') ||
			document.querySelector('[role="dialog"] button[aria-label][aria-label*="Close"]');
		if (!closeBtn) {
			const closeSvg = document.querySelector('svg[aria-label="Close"]');
			if (closeSvg) {
				closeBtn = closeSvg.closest('button') || closeSvg.parentElement;
			}
		}
		if (!closeBtn) {
			const lineIcon = document.querySelector('line[x1="20.649"][x2="3.354"][y1="20.649"][y2="3.354"]');
			if (lineIcon) {
				closeBtn = lineIcon.closest('button') || lineIcon.closest('svg')?.parentElement;
			}
		}
		if (closeBtn) {
			closeBtn.click();
			return true;
		}
		await new Promise((r) => setTimeout(r, 120));
	}
	return false;
}

async function igProcessSavedPost() {
	const link = igFindNextSavedLink();
	if (!link) return false;

	const href = link.getAttribute('href');
	if (href) igSavedVisited.add(href);
	link.dataset.igSavedProcessed = 'true';

	link.scrollIntoView({ behavior: 'smooth', block: 'center' });
	await new Promise((r) => setTimeout(r, 200));
	link.click();

	const dialog = await igWaitForDialog();
	if (!dialog) {
		igSendLog('Không mở được dialog bài viết đã lưu', 'warning');
		return false;
	}

	const removed = await igClickRemoveButton();
	if (!removed) {
		igSendLog('Không tìm thấy nút Remove', 'warning');
		await igCloseSavedDialog();
		return false;
	}

	await new Promise((r) => setTimeout(r, 200));
	await igCloseSavedDialog();

	igSavedProcessed++;
	igSendSavedProgress(false);
	igSendLog(`Đã xóa bài đã lưu: ${igSavedProcessed}`, 'success');
	return true;
}

function igSendSavedProgress(completed = false, error = null) {
	try {
		chrome.runtime.sendMessage({
			action: 'updateProgress',
			processed: igSavedProcessed,
			total: Number.isFinite(igSavedTarget) ? igSavedTarget : igSavedProcessed,
			completed,
			error
		});
	} catch (_) {}
}

async function igScrollSavedPage() {
	window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
	await new Promise((r) => setTimeout(r, 800));
}

async function igRunDeleteSavedLoop() {
	igSendLog('Bắt đầu xóa bài viết đã lưu trên Instagram...', 'info');
	igCreateNotification('Bắt đầu xóa bài viết đã lưu...');
	let attempts = 0;

	while (igSavedRunning && igSavedProcessed < igSavedTarget) {
		const ok = await igProcessSavedPost();
		if (!igSavedRunning) break;

		if (ok) {
			attempts = 0;
			await new Promise((r) => setTimeout(r, 700));
			continue;
		}

		attempts++;
		if (attempts >= 3) {
			await igScrollSavedPage();
		}
		if (attempts >= 6) {
			igSendLog('Không còn bài viết đã lưu để xóa.', 'warning');
			break;
		}
	}

	igSavedRunning = false;
	igSendSavedProgress(true);
	igCreateNotification(`Hoàn tất xóa bài đã lưu: ${igSavedProcessed}`, 'success');
}




