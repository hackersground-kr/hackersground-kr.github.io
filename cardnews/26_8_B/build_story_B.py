import os

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
  <img class="mascot" src="images/char4.png" style="width:400px; left:-70px; bottom:-30px; opacity:0.9; transform:rotate(-6deg);">
  <img class="mascot" src="images/char1.png" style="width:220px; right:-30px; top:100px; opacity:0.85; transform:rotate(10deg);">
  ''' + HEADER("STORY") + '''
  <div class="story-body">
    <div class="cover-badge" style="border-color:var(--primary-blue); box-shadow:0 0 30px rgba(59,130,246,0.3);"><span style="color:var(--secondary-blue);">●</span> AI PHOTOBOOTH BIZ</div>
    <div class="slogan" style="margin-top:36px;">예쁜 <span class="accent blue">AI</span>보다<br><span class="accent blue">10초</span>의 즐거움</div>
    <div class="desc">최신 모델을 껐다. 대신 대기시간을 없앴다.<br>사람들이 산 건 사진이 아니라 순간이었다.</div>
  </div>
  ''' + progress(TOTAL, 0) + FOOTER("8월 AI 빌더모임 · 2026.08.13")
make(cover, "storyB_00_cover")

# ---------- Beats ----------
beats = [
    ("최신이<br>답이라 믿었다", "좋은 AI일수록 좋은 서비스라 여겼다"),
    ("일부러<br>낡은 걸 썼다", "오래된 가벼운 모델을 그대로 뒀다"),
    ("적은 기다림이<br>전부였다", "대기시간이 만족도를 가장 갉아먹었다"),
    ("10초 안에<br>끝내자", "결과가 10초 안에 나오게 다시 짰다"),
    ("아무도<br>안 따졌다", "아무도 퀄리티를 지적하지 않았다"),
    ("산 건<br>기억이었다", "사진이 아니라 순간을 사간 거였다"),
    ("싸고 빠른 게<br>팔렸다", "저가·저지연 전략이 매출로 이어졌다"),
    ("그대로<br>브랜드에 붙였다", "화이트라벨로 협업까지 확장했다"),
    ("빠른 즐거움이<br>이겼다", "느린 완벽함은 결국 순위 밖이었다"),
]

topic_meta = "TOPIC · NEW BUSINESS"

for i, (slogan, desc) in enumerate(beats, start=1):
    mascots = {
        1: '<img class="mascot" src="images/char4.png" style="width:270px; right:-50px; bottom:-30px; opacity:0.25;">',
        4: '<img class="mascot" src="images/char1.png" style="width:250px; right:-40px; top:-20px; opacity:0.25;">',
        6: '<img class="mascot" src="images/char5.png" style="width:270px; right:-50px; bottom:-30px; opacity:0.25;">',
        9: '<img class="mascot" src="images/char4.png" style="width:250px; right:-40px; bottom:-20px; opacity:0.3;">',
    }
    mascot_html = mascots.get(i, "")
    content = mascot_html + HEADER(f"{i:02d} / 09") + f'''
  <div class="story-body">
    <div class="slogan">{slogan}</div>
    <div class="desc">{desc}</div>
  </div>
  ''' + progress(TOTAL, i) + FOOTER(topic_meta)
    make(content, f"storyB_{i:02d}")

print("done")
