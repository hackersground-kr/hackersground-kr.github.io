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
    ("포토부스에 AI를", "촬영한 사진을 AI가 새롭게 바꿔줬다"),
    ("더 정교한 모델로", "표현력과 이미지 완성도를 우선했다"),
    ("결과가 늦게 나왔다", "높은 완성도만큼 생성 시간도 길어졌다"),
    ("기다림은 지루했다", "생성 시간이 길어질수록 현장의 흥이 끊겼다"),
    ("오래된 모델을 골랐다", "완성도는 낮추고 결과는 더 빠르게 보여줬다"),
    ("10초 안에 보여주자", "설렘이 식기 전에 결과가 나왔다"),
    ("완벽하지 않아도", "이미지의 완성도보다 예상 밖의 결과가 재미를 만들었다"),
    ("반응에 기술을 맞췄다", "고객을 기술에 맞추지 않았다"),
    ("고객이 기준이다", "좋은 제품은 고객이 만족할 때 완성된다"),
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
