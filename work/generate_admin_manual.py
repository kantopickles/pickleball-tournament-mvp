from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path("/Users/nishikawayuuki/Documents/Codex/2026-06-15/new-chat")
OUTPUT_DIR = ROOT / "outputs"
OUTPUT_PDF = OUTPUT_DIR / "kanto-pickles-admin-manual.pdf"
ASSET_DIR = ROOT / "work" / "admin_manual_assets"
FONT_PATH = Path("/Library/Fonts/Arial Unicode.ttf")
if not FONT_PATH.exists():
    FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 16 * mm


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("ManualSans", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("ManualSerif", str(FONT_PATH)))


def pill_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size)


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_mock_top_screen(path: Path) -> None:
    img = Image.new("RGB", (1400, 920), "#f7f8f3")
    draw = ImageDraw.Draw(img)
    title = pill_font(54)
    sub = pill_font(22)
    body = pill_font(20)
    bold = pill_font(26)
    small = pill_font(18)

    rounded(draw, (40, 30, 1360, 240), 28, "#ffffff", "#d8dfd2", 2)
    draw.rectangle((40, 30, 1360, 240), fill="#0d3b66")
    draw.text((88, 72), "Kanto Pickle's Drow", font=title, fill="white")
    draw.text((90, 150), "大会一覧と大会作成を1画面で管理", font=sub, fill="#dce8f2")

    rounded(draw, (40, 280, 1360, 570), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 318), "Tournaments", font=small, fill="#c58a1d")
    draw.text((80, 350), "大会一覧", font=bold, fill="#1f261f")
    draw.text((1070, 352), "開く、または作成用PINで削除できます。", font=small, fill="#6f7a70")
    cards = [
        ("6月交流大会", "リーグ戦 / 2ブロック / 3本勝負 / 2026/06/20"),
        ("春のシングルス", "総当たり / 1本勝負 / 2026/06/18"),
        ("ミックスダブルス杯", "トーナメント / 3本勝負 / 2026/06/12"),
    ]
    y = 400
    for i, (name, meta) in enumerate(cards):
        x = 80 + (i % 2) * 620
        yy = y + (i // 2) * 110
        rounded(draw, (x, yy, x + 560, yy + 84), 18, "#f7f8f3", "#d8dfd2", 2)
        draw.text((x + 22, yy + 18), name, font=bold, fill="#1f261f")
        draw.text((x + 22, yy + 50), meta, font=small, fill="#6f7a70")
        rounded(draw, (x + 470, yy + 18, x + 530, yy + 54), 10, "#42c884")
        draw.text((x + 486, yy + 24), "開く", font=small, fill="#0f2618")

    rounded(draw, (40, 610, 1360, 880), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 648), "New tournament", font=small, fill="#c58a1d")
    draw.text((80, 680), "大会を作成", font=bold, fill="#1f261f")
    labels = ["大会名", "大会形式", "1試合あたり", "作成用PIN", "管理者PIN", "参加者PIN"]
    placeholders = ["例: 6月交流大会", "リーグ戦", "3本勝負", "【製作者に聞く】", "4文字以上", "参加者全員で使うPIN"]
    base_y = 730
    for idx, label in enumerate(labels):
        x = 80 + (idx % 2) * 620
        yy = base_y + (idx // 2) * 58
        draw.text((x, yy - 26), label, font=small, fill="#374151")
        rounded(draw, (x, yy, x + 560, yy + 38), 10, "#f9fafb", "#d8dfd2", 2)
        draw.text((x + 16, yy + 8), placeholders[idx], font=small, fill="#93a09a")

    img.save(path)


def draw_mock_access_screen(path: Path) -> None:
    img = Image.new("RGB", (1200, 820), "#f7f8f3")
    draw = ImageDraw.Draw(img)
    title = pill_font(46)
    body = pill_font(24)
    small = pill_font(18)
    bold = pill_font(22)

    rounded(draw, (150, 70, 1050, 700), 26, "#ffffff", "#d8dfd2", 2)
    draw.text((220, 130), "Access", font=small, fill="#c58a1d")
    draw.text((220, 170), "大会ページを開く", font=title, fill="#1f261f")
    draw.text((220, 250), "参加者名や試合情報を表示する前に、PINで確認します。", font=body, fill="#475569")
    draw.text((220, 288), "参加者は参加者PIN、主催者は管理者PINを入力してください。", font=body, fill="#475569")

    rounded(draw, (220, 360, 490, 420), 14, "#0d3b66")
    rounded(draw, (510, 360, 780, 420), 14, "#ffffff", "#d8dfd2", 2)
    draw.text((273, 378), "参加者として開く", font=bold, fill="white")
    draw.text((566, 378), "管理者として開く", font=bold, fill="#334155")

    draw.text((220, 474), "管理者PIN", font=small, fill="#334155")
    rounded(draw, (220, 500, 780, 552), 12, "#f9fafb", "#d8dfd2", 2)
    draw.text((240, 516), "••••••••", font=body, fill="#94a3b8")

    rounded(draw, (220, 594, 430, 650), 14, "#42c884")
    rounded(draw, (450, 594, 660, 650), 14, "#ffffff", "#d8dfd2", 2)
    draw.text((285, 611), "大会を開く", font=bold, fill="#0f2618")
    draw.text((495, 611), "参加者向け使い方", font=small, fill="#334155")
    img.save(path)


def draw_mock_admin_screen(path: Path) -> None:
    img = Image.new("RGB", (1400, 1200), "#f7f8f3")
    draw = ImageDraw.Draw(img)
    title = pill_font(44)
    body = pill_font(20)
    small = pill_font(18)
    bold = pill_font(26)
    stat = pill_font(34)

    rounded(draw, (40, 30, 1360, 250), 24, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 72), "リーグテスト1", font=title, fill="#1f261f")
    draw.text((80, 132), "リーグ戦", font=small, fill="#c58a1d")
    for i, (n, label, color) in enumerate([(12, "参加者", "#42c884"), (7, "未入力", "#f5d35f"), (5, "入力済み", "#f06f45")]):
        x = 80 + i * 180
        rounded(draw, (x, 160, x + 150, 224), 14, "#f7f8f3", "#d8dfd2", 2)
        draw.text((x + 18, 172), str(n), font=stat, fill=color)
        draw.text((x + 18, 206), label, font=small, fill="#6f7a70")

    rounded(draw, (40, 290, 760, 680), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 330), "Admin", font=small, fill="#c58a1d")
    draw.text((80, 364), "管理者メニュー", font=bold, fill="#1f261f")
    fields = ["管理者PIN", "参加者共通PINを変更", "参加者名", "開始順位", "終了順位"]
    vals = ["••••••", "new-participant-pin", "田中 / 斉藤", "1位", "2位"]
    y = 430
    for label, val in zip(fields, vals):
        draw.text((80, y - 28), label, font=small, fill="#334155")
        rounded(draw, (80, y, 720, y + 40), 10, "#f9fafb", "#d8dfd2", 2)
        draw.text((96, y + 8), val, font=small, fill="#64748b")
        y += 74
    rounded(draw, (80, 620, 280, 660), 12, "#42c884")
    rounded(draw, (300, 620, 520, 660), 12, "#f06f45")
    draw.text((132, 632), "参加者を追加", font=small, fill="#0f2618")
    draw.text((336, 632), "1位2位トーナメント作成", font=small, fill="#fff7ed")

    rounded(draw, (800, 290, 1360, 680), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((840, 330), "Players", font=small, fill="#c58a1d")
    draw.text((840, 364), "参加者", font=bold, fill="#1f261f")
    players = [("田中 / 斉藤", "B1"), ("佐藤 / 高橋", "B1"), ("鈴木 / 伊藤", "B2"), ("山本 / 小林", "B2")]
    py = 420
    for name, block in players:
        rounded(draw, (840, py, 1320, py + 70), 16, "#f7f8f3", "#d8dfd2", 2)
        draw.text((864, py + 20), name, font=small, fill="#1f261f")
        rounded(draw, (1160, py + 18, 1230, py + 48), 12, "#dff4e8")
        rounded(draw, (1240, py + 18, 1300, py + 48), 12, "#fff1f2")
        draw.text((1182, py + 24), block, font=small, fill="#138a57")
        draw.text((1260, py + 24), "削除", font=small, fill="#b91c1c")
        py += 86

    rounded(draw, (40, 730, 1360, 1120), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 770), "Matches", font=small, fill="#c58a1d")
    draw.text((80, 804), "試合", font=bold, fill="#1f261f")
    for idx, status in enumerate(["未入力", "ロック済み"]):
        yy = 860 + idx * 116
        rounded(draw, (80, yy, 1320, yy + 92), 18, "#f9fafb", "#d8dfd2", 2)
        draw.text((110, yy + 18), f"R{idx + 1} / {idx + 1}", font=small, fill="#42c884")
        draw.text((110, yy + 48), "田中 / 斉藤  vs  佐藤 / 高橋", font=body, fill="#1f261f")
        color = "#fff3ca" if status == "未入力" else "#dff4e8"
        text_color = "#9a6a00" if status == "未入力" else "#138a57"
        rounded(draw, (1150, yy + 18, 1280, yy + 52), 12, color)
        draw.text((1178, yy + 27), status, font=small, fill=text_color)
        rounded(draw, (110, yy + 118 - 58, 340, yy + 118 - 18), 12, "#0d3b66")
        rounded(draw, (360, yy + 118 - 58, 560, yy + 118 - 18), 12, "#ffffff", "#d8dfd2", 2)
        draw.text((180, yy + 118 - 48), "結果を保存", font=small, fill="white")
        draw.text((430, yy + 118 - 48), "ロック解除", font=small, fill="#334155")
    img.save(path)


