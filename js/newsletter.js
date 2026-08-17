(() => {
  const API_BASE = window.HACKERSGROUND_CONTENT_API
    || 'https://hackersground-api.azurewebsites.net/api';

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = form.elements.email.value.trim();
        const button = form.querySelector('button[type="submit"]');
        const result = form.querySelector('[data-newsletter-result]');
        button.disabled = true;
        result.textContent = '';

        try {
          const response = await fetch(`${API_BASE}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              consent: true,
              source: form.dataset.newsletterSource || 'website',
            }),
          });
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error || '구독 처리에 실패했습니다.');
          }
          form.reset();
          result.textContent = body.message;
          result.className = 'newsletter-result success';
        } catch (error) {
          result.textContent = error.message;
          result.className = 'newsletter-result error';
        } finally {
          button.disabled = false;
        }
      });
    });
  });
})();
