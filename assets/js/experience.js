// Load keywords from JSON and render as badges
import { initializeAuth, saveKeywords, userData, REPO_OWNER } from './auth.js';

async function loadKeywords() {
  try {
    const resp = await fetch('assets/data/keywords.json');
    if (!resp.ok) return [];
    return await resp.json();
  } catch (e) {
    console.warn('Failed to load keywords', e);
    return [];
  }
}

function renderKeywords(list) {
  const container = document.getElementById('keywords-list');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(k => {
    const span = document.createElement('span');
    span.className = 'kw';
    span.textContent = k;
    container.appendChild(span);
  });
}

async function init() {
  const keywords = await loadKeywords();
  renderKeywords(keywords);

  // Resume modal behavior
  const resumeBtn = document.querySelector('.resume-btn');
  const modal = document.getElementById('resume-modal');
  const overlay = document.getElementById('resume-overlay');
  const close = document.getElementById('resume-close');

  if (resumeBtn && modal && overlay && close) {
    resumeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('active');
      modal.setAttribute('aria-hidden','false');
    });

    const hide = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden','true');
    }

    overlay.addEventListener('click', hide);
    close.addEventListener('click', hide);
  }

  // Initialize auth to detect owner
  await initializeAuth();
  // If logged in as owner, show an Edit Keywords button in the sidebar
  if (userData?.login === REPO_OWNER) {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const editBtn = document.createElement('button');
      editBtn.className = 'resume-btn';
      editBtn.textContent = 'Edit Keywords';
      editBtn.style.marginTop = '8px';
      sidebar.appendChild(editBtn);

      editBtn.addEventListener('click', async (e) => {
        const current = await loadKeywords();
        const newVal = prompt('Edit comma-separated keywords:', current.join(', '));
        if (!newVal) return;
        const arr = newVal.split(',').map(s => s.trim()).filter(Boolean);
        try {
          await saveKeywords(arr);
          renderKeywords(arr);
          alert('Keywords updated successfully');
        } catch (err) {
          alert('Failed to save keywords: ' + (err.message || err));
        }
      });
    }
  }
}

init();
