# Universe AR

Studio biến hình trên trình duyệt với 6 nhân vật Avengers và 8 nhân vật Wibu.

- **Gojo Live.** Chọn **Wibu → Gojo Satoru → Bật camera**. Giữ mặt, vai và thân trên trong khung, rồi bấm **Chụp và thay áo AI**. FASHN dùng ảnh áo tham chiếu trong `assets/lens/gojo-reference.jpg`.
- **Hư Thức Tử.** Khi camera bật, đưa hai tay lại gần để hợp hai luồng xanh và đỏ thành tím. Sau khi thay áo, hiệu ứng tiếp tục chạy trên ảnh. Nhấn **F** hoặc **Tung chiêu** để tung chiêu, **Lưu PNG** để tải ảnh hoặc **Chụp lại** để mở camera.
- **Chiêu thức và Trang phục.** Các nhân vật khác vẫn dùng MediaPipe để nhận diện bàn tay, mặt hoặc vai trên thiết bị. Có thể xem thử khi chưa bật camera.

```sh
npm ci
npm start       # http://localhost:3456
npm test
npm run build
```

Cần Node.js 22.12 trở lên. Trình duyệt yêu cầu HTTPS hoặc localhost để cấp quyền camera.

## FASHN trên Mac

Lượt chạy đã kiểm thử dùng FASHN VTON v1.5 và PyTorch MPS trên Apple Silicon. FASHN xử lý một ảnh mỗi lượt. Ảnh chụp và ảnh kết quả được giữ tạm trong bộ nhớ.

`npm start` tự phát hiện runtime tại `.fashn/`. Có thể dùng `FASHN_RUNTIME_DIR` để trỏ tới nơi khác có cùng cấu trúc. Cần Python 3.12 và khoảng 4 GB ổ đĩa cho runtime, trọng số và bộ nhớ đệm.

```sh
mkdir -p .fashn
git clone https://github.com/fashn-AI/fashn-vton-1.5.git .fashn/source
git -C .fashn/source checkout 7c0f10a
git -C .fashn/source fetch origin pull/6/head
git -C .fashn/source restore --source=FETCH_HEAD -- src/fashn_vton/pipeline.py src/fashn_vton/tryon_mmdit.py
python3.12 -m venv .fashn/venv
.fashn/venv/bin/python -m pip install torch torchvision safetensors huggingface_hub pillow numpy opencv-python tqdm einops onnxruntime matplotlib fashn-human-parser
.fashn/venv/bin/python .fashn/source/scripts/download_weights.py --weights-dir .fashn/weights
npm start
```

Bản vá [Apple Metal của FASHN](https://github.com/fashn-AI/fashn-vton-1.5/pull/6) cho phép chạy trên MPS. Trọng số nhận diện người được tải vào `.fashn/cache` khi dùng lần đầu. Lần thử mẫu trên máy này mất khoảng 6 phút. Xem thêm [hướng dẫn FASHN VTON v1.5](https://github.com/fashn-AI/fashn-vton-1.5).

## Deploy bằng Wrangler

```sh
npm run deploy
npx wrangler secret put FASHN_API_KEY
```

Bản Cloudflare gọi [FASHN Try-On v1.6](https://docs.fashn.ai/api-reference/tryon-v1-6) ở chế độ `quality`. Chỉ ảnh do người dùng bấm chụp được gửi ra ngoài. Worker giữ key ở phía máy chủ, giới hạn hai lượt chụp mỗi phút cho một IP tại mỗi vị trí Cloudflare và yêu cầu mã phiên có chữ ký để lấy kết quả. API dùng một credit mỗi ảnh. Khi chưa đặt secret, Gojo vẫn có ảnh mẫu và Hư Thức Tử.

Ảnh đầu ra dựa trên một khung hình. Chế độ camera vẫn hiển thị Hư Thức Tử theo bàn tay và không gửi video tới FASHN. Tuỳ chọn Lens Camera Kit cho camera trực tiếp vẫn cấu hình qua `studio/snap-config.js`, với SDK được đóng gói bằng `npm run build:snap` khi đã có Lens và token Web staging.