def draw_mock_league_screen(path: Path) -> None:
    img = Image.new("RGB", (1400, 1020), "#f7f8f3")
    draw = ImageDraw.Draw(img)
    small = pill_font(18)
    body = pill_font(20)
    bold = pill_font(28)

    rounded(draw, (40, 40, 900, 520), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 82), "League", font=small, fill="#c58a1d")
    draw.text((80, 116), "リーグ表", font=bold, fill="#1f261f")
    headers = ["", "田中", "佐藤", "鈴木", "山本"]
    x0, y0, cell_w, cell_h = 80, 180, 140, 64
    for c, header in enumerate(headers):
        rounded(draw, (x0 + c * cell_w, y0, x0 + (c + 1) * cell_w - 6, y0 + cell_h - 6), 10, "#eef3ea")
        draw.text((x0 + c * cell_w + 22, y0 + 18), header, font=small, fill="#334155")
    names = ["田中", "佐藤", "鈴木", "山本"]
    values = [["-", "11-7", "未入力", "11-8"], ["7-11", "-", "11-9", "未入力"], ["未入力", "9-11", "-", "11-4"], ["8-11", "未入力", "4-11", "-"]]
    for r, name in enumerate(names):
        yy = y0 + (r + 1) * cell_h
        rounded(draw, (x0, yy, x0 + cell_w - 6, yy + cell_h - 6), 10, "#eef3ea")
        draw.text((x0 + 22, yy + 18), name, font=small, fill="#334155")
        for c, val in enumerate(values[r]):
            fill = "#fff3ca" if val == "未入力" else "#ffffff"
            rounded(draw, (x0 + (c + 1) * cell_w, yy, x0 + (c + 2) * cell_w - 6, yy + cell_h - 6), 10, fill, "#d8dfd2", 2)
            draw.text((x0 + (c + 1) * cell_w + 26, yy + 18), val, font=small, fill="#1f261f")

    rounded(draw, (940, 40, 1360, 520), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((980, 82), "Standings", font=small, fill="#c58a1d")
    draw.text((980, 116), "順位表", font=bold, fill="#1f261f")
    ranking = [("1", "田中", "3", "+12"), ("2", "鈴木", "2", "+5"), ("3", "佐藤", "1", "-2"), ("4", "山本", "0", "-15")]
    yy = 176
    for rank, name, win, diff in ranking:
        rounded(draw, (980, yy, 1320, yy + 62), 14, "#f7f8f3", "#d8dfd2", 2)
        draw.text((1004, yy + 18), f"{rank}位", font=small, fill="#334155")
        draw.text((1088, yy + 18), name, font=small, fill="#1f261f")
        draw.text((1214, yy + 18), f"{win}勝", font=small, fill="#138a57")
        draw.text((1268, yy + 18), diff, font=small, fill="#9a6a00")
        yy += 78

    rounded(draw, (40, 570, 1360, 960), 22, "#ffffff", "#d8dfd2", 2)
    draw.text((80, 612), "Playoff", font=small, fill="#c58a1d")
    draw.text((80, 646), "順位別トーナメント", font=bold, fill="#1f261f")
    rounded(draw, (80, 708, 360, 760), 12, "#f06f45")
    rounded(draw, (380, 708, 620, 760), 12, "#f06f45")
    draw.text((146, 724), "1位トーナメント作成", font=small, fill="#fff7ed")
    draw.text((436, 724), "2位トーナメント作成", font=small, fill="#fff7ed")

    matches = [("準決勝", "田中 / 斉藤", "鈴木 / 伊藤"), ("決勝", "Winner SF1", "Winner SF2")]
    mx = 760
    for idx, (round_name, left, right) in enumerate(matches):
        yy = 700 + idx * 120
        rounded(draw, (mx, yy, mx + 480, yy + 86), 18, "#f9fafb", "#d8dfd2", 2)
        draw.text((mx + 24, yy + 18), round_name, font=small, fill="#42c884")
        draw.text((mx + 24, yy + 48), f"{left}  vs  {right}", font=body, fill="#1f261f")
    img.save(path)


def create_assets() -> dict[str, Path]:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    assets = {
        "top": ASSET_DIR / "top.png",
        "access": ASSET_DIR / "access.png",
        "admin": ASSET_DIR / "admin.png",
        "league": ASSET_DIR / "league.png",
    }
    draw_mock_top_screen(assets["top"])
    draw_mock_access_screen(assets["access"])
    draw_mock_admin_screen(assets["admin"])
    draw_mock_league_screen(assets["league"])
    return assets


def draw_page_number(pdf: canvas.Canvas, page_number: int) -> None:
    pdf.setFont("ManualSerif", 9)
    pdf.setFillColor(colors.HexColor("#6b7280"))
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 9 * mm, f"{page_number}")


