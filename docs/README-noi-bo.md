# Góc Dịch Thuật

Website chia sẻ bản dịch tiếng Việt, xây dựng bằng Hexo 8 và theme NexT.Gemini.

## Chạy trên máy

Yêu cầu Node.js 20.19 trở lên và Git.

```powershell
npm install
npm run server
```

Mở `http://localhost:4000`.

## Post Studio: quản lý bài viết bằng giao diện

Khởi động trình quản lý cục bộ:

```powershell
npm run admin
```

Mở `http://127.0.0.1:4173`, sau đó bạn có thể:

- Xem và tìm kiếm tất cả bài trong `source/_posts/`.
- Ẩn/hiện bài bằng trường `published` trong front matter.
- Chỉnh metadata và Markdown với preview trực quan.
- Tạo bài từ template Side Story, Event Story, Phỏng vấn hoặc Bài viết.
- Import TXT trực tiếp cho Side Story và Event Story.
- Chuyển sang **Quản lý blog** để sửa tên blog, mô tả, URL, tác giả và nội dung các trang Danh sách bản dịch, Cập nhật, Giới thiệu.
- Build website mà không mở thêm Hexo server.
- Xóa an toàn: bài và asset được chuyển vào `.trash/`, không bị xóa vĩnh viễn ngay.

Khi lưu trong khu vực **Quản lý blog**, Post Studio tạo bản sao tại `.trash/backups/blog-settings/` rồi tự build lại website. Trang Bản dịch được biên soạn thủ công bằng các tag `library_project`, `library_event`, `library_interview`, `library_grid_start` và `library_card`; hướng dẫn mẫu được hiển thị ngay dưới trình soạn.

```markdown
{% library_project Project Sekai %}

## Event Stories

{% library_event Event Stories | /images/overview/event-logo.png | Tên event | /translations/event/ %}
[Chapter 1](/translations/event-chapter-1/)
[Chapter 2](/translations/event-chapter-2/)
Chapter 3
Chapter 4
{% endlibrary_event %}
```

Muốn xuống dòng trong tên event, đặt `<br>` ngay tại vị trí cần ngắt dòng (không nhấn Enter giữa tag), ví dụ: `Tên event dòng 1<br>Tên event dòng 2`.

Đặt ảnh minh họa trong `source/images/overview/`. Có thể lặp lại `library_event`, `library_interview` hoặc thêm `library_project` mới để mở rộng thư viện.

Mỗi `library_project` sẽ trở thành một tab lựa chọn. Dùng `library_grid_start`, `library_card`, `library_grid_end` cho lưới Side Story ảnh nhỏ. Card không có link sẽ tự chuyển trắng đen.

Side Story:

```markdown
{% library_card /images/overview/rui-card.jpg | Rui 4★ - A Step Towards My Dream | /translations/rui-dream/ %}
{% library_card /images/overview/rui-birthday.jpg | Rui - Happy Birthday!! | %}
```

Post Studio chỉ chạy trên `127.0.0.1`, không được đưa lên GitHub Pages và không cho người ngoài sửa website. Sau khi lưu/ẩn/xóa, hãy build, commit và push để thay đổi xuất hiện trên website công khai.

Khi dùng xong, quay lại terminal và nhấn `Ctrl+C` để đóng cổng `4173`.

### Thêm định dạng bài mới

Các template nằm trong `admin/post-types.yml`. Mỗi template gồm:

```yaml
id-template:
  name: Tên hiển thị
  description: Mô tả ngắn
  supports_txt_import: false
  categories: [Danh mục mặc định]
  tags: [Tag mặc định]
  default_body: |-
    Nội dung Markdown mẫu
```

Thêm một mục mới vào file này rồi khởi động lại `npm run admin`; template mới sẽ tự xuất hiện trong danh sách loại bài.

### Template bài phỏng vấn

Trong Post Studio, chọn loại **Phỏng vấn** để dùng cấu trúc hero, đoạn dẫn, hỏi–đáp, ảnh minh họa và hồ sơ khách mời.

