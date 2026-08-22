(() => {
  const API_BASE = window.HACKERSGROUND_CONTENT_API
    || 'https://hackersground-api.azurewebsites.net/api';

  async function request(path, options) {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
      throw new Error(`Content API request failed: ${response.status}`);
    }
    return response.json();
  }

  function formatDate(date) {
    if (!date) return '';
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
      ? date
      : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(parsed);
  }

  function shortUrl(kind, shortId) {
    const section = kind === 'post' ? 'posts' : 'events';
    return new URL(`/${section}/${shortId}`, window.location.origin).href;
  }

  function configureShareButton(kind, content) {
    const button = document.querySelector('[data-content-share]');
    const result = document.querySelector('[data-content-share-result]');
    if (!button || !result || !Number.isSafeInteger(content.shortId)) {
      return;
    }

    const url = shortUrl(kind, content.shortId);
    button.hidden = false;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        result.textContent = '단축 URL을 복사했습니다.';
      } catch {
        result.textContent = '단축 URL을 복사하지 못했습니다. 잠시 후 다시 시도해주세요.';
      }
    });
  }

  function createPostItem(post) {
    const link = document.createElement('a');
    link.className = 'post-item';
    link.href = `content.html?slug=${encodeURIComponent(post.slug)}`;
    link.dataset.tag = post.tag || 'other';

    const emoji = document.createElement('span');
    emoji.className = 'post-emoji';
    emoji.textContent = post.emoji || '📝';
    link.append(emoji);

    const content = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'post-meta';
    const tag = document.createElement('span');
    tag.className = `post-tag ${post.tag || 'other'}`;
    tag.textContent = post.tag || 'other';
    const date = document.createElement('span');
    date.className = 'post-date';
    date.textContent = formatDate(post.publishedAt || post.createdAt);
    meta.append(tag, date);

    const title = document.createElement('div');
    title.className = 'post-title';
    title.textContent = post.title;
    const excerpt = document.createElement('div');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = post.excerpt || '';
    content.append(meta, title, excerpt);
    link.append(content);
    return link;
  }

  function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.date = event.event?.startAt || event.publishedAt || '';
    card.dataset.type = event.event?.eventType || '';
    card.dataset.status = event.event?.registrationUrl ? 'upcoming' : 'closed';

    const category = document.createElement('div');
    category.className = 'event-category seminar';
    category.textContent = event.event?.eventType || '행사';
    const title = document.createElement('h3');
    title.className = 'event-title';
    title.textContent = `${event.emoji || '🗓️'} ${event.title}`;
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    const date = document.createElement('div');
    date.className = 'event-date';
    date.textContent = `📅 ${formatDate(event.event?.startAt)}`;
    const location = document.createElement('div');
    location.className = 'event-location';
    location.textContent = `📍 ${event.event?.location || '장소 추후 공지'}`;
    meta.append(date, location);
    const excerpt = document.createElement('p');
    excerpt.className = 'event-description';
    excerpt.textContent = event.excerpt || '';
    const footer = document.createElement('div');
    footer.className = 'event-footer';
    const price = document.createElement('span');
    price.className = 'event-price';
    price.textContent = event.event?.price || '무료';
    const link = document.createElement('a');
    link.className = 'event-button';
    link.href = `content.html?slug=${encodeURIComponent(event.slug)}`;
    link.textContent = '자세히 보기';
    footer.append(price, link);
    card.append(category, title, meta, excerpt, footer);
    return card;
  }

  async function loadList(container) {
    const kind = container.dataset.contentList;
    const { items } = await request(`/content/${kind}`);
    if (!items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.append(
      kind === 'post' ? createPostItem(item) : createEventCard(item),
    ));
    container.replaceChildren(fragment);

    if (kind === 'event' && typeof window.sortEvents === 'function') {
      window.sortEvents();
    }
  }

  async function loadDetail(container) {
    const kind = container.dataset.contentDetail;
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) {
      container.textContent = '콘텐츠 주소가 올바르지 않습니다.';
      return;
    }

    const { content } = await request(`/content/${kind}/${encodeURIComponent(slug)}`);
    const isLegacyEvent = kind === 'event' && content.bodyFormat === 'legacy-html';
    const legacyHero = document.querySelector('[data-content-hero]');
    const legacyCta = document.querySelector('[data-content-cta]');
    document.body.dataset.contentSlug = content.slug;
    document.body.dataset.contentFormat = content.bodyFormat || 'markdown';

    document.title = `${content.title} · 해커그라운드`;
    document.querySelector('[data-content-title]').textContent = `${content.emoji || ''} ${content.title}`;
    document.querySelector('[data-content-excerpt]').textContent = content.excerpt || '';
    document.querySelector('[data-content-tag]').textContent = content.tag || kind;
    const date = document.querySelector('[data-content-date]');
    if (date) date.textContent = formatDate(content.publishedAt || content.createdAt);
    const viewCount = document.querySelector('[data-content-views]');
    if (viewCount) viewCount.textContent = `조회 ${content.viewCount}`;
    configureShareButton(kind, content);

    const eventMeta = document.querySelector('[data-content-event-meta]');
    if (kind === 'event' && eventMeta) {
      eventMeta.hidden = isLegacyEvent;
      eventMeta.textContent = [
        content.event.startAt && `📅 ${formatDate(content.event.startAt)}`,
        content.event.location && `📍 ${content.event.location}`,
        content.event.price && `💳 ${content.event.price}`,
      ].filter(Boolean).join(' · ');
    }

    container.classList.toggle('legacy-event-content', isLegacyEvent);
    container.innerHTML = content.renderedHtml;
    if (isLegacyEvent) {
      const legacyHeroContent = container.querySelector('.event-detail-hero .container');
      const shareButton = legacyHero?.querySelector('[data-content-share]');
      const shareResult = legacyHero?.querySelector('[data-content-share-result]');
      if (legacyHeroContent && shareButton && shareResult) {
        const shareControls = document.createElement('div');
        shareControls.className = 'legacy-share-controls';
        shareControls.append(shareButton, shareResult);
        legacyHeroContent.append(shareControls);
      }
      legacyHero?.remove();
      legacyCta?.remove();
    }
    request(`/content/${kind}/${encodeURIComponent(slug)}`, { method: 'POST' })
      .then(({ viewCount: nextViewCount }) => {
        if (viewCount) viewCount.textContent = `조회 ${nextViewCount}`;
      })
      .catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-content-list]').forEach((container) => {
      loadList(container).catch(() => {
        // Network failure keeps the static JSON-derived fallback content visible.
      });
    });
    document.querySelectorAll('[data-content-detail]').forEach((container) => {
      loadDetail(container).catch(() => {
        container.textContent = '콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
      });
    });
  });
})();
