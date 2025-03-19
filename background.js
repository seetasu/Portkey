document.addEventListener('DOMContentLoaded', function() {
  setupGreeting();
  // 获取书签树
  chrome.bookmarks.getTree(function(bookmarkTreeNodes) {
      if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return; // 处理错误
      }
      displayBookmarks(bookmarkTreeNodes);
  });
});

function displayBookmarks(bookmarkNodes) {
  const bookmarksDiv = document.getElementById('bookmarks');
  
  // 存储所有顶层文件夹
  const folders = [];
  
  function processBookmarks(nodes, level = 0) {
      nodes.forEach(node => {
          if (node.children) {
              // 创建文件夹
              const folderDiv = document.createElement('div');
              folderDiv.className = 'bookmark-folder';
              
              const folderName = document.createElement('div');
              folderName.className = 'folder-name';
              folderName.textContent = node.title || '未命名文件夹';
              folderDiv.appendChild(folderName);
              
              // 处理文件夹中的直接书签
              node.children.forEach(child => {
                  if (!child.children) { // 只处理书签，不处理子文件夹
                      const bookmarkElement = createBookmarkElement(child);
                      if (bookmarkElement) {
                          folderDiv.appendChild(bookmarkElement);
                      }
                  }
              });
              
              // 如果文件夹不为空，添加到列表中
              if (folderDiv.children.length > 1) { // > 1 因为包含了 folderName
                  folders.push(folderDiv);
              }
              
              // 递归处理子文件夹中的书签，将它们作为新的独立文件夹
              node.children.forEach(child => {
                  if (child.children) {
                      processBookmarks([child], level + 1);
                  }
              });
          }
      });
  }
  
  function createBookmarkElement(node) {
      if (!node.url) return null;
      
      const bookmarkDiv = document.createElement('div');
      bookmarkDiv.className = 'bookmark-item';
      bookmarkDiv.dataset.bookmarkId = node.id;
      
      const icon = document.createElement('img');
      icon.alt = '图标';
      icon.className = 'bookmark-icon';
      tryGetFavicon(node.url, icon);
      
      const link = document.createElement('a');
      link.href = node.url;
      link.textContent = node.title || node.url;
      
      // 将右键菜单事件添加到整个 bookmarkDiv
      bookmarkDiv.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          showContextMenu(e, node);
      });
      
      // 添加点击事件到整个 bookmarkDiv
      bookmarkDiv.addEventListener('click', function(e) {
          window.location.href = node.url;
      });
      
      // 阻止图标和链接的点击事件冒泡
      icon.addEventListener('click', e => e.stopPropagation());
      link.addEventListener('click', e => e.stopPropagation());
      
      bookmarkDiv.appendChild(icon);
      bookmarkDiv.appendChild(link);
      
      return bookmarkDiv;
  }
  
  // 处理根节点的子节点
  processBookmarks(bookmarkNodes[0].children);
  
  // 将所有文件夹添加到页面
  folders.forEach(folder => {
      if (folder.children.length > 1) { // 只添加非空文件夹
          bookmarksDiv.appendChild(folder);
      }
  });
}

// 显示上下文菜单
function showContextMenu(event, bookmark) {
  // 移除可能存在的旧菜单
  const oldMenu = document.querySelector('.context-menu');
  if (oldMenu) {
      oldMenu.remove();
  }

  // 创建菜单
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  // 重命名选项
  const renameOption = document.createElement('div');
  renameOption.className = 'menu-item';
  renameOption.textContent = '重命名';
  renameOption.onclick = () => {
      const newTitle = prompt('请输入新的名称：', bookmark.title);
      if (newTitle) {
          chrome.bookmarks.update(bookmark.id, { title: newTitle }, () => {
              location.reload(); // 重新加载页面以显示更新
          });
      }
  };

  // 删除选项
  const deleteOption = document.createElement('div');
  deleteOption.className = 'menu-item';
  deleteOption.textContent = '删除';
  deleteOption.onclick = () => {
      if (confirm('确定要删除这个书签吗？')) {
          chrome.bookmarks.remove(bookmark.id, () => {
              location.reload(); // 重新加载页面以显示更新
          });
      }
  };

  menu.appendChild(renameOption);
  menu.appendChild(deleteOption);
  document.body.appendChild(menu);

  // 点击其他地方关闭菜单
  document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
  });
}

// 判断是否为内部域名
function isInternalDomain(hostname) {
  // 添加您公司的内部域名规则
  const internalDomains = [
      '.internal.company.com',
      '.intranet.com',
      // 添加其他内部域名模式
  ];
  return internalDomains.some(domain => hostname.includes(domain));
}

// 获取内部网站的图标
function getInternalIcon() {
  // 这里可以返回一个代表内部网站的图标
  return 'path/to/internal-icon.png'; // 需要准备一个内部网站的默认图标
}

// 获取默认图标的函数
function getDefaultIcon() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyVpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDAyIDc5LjE2NDQ4OCwgMjAyMC8wNy8xMC0yMjowNjo1MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjAgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6Y0YwNEE1MzQ5RDY1NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpBNjA5RTM0OUQ2NTYxMUUwOEQ2QUU2RDg5QkM4NzY1NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkE2MDlFMzQ2RDY1NjExRTA4RDZBRTZEOEI5QkM4NzY1NiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBNjA5RTM0N0Q2NTYxMUUwOEQ2QUU2RDg5QkM4NzY1NiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAAAALAAAAAAQABAAAAIRhI+py+0Po5y02ouz3rz7rxUAOw==';
}

function tryGetFavicon(url, icon) {
  try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      
      // 对其他域名使用常规的 favicon 获取逻辑
      icon.onerror = function() {
          // 如果 Google 服务失败，尝试直接从网站获取
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
                  // 如果所有路径都失败，使用默认图标
                  icon.src = getDefaultIcon();
              }
          }

          // 设置错误处理
          icon.onerror = tryNextPath;
          // 开始尝试第一个路径
          tryNextPath();
      };

      // 首先尝试 Google 的服务
      icon.src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;

  } catch (e) {
      icon.src = getDefaultIcon();
  }
}

// 添加问候语相关函数
function setupGreeting() {
  const greetingElement = document.getElementById('greeting');
  const usernameElement = document.getElementById('username');
  
  // 更新问候语
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
  
  // 加载保存的用户名
  const savedUsername = localStorage.getItem('username');
  if (savedUsername) {
      usernameElement.textContent = savedUsername;
  }
  
  // 用户名失焦时保存
  usernameElement.addEventListener('blur', function() {
      const newName = this.textContent.trim();
      if (newName && newName !== '点击输入名字') {
          localStorage.setItem('username', newName);
      }
  });
  
  // 用户名获得焦点时，如果是默认文本就清空
  usernameElement.addEventListener('focus', function() {
      if (this.textContent === '点击输入名字') {
          this.textContent = '';
      }
  });
  
  // 初始更新问候语
  updateGreeting();
  
  // 每分钟更新一次问候语
  setInterval(updateGreeting, 60000);
}  