Cũng có thể tạo từ terminal:

```powershell
npm run new:interview -- "ten-bai-phong-van"
```

Các tag chính:

```markdown
{% interview_lead %}
Đoạn dẫn của bài phỏng vấn.
{% endinterview_lead %}

{% interview_question %}
Nội dung câu hỏi?
{% endinterview_question %}

{% interview_answer "Tên khách mời" %}
Nội dung câu trả lời.
{% endinterview_answer %}

{% scene "/images/translations/ten-bai/figure-01.jpg" "Chú thích ảnh." %}
```

File scaffold nằm tại `scaffolds/interview.md`; giao diện và dữ liệu mặc định của Post Studio nằm tại `admin/post-types.yml`.

## Tạo bài dịch

```powershell
npm run new -- "ten-bai-khong-dau"
```

File mới nằm trong `source/_posts/`. Điền metadata ở đầu file, viết phần giới thiệu trước `<!-- more -->`, rồi viết bản dịch phía sau.

## Viết lời thoại nhân vật

Thông tin tên, ảnh và màu của nhân vật nằm trong `source/_data/characters.yml`. Trong bài dịch, dùng ID nhân vật thay cho HTML thủ công:

```markdown
{% dialogue kanade %}
Đây là lời thoại thông thường.
{% enddialogue %}

{% dialogue kanade thought %}
(Đây là độc thoại nội tâm.)
{% enddialogue %}
```

Chèn ảnh bối cảnh bằng:

```markdown
{% scene "/images/scenes/project-sekai/ten-boi-canh.webp" "Tên bối cảnh" %}
```

Khi thêm nhân vật mới:

1. Đặt avatar trong `source/images/characters/project-sekai/`.
2. Thêm ID, tên, đường dẫn avatar và màu vào `source/_data/characters.yml`.
3. Dùng ID đó trong tag `{% dialogue id %}`.

Nếu ID chưa được khai báo, quá trình build sẽ cảnh báo và dùng nhân vật `unknown` làm phương án dự phòng.

## Chuyển file TXT thành bài dịch

Định dạng TXT cơ bản:

```text
# Part 1

# Trường nữ sinh Miyamasuzaka - Sân trong

Kanade: Dòng đầu tiên.
Dòng này vẫn thuộc lời thoại của Kanade.

Mafuyu: Lời thoại tiếp theo.
```

Khi chuyển đổi, `Part 1`, `Part 2` và `Ghi chú` sẽ được xuất thành heading `##` để hiện trong mục lục. Các heading khác được xem là tên cảnh và được xuất thành `<p class="translation-scene-title">...</p>`, nên sẽ không làm mục lục bị dày.

Chuyển đổi thử mà không tạo file:

```powershell
npm run convert -- res\Kanade1.txt --title "SHINOBI Stage – Phần 1" --dry-run
```

Tạo bài thật:

```powershell
npm run convert -- res\Kanade1.txt `
  --title "SHINOBI Stage – Phần 1" `
  --slug "shinobi-stage-phan-1-auto" `
  --translator "Tên của bạn"
