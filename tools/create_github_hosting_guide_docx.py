from __future__ import annotations

import datetime as _dt
import html
import os
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "huong-dan-host-github-pages.docx"


def esc(value: str) -> str:
    return html.escape(value, quote=False)


def r(text: str, *, bold: bool = False, italic: bool = False, color: str | None = None, size: int | None = None) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    if size:
        props.append(f'<w:sz w:val="{size * 2}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f"<w:r>{rpr}<w:t xml:space=\"preserve\">{esc(text)}</w:t></w:r>"


def p(text: str = "", style: str = "Normal", *, runs: list[str] | None = None, num: tuple[int, int] | None = None) -> str:
    ppr = [f'<w:pStyle w:val="{style}"/>']
    if num:
        ilvl, num_id = num
        ppr.append(f"<w:numPr><w:ilvl w:val=\"{ilvl}\"/><w:numId w:val=\"{num_id}\"/></w:numPr>")
    body = "".join(runs) if runs is not None else r(text)
    return f"<w:p><w:pPr>{''.join(ppr)}</w:pPr>{body}</w:p>"


def code_block(lines: str) -> str:
    out = []
    for line in lines.strip("\n").split("\n"):
        out.append(p(line, "CodeBlock"))
    return "".join(out)


def cell(content: str, width: int, fill: str | None = None) -> str:
    shd = f'<w:shd w:fill="{fill}"/>' if fill else ""
    return (
        f"<w:tc><w:tcPr><w:tcW w:w=\"{width}\" w:type=\"dxa\"/>"
        f"<w:tcMar><w:top w:w=\"80\" w:type=\"dxa\"/><w:bottom w:w=\"80\" w:type=\"dxa\"/>"
        f"<w:start w:w=\"120\" w:type=\"dxa\"/><w:end w:w=\"120\" w:type=\"dxa\"/></w:tcMar>{shd}</w:tcPr>{content}</w:tc>"
    )


def table(headers: list[str], rows: list[list[str]], widths: list[int]) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    header_cells = "".join(cell(p(h, "TableHeader"), w, "E8EEF5") for h, w in zip(headers, widths))
    body_rows = []
    for row in rows:
        body_rows.append("<w:tr>" + "".join(cell(p(value, "TableText"), w) for value, w in zip(row, widths)) + "</w:tr>")
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E2EC"/><w:left w:val="single" w:sz="4" w:color="D9E2EC"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="D9E2EC"/><w:right w:val="single" w:sz="4" w:color="D9E2EC"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="D9E2EC"/><w:insideV w:val="single" w:sz="4" w:color="D9E2EC"/></w:tblBorders>'
        f'</w:tblPr><w:tblGrid>{grid}</w:tblGrid><w:tr>{header_cells}</w:tr>{"".join(body_rows)}</w:tbl>'
    )


def callout(title: str, body: str) -> str:
    content = p("", "CalloutTitle", runs=[r(title, bold=True, color="1F3A5F")]) + p(body, "CalloutText")
    return table([""], [[body]], [9360]).replace(p("", "TableHeader"), p(title, "CalloutTitle"), 1)


def bullet(text: str) -> str:
    return p(text, "ListParagraph", num=(0, 1))


def numbered(text: str) -> str:
    return p(text, "ListParagraph", num=(0, 2))


