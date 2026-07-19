from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "/Users/nishikawayuuki/Documents/Codex/2026-06-15/new-chat/output/pdf/protected-ui-recommendations.pdf"

NAVY = HexColor("#14213D")
INDIGO = HexColor("#585CF2")
MUTED = HexColor("#68748D")
PALE = HexColor("#F3F5FF")
BORDER = HexColor("#DCE2F1")
WHITE = HexColor("#FFFFFF")

FONT = "ArialUnicode"
pdfmetrics.registerFont(TTFont(FONT, "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))


def page_background(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(HexColor("#F7F9FE"))
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(INDIGO)
    canvas.roundRect(18 * mm, height - 26 * mm, 19 * mm, 4 * mm, 2 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8)
    canvas.drawRightString(width - 18 * mm, 13 * mm, f"Protected UI Review  /  {doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
title = ParagraphStyle(
    "TitleJP",
    parent=styles["Title"],
    fontName=FONT,
    fontSize=23,
    leading=31,
    textColor=NAVY,
    spaceAfter=7 * mm,
)
subtitle = ParagraphStyle(
    "SubtitleJP",
    parent=styles["BodyText"],
    fontName=FONT,
    fontSize=10.5,
    leading=18,
    textColor=MUTED,
    spaceAfter=7 * mm,
)
section = ParagraphStyle(
    "SectionJP",
    parent=styles["Heading2"],
    fontName=FONT,
    fontSize=13,
    leading=19,
    textColor=NAVY,
    spaceAfter=2.5 * mm,
)
body = ParagraphStyle(
    "BodyJP",
    parent=styles["BodyText"],
    fontName=FONT,
    fontSize=9.5,
    leading=16,
    textColor=MUTED,
)
badge = ParagraphStyle(
    "BadgeJP",
    parent=body,
    alignment=TA_CENTER,
    fontSize=8.5,
    leading=13,
    textColor=INDIGO,
)
item_title = ParagraphStyle(
    "ItemTitleJP",
    parent=body,
    fontSize=10,
    leading=16,
    textColor=NAVY,
)


def recommendation(number, heading, description):
    number_cell = Table(
        [[Paragraph(str(number), badge)]],
        colWidths=[10 * mm],
        rowHeights=[10 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PALE),
            ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
    )
    copy = Paragraph(f"<b>{heading}</b><br/><font color='#68748D'>{description}</font>", item_title)
    card = Table(
        [[number_cell, copy]],
        colWidths=[15 * mm, 139 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), WHITE),
            ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
        ]),
    )
    return KeepTogether([card, Spacer(1, 3 * mm)])


doc = BaseDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=22 * mm,
    rightMargin=22 * mm,
    topMargin=24 * mm,
    bottomMargin=21 * mm,
    title="保護指定エリア UI/UX改善提案",
    author="Codex UI Review",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="review", frames=[frame], onPage=page_background)])

story = [
    Spacer(1, 4 * mm),
    Paragraph("保護指定エリア<br/>UI/UX改善提案", title),
    Paragraph(
        "対象はトップページのヒーロー画像と、その下にある「総当たり・リーグ戦・トーナメント」の紹介画像です。"
        "ご指定どおり、今回の実装ではこの範囲を一切変更していません。以下は将来検討できる提案のみです。",
        subtitle,
    ),
    Paragraph("実装していない提案", section),
    recommendation(
        1,
        "画像内ボタンのタップ位置を端末ごとに再検証",
        "見えているボタンは画像の一部で、実際のクリック領域は透明な要素です。画面比率によって位置が少しずれる可能性があるため、代表的なスマホ幅で座標を確認すると安心です。",
    ),
    recommendation(
        2,
        "PC用・スマホ用の透明ボタンを読み上げ順から整理",
        "表示されていない側の透明ボタンがキーボード操作や読み上げの対象にならないよう、端末幅に応じて完全に無効化する設計を検討できます。",
    ),
    recommendation(
        3,
        "画像内テキストのアクセシビリティ補助",
        "画像に含まれるタイトルや説明は文字として選択・拡大・読み上げできません。見た目はそのままに、画面外の説明文や適切な代替テキストを加える方法があります。",
    ),
    recommendation(
        4,
        "ページ見出しの意味付け",
        "メインタイトルが画像のため、検索エンジンや支援技術からページの主見出しを判別しづらい状態です。見た目を変えずに、非表示のH1を補う案があります。",
    ),
    recommendation(
        5,
        "キーボード操作時のフォーカス表示",
        "透明ボタンをTabキーで選んだ際、どこが選ばれているか見えにくいため、画像のボタン位置に控えめな輪郭を表示する案があります。",
    ),
    recommendation(
        6,
        "画像制作時の安全領域を固定",
        "重要な文字やボタンが端末の切り抜きで欠けないよう、PC・スマホそれぞれに安全領域のテンプレートを用意すると、今後の画像差し替えが安定します。",
    ),
]

doc.build(story)
print(OUTPUT)