```

Kết quả mặc định nằm tại `source/_posts/<slug>.md`. Công cụ không ghi đè bài đã tồn tại; chỉ dùng `--force` khi bạn chắc chắn muốn thay thế nội dung cũ.

Slug được tự động chuẩn hóa thành chữ thường. Sau khi chạy converter trong khi Post Studio đang mở, bấm **Nạp lại danh sách** để bài mới xuất hiện ngay.

Các tùy chọn:

```text
--title           Tiêu đề bài
--slug            Tên file và đường dẫn không dấu
--output           Đường dẫn file Markdown tùy chỉnh
--categories       Danh mục, cách nhau bằng dấu phẩy
--tags             Tags, cách nhau bằng dấu phẩy
--post-type        side-story, event-story, interview hoặc article
--translator       Người dịch
--source-url       Liên kết bản gốc
--description      Mô tả bài
--dry-run          Xem kết quả nhưng không ghi file
--force            Cho phép ghi đè
```

Tên nhân vật được đối chiếu với `source/_data/characters.yml`, bao gồm ID, tên đầy đủ, tên ngắn và `aliases`. Nhân vật chưa có registry vẫn được giữ nguyên nội dung và sinh cảnh báo `TODO` để bạn bổ sung sau.

## Import ảnh vào bản dịch

Đặt file TXT trực tiếp trong `res/` và ảnh background trong `res/bg/`, rồi thêm chỉ dẫn tại vị trí muốn hiển thị:

```text
[IMAGE: cafe.webp | Cafe]
```

Converter sẽ tìm `res/bg/cafe.webp` trước, sau đó mới thử file nằm cạnh TXT. Nếu muốn chỉ rõ thư mục con khác, có thể ghi `[IMAGE: ten-thu-muc/anh.webp | Chú thích]`.

Khi chuyển đổi, ảnh được tự động chép tới:

```text
source/images/translations/<slug>/cafe.webp
```

và chỉ dẫn được đổi thành tag `{% scene %}` trong bài Markdown.

Để import riêng một ảnh vào bài đã có:

```powershell
npm run import:media -- res\cafe.webp `
  --slug "shinobi-stage-phan-1" `
  --type image `
  --label "Cafe"
```

Công cụ sẽ in ra tag cần dán vào bài.

## Nhạc nền cho bài dịch

Đặt file nhạc cạnh TXT và thêm:

```text
[AUDIO: bgm.mp3 | Tên bản nhạc]
```

File sẽ được chép vào `source/audio/translations/<slug>/`. Bản nhạc đầu tiên được đánh dấu thử tự phát; nếu trình duyệt chặn autoplay có âm thanh, trình phát nổi sẽ yêu cầu người đọc nhấn `▶`.

Import nhạc vào bài có sẵn:

```powershell
npm run import:media -- res\bgm.mp3 `
  --slug "shinobi-stage-phan-1" `
  --type audio `
  --label "Tên bản nhạc" `
  --autoplay
```

Hoặc chèn thủ công:

```markdown
{% bgm "/audio/translations/shinobi-stage-phan-1/bgm.mp3" "Tên bản nhạc" autoplay %}
```

Có thể thêm nhiều tag `bgm` trong cùng một bài; trình phát sẽ hiện nút chuyển bài. Hãy chỉ sử dụng nhạc bạn có quyền phân phối và nên ưu tiên MP3 hoặc OGG được nén hợp lý.

Các trạng thái nên dùng nhất quán:

- `Bản nháp`
- `Chưa hoàn thành`
- `Hoàn thành`

Masterlist tại `source/overview/index.md` được sinh tự động từ các bài đang hiển thị. Bạn chỉ cần ghi thay đổi đáng chú ý trong `source/updates/index.md` nếu muốn có nhật ký cập nhật.

## Những chỗ cần thay trước khi xuất bản

Tìm toàn dự án với từ khóa `YOUR_USERNAME`, `Tên của bạn` và `your-email@example.com`, sau đó thay bằng thông tin thật.

Đặc biệt, sửa:

- `url` trong `_config.yml`.
- GitHub và email trong `_config.next.yml`.
- Thông tin liên hệ trong `source/about/index.md`.
- Nguồn và credit trong từng bài dịch.

## Xuất bản lên GitHub Pages

1. Tạo repository tên `YOUR_USERNAME.github.io`.
2. Push mã nguồn lên nhánh `main`.
3. Vào **Settings → Pages → Source** và chọn **GitHub Actions**.
4. Workflow `.github/workflows/pages.yml` sẽ tự build và xuất bản website.

## Các lệnh hữu ích

```powershell
npm run clean         # Xóa cache và bản build cũ
npm run build         # Sinh website vào thư mục public
npm run server        # Chạy website cục bộ
npm run server:debug  # Chạy cục bộ với log chi tiết
```

Không chỉnh sửa trực tiếp các file trong `node_modules/hexo-theme-next`. Cấu hình theme nằm trong `_config.next.yml`; CSS tùy chỉnh nằm trong `source/_data/styles.styl`.