def build_document_xml() -> str:
    today = _dt.date.today().strftime("%d/%m/%Y")
    body: list[str] = []
    body.append(p("Hướng dẫn host và vận hành blog Hexo trên GitHub Pages", "Title"))
    body.append(p(f"Website Hexo + NexT + Post Studio | Cập nhật: {today}", "Subtitle"))
    body.append(p("Tài liệu này dành cho việc đưa blog dịch thuật lên GitHub Pages, duy trì nội dung bằng Post Studio và kiểm soát các rủi ro thường gặp khi public một website tĩnh.", "Lead"))

    body.append(p("1. Mô hình hoạt động", "Heading1"))
    body.append(p("Website này là website tĩnh tạo bằng Hexo. Nội dung nguồn nằm trong thư mục source/, cấu hình nằm ở _config.yml và _config.next.yml, còn public/ là kết quả build. GitHub Pages nên build từ mã nguồn bằng GitHub Actions thay vì sửa trực tiếp public/."))
    body.append(bullet("Bạn viết hoặc chỉnh bài bằng Post Studio trên máy cá nhân."))
    body.append(bullet("Post Studio lưu file Markdown, YAML và tài nguyên vào workspace."))
    body.append(bullet("Bạn commit và push mã nguồn lên GitHub."))
    body.append(bullet("GitHub Actions chạy npm install và npm run build để sinh website."))
    body.append(bullet("GitHub Pages phục vụ nội dung đã build ra Internet."))

    body.append(p("2. Chuẩn bị trước khi đưa lên GitHub", "Heading1"))
    body.append(numbered("Tạo tài khoản GitHub và repository. Nếu muốn dùng domain mặc định, đặt tên repo là YOUR_USERNAME.github.io."))
    body.append(numbered("Cài Git và Node.js 20.19 trở lên trên máy cá nhân."))
    body.append(numbered("Kiểm tra dự án chạy được bằng npm install, npm run clean và npm run build."))
    body.append(numbered("Sửa thông tin nhận diện blog, liên hệ, GitHub, email và URL website trước khi public."))
    body.append(numbered("Đảm bảo tài nguyên thật nằm trong source/, không chỉ nằm trong public/."))

    body.append(p("Các file cần kiểm tra", "Heading2"))
    body.append(table(
        ["File / thư mục", "Vai trò", "Điều cần kiểm soát"],
        [
            ["_config.yml", "Cấu hình chính của Hexo", "url, title, subtitle, author, description."],
            ["_config.next.yml", "Cấu hình theme NexT", "menu, social, avatar, font, màu nhận diện."],
            ["source/_posts/", "Bài viết gốc", "Không để bản nháp hoặc ghi chú riêng tư bị published."],
            ["source/_data/characters.yml", "Registry nhân vật", "Đúng ID, ảnh, màu, alias; YAML phải hợp lệ."],
            ["source/images/ và source/audio/", "Tài nguyên public", "Chỉ đưa lên ảnh/nhạc được phép chia sẻ."],
            [".github/workflows/pages.yml", "Workflow deploy", "Không chứa secret thừa; chỉ cấp quyền cần thiết."],
        ],
        [2300, 2500, 4560],
    ))

    body.append(p("3. Cấu hình GitHub Pages", "Heading1"))
    body.append(numbered("Push toàn bộ mã nguồn lên nhánh main."))
    body.append(numbered("Vào GitHub repository → Settings → Pages."))
    body.append(numbered("Ở Source, chọn GitHub Actions."))
    body.append(numbered("Đảm bảo workflow .github/workflows/pages.yml tồn tại."))
    body.append(numbered("Mỗi lần push main, GitHub Actions sẽ tự build và deploy."))
    body.append(p("Workflow tối thiểu nên làm các việc: checkout mã nguồn, cài Node, chạy npm ci hoặc npm install, chạy npm run build, upload thư mục public/ và deploy Pages."))

    body.append(p("4. Quy trình vận hành hằng ngày", "Heading1"))
    body.append(numbered("Chạy Post Studio bằng npm run admin và mở http://127.0.0.1:4173."))
    body.append(numbered("Tạo hoặc chỉnh bài trong tab Bài viết. Dùng trạng thái Bản nháp / Chưa hoàn thành / Hoàn thành."))
    body.append(numbered("Với Side Story hoặc Event Story, import TXT rồi rà lại dialogue, ảnh, nhạc và credit."))
    body.append(numbered("Với trang Bản dịch, vào Quản lý blog để sửa source/overview/index.md."))
    body.append(numbered("Chạy npm run clean và npm run build trước khi push nếu vừa đổi CSS, tag helper hoặc cấu hình."))
    body.append(numbered("Kiểm tra local, commit, rồi push lên GitHub."))
    body.append(code_block("""
npm run admin
npm run clean
npm run build
git status
git add .
git commit -m "Update translations"
git push
"""))

    body.append(p("5. Kiểm tra trước khi public", "Heading1"))
    body.append(bullet("Không còn placeholder như YOUR_USERNAME, your-email@example.com, Tên của bạn hoặc TODO riêng tư."))
    body.append(bullet("Không có file nhạy cảm như .env, token, cookie, log cá nhân, bản dịch chưa xin phép hoặc ghi chú nội bộ."))
    body.append(bullet("Tất cả ảnh cần public nằm trong source/images/; tất cả nhạc cần public nằm trong source/audio/."))
    body.append(bullet("Các bài chưa muốn công khai có published: false hoặc chưa được commit."))
    body.append(bullet("Trang About có ghi rõ website phi lợi nhuận, không chính thức và cách liên hệ."))
    body.append(bullet("Bài dịch có nguồn gốc, credit hình ảnh/nhạc và ghi chú bản quyền phù hợp."))
    body.append(code_block('rg "YOUR_USERNAME|your-email@example.com|Tên của bạn|TODO|SECRET|TOKEN|PASSWORD|PRIVATE"'))

    body.append(p("6. Nguy cơ cần kiểm soát", "Heading1"))
    body.append(table(
        ["Nguy cơ", "Tác động", "Cách kiểm soát"],
        [
            ["Lộ thông tin cá nhân", "Email, username, đường dẫn máy hoặc ghi chú riêng tư bị public.", "Chạy rg kiểm tra placeholder/secret; xem git diff trước khi commit."],
            ["Đưa nhầm bản nháp", "Người đọc thấy nội dung chưa hoàn thiện.", "Dùng published: false; kiểm tra Post Studio filter Đang hiện trước khi push."],
            ["Vi phạm bản quyền ảnh/nhạc", "Bị gỡ nội dung hoặc khiếu nại.", "Chỉ dùng tài nguyên được phép; ghi nguồn; cân nhắc tránh host nhạc thương mại."],
            ["Build GitHub thất bại", "Website không cập nhật.", "Đọc tab Actions; kiểm tra Node version, package-lock.json và lỗi YAML/Markdown."],
            ["Mất tài nguyên sau hexo clean", "Ảnh hiện ở public nhưng mất ở lần build sau.", "Luôn đặt tài nguyên gốc trong source/, không chỉnh trực tiếp public/."],
            ["Hỏng link cũ", "Người đọc hoặc trang Bản dịch gặp 404.", "Không đổi slug sau khi publish; nếu buộc đổi, cập nhật toàn bộ link."],
            ["YAML sai indent", "Post Studio hoặc Hexo build lỗi.", "Sửa trong Post Studio cẩn thận; build local trước khi push."],
            ["GitHub Pages cache", "Đã push nhưng trang chưa đổi ngay.", "Đợi vài phút; kiểm tra Actions deploy thành công; hard refresh trình duyệt."],
        ],
        [2200, 3000, 4160],
    ))

    body.append(p("7. Những việc không nên làm", "Heading1"))
    body.append(bullet("Không chỉnh trực tiếp node_modules/ hoặc public/ như nguồn chính."))
    body.append(bullet("Không đưa Post Studio lên GitHub Pages; Post Studio chỉ nên chạy local tại 127.0.0.1."))
    body.append(bullet("Không commit file .env, token, archive riêng tư, bản raw chưa muốn công khai."))
    body.append(bullet("Không dùng nhạc nền autoplay bừa bãi; trình duyệt có thể chặn và người đọc có thể khó chịu."))
    body.append(bullet("Không đổi cấu trúc URL/slug hàng loạt khi đã có người đọc."))

    body.append(p("8. Xử lý sự cố thường gặp", "Heading1"))
    body.append(table(
        ["Hiện tượng", "Nguyên nhân thường gặp", "Cách xử lý"],
        [
            ["Port 4000 has been used", "Hexo server cũ còn chạy.", "Mở localhost:4000 kiểm tra; tắt terminal cũ hoặc chạy npx hexo server -p 4001."],
            ["Website local không đổi", "Cache Hexo hoặc public cũ.", "Chạy npm run clean rồi npm run build."],
            ["GitHub Actions đỏ", "Lỗi build trên GitHub.", "Mở Actions, đọc log, sửa lỗi rồi push lại."],
            ["Ảnh không hiện", "Ảnh chỉ có trong public hoặc sai đường dẫn.", "Đưa ảnh vào source/images/... và dùng đường dẫn /images/..."],
            ["Dialogue dùng unknown", "ID nhân vật chưa có trong characters.yml.", "Thêm ID hoặc sửa tag dialogue cho đúng."],
        ],
        [2300, 3000, 4060],
    ))

    body.append(p("9. Checklist triển khai lần đầu", "Heading1"))
    checks = [
        "Đã sửa _config.yml: title, subtitle, description, author, url.",
        "Đã sửa _config.next.yml: GitHub, email, avatar, menu.",
        "Đã kiểm tra About, Updates và Overview.",
        "Đã chạy npm run clean và npm run build thành công.",
        "Đã tìm placeholder và thông tin nhạy cảm bằng rg.",
        "Đã kiểm tra các bài đang hiển thị trong Post Studio.",
        "Đã commit source/, package.json, package-lock.json, scripts/, tools/, admin/ và workflow.",
        "Đã bật GitHub Pages bằng GitHub Actions.",
        "Đã xem kết quả deploy và mở website public.",
    ]
    for item in checks:
        body.append(bullet("☐ " + item))

    body.append(p("Ghi nhớ cuối", "Heading1"))
    body.append(p("Với blog này, nguyên tắc an toàn nhất là: viết và kiểm tra ở local, chỉ commit nguồn thật trong source/, build sạch trước khi push, và luôn xem lại GitHub Actions sau khi deploy. Nếu có gì nhạy cảm đã lỡ push, hãy xóa khỏi file, commit lại, và cân nhắc xoay vòng thông tin đã lộ nếu đó là token hoặc email riêng."))

    sect = (
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
        "</w:sectPr>"
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body)}{sect}</w:body></w:document>"
    )


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="44"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="220"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="6B7280"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Lead"><w:name w:val="Lead"/><w:pPr><w:spacing w:after="220" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/><w:color w:val="1F3A5F"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:pPr><w:spacing w:before="40" w:after="40"/><w:ind w:left="240"/><w:shd w:fill="F4F6F9"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="20"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:pPr><w:spacing w:after="0" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/><w:color w:val="222222"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutTitle"><w:name w:val="Callout Title"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="22"/><w:color w:val="1F3A5F"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutText"><w:name w:val="Callout Text"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/><w:color w:val="222222"/></w:rPr></w:style>
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
    now = _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Hướng dẫn host và vận hành blog Hexo trên GitHub Pages</dc:title>
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
