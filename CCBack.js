// ==UserScript==
// @name         크랙 채팅 백업 떠먹기
// @namespace    http://tampermonkey.net/
// @version      1.05
// @description  [버그 수정 최종판] 내가 쓰려고 만듦, 메시지 양이 많으면 로딩 오래 걸리고, 멈출 때마다 수시로 스크롤 내려줘야 함. 참고하세요.
// @author       오므라이스
// @updateURL    https://github.com/CHOCOiceG/DORAMA/raw/refs/heads/main/CCBack.js
// @downloadURL  https://github.com/CHOCOiceG/DORAMA/raw/refs/heads/main/CCBack.js
// @match        https://crack.wrtn.ai/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // =====================================================================================
    // ✨ 사용자 설정 영역 ✨
    // =====================================================================================
    const MESSAGE_WRAPPER_CLASS = "message-item";
    const AI_ROLE_CLASS = "css-ae5fn1";
    const MESSAGE_CONTENT_CLASS = "css-14pez97";
    // =====================================================================================


    console.log('🚀 크랙 채팅 백업 떠먹기 시작!');
    let backupInProgress = false;
    const turndownService = new TurndownService();

    // --- 핵심 기능 함수들 ---

    function analyzeMessageStructure(element, userName) {
        try {
            const aiRoleElement = element.querySelector(`[class*="${AI_ROLE_CLASS}"]`);
            const isUser = !aiRoleElement;
            const sender = isUser ? userName : aiRoleElement.textContent.trim();
            const content = element.querySelector(`[class*="${MESSAGE_CONTENT_CLASS}"]`);
            const images = content ? Array.from(content.querySelectorAll('img')).map(img => img.src) : [];
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let chatType = 'general';
            const classList = Array.from(element.classList);
            if (classList.some(c => c.includes('superchat-plus'))) chatType = 'superchat-plus';
            else if (classList.some(c => c.includes('superchat'))) chatType = 'superchat';
            else if (classList.some(c => c.includes('powerchat-plus'))) chatType = 'powerchat-plus';
            else if (classList.some(c => c.includes('powerchat'))) chatType = 'powerchat';

            return { sender, content: content || element, timestamp, isUser, images, chatType };
        } catch (e) {
            console.error("메시지 구조 분석 중 오류", e, element);
            return null;
        }
    }

    function findMessageElements() {
        return document.querySelectorAll(`div[class*="${MESSAGE_WRAPPER_CLASS}"]`);
    }

    async function loadAllMessages() {
        updateStatus('🔄 모든 메시지 로딩 중...');
        const messageElements = findMessageElements();
        if (messageElements.length === 0) {
            updateStatus("❌ 메시지를 찾을 수 없어 스크롤할 수 없습니다.");
            return false;
        }
        let scroller = messageElements[0].parentElement;
        for (let i = 0; i < 10 && scroller; i++) {
            if (scroller.scrollHeight > scroller.clientHeight + 5) break;
            scroller = scroller.parentElement;
        }
        if (!scroller) {
            updateStatus("❌ 스크롤 영역을 찾을 수 없습니다.");
            return false;
        }
        let lastHeight = 0;
        let sameHeightCount = 0;
        const maxSameHeightRetries = 20;
        while (sameHeightCount < maxSameHeightRetries) {
            scroller.scrollTo(0, 0);
            await new Promise(r => setTimeout(r, 2000));
            const currentHeight = scroller.scrollHeight;
            if (Math.abs(currentHeight - lastHeight) < 10) {
                sameHeightCount++;
                updateStatus(`... 로딩 확인 중 (${sameHeightCount}/${maxSameHeightRetries})`);
            } else {
                sameHeightCount = 0;
                lastHeight = currentHeight;
                updateStatus(`📜 메시지 로딩 중... (높이: ${currentHeight}px)`);
            }
        }
        updateStatus('✅ 모든 메시지 로딩 완료!');
        return true;
    }

    async function startBackup(format) {
        if (backupInProgress) return;
        backupInProgress = true;
        const menu = document.getElementById('backup-menu');
        let userName = prompt("백업에 사용할 사용자 이름을 입력하세요:", "사용자");
        if (!userName || userName.trim() === "") userName = "사용자";

        try {
            updateStatus('🚀 백업 프로세스 시작...');
            const loaded = await loadAllMessages();
            if (!loaded) {
                backupInProgress = false;
                return;
            }
            const finalMessages = findMessageElements();
            if (finalMessages.length === 0) {
                updateStatus('❌ 설정된 클래스로 메시지를 찾지 못했습니다.');
                backupInProgress = false;
                return;
            }
            const data = Array.from(finalMessages).map(el => analyzeMessageStructure(el, userName)).filter(Boolean);
            if (data.length === 0) {
                updateStatus('❌ 백업할 메시지가 없습니다.');
                backupInProgress = false;
                return;
            }
            const filename = `크랙채팅_백업_${new Date().toISOString().split('T')[0]}`;
            if (format === 'html' || format === 'both') {
                updateStatus('🌐 HTML 파일 생성 중...');
                await new Promise(r => setTimeout(r, 100));
                downloadFile(generateHTML(data), filename + '.html', 'text/html;charset=utf-8');
            }
            if (format === 'txt' || format === 'both') {
                updateStatus('📄 TXT 파일 생성 중...');
                await new Promise(r => setTimeout(r, 100));
                downloadFile(generateTXT(data), filename + '.txt', 'text/plain;charset=utf-8');
            }
            updateStatus(`✅ 백업 완료! (${data.length}개)`);
        } catch (error) {
            console.error('백업 중 오류 발생:', error);
            updateStatus('❌ 오류 발생! 콘솔 확인');
        } finally {
            setTimeout(() => {
                if (menu) menu.remove();
                backupInProgress = false;
            }, 3000);
        }
    }


    // --- 유틸리티 및 UI 함수들 ---

    function updateStatus(message) {
        const statusDiv = document.getElementById('backup-status');
        if (statusDiv) {
            statusDiv.innerHTML = message;
        }
        console.log('📋 상태:', message);
    }

    function createBackupButton() {
        const existingBtn = document.getElementById('crack-backup-btn');
        if (existingBtn) existingBtn.remove();

        const targetContainer = document.querySelector('.css-8pkwc8.eh9908w0');
        if (!targetContainer) {
            setTimeout(createBackupButton, 1000);
            return;
        }
        const backupBtn = document.createElement('button');
        backupBtn.id = 'crack-backup-btn';
        backupBtn.innerHTML = '📚 백업';
        backupBtn.style.cssText = "margin-left:8px;padding:8px 12px;background:linear-gradient(45deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s ease";
        backupBtn.addEventListener('mouseenter', () => backupBtn.style.transform = 'scale(1.05)');
        backupBtn.addEventListener('mouseleave', () => backupBtn.style.transform = 'scale(1)');
        backupBtn.addEventListener('click', showBackupMenu);
        targetContainer.appendChild(backupBtn);
    }

    function showBackupMenu(event) {
        event.stopPropagation();
        if (backupInProgress) return;
        const existingMenu = document.getElementById('backup-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }
        const menu = document.createElement('div');
        menu.id = 'backup-menu';
        const rect = document.getElementById('crack-backup-btn').getBoundingClientRect();
        menu.style.cssText = `position:fixed!important;background:rgba(255,255,255,.8)!important;border-radius:12px!important;padding:15px!important;z-index:1000000!important;backdrop-filter:blur(10px)!important;box-shadow:0 8px 32px rgba(0,0,0,.1)!important;width:150px;border:1px solid #d0d7de;bottom:${window.innerHeight - rect.top + 10}px;right:${window.innerWidth - rect.right}px`;
        menu.innerHTML = `<div style="color:#1f2328;font-size:14px;font-weight:700;margin-bottom:10px;text-align:center">📚 채팅 백업</div><button id="backup-html" class="backup-option-btn" style="background:#2da44e">🌐 HTML로 백업</button><button id="backup-txt" class="backup-option-btn" style="background:#0969da">📄 TXT로 백업</button><button id="backup-both" class="backup-option-btn" style="background:#d29922">📦 둘 다 백업</button><div id="backup-status" style="color:#57606a;font-size:11px;margin-top:12px;text-align:center;min-height:16px"></div>`;
        document.body.appendChild(menu);
        GM_addStyle(".backup-option-btn{display:block;width:100%;margin:5px 0;padding:8px;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;transition:opacity .2s}.backup-option-btn:hover{opacity:.8}");
        document.getElementById('backup-html').addEventListener('click', () => startBackup('html'));
        document.getElementById('backup-txt').addEventListener('click', () => startBackup('txt'));
        document.getElementById('backup-both').addEventListener('click', () => startBackup('both'));
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    function generateHTML(data) {
        const title = document.title || '크랙 채팅';
        const date = new Date().toLocaleDateString();
        return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>📚 ${title} - 백업</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;background:#fff;color:#1f2328}.header{text-align:center;margin-bottom:30px;border-bottom:1px solid #d0d7de;padding-bottom:20px}.header h1{background:linear-gradient(45deg,#0969da,#2a09da);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.message{margin:15px 0;display:flex;align-items:flex-end;gap:10px}.message.user{justify-content:flex-end}.message-bubble{max-width:75%;padding:12px 18px;border-radius:18px;box-shadow:0 1px 2px rgba(0,0,0,.1)}.message.user .message-bubble{background:#ddf4ff;border:1px solid #a2d9ff}.message:not(.user) .message-bubble{background:#f6f8fa;border:1px solid #d0d7de}.message.superchat .message-bubble{border-left:4px solid #87ceeb}.message.superchat-plus .message-bubble{border-left:4px solid #9370db}.message.powerchat .message-bubble{border-left:4px solid #98fb98}.message.powerchat-plus .message-bubble{border-left:4px solid #ffa07a}.message.general .message-bubble{border-left:4px solid #d0d7de}.sender{font-weight:700;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:5px}.timestamp{font-size:11px;color:#57606a;margin-left:auto}.content{line-height:1.6;word-wrap:break-word}.content img{max-width:100%;border-radius:8px;margin-top:10px;border:1px solid #d0d7de}.nav{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:10px}.nav a{display:flex;justify-content:center;align-items:center;width:40px;height:40px;background:rgba(255,255,255,.8);backdrop-filter:blur(5px);color:#1f2328;text-decoration:none;border-radius:50%;font-size:20px;transition:all .2s;border:1px solid #d0d7de}.nav a:hover{background:#0969da;color:#fff;border-color:#0969da}code:not(pre code){background:#d0d7de;padding:3px 6px;border-radius:4px;font-family:"D2Coding",monospace}pre{background:#f6f8fa;border-radius:8px;padding:12px;border:1px solid #d0d7de}pre code{font-family:"D2Coding",monospace!important}ul,ol{padding-left:20px}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}em{font-style:normal;color:#57606a}</style></head><body><a id="top"></a><div class="header"><h1>📚 채팅 백업</h1><p>${title} - ${date}</p><p>총 ${data.length}개 메시지</p></div>${data.map(msg=>`<div class="message ${msg.isUser?"user":""} ${msg.chatType}"><div class="message-bubble"><div class="sender">${msg.isUser?"👤":"🤖"} ${msg.sender}<span class="timestamp">${msg.timestamp}</span></div><div class="content">${msg.content?msg.content.innerHTML:"내용 없음"}</div></div></div>`).join("")}<div id="bottom"></div><div class="nav"><a href="#top">⏫</a><a href="#bottom">⏬</a></div><script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script><script>hljs.highlightAll()<\/script></body></html>`;
    }

    function htmlToMarkdown(htmlElement) {
        if (!htmlElement) return " ";
        htmlElement.querySelectorAll("pre code").forEach(e => { e.innerHTML = e.innerHTML.replace(/<br\s*\/?>/gi, "\n") });
        return turndownService.turndown(htmlElement.innerHTML || "");
    }

    function generateTXT(data) {
        const title = document.title || '크랙 채팅';
        const date = new Date().toLocaleDateString();
        let txt = `📚 ${title} - 채팅 백업\n날짜: ${date}\n총 ${data.length}개 메시지\n${'='.repeat(50)}\n\n`;
        data.forEach((msg, i) => {
            const senderIcon = msg.isUser ? '👤' : '🤖';
            txt += `[${i + 1}] ${senderIcon} ${msg.sender} (${msg.timestamp})\n${htmlToMarkdown(msg.content)}\n`;
            if (msg.images.length > 0) {
                txt += `\n[이미지]:\n${msg.images.join('\n')}\n`;
            }
            txt += `${'-'.repeat(40)}\n\n`;
        });
        return txt;
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function init() {
        setTimeout(createBackupButton, 2000);
    }

    let currentURL = location.href;
    const observer = new MutationObserver(() => {
        if (location.href !== currentURL) {
            currentURL = location.href;
            init();
        }
    });
    if (document.body) {
        observer.observe(document.body, { subtree: true, childList: true });
    }
    window.addEventListener('load', init);

})();
