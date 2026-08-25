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

  function parseEventDate(value) {
    if (!value || typeof value !== 'string') return undefined;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const match = value.match(/(\d{4})[.\-/]\s*(\d{1,2})(?:[.\-/]\s*(\d{1,2}))?/);
    if (!match) return undefined;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
  }

  function hasEventEnded(event) {
    const endAt = parseEventDate(event?.endAt);
    if (endAt) return endAt.getTime() < Date.now();

    const startAt = parseEventDate(event?.startAt);
    if (!startAt) return false;
    startAt.setHours(23, 59, 59, 999);
    return startAt.getTime() < Date.now();
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

  function dateValue(post) {
    const value = new Date(post.publishedAt || post.createdAt || 0).getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  function recommendedPosts(posts, currentSlug) {
    const candidates = posts.filter((post) => post.slug !== currentSlug);
    const latest = [...candidates].sort((left, right) => dateValue(right) - dateValue(left));
    const selected = [];
    const add = (post, kind) => {
      if (post && !selected.some((item) => item.post.slug === post.slug)) {
        selected.push({ post, kind });
      }
    };

    latest.slice(0, 2).forEach((post) => add(post, 'latest'));
    [...candidates]
      .sort((left, right) => Number(right.viewCount || 0) - Number(left.viewCount || 0)
        || dateValue(right) - dateValue(left))
      .some((post) => {
        if (selected.some((item) => item.post.slug === post.slug)) return false;
        add(post, 'popular');
        return true;
      });
    latest.forEach((post) => add(post, 'latest'));

    return selected.slice(0, 3);
  }

  function createRecommendationCard({ post, kind }) {
    const link = document.createElement('a');
    link.className = 'post-recommendation-card';
    link.href = `content.html?slug=${encodeURIComponent(post.slug)}`;

    const kindLabel = document.createElement('span');
    kindLabel.className = `post-recommendation-kind ${kind}`;
    kindLabel.textContent = kind === 'popular' ? '인기 글' : '최신 글';
    const title = document.createElement('h3');
    title.className = 'post-recommendation-title';
    title.textContent = post.title;
    const excerpt = document.createElement('p');
    excerpt.className = 'post-recommendation-excerpt';
    excerpt.textContent = post.excerpt || '';
    const meta = document.createElement('div');
    meta.className = 'post-recommendation-meta';
    const tag = document.createElement('span');
    tag.className = `post-tag ${post.tag || 'other'}`;
    tag.textContent = post.tag || 'other';
    const date = document.createElement('span');
    date.textContent = formatDate(post.publishedAt || post.createdAt);
    const views = document.createElement('span');
    views.textContent = `조회 ${Number(post.viewCount || 0)}`;
    meta.append(tag, date, views);
    link.append(kindLabel, title, excerpt, meta);
    return link;
  }

  async function loadPostRecommendations(currentSlug) {
    const section = document.querySelector('[data-post-recommendations]');
    const list = document.querySelector('[data-post-recommendation-list]');
    if (!section || !list) return;

    const { items } = await request('/content/post');
    const recommendations = recommendedPosts(items, currentSlug);
    if (!recommendations.length) return;

    const fragment = document.createDocumentFragment();
    recommendations.forEach((item) => fragment.append(createRecommendationCard(item)));
    list.replaceChildren(fragment);
    section.hidden = false;
  }

  function createEventCard(event) {
    const isClosed = hasEventEnded(event.event);
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.date = parseEventDate(event.event?.startAt)?.toISOString() || event.publishedAt || '';
    card.dataset.type = event.event?.eventType || '';
    card.dataset.status = !isClosed && event.event?.registrationUrl ? 'upcoming' : 'closed';

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
    link.textContent = isClosed ? '신청마감' : '자세히 보기';
    footer.append(price, link);
    card.append(category, title, meta, excerpt, footer);
    return card;
  }

  async function loadList(container) {
    const kind = container.dataset.contentList;
    const { items } = await request(`/content/${kind}`);
    if (!items.length) return;
    const limit = Number(container.dataset.contentLimit);
    const visibleItems = Number.isSafeInteger(limit) && limit > 0
      ? items.slice(0, limit)
      : items;

    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item) => fragment.append(
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
    const vibeShowcase = document.querySelector('[data-vibe-showcase]');
    if (vibeShowcase) {
      vibeShowcase.hidden = content.slug !== 'vibe-coding-workshop';
    }

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
    if (kind === 'event') {
      const registrationLink = document.querySelector('[data-content-registration]');
      if (registrationLink && content.event.registrationUrl) {
        registrationLink.href = content.event.registrationUrl;
        registrationLink.hidden = false;
      }
    }

    container.classList.toggle('legacy-event-content', isLegacyEvent);
    container.innerHTML = content.renderedHtml;
    if (kind === 'post') {
      loadPostRecommendations(content.slug).catch(() => {});
    }
    if (kind === 'event' && hasEventEnded(content.event)) {
      const closeRegistrationLink = (link) => {
        link.classList.add('registration-closed');
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.tabIndex = -1;
        link.textContent = '신청마감';
      };

      container.querySelectorAll('a[href*="register.html"]').forEach(closeRegistrationLink);
      container.querySelectorAll('.sticky-apply').forEach((stickyApply) => {
        stickyApply.classList.add('registration-bar-closed');
        stickyApply.querySelectorAll('.apply-deadline, .deadline').forEach((deadline) => {
          deadline.textContent = '신청이 마감되었습니다.';
        });
        stickyApply.querySelectorAll('a.apply-button, a.cta-button, a.btn-primary')
          .forEach(closeRegistrationLink);
      });
    }
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
