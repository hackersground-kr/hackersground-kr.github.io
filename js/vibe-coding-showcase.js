(() => {
  const showcaseConfigs = {
    'vibe-coding-workshop': {
      eyebrow: '코딩을 몰라도, 90분이면',
      title: '내 홈페이지가 손님을 만나는 순간',
      description: '말로 설명하면 AI가 만들고, 링크와 QR로 알리고, 문자와 메일로 바로 문의받아요.',
      flowLabel: '바이브코딩 홈페이지 제작 과정',
      firstStep: 'AI에게 말하기',
      assistantMessage: '어떤 홈페이지를<br>만들고 싶으세요?',
      userMessage: '내 가게를 소개하고<br>문의도 받고 싶어!',
      typingLabel: 'AI가 홈페이지를 만드는 중',
      typingText: 'AI가 만드는 중',
      arrowText: '완성!',
      secondStep: '내 홈페이지 완성',
      browser: {
        url: 'my-page.kr',
        logo: 'MY BRAND',
        eyebrow: '반가워요 👋',
        title: '나를 소개하는<br>진짜 홈페이지',
        description: '내 이야기와 서비스를 한눈에 보여주세요.',
        actions: [
          { id: 'message', label: '💬 문자로 문의', notice: '✓ 문자 앱으로 연결되는 버튼이에요' },
          { id: 'email', label: '✉️ 메일로 문의', notice: '✓ 메일 앱으로 연결되는 버튼이에요' },
        ],
        notice: '버튼 한 번이면 바로 문의할 수 있어요',
      },
      featureLabel: '완성되는 홈페이지 기능',
      features: [
        {
          id: 'link',
          icon: '🔗',
          title: '내 홈페이지 링크',
          summary: '친구와 손님에게 바로 공유',
          detail: '<strong>주소가 생겨요.</strong> 만든 즉시 링크를 보내 누구에게나 보여줄 수 있어요.',
        },
        {
          id: 'qr',
          icon: '▦',
          iconType: 'qr',
          title: '찍으면 열리는 QR',
          summary: '명함·포스터에서 내 홈페이지로',
          detail: '<strong>QR을 찍으면 바로 연결돼요.</strong> 명함이나 포스터의 QR로 같은 홈페이지가 열려요.',
        },
        {
          id: 'contact',
          icon: '💬',
          title: '문자·메일 문의 버튼',
          summary: '궁금한 손님이 놓치지 않게',
          detail: '<strong>문의가 쉬워져요.</strong> 손님이 문자 또는 메일 버튼을 눌러 바로 연락할 수 있어요.',
        },
      ],
      promise: '수업이 끝나면 아이디어가 아니라, 공유할 수 있는 <strong>내 홈페이지</strong>를 갖게 됩니다.',
    },
    'ai-searchable-homepage': {
      eyebrow: '홈페이지는 있는데, AI가 모른다면?',
      title: 'AI가 내 홈페이지를 발견하고 추천하는 순간',
      description: '고객의 질문을 이해하고, 내 홈페이지에서 답을 찾아, 검색 결과에 소개되게 만들어요.',
      flowLabel: 'AI에게 검색되는 홈페이지의 작동 방식',
      firstStep: '고객이 AI에게 질문',
      assistantMessage: '대구에서 이런 서비스를<br>잘하는 곳을 추천해줘!',
      userMessage: '관련 홈페이지를<br>찾아보고 있어요.',
      typingLabel: 'AI가 홈페이지를 이해하는 중',
      typingText: 'AI가 정보를 읽는 중',
      arrowText: '발견!',
      secondStep: 'AI가 이해하는 홈페이지',
      browser: {
        url: 'my-brand.kr',
        logo: 'MY BRAND',
        eyebrow: 'AI가 읽기 쉬운 정보 🔎',
        title: '누구인지, 무엇을 하는지<br>한눈에',
        description: '명확한 소개와 답이 되는 콘텐츠를 담아보세요.',
        actions: [
          { id: 'service', label: '🧭 서비스 소개', notice: '✓ 제공하는 서비스가 명확하게 보여요' },
          { id: 'review', label: '✦ 이용 사례', notice: '✓ AI가 참고할 구체적인 근거가 생겨요' },
        ],
        notice: 'AI가 이해하고 인용할 근거가 생겨요',
      },
      featureLabel: 'AI 검색을 돕는 홈페이지 조건',
      features: [
        {
          id: 'structure',
          icon: '🧭',
          title: 'AI가 읽는 구조',
          summary: '페이지의 의미를 명확하게',
          detail: '<strong>구조가 뜻을 알려줘요.</strong> 제목과 섹션을 정리해 AI가 페이지의 맥락을 이해하게 만들어요.',
        },
        {
          id: 'answer',
          icon: '✍️',
          title: '답이 되는 콘텐츠',
          summary: '고객 질문에 바로 답하도록',
          detail: '<strong>고객의 질문에 답해요.</strong> 서비스, 지역, 경험을 구체적으로 적어 AI가 답변에 활용하게 만들어요.',
        },
        {
          id: 'discover',
          icon: '🔎',
          title: '검색·추천될 기회',
          summary: 'AI 답변 속 내 홈페이지로',
          detail: '<strong>발견될 가능성을 높여요.</strong> AI가 내 홈페이지를 근거로 소개하고 연결할 기회를 만들어요.',
        },
      ],
      promise: '밋업이 끝나면 내 홈페이지에서 가장 먼저 바꿀 <strong>한 가지</strong>를 정하게 됩니다.',
    },
  };

  function qrIcon() {
    return '<span class="vibe-feature__icon vibe-feature__qr" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
  }

  function featureIcon(feature) {
    return feature.iconType === 'qr'
      ? qrIcon()
      : `<span class="vibe-feature__icon" aria-hidden="true">${feature.icon}</span>`;
  }

  function pulseBrowser(browser) {
    browser.classList.remove('is-pulsing');
    window.requestAnimationFrame(() => {
      browser.classList.add('is-pulsing');
      window.setTimeout(() => browser.classList.remove('is-pulsing'), 650);
    });
  }

  function initializeShowcase(showcase, config) {
    const browser = showcase.querySelector('[data-vibe-browser]');
    const caption = showcase.querySelector('[data-vibe-caption]');
    const captionIcon = showcase.querySelector('[data-vibe-caption-icon]');
    const notice = showcase.querySelector('[data-vibe-notice]');

    showcase.querySelectorAll('[data-vibe-feature]').forEach((button) => {
      button.addEventListener('click', () => {
        const selected = config.features.find((feature) => feature.id === button.dataset.vibeFeature);
        showcase.querySelectorAll('[data-vibe-feature]').forEach((feature) => {
          const active = feature === button;
          feature.classList.toggle('is-active', active);
          feature.setAttribute('aria-pressed', String(active));
        });
        captionIcon.textContent = selected.icon;
        caption.innerHTML = selected.detail;
        pulseBrowser(browser);
      });
    });

    showcase.querySelectorAll('[data-vibe-demo]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = config.browser.actions.find((item) => item.id === button.dataset.vibeDemo);
        notice.textContent = action.notice;
        pulseBrowser(browser);
      });
    });
  }

  function createEventShowcase(config) {
    const firstFeature = config.features[0];
    const showcase = document.createElement('section');
    showcase.className = 'vibe-showcase';
    showcase.setAttribute('aria-label', config.title);
    showcase.innerHTML = `
      <div class="vibe-showcase__heading">
        <span class="vibe-showcase__eyebrow">${config.eyebrow}</span>
        <h2>${config.title}</h2>
        <p>${config.description}</p>
      </div>
      <div class="vibe-showcase__flow" aria-label="${config.flowLabel}">
        <div class="vibe-showcase__prompt">
          <div class="vibe-showcase__step-label"><span>1</span>${config.firstStep}</div>
          <div class="vibe-showcase__chat">
            <span class="vibe-showcase__chat-dot" aria-hidden="true">AI</span>
            <p>${config.assistantMessage}</p>
          </div>
          <div class="vibe-showcase__chat vibe-showcase__chat--mine"><p>${config.userMessage}</p></div>
          <div class="vibe-showcase__typing" aria-label="${config.typingLabel}">
            <i></i><i></i><i></i><span>${config.typingText}</span>
          </div>
        </div>
        <div class="vibe-showcase__arrow" aria-hidden="true"><span></span><b>${config.arrowText}</b></div>
        <div class="vibe-showcase__result">
          <div class="vibe-showcase__step-label"><span>2</span>${config.secondStep}</div>
          <div class="vibe-browser" data-vibe-browser>
            <div class="vibe-browser__bar"><i></i><i></i><i></i><span>${config.browser.url}</span></div>
            <div class="vibe-browser__page">
              <div class="vibe-browser__logo">${config.browser.logo}</div>
              <div class="vibe-browser__hero">
                <span>${config.browser.eyebrow}</span>
                <strong>${config.browser.title}</strong>
                <p>${config.browser.description}</p>
              </div>
              <div class="vibe-browser__contacts">
                ${config.browser.actions.map((action) => `<button type="button" data-vibe-demo="${action.id}">${action.label}</button>`).join('')}
              </div>
              <div class="vibe-browser__notice" data-vibe-notice aria-live="polite">${config.browser.notice}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="vibe-showcase__features" role="group" aria-label="${config.featureLabel}">
        ${config.features.map((feature, index) => `
          <button class="vibe-feature${index === 0 ? ' is-active' : ''}" type="button" data-vibe-feature="${feature.id}" aria-pressed="${index === 0}">
            ${featureIcon(feature)}
            <span><b>${feature.title}</b><small>${feature.summary}</small></span>
          </button>
        `).join('')}
      </div>
      <div class="vibe-showcase__caption">
        <span data-vibe-caption-icon>${firstFeature.icon}</span>
        <p data-vibe-caption>${firstFeature.detail}</p>
      </div>
      <p class="vibe-showcase__promise"><span>✓</span>${config.promise}</p>
    `;
    initializeShowcase(showcase, config);
    return showcase;
  }

  function renderEventShowcase(slug) {
    const container = document.querySelector('[data-event-showcase]');
    const config = showcaseConfigs[slug];
    if (!container) return;
    container.replaceChildren(...(config ? [createEventShowcase(config)] : []));
  }

  window.createEventShowcase = createEventShowcase;
  window.renderEventShowcase = renderEventShowcase;
})();