def draw_header(pdf: canvas.Canvas, title: str, subtitle: str) -> None:
    pdf.setFillColor(colors.HexColor("#0f4c81"))
    pdf.roundRect(MARGIN_X, PAGE_HEIGHT - 40 * mm, PAGE_WIDTH - MARGIN_X * 2, 27 * mm, 8 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("ManualSans", 23)
    pdf.drawString(MARGIN_X + 8 * mm, PAGE_HEIGHT - 24 * mm, title)
    pdf.setFont("ManualSerif", 11)
    pdf.drawString(MARGIN_X + 8 * mm, PAGE_HEIGHT - 33 * mm, subtitle)


def section_title(pdf: canvas.Canvas, y: float, text: str) -> float:
    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.setFont("ManualSans", 16)
    pdf.drawString(MARGIN_X, y, text)
    pdf.setStrokeColor(colors.HexColor("#f59e0b"))
    pdf.setLineWidth(2)
    pdf.line(MARGIN_X, y - 3 * mm, MARGIN_X + 30 * mm, y - 3 * mm)
    return y - 9 * mm


def paragraph(pdf: canvas.Canvas, x: float, y: float, text: str, size: int = 10, color: str = "#334155", leading: float = 5.0 * mm) -> float:
    pdf.setFillColor(colors.HexColor(color))
    pdf.setFont("ManualSerif", size)
    obj = pdf.beginText()
    obj.setTextOrigin(x, y)
    obj.setLeading(leading)
    for line in text.split("\n"):
        obj.textLine(line)
    pdf.drawText(obj)
    return y - len(text.split("\n")) * leading


def info_box(pdf: canvas.Canvas, x: float, y: float, w: float, items: list[str], fill: str = "#f8fafc") -> float:
    line_h = 6 * mm
    h = 9 * mm + len(items) * line_h
    pdf.setFillColor(colors.HexColor(fill))
    pdf.setStrokeColor(colors.HexColor("#d7dee7"))
    pdf.roundRect(x, y - h, w, h, 5 * mm, fill=1, stroke=1)
    pdf.setFillColor(colors.HexColor("#1f2937"))
    pdf.setFont("ManualSerif", 10)
    yy = y - 6 * mm
    for item in items:
        pdf.drawString(x + 4 * mm, yy, f"- {item}")
        yy -= line_h
    return y - h - 3 * mm


def image_card(pdf: canvas.Canvas, image_path: Path, x: float, y: float, w: float, h: float, caption: str) -> float:
    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(colors.HexColor("#d7dee7"))
    pdf.roundRect(x, y - h, w, h, 5 * mm, fill=1, stroke=1)
    pdf.drawImage(ImageReader(str(image_path)), x + 4 * mm, y - h + 14 * mm, width=w - 8 * mm, height=h - 24 * mm, preserveAspectRatio=True, mask="auto")
    pdf.setFillColor(colors.HexColor("#475569"))
    pdf.setFont("ManualSerif", 9)
    pdf.drawString(x + 4 * mm, y - h + 6 * mm, caption)
    return y - h


def two_col_steps(pdf: canvas.Canvas, y: float, steps: list[tuple[str, str]]) -> float:
    gap = 4 * mm
    card_w = (PAGE_WIDTH - MARGIN_X * 2 - gap) / 2
    card_h = 26 * mm
    for idx, (title, body) in enumerate(steps):
        col = idx % 2
        row = idx // 2
        x = MARGIN_X + col * (card_w + gap)
        yy = y - row * (card_h + gap)
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(colors.HexColor("#d7dee7"))
        pdf.roundRect(x, yy - card_h, card_w, card_h, 5 * mm, fill=1, stroke=1)
        pdf.setFillColor(colors.HexColor("#0f4c81"))
        pdf.circle(x + 7 * mm, yy - 7 * mm, 4 * mm, fill=1, stroke=0)
        pdf.setFillColor(colors.white)
        pdf.setFont("ManualSans", 10)
        pdf.drawCentredString(x + 7 * mm, yy - 8.2 * mm, str(idx + 1))
        pdf.setFillColor(colors.HexColor("#0f172a"))
        pdf.drawString(x + 14 * mm, yy - 8 * mm, title)
        paragraph(pdf, x + 14 * mm, yy - 15 * mm, body, size=9, leading=4.6 * mm)
    rows = (len(steps) + 1) // 2
    return y - rows * (card_h + gap) + gap - 2 * mm


def build_pdf() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()
    assets = create_assets()

    pdf = canvas.Canvas(str(OUTPUT_PDF), pagesize=A4)
    pdf.setTitle("Kanto Pickle's Drow 管理者向け取扱説明書")

    # 1 cover
    pdf.setFillColor(colors.HexColor("#f8fafc"))
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, "Kanto Pickle's Drow 管理者向け取扱説明書", "大会作成から結果修正までを画像付きで整理した拡張版")
    y = PAGE_HEIGHT - 54 * mm
    y = paragraph(pdf, MARGIN_X, y, "このPDFは主催者向けです。\n大会を作る、参加者を入れる、ドローを作る、結果を直す、順位別トーナメントを作る、までを順番に追えます。", size=10)
    pdf.setFillColor(colors.HexColor("#fff7ed"))
    pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
    pdf.roundRect(MARGIN_X, y - 30 * mm, PAGE_WIDTH - MARGIN_X * 2, 26 * mm, 5 * mm, fill=1, stroke=1)
    pdf.setFillColor(colors.HexColor("#7c2d12"))
    pdf.setFont("ManualSans", 11)
    pdf.drawString(MARGIN_X + 5 * mm, y - 11 * mm, "管理情報")
    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("ManualSerif", 10)
    pdf.drawString(MARGIN_X + 40 * mm, y - 11 * mm, "作成用PIN: 【製作者に聞く】")
    pdf.drawString(MARGIN_X + 40 * mm, y - 19 * mm, "管理者PIN: 大会ごとに自分で決める / 参加者PIN: 参加者全員で共通")
    image_card(pdf, assets["top"], MARGIN_X, 106 * mm, PAGE_WIDTH - MARGIN_X * 2, 102 * mm, "トップページの見本: 大会一覧と大会作成フォーム")
    draw_page_number(pdf, 1)
    pdf.showPage()

    # 2 create tournament
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, "1. まず大会を作る", "トップページで最初に設定すること")
    y = PAGE_HEIGHT - 54 * mm
    y = two_col_steps(pdf, y, [
        ("大会名を決める", "あとから一覧で見て分かる名前にします。"),
        ("大会形式を選ぶ", "総当たり / リーグ戦 / トーナメント から選びます。"),
        ("1試合あたりを選ぶ", "1本勝負 / 3本勝負 / 5本勝負 から選びます。"),
        ("PINを設定する", "作成用PINは【製作者に聞く】。管理者PINと参加者PINは自分で決めます。"),
    ])
    y = section_title(pdf, y, "画面イメージ")
    image_card(pdf, assets["top"], MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, 92 * mm, "大会一覧の下に大会作成フォームがあります")
    y -= 98 * mm
    info_box(pdf, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, [
        "リーグ戦を選ぶとブロック数も選べます。",
        "大会作成ボタンを押すと、その大会専用URLが作られます。",
        "大会一覧からその大会を開いて管理に進みます。",
    ], fill="#eff6ff")
    draw_page_number(pdf, 2)
    pdf.showPage()

    # 3 access
    pdf.setFillColor(colors.HexColor("#fffdf8"))
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, "2. 大会ページを開く", "いきなり中身は見えず、先にPIN確認があります")
    y = PAGE_HEIGHT - 54 * mm
    y = paragraph(pdf, MARGIN_X, y, "大会一覧で「開く」を押すと、まずPIN確認ページが出ます。\n管理者はここで管理者PINを入れて入場します。", size=10)
    y = section_title(pdf, y - 2 * mm, "画面イメージ")
    image_card(pdf, assets["access"], MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, 105 * mm, "管理者として開くを選び、管理者PINを入力します")
    y -= 111 * mm
    y = section_title(pdf, y, "ここで分かれていること")
    info_box(pdf, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, [
        "参加者は参加者PINで入ります。",
        "管理者は管理者PINで入ります。",
        "PINを知らない人は大会の中身を見られません。",
        "参加者向け使い方ページへの導線もここにあります。",
    ], fill="#f0fdf4")
    draw_page_number(pdf, 3)
    pdf.showPage()

    # 4 admin dashboard
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, "3. 管理者メニューで大会を回す", "参加者登録、参加者PIN変更、ドロー生成、組み替え")
    y = PAGE_HEIGHT - 54 * mm
    y = two_col_steps(pdf, y, [
        ("参加者を追加", "管理者メニューで参加者名を1人ずつ追加します。"),
        ("参加者共通PINを変更", "必要なら途中で参加者PINを更新できます。"),
        ("ドローを生成", "参加者がそろったら自動で対戦表を作ります。"),
        ("対戦相手を組み替え", "各試合カードから手動で入れ替えできます。"),
    ])
    y = section_title(pdf, y, "画面イメージ")
    image_card(pdf, assets["admin"], MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, 118 * mm, "左に管理者メニュー、右に参加者一覧、下に試合カードが並びます")
    draw_page_number(pdf, 4)
    pdf.showPage()

    # 5 league
    pdf.setFillColor(colors.HexColor("#fffdf8"))
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, "4. リーグ戦の運用", "リーグ表、順位表、順位別トーナメント")
    y = PAGE_HEIGHT - 54 * mm
    y = paragraph(pdf, MARGIN_X, y, "リーグ戦は、ブロック内の入力が終わると順位表が自動で更新されます。\nそのあと管理者メニューから順位別トーナメントを追加できます。", size=10)
    y = section_title(pdf, y - 2 * mm, "画面イメージ")
    image_card(pdf, assets["league"], MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, 106 * mm, "左にリーグ表、右に順位表、下に順位別トーナメント作成")
    y -= 112 * mm
    y = section_title(pdf, y, "覚えておくこと")
    info_box(pdf, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, [
        "順位は 勝利数 -> 得失 -> 直接対戦 の順で判定されます。",
        "1位トーナメント、2位トーナメント、1位2位トーナメント などを作れます。",
        "予選リーグに未入力試合が残っていると順位別トーナメントは作れません。",
        "間違って作った順位別トーナメントは削除できます。",
    ], fill="#fff7ed")
    draw_page_number(pdf, 5)
    pdf.showPage()

    # 6 finish
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, "5. よく使う管理操作", "結果修正、大会削除、参加者への共有")
    y = PAGE_HEIGHT - 54 * mm
    y = section_title(pdf, y, "結果修正")
    y = info_box(pdf, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, [
        "入力済み試合はロックされます。",
        "修正したいときは管理者として入り、該当試合でロック解除を押します。",
        "点数を入れ直して、もう一度保存します。",
    ], fill="#fef2f2")
    y = section_title(pdf, y, "大会削除")
    y = info_box(pdf, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, [
        "トップページの大会一覧から削除できます。",
        "削除時に使うのは管理者PINではなく作成用PINです。",
        "作成用PINの表記はこのPDFでは【製作者に聞く】にしています。",
    ], fill="#fff7ed")
    y = section_title(pdf, y, "参加者への共有")
    y = info_box(pdf, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2, [
        "共有するのは大会URLと参加者PINです。",
        "参加者は参加者PINを入れ、自分の名前を選んで入ります。",
        "自分の名前が含まれる未入力試合だけ結果保存できます。",
    ], fill="#eff6ff")
    paragraph(pdf, MARGIN_X, 24 * mm, "更新メモ\nこの取説は 2026-06-20 時点の Kanto Pickle's Drow の画面構成をもとに作成しています。", size=9, color="#64748b", leading=4.6 * mm)
    draw_page_number(pdf, 6)
    pdf.save()
    return OUTPUT_PDF


if __name__ == "__main__":
    print(build_pdf())
