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
  <img class="mascot" src="images/char5.png" style="width:340px; left:-60px; bottom:-30px; opacity:0.9; transform:rotate(-6deg);">
  <img class="mascot" src="images/char3.png" style="width:220px; right:-30px; top:100px; opacity:0.85; transform:rotate(10deg);">
  ''' + HEADER("STORY") + '''
  <div class="story-body">
    <div class="cover-badge" style="border-color:var(--primary-purple); box-shadow:0 0 30px rgba(139,92,246,0.3);"><span style="color:var(--secondary-purple);">●</span> B2B AUTOMATION · SI</div>
    <div class="slogan" style="margin-top:36px;">진짜 <span class="accent purple">실력</span>은<br><span class="accent purple">이해력</span>이다</div>
    <div class="desc">개발은 이제 병목이 아니다.<br>남은 문제는 '정확히 듣는 것'이었다.</div>
  </div>
  ''' + progress(TOTAL, 0) + FOOTER("8월 AI 빌더모임 · 2026.08.13")
make(cover, "storyC_00_cover")

# ---------- Beats ----------
beats = [
    ("개발은<br>이제 다 된다", "코드 짜는 건 더 이상 병목이 아니다"),
    ("근데<br>자꾸 삐걱댔다", "자동화를 넣어도 현장에선 계속 삐걱댔다"),
    ("코드 탓이<br>아니었다", "문제는 코드 밖에 있었다"),
    ("잘못 들은 게<br>문제였다", "현장이 원하는 걸 잘못 알아들었다"),
    ("한 단어가<br>다 뒤집었다", "용어 하나 오해로 전부 다시 만들었다"),
    ("듣는 시간을<br>늘렸다", "개발보다 듣는 시간에 더 투자했다"),
    ("다르게<br>들리기 시작했다", "같은 기능도 전혀 다르게 완성됐다"),
    ("실력은<br>이해력이다", "AI 시대의 실력은 듣는 능력이다"),
    ("여기는<br>대체 안 된다", "정확히 듣는 자리는 사람만의 몫이다"),
]

topic_meta = "TOPIC · BUSINESS"

for i, (slogan, desc) in enumerate(beats, start=1):
    mascots = {
        1: '<img class="mascot" src="images/char5.png" style="width:270px; right:-50px; bottom:-30px; opacity:0.25;">',
        4: '<img class="mascot" src="images/char3.png" style="width:250px; right:-40px; top:-20px; opacity:0.25;">',
        6: '<img class="mascot" src="images/char2.png" style="width:270px; right:-50px; bottom:-30px; opacity:0.25;">',
        9: '<img class="mascot" src="images/char5.png" style="width:250px; right:-40px; bottom:-20px; opacity:0.3;">',
    }
    mascot_html = mascots.get(i, "")
    content = mascot_html + HEADER(f"{i:02d} / 09") + f'''
  <div class="story-body">
    <div class="slogan">{slogan}</div>
    <div class="desc">{desc}</div>
  </div>
  ''' + progress(TOTAL, i) + FOOTER(topic_meta)
    make(content, f"storyC_{i:02d}")

print("done")
