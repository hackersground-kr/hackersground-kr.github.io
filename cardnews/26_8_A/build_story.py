import re, os

TEMPLATE = open("/tmp/cardnews/story_template.html", encoding="utf-8").read()

def make(content_html, outname):
    html = TEMPLATE.replace("<!-- CONTENT -->", content_html)
    path = f"/tmp/cardnews/{outname}.html"
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
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
    ("AI에게<br>맡겨봤다", "게임 아트를 통째로 맡겨보기로 했다"),
    ("컨셉아트는<br>그럴듯했다", "2D 스타일만큼은 확실히 살아났다"),
    ("딱, 거기까지였다", "캐릭터 액션의 '맛'까지는 안 나왔다"),
    ("그래서<br>3D로 틀었다", "2D 한 장을 멀티뷰로, 다시 3D로"),
    ("생각보다<br>정교했다", "파츠 분리까지 예상 밖으로 정확했다"),
    ("근데 손끝에서<br>막혔다", "손가락과 표정에서 AI가 멈췄다"),
    ("다들<br>같은 자리였다", "다른 게임사도 똑같이 거기서 멈췄다"),
    ("경계는<br>리깅에 있다", "AI와 사람의 선은 손끝에 그어졌다"),
    ("맛은<br>사람이 완성한다", "AI가 만들고, 사람이 마지막을 얹는다"),
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
    content = mascot_html + HEADER(f"{i:02d} / 09") + f'''
  <div class="story-body">
    <div class="slogan">{slogan}</div>
    <div class="desc">{desc}</div>
  </div>
  ''' + progress(TOTAL, i) + FOOTER(topic_meta)
    make(content, f"storyA_{i:02d}")

print("done")
