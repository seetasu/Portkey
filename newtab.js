document.addEventListener('DOMContentLoaded', function() {
    setupGreeting();
    loadBookmarks();
});

function loadBookmarks() {
    chrome.bookmarks.getTree(function(bookmarkTreeNodes) {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        displayBookmarks(bookmarkTreeNodes);
    });
}

function displayBookmarks(bookmarkNodes) {
    const bookmarksDiv = document.getElementById('bookmarks');
    // 清空现有内容，但保留问候语
    const greetingContainer = bookmarksDiv.querySelector('.greeting-container');
    bookmarksDiv.innerHTML = '';
    if (greetingContainer) {
        bookmarksDiv.appendChild(greetingContainer);
    }
    
    // 存储所有顶层文件夹
    const folders = new Map(); // 使用 Map 来跟踪文件夹
    
    function processBookmarks(nodes, level = 0) {
        nodes.forEach(node => {
            if (node.children) {
                // 只为顶层文件夹创建文件夹元素
                if (level === 0) {
                    const folderDiv = document.createElement('div');
                    folderDiv.className = 'bookmark-folder';
                    
                    const folderName = document.createElement('div');
                    folderName.className = 'folder-name';
                    folderName.textContent = node.title || '未命名文件夹';
                    folderDiv.appendChild(folderName);
                    
                    // 处理所有子书签（包括子文件夹中的书签）
                    processBookmarkItems(node, folderDiv);
                    
                    if (folderDiv.children.length > 1) { // 如果文件夹不为空
                        folders.set(node.id, folderDiv);
                    }
                }
                
                // 递归处理子文件夹中的书签
                node.children.forEach(child => {
                    if (child.children) {
                        processBookmarks([child], level + 1);
                    }
                });
            }
        });
    }
    
    function processBookmarkItems(folderNode, folderDiv) {
        // 处理文件夹中的所有书签（包括子文件夹中的）
        function processItems(node) {
            if (!node.children) {
                const bookmarkElement = createBookmarkElement(node);
                if (bookmarkElement) {
                    folderDiv.appendChild(bookmarkElement);
                }
            } else {
                node.children.forEach(processItems);
            }
        }
        
        folderNode.children.forEach(processItems);
    }
    
    processBookmarks(bookmarkNodes[0].children);
    
    // 将所有文件夹添加到页面
    folders.forEach(folder => {
        if (folder.children.length > 1) {
            bookmarksDiv.appendChild(folder);
        }
    });
}

function createBookmarkElement(node) {
    if (!node.url) return null;
    
    const bookmarkDiv = document.createElement('div');
    bookmarkDiv.className = 'bookmark-item';
    bookmarkDiv.dataset.bookmarkId = node.id;
    
    bookmarkDiv.draggable = true;
    
    const icon = document.createElement('img');
    icon.alt = '图标';
    icon.className = 'bookmark-icon';
    tryGetFavicon(node.url, icon);
    
    const link = document.createElement('a');
    link.href = node.url;
    link.textContent = node.title || node.url;
    
    bookmarkDiv.addEventListener('dragstart', handleDragStart);
    bookmarkDiv.addEventListener('dragend', handleDragEnd);
    bookmarkDiv.addEventListener('dragover', handleDragOver);
    bookmarkDiv.addEventListener('dragleave', handleDragLeave);
    bookmarkDiv.addEventListener('drop', handleDrop);
    
    bookmarkDiv.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showContextMenu(e, node);
    });
    
    bookmarkDiv.addEventListener('click', function(e) {
        if (!isDragging) {
            window.location.href = node.url;
        }
    });
    
    icon.addEventListener('click', e => e.stopPropagation());
    link.addEventListener('click', e => e.stopPropagation());
    
    bookmarkDiv.appendChild(icon);
    bookmarkDiv.appendChild(link);
    
    return bookmarkDiv;
}

let draggedElement = null;
let isDragging = false;

function handleDragStart(e) {
    isDragging = true;
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.bookmarkId);
}

