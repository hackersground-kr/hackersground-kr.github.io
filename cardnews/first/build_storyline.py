from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE = (BASE_DIR / "story_template.html").read_text(encoding="utf-8")

def make(content_html, outname):
    html = TEMPLATE.replace("<!-- CONTENT -->", content_html)
    path = BASE_DIR / f"{outname}.html"
    path.write_text(html, encoding="utf-8")
    return path

FOOTER = lambda meta: f'''
  <div class="footer">
    <div class="meta">{meta}</div>
    <div class="logo-mini">HACKERS<span>GROUND</span></div>
  </div>
'''

HEADER = lambda page: f'''
  <div class="header-row">
    <div class="brand"><span class="dot"></span>HACKERSGROUND.KR</div>
    <div class="page-num">{page}</div>
  </div>
'''

def progress(total, active_idx):
    dots = ""
    for i in range(total):
        cls = "progress-dot active" if i == active_idx else "progress-dot"
        dots += f'<div class="{cls}"></div>'
    return f'<div class="progress-row">{dots}</div>'

TOTAL = 6  # cover + 기/승/전/결 + 마무리

# ---------- Card 0: Cover ----------
cover = '''
  <img class="mascot" src="images/char3.png" style="width:360px; left:-60px; bottom:-30px; opacity:0.9; transform:rotate(-6deg);">
  <img class="mascot" src="images/char1.png" style="width:220px; right:-30px; top:100px; opacity:0.85; transform:rotate(10deg);">
  ''' + HEADER("STORY") + '''
  <div class="story-body">
    <div class="cover-badge"><span style="color:var(--primary-green);">●</span> AI BUILDER MEETUP</div>
    <div class="slogan" style="margin-top:36px;">AI가 다<br>하는 시대</div>
    <div class="desc">그래도 안 되는 게 있다는 걸 알았다.<br>8월 AI 빌더모임에서 나눈 이야기.</div>
  </div>
  ''' + progress(TOTAL, 0) + FOOTER("8월 AI 빌더모임 · 2026.08.13")
make(cover, "storyline_00_cover")

# ---------- Beats: 起承轉結 + 마무리 ----------
beats = [
    # (slogan, desc, accent_class, footer_meta)
    ("속도는<br>이미 정답", "웹도 반복도, AI가 대신한 지 오래다", "", "起 · 현상"),
    ("근데 손맛은<br>안 된다", "타격감도 재미도, 아직은 사람 몫이다", "purple", "承 · 전개"),
    ("희소한 건<br>이해력", "요구를 정확히 듣는 사람이 이긴다", "blue", "轉 · 반전"),
    ("결국 남는 건<br>신뢰", "관계가 쌓일수록 값어치가 커진다", "", "結 · 결론"),
    ("그래서<br>우리는 모인다", "매달 둘째 주 목요일, 계속 이야기한다", "", "NEXT · 2026.09"),
]

mascots = {
    1: '<img class="mascot" src="images/char3.png" style="width:270px; right:-50px; bottom:-30px; opacity:0.25;">',
    2: '<img class="mascot" src="images/char5.png" style="width:260px; right:-40px; top:-20px; opacity:0.25;">',
    3: '<img class="mascot" src="images/char4.png" style="width:270px; right:-50px; bottom:-30px; opacity:0.25;">',
    4: '<img class="mascot" src="images/char1.png" style="width:250px; right:-40px; top:-20px; opacity:0.25;">',
    5: '<img class="mascot" src="images/char2.png" style="width:280px; left:-60px; bottom:-30px; opacity:0.9; transform:rotate(6deg);">',
}

for i, (slogan, desc, accent_cls, footer_meta) in enumerate(beats, start=1):
    slogan_html = slogan
    if accent_cls:
        parts = slogan.split("<br>")
        if len(parts) == 2:
            slogan_html = f'{parts[0]}<br><span class="accent {accent_cls}">{parts[1]}</span>'
        else:
            slogan_html = f'<span class="accent {accent_cls}">{slogan}</span>'
    mascot_html = mascots.get(i, "")
    content = mascot_html + HEADER(f"{i:02d} / 05") + f'''
  <div class="story-body">
    <div class="slogan">{slogan_html}</div>
    <div class="desc">{desc}</div>
  </div>
  ''' + progress(TOTAL, i) + FOOTER(footer_meta)
    make(content, f"storyline_{i:02d}")

print("done")
