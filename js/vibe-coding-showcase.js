(() => {
  const details = {
    link: {
      icon: '🔗',
      html: '<strong>주소가 생겨요.</strong> 만든 즉시 링크를 보내 누구에게나 보여줄 수 있어요.',
    },
    qr: {
      icon: '▦',
      html: '<strong>QR을 찍으면 바로 연결돼요.</strong> 명함이나 포스터의 QR로 같은 홈페이지가 열려요.',
    },
    contact: {
      icon: '💬',
      html: '<strong>문의가 쉬워져요.</strong> 손님이 문자 또는 메일 버튼을 눌러 바로 연락할 수 있어요.',
    },
  };

  function pulseBrowser(browser) {
    browser.classList.remove('is-pulsing');
    window.requestAnimationFrame(() => {
      browser.classList.add('is-pulsing');
      window.setTimeout(() => browser.classList.remove('is-pulsing'), 650);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const showcase = document.querySelector('[data-vibe-showcase]');
    if (!showcase) return;

    const browser = showcase.querySelector('[data-vibe-browser]');
    const caption = showcase.querySelector('[data-vibe-caption]');
    const captionIcon = showcase.querySelector('[data-vibe-caption-icon]');
    const notice = showcase.querySelector('[data-vibe-notice]');

    showcase.querySelectorAll('[data-vibe-feature]').forEach((button) => {
      button.addEventListener('click', () => {
        const selected = details[button.dataset.vibeFeature];
        showcase.querySelectorAll('[data-vibe-feature]').forEach((feature) => {
          const active = feature === button;
          feature.classList.toggle('is-active', active);
          feature.setAttribute('aria-pressed', String(active));
        });
        captionIcon.textContent = selected.icon;
        caption.innerHTML = selected.html;
        pulseBrowser(browser);
      });
    });

    showcase.querySelectorAll('[data-vibe-demo]').forEach((button) => {
      button.addEventListener('click', () => {
        const isMessage = button.dataset.vibeDemo === 'message';
        notice.textContent = isMessage
          ? '✓ 문자 앱으로 연결되는 버튼이에요'
          : '✓ 메일 앱으로 연결되는 버튼이에요';
        pulseBrowser(browser);
      });
    });
  });
})();