function handleDragEnd(e) {
    isDragging = false;
    this.classList.remove('dragging');
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    if (this !== draggedElement) {
        // 移除其他元素的效果
        document.querySelectorAll('.bookmark-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        // 添加当前元素的效果
        this.classList.add('drag-over');
    }
    
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    if (this === draggedElement) return;
    
    const draggedId = e.dataTransfer.getData('text/plain');
    const dropId = this.dataset.bookmarkId;
    const dropTarget = this;
    
    chrome.bookmarks.get([draggedId, dropId], (nodes) => {
        if (chrome.runtime.lastError) return;
        
        const draggedNode = nodes.find(node => node.id === draggedId);
        const dropNode = nodes.find(node => node.id === dropId);
        
        if (!draggedNode || !dropNode) return;
        
        let newIndex = dropNode.index;
        if (draggedNode.index > dropNode.index) {
            newIndex = dropNode.index;
        } else {
            newIndex = dropNode.index + 1;
        }

        const draggedElement = document.querySelector(`[data-bookmark-id="${draggedId}"]`);
        const dropElement = document.querySelector(`[data-bookmark-id="${dropId}"]`);
        const bookmarksContainer = draggedElement.parentNode;
        
        // 获取所有需要移动的书签
        const bookmarks = Array.from(bookmarksContainer.querySelectorAll('.bookmark-item'));
        const draggedRect = draggedElement.getBoundingClientRect();
        const dropRect = dropElement.getBoundingClientRect();
        
        // 计算移动距离
        const moveDistance = dropRect.top - draggedRect.top;
        
        // 保存每个元素的初始位置
        bookmarks.forEach(bookmark => {
            const rect = bookmark.getBoundingClientRect();
            bookmark.dataset.initialTop = rect.top;
        });
        
        // 先移除拖拽中的样式
        draggedElement.classList.remove('dragging');
        dropElement.classList.remove('drag-over');
        
        // 执行移动
        if (draggedNode.index > dropNode.index) {
            bookmarksContainer.insertBefore(draggedElement, dropElement);
        } else {
            bookmarksContainer.insertBefore(draggedElement, dropElement.nextSibling);
        }
        
        // 为每个移动的元素添加过渡效果
        bookmarks.forEach(bookmark => {
            if (bookmark !== draggedElement) {
                const newRect = bookmark.getBoundingClientRect();
                const initialTop = parseFloat(bookmark.dataset.initialTop);
                const deltaY = initialTop - newRect.top;
                
                // 设置初始位置
                bookmark.style.transform = `translateY(${deltaY}px)`;
                
                // 强制重绘
                bookmark.offsetHeight;
                
                // 添加过渡效果并移动到新位置
                bookmark.style.transition = 'transform 0.3s ease';
                bookmark.style.transform = 'translateY(0)';
                
                // 清理
                setTimeout(() => {
                    bookmark.style.transition = '';
                    bookmark.style.transform = '';
                    delete bookmark.dataset.initialTop;
                }, 300);
            }
        });
        
        // 添加完成动画
        draggedElement.classList.add('drop-success');
        
        // 更新书签数据
        chrome.bookmarks.move(draggedId, {
            parentId: dropNode.parentId,
            index: newIndex
        }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                loadBookmarks();
                return;
            }
            
            setTimeout(() => {
                draggedElement.classList.remove('drop-success');
            }, 300);
        });
    });
    
    return false;
}

function showContextMenu(event, bookmark) {
    const oldMenu = document.querySelector('.context-menu');
    if (oldMenu) {
        oldMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const renameOption = document.createElement('div');
    renameOption.className = 'menu-item';
    renameOption.textContent = '重命名';
    renameOption.onclick = () => {
        const newTitle = prompt('请输入新的名称：', bookmark.title);
        if (newTitle) {
            chrome.bookmarks.update(bookmark.id, { title: newTitle }, () => {
                location.reload();
            });
        }
    };

    const deleteOption = document.createElement('div');
    deleteOption.className = 'menu-item';
    deleteOption.textContent = '删除';
    deleteOption.onclick = () => {
        if (confirm('确定要删除这个书签吗？')) {
            chrome.bookmarks.remove(bookmark.id, () => {
                location.reload();
            });
        }
    };

    menu.appendChild(renameOption);
    menu.appendChild(deleteOption);
    document.body.appendChild(menu);

    document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
    });
}

function tryGetFavicon(url, icon) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        if (hostname.includes('codehub-g.huawei.com')) {
            icon.src = 'img/codehub.png';
            return;
        }
        
        if (hostname.includes('octo-cd.hdesign.huawei.com') || hostname.includes('octo.hdesign.huawei.com')) {
            icon.src = 'img/octo.png';
            return;
        }
        
        icon.onerror = function() {
            const hostname = urlObj.origin;
            const faviconPaths = [
                `${hostname}/favicon.ico`,
                `${hostname}/favicon.png`,
                `${hostname}/static/favicon.ico`,
                `${hostname}/images/favicon.ico`,
                `${hostname}/static/images/favicon.ico`,
            ];

            let currentIndex = 0;

            function tryNextPath() {
                if (currentIndex < faviconPaths.length) {
                    icon.src = faviconPaths[currentIndex];
                    currentIndex++;
                } else {
                    icon.src = getDefaultIcon();
                }
            }

            icon.onerror = tryNextPath;
            tryNextPath();
        };

        icon.src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;

    } catch (e) {
        icon.src = getDefaultIcon();
    }
}

function getDefaultIcon() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyVpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDAyIDc5LjE2NDQ4OCwgMjAyMC8wNy8xMC0yMjowNjo1MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjAgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6Y0YwNEE1MzQ5RDY1NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpBNjA5RTM0OUQ2NTYxMUUwOEQ2QUU2RDg5QkM4NzY1NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkE2MDlFMzQ2RDY1NjExRTA4RDZBRTZEOEI5QkM4NzY1NiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBNjA5RTM0N0Q2NTYxMUUwOEQ2QUU2RDg5QkM4NzY1NiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAAAALAAAAAAQABAAAAIRhI+py+0Po5y02ouz3rz7rxUAOw==';
}

function setupGreeting() {
    const greetingElement = document.getElementById('greeting');
    const usernameElement = document.getElementById('username');
    
    function updateGreeting() {
        const hour = new Date().getHours();
        let greeting = '';
        
        if (hour >= 5 && hour < 12) {
            greeting = '早上好，';
        } else if (hour >= 12 && hour < 14) {
            greeting = '中午好，';
        } else if (hour >= 14 && hour < 18) {
            greeting = '下午好，';
        } else {
            greeting = '晚上好，';
        }
        
        greetingElement.textContent = greeting;
    }
    
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        usernameElement.textContent = savedUsername;
    }
    
    usernameElement.addEventListener('blur', function() {
        const newName = this.textContent.trim();
        if (newName && newName !== '点击输入名字') {
            localStorage.setItem('username', newName);
        }
    });
    
    usernameElement.addEventListener('focus', function() {
        if (this.textContent === '点击输入名字') {
            this.textContent = '';
        }
    });
    
    updateGreeting();
    setInterval(updateGreeting, 60000);
} 