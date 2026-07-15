from __future__ import annotations

import datetime as _dt
import html
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "huong-dan-import-txt-sang-markdown.docx"


def esc(value: str) -> str:
    return html.escape(value, quote=False)


def r(text: str, *, bold: bool = False, italic: bool = False, color: str | None = None, size: int | None = None) -> str:
    props: list[str] = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    if size:
        props.append(f'<w:sz w:val="{size * 2}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'


def p(text: str = "", style: str = "Normal", *, runs: list[str] | None = None, num: tuple[int, int] | None = None) -> str:
    ppr = [f'<w:pStyle w:val="{style}"/>']
    if num:
        ilvl, num_id = num
        ppr.append(f'<w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="{num_id}"/></w:numPr>')
    body = "".join(runs) if runs is not None else r(text)
    return f"<w:p><w:pPr>{''.join(ppr)}</w:pPr>{body}</w:p>"


def bullet(text: str) -> str:
    return p(text, "ListParagraph", num=(0, 1))


def numbered(text: str) -> str:
    return p(text, "ListParagraph", num=(0, 2))


def code_block(lines: str) -> str:
    return "".join(p(line, "CodeBlock") for line in lines.strip("\n").split("\n"))


def cell(content: str, width: int, fill: str | None = None) -> str:
    shd = f'<w:shd w:fill="{fill}"/>' if fill else ""
    return (
        f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>'
        '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/>'
        f'<w:start w:w="120" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar>{shd}</w:tcPr>'
        f"{content}</w:tc>"
    )


def table(headers: list[str], rows: list[list[str]], widths: list[int]) -> str:
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    header = "".join(cell(p(label, "TableHeader"), width, "E8EEF5") for label, width in zip(headers, widths))
    body_rows = []
    for row in rows:
        body_rows.append("<w:tr>" + "".join(cell(p(value, "TableText"), width) for value, width in zip(row, widths)) + "</w:tr>")
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E2EC"/><w:left w:val="single" w:sz="4" w:color="D9E2EC"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="D9E2EC"/><w:right w:val="single" w:sz="4" w:color="D9E2EC"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="D9E2EC"/><w:insideV w:val="single" w:sz="4" w:color="D9E2EC"/></w:tblBorders>'
        f'</w:tblPr><w:tblGrid>{grid}</w:tblGrid><w:tr>{header}</w:tr>{"".join(body_rows)}</w:tbl>'
    )


