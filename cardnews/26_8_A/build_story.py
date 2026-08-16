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

TOTAL = 10  # cover + 9 beats

# ---------- Card 0: Cover ----------
cover = '''
  <img class="mascot" src="images/char3.png" style="width:420px; left:-70px; bottom:-30px; opacity:0.9; transform:rotate(-6deg);">
  <img class="mascot" src="images/char1.png" style="width:240px; right:-40px; top:100px; opacity:0.85; transform:rotate(10deg);">
  ''' + HEADER("STORY") + '''
  <div class="story-body">
    <div class="cover-badge"><span style="color:var(--primary-green);">●</span> GAME × AI ART</div>
    <div class="slogan" style="margin-top:36px;">AI는 <span class="accent">컨셉</span>까지,<br>손맛은 <span class="accent">사람</span>이</div>
    <div class="desc">게임 아트를 통째로 AI에게 맡겨봤다.<br>그리고 딱 한 지점에서, 사람의 손이 남았다.</div>
  </div>
  ''' + progress(TOTAL, 0) + FOOTER("8월 AI 빌더모임 · 2026.08.13")
make(cover, "storyA_00_cover")

# ---------- Beats ----------
beats = [
    # (slogan_html, desc)
    ("AI로 게임을<br>만들 수 있을까?", "기획부터 개발, 아트까지. AI가 어디까지 할 수 있는지 직접 만들어봤다"),
    ("개발은<br>생각보다 잘한다", "이동, 전투, UI, 데이터 구조까지. 구현 속도는 이미 상당히 빨라졌다"),
    ("코드는<br>문제가 아니었다", "명확하게 요구할수록 AI는 꽤 복잡한 게임 시스템도 구현해냈다"),
    ("아트는 어떨까?", "컨셉아트부터 3D 모델까지 AI 파이프라인을 연결해봤다"),
    ("보이는 건<br>빠르게 만든다", "컨셉, 멀티뷰, 3D 모델링까지. 프로토타입을 만드는 속도는 압도적이었다"),
    ("그럴듯함과<br>완성도는 달랐다", "손가락, 표정, 리깅, 애니메이션. 플레이할수록 작은 어색함이 쌓였다"),
    ("그럼 게임성은?", "타격감, 템포, 난이도, 피드백. '작동하는 게임'을 '재미있는 게임'으로 만드는 과정이 남았다"),
    ("만드는 건 된다.<br>재밌게만드는 게 어렵다", "AI는 결과물을 빠르게 만든다. 하지만 무엇이 재미있는지는 아직 사람이 계속 판단해야 한다"),
    ("AI는 속도를 만들고,<br>사람은 게임을 만든다", "구현과 제작은 AI에게 맡긴다. 방향과 감각, 그리고 마지막 완성도는 사람이 결정한다"),
]

topic_meta = "TOPIC · GAME DEV"

for i, (slogan, desc) in enumerate(beats, start=1):
    mascots = {
        1: '<img class="mascot" src="images/char3.png" style="width:280px; right:-50px; bottom:-30px; opacity:0.25;">',
        4: '<img class="mascot" src="images/char4.png" style="width:260px; right:-40px; top:-20px; opacity:0.25;">',
        6: '<img class="mascot" src="images/char5.png" style="width:280px; right:-50px; bottom:-30px; opacity:0.25;">',
        9: '<img class="mascot" src="images/char1.png" style="width:260px; right:-40px; bottom:-20px; opacity:0.3;">',
    }
    mascot_html = mascots.get(i, "")
    slogan_style = ' style="font-size:88px; letter-spacing:-4px;"' if i == 8 else ""
    content = mascot_html + HEADER(f"{i:02d} / 09") + f'''
  <div class="story-body">
    <div class="slogan"{slogan_style}>{slogan}</div>
    <div class="desc">{desc}</div>
  </div>
  ''' + progress(TOTAL, i) + FOOTER(topic_meta)
    make(content, f"storyA_{i:02d}")

print("done")
