(() => {
  const API_BASE = window.HACKERSGROUND_CONTENT_API
    || 'https://hackersground-api.azurewebsites.net/api';

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
      const emailInput = form.elements.email;
      const nextButton = form.querySelector('[data-newsletter-next]');
      const preferences = form.querySelector('[data-newsletter-preferences]');
      const result = form.parentElement.querySelector('[data-newsletter-result]');

      nextButton.addEventListener('click', () => {
        if (!emailInput.reportValidity()) {
          return;
        }
        preferences.hidden = false;
        preferences.querySelector('input').focus();
      });

      form.querySelectorAll('.newsletter-options input').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.type === 'radio') {
            form.querySelectorAll(`input[name="${input.name}"]`).forEach((radio) => {
              radio.closest('label').classList.toggle('is-selected', radio.checked);
            });
            return;
          }
          input.closest('label').classList.toggle('is-selected', input.checked);
        });
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        const affiliation = form.querySelector('input[name="affiliation"]:checked')?.value;
        const interests = Array.from(form.querySelectorAll('input[name="interests"]:checked'))
          .map((input) => input.value);
        const button = form.querySelector('button[type="submit"]');
        if (!affiliation || interests.length === 0) {
          result.textContent = '소속과 관심사를 선택해주세요.';
          result.className = 'newsletter-result error';
          return;
        }
        const buttonText = button.textContent;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = '구독 정보를 저장 중...';
        result.textContent = '잠시만요. 구독 정보를 저장하고 있어요.';
        result.className = 'newsletter-result pending';

        try {
          const response = await fetch(`${API_BASE}/subscribe`, {
            method: 'POST',
            // A safelisted content type avoids an extra CORS preflight request.
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({
              email,
              affiliation,
              interests,
              consent: true,
              source: form.dataset.newsletterSource || 'website',
            }),
          });
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error || '구독 처리에 실패했습니다.');
          }
          window.location.assign('/newsletter/thank-you.html');
        } catch (error) {
          result.textContent = error.message;
          result.className = 'newsletter-result error';
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.textContent = buttonText;
        }
      });
    });
  });
})();