def build_document_xml() -> str:
    today = _dt.date.today().strftime("%d/%m/%Y")
    body: list[str] = []

    body.append(p("Hướng dẫn import TXT và chuyển sang Markdown", "Title"))
    body.append(p(f"Blog Hexo + Post Studio | Cập nhật: {today}", "Subtitle"))
    body.append(p("Tài liệu này giải thích cách chuẩn bị file TXT, import vào Post Studio hoặc chuyển đổi bằng terminal, sau đó hiệu chỉnh thành bài Markdown hoàn chỉnh cho website dịch thuật.", "Lead"))

    body.append(p("1. Kết luận nhanh", "Heading1"))
    body.append(p("Có hai cách chuyển TXT sang Markdown trong blog hiện tại:"))
    body.append(bullet("Cách khuyến nghị: dùng Post Studio để tạo bài Side Story/Event Story, chọn file TXT, bấm Chuyển đổi và chèn, rồi hiệu chỉnh trực quan trong editor."))
    body.append(bullet("Cách mạnh hơn: dùng lệnh npm run convert để tạo thẳng file Markdown trong source/_posts/ và tự động copy ảnh/nhạc nếu TXT có chỉ dẫn media."))
    body.append(bullet("Post Studio hiện chỉ import nội dung TXT. Nếu TXT có chỉ dẫn ảnh/nhạc, nó sẽ tạo dòng TODO để bạn import media sau. Terminal converter mới tự copy media cạnh file TXT."))

    body.append(p("2. File TXT cần viết theo cấu trúc nào?", "Heading1"))
    body.append(p("Converter đọc TXT theo từng dòng. Một dòng có dạng Tên nhân vật: Nội dung sẽ được đổi thành block dialogue. Các dòng tiếp theo không có tên nhân vật vẫn thuộc cùng lượt thoại cho đến khi gặp dòng trống, heading, nhân vật mới hoặc chỉ dẫn media."))
    body.append(code_block("""
# Part 1

[IMAGE: cafe.webp | Cafe]

Kanade: Dòng đầu tiên.
Dòng này vẫn thuộc lời thoại của Kanade.

Mafuyu: (Đây là độc thoại nội tâm.)

Mizuki: Cùng cố gắng nào♪
Trước hết là phần quan trọng nhất!

[AUDIO: bgm.mp3 | Main theme]
"""))

    body.append(p("Các quy tắc nhận diện", "Heading2"))
    body.append(table(
        ["Dạng trong TXT", "Ý nghĩa", "Kết quả Markdown"],
        [
            ["# Part 1", "Heading trong TXT.", "Được nâng thành heading Markdown thấp hơn một cấp, ví dụ # thành ##."],
            ["Kanade: Nội dung", "Một lượt thoại của nhân vật.", "Đổi thành {% dialogue kanade %}...{% enddialogue %} nếu tìm được ID."],
            ["Dòng nối tiếp", "Dòng tiếp theo của cùng lượt thoại.", "Nằm trong cùng block dialogue."],
            ["(Nội dung)", "Nếu toàn bộ lượt thoại được bọc trong ngoặc.", "Đổi thành biến thể thought: {% dialogue id thought %}."],
            ["[IMAGE: file | caption]", "Ảnh minh họa / bối cảnh.", "CLI đổi thành {% scene %}; Post Studio tạo TODO import media."],
            ["[AUDIO: file | title]", "Nhạc nền.", "CLI đổi thành {% bgm %}; Post Studio tạo TODO import media."],
            ["Đoạn thường", "Dòng không phải heading, media, dialogue.", "Giữ lại thành paragraph Markdown."],
        ],
        [2100, 2700, 4560],
    ))

    body.append(p("3. Import bằng Post Studio", "Heading1"))
    body.append(p("Đây là cách dễ dùng nhất khi bạn muốn nhìn preview, chỉnh metadata, sửa nội dung ngay trong giao diện."))
    body.append(numbered("Chạy Post Studio:"))
    body.append(code_block("npm run admin"))
    body.append(numbered("Mở http://127.0.0.1:4173 trong trình duyệt."))
    body.append(numbered("Chọn Tạo mới hoặc mở một bài đang chỉnh."))
    body.append(numbered("Ở Loại bài, chọn Side Story hoặc Event Story. Chỉ các template này mới bật khu vực Import kịch bản TXT."))
    body.append(numbered("Bấm Chọn file TXT, chọn file .txt đã chuẩn bị."))
    body.append(numbered("Bấm Chuyển đổi và chèn. Nội dung TXT sẽ được đổi thành các tag Markdown và chèn vào body bài viết."))
    body.append(numbered("Đọc phần cảnh báo nếu có nhân vật chưa khai báo. Sau đó sửa ID, thêm nhân vật trong registry hoặc chỉnh lại tên nhân vật trong TXT."))
    body.append(numbered("Hiệu chỉnh lại bài: tiêu đề, mô tả, nhân vật, trạng thái, đoạn giới thiệu trước <!-- more -->, ảnh/nhạc TODO nếu có."))
    body.append(numbered("Bấm Lưu bài, rồi build để kiểm tra website."))
    body.append(p("Điểm cần nhớ: Post Studio không tự copy ảnh/nhạc từ máy khi bạn chọn TXT. Nếu TXT có [IMAGE] hoặc [AUDIO], nội dung chèn vào sẽ có comment TODO. Bạn cần dùng công cụ import media riêng hoặc chèn tag scene/bgm thủ công sau khi đã đặt file vào source/images hoặc source/audio.", "CalloutText"))

    body.append(p("4. Chuyển đổi bằng terminal", "Heading1"))
    body.append(p("Dùng cách này khi bạn muốn converter tạo file Markdown hoàn chỉnh trong source/_posts/ và copy media tự động. File ảnh/nhạc phải đặt cạnh file TXT hoặc dùng đường dẫn tương đối từ vị trí file TXT."))
    body.append(p("Chạy thử không ghi file", "Heading2"))
    body.append(code_block("""
npm run convert -- res\\Kanade1.txt --title "SHINOBI Stage - Phần 1" --dry-run
"""))
    body.append(p("Tạo bài thật", "Heading2"))
    body.append(code_block("""
npm run convert -- res\\Kanade1.txt ^
  --title "SHINOBI Stage - Phần 1" ^
  --slug "shinobi-stage-phan-1-auto" ^
  --translator "M T" ^
  --categories "Project Sekai,Side Story" ^
  --source-url "https://..."
"""))
    body.append(p("PowerShell cũng có thể dùng dấu backtick ` để xuống dòng. Nếu lệnh nhiều dòng bị khó copy, hãy viết một dòng duy nhất.", "CalloutText"))

    body.append(p("Các tùy chọn quan trọng", "Heading2"))
    body.append(table(
        ["Tùy chọn", "Dùng để làm gì"],
        [
            ["--title", "Tiêu đề bài. Nếu không có, converter lấy tên file TXT."],
            ["--slug", "Tên file Markdown và đường dẫn URL không dấu. Ví dụ shinobi-stage-phan-1."],
            ["--output", "Ghi ra một file Markdown tùy chỉnh thay vì source/_posts/<slug>.md."],
            ["--categories", "Danh mục, ngăn cách bằng dấu phẩy. Ví dụ Project Sekai,Side Story."],
            ["--tags", "Tags bổ sung. Nếu bỏ trống, converter lấy danh sách nhân vật nhận diện được."],
            ["--translator", "Tên người dịch hiển thị trong meta block."],
            ["--source-url", "Link nguồn gốc, đưa vào front matter."],
            ["--description", "Mô tả ngắn cho bài viết."],
            ["--dry-run", "In Markdown ra màn hình, không tạo file và không copy media."],
            ["--force", "Cho phép ghi đè file Markdown đã tồn tại. Chỉ dùng khi chắc chắn."],
        ],
        [2100, 7260],
    ))

    body.append(p("5. Markdown sau khi chuyển đổi sẽ trông như thế nào?", "Heading1"))
    body.append(p("Từ TXT ví dụ ở trên, phần nội dung sau front matter thường có dạng:"))
    body.append(code_block("""
<div class="translation-meta">
  <strong>Tiêu đề:</strong> SHINOBI Stage - Phần 1<br>
  <strong>Nhân vật:</strong> Kanade, Mafuyu, Mizuki<br>
  <strong>Người dịch:</strong> M T<br>
  <strong>Trạng thái:</strong> Bản nháp<br>
  <strong>File nguồn:</strong> Kanade1.txt
</div>

<!-- more -->

## Part 1

{% scene "/images/translations/shinobi-stage-phan-1-auto/cafe.webp" "Cafe" %}

{% dialogue kanade %}
Dòng đầu tiên.
Dòng này vẫn thuộc lời thoại của Kanade.
{% enddialogue %}

{% dialogue mafuyu thought %}
(Đây là độc thoại nội tâm.)
{% enddialogue %}

{% bgm "/audio/translations/shinobi-stage-phan-1-auto/bgm.mp3" "Main theme" autoplay %}
"""))
    body.append(p("Sau khi chuyển đổi, hãy xem Markdown như bản nháp có cấu trúc. Việc dịch mượt, ngắt câu, thêm hình, sửa caption, thêm credit và kiểm tra nhân vật vẫn cần làm thủ công.", "CalloutText"))

    body.append(p("6. Cách converter nhận diện nhân vật", "Heading1"))
    body.append(p("Danh sách nhân vật nằm trong source/_data/characters.yml. Converter so tên trong TXT với các trường ID, name, short_name và aliases. Tên được chuẩn hóa về dạng không dấu, không khoảng trắng/gạch nối để tăng khả năng khớp."))
    body.append(code_block("""
kanade:
  name: Yoisaki Kanade
  short_name: Kanade
  aliases:
    - Yoisaki Kanade
    - 宵崎奏
  color: "#BB6688"
  avatar: /images/characters/project-sekai/kanade.png
"""))
    body.append(p("Nếu TXT có tên chưa khớp registry, converter vẫn tạo block dialogue bằng ID tạm và thêm TODO. Khi gặp TODO, bạn có hai lựa chọn: sửa tên trong TXT/Markdown về alias đã có, hoặc thêm nhân vật/alias mới vào characters.yml.", "CalloutText"))

    body.append(p("7. Import ảnh và nhạc", "Heading1"))
    body.append(p("Với terminal converter, đặt media cạnh file TXT:"))
    body.append(code_block("""
res/
  story.txt
  cafe.webp
  bgm.mp3
"""))
    body.append(p("Trong TXT, viết:"))
    body.append(code_block("""
[IMAGE: cafe.webp | Cafe]
[AUDIO: bgm.mp3 | Main theme]
"""))
    body.append(p("Khi tạo bài thật, converter sẽ copy file vào:"))
    body.append(code_block("""
source/images/translations/<slug>/cafe.webp
source/audio/translations/<slug>/bgm.mp3
"""))
    body.append(p("Nếu bài đã tồn tại và bạn chỉ muốn import media riêng, dùng:"))
    body.append(code_block("""
npm run import:media -- res\\cafe.webp --slug "shinobi-stage-phan-1" --type image --label "Cafe"

npm run import:media -- res\\bgm.mp3 --slug "shinobi-stage-phan-1" --type audio --label "Main theme" --autoplay
"""))

    body.append(p("8. Checklist trước khi lưu hoặc push", "Heading1"))
    body.append(bullet("TXT lưu bằng UTF-8, tránh copy từ Word gây ký tự lạ."))
    body.append(bullet("Tên nhân vật trong TXT khớp ID, short_name hoặc aliases trong characters.yml."))
    body.append(bullet("Mỗi lượt thoại có dạng Nhân vật: Nội dung; không dùng dấu / trong phần tên vì converter không nhận dạng tên chứa dấu gạch chéo."))
    body.append(bullet("Các file ảnh/nhạc nằm cạnh TXT nếu dùng terminal converter."))
    body.append(bullet("Không dùng --force nếu chưa backup hoặc chưa chắc muốn ghi đè bài cũ."))
    body.append(bullet("Sau khi import, đọc lại toàn bộ preview vì converter chỉ lo cấu trúc, không thay thế bước biên tập."))
    body.append(bullet("Chạy npm run build trước khi push để phát hiện lỗi tag, YAML hoặc đường dẫn asset."))

    body.append(p("9. Lỗi thường gặp", "Heading1"))
    body.append(table(
        ["Hiện tượng", "Nguyên nhân thường gặp", "Cách xử lý"],
        [
            ["Nhân vật hiện unknown hoặc có TODO", "Tên trong TXT chưa có trong characters.yml.", "Thêm alias/nhân vật trong Post Studio > Quản lý blog > Nhân vật hoặc sửa tag dialogue về ID đúng."],
            ["Ảnh/nhạc không hiện khi import bằng Post Studio", "Post Studio chỉ chèn TODO media, không copy file media.", "Dùng npm run import:media hoặc đặt asset vào source/images/source/audio rồi chèn tag scene/bgm."],
            ["Converter báo file đã tồn tại", "source/_posts/<slug>.md đã có.", "Đổi slug, dùng --output khác, hoặc chỉ dùng --force khi muốn ghi đè."],
            ["Tiếng Việt bị lỗi dấu trong terminal", "Console hiển thị sai encoding, hoặc file TXT không phải UTF-8.", "Mở file trong VS Code, Save with Encoding: UTF-8; kiểm tra lại trong Post Studio/website."],
            ["Heading bị lệch cấp", "Converter cố ý đổi # thành ## để tránh trùng H1 của bài.", "Sau khi import, chỉnh #/##/### trong Markdown nếu muốn bố cục khác."],
            ["Nhạc không tự phát", "Trình duyệt chặn autoplay có âm thanh.", "Người đọc cần bấm nút phát; đây là hành vi bình thường của browser."],
        ],
        [2100, 3100, 4160],
    ))

    body.append(p("10. Quy trình khuyến nghị của mình", "Heading1"))
    body.append(numbered("Chuẩn bị TXT sạch: heading, thoại, dòng trống giữa các lượt, media directive nếu cần."))
    body.append(numbered("Nếu chưa chắc format đúng, import thử bằng Post Studio để xem preview nhanh."))
    body.append(numbered("Nếu bài có nhiều ảnh/nhạc, dùng terminal converter để copy media tự động."))
    body.append(numbered("Mở bài trong Post Studio, chỉnh metadata và nội dung dịch."))
    body.append(numbered("Cập nhật trang Bản dịch nếu bài cần xuất hiện trong thư viện thủ công."))
    body.append(numbered("Build local, đọc thử website, rồi mới commit/push."))

    body.append(p("Ghi nhớ cuối", "Heading1"))
    body.append(p("Hãy coi import TXT là bước dựng khung, không phải bước xuất bản cuối. Nó giúp bạn đi từ kịch bản thô sang Markdown có avatar, màu nhân vật, ảnh và nhạc nhanh hơn; phần chất lượng cuối cùng vẫn nằm ở khâu hiệu chỉnh sau import.", "Lead"))

    body.append('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>')
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>""" + "".join(body) + "</w:body></w:document>"


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="140"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:b/><w:sz w:val="56"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr><w:sz w:val="24"/><w:color w:val="64748B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Lead"><w:name w:val="Lead"/><w:qFormat/><w:pPr><w:spacing w:before="80" w:after="180" w:line="320" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="24"/><w:color w:val="334155"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="260" w:lineRule="auto"/><w:ind w:left="240"/><w:shd w:fill="F6F8FA"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/><w:color w:val="0F172A"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutText"><w:name w:val="Callout Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="100" w:after="140" w:line="300" w:lineRule="auto"/><w:ind w:left="240"/><w:shd w:fill="EEF2FF"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="1E3A8A"/></w:rPr></w:style>
</w:styles>"""


def numbering_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>"""


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def root_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def doc_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>"""


def settings_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>"""


def core_xml() -> str:
    now = _dt.datetime.now(_dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Hướng dẫn import TXT và chuyển sang Markdown</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""


def app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>"""


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types_xml())
        z.writestr("_rels/.rels", root_rels_xml())
        z.writestr("word/_rels/document.xml.rels", doc_rels_xml())
        z.writestr("word/document.xml", build_document_xml())
        z.writestr("word/styles.xml", styles_xml())
        z.writestr("word/numbering.xml", numbering_xml())
        z.writestr("word/settings.xml", settings_xml())
        z.writestr("docProps/core.xml", core_xml())
        z.writestr("docProps/app.xml", app_xml())
    print(OUT)


if __name__ == "__main__":
    main()
