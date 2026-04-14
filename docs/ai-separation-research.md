# AI Vocal Separation — Model Research & Integration

Ghi chú các kỹ thuật SOTA đã áp dụng vào `/cong-cu/xoa-giong-ai` và các rào cản với cái chưa áp dụng được.

## Mô hình tham khảo

### 1. MDX-Net (đã tích hợp, mặc định)
- Kiến trúc U-Net phổ biến, input STFT CAC 4-kênh (real/imag L/R).
- SDR MUSDB18-HQ vocals ≈ 10.5-10.8 dB.
- Ưu: inference nhanh, ONNX export ổn định.
- Nhược: có artifact kim loại ở transient, thua band-split methods ~2 dB.
- Registry: `mdx_a` (kuielab_a_vocals) + `mdx_b` (kuielab_b_vocals).

### 2. HTDemucs (đã tích hợp, env-gated)
- Hybrid Transformer Demucs — waveform-based với transformer cross-domain.
- Input raw waveform `[1, 2, 343980]`, output `[1, 4, 2, T]` (drums/bass/other/vocals).
- SDR ≈ 9.2 dB trung bình 4 stems.
- Ưu: ra 4 stems native, phase coherent.
- Bật: set `NEXT_PUBLIC_AI_HTDEMUCS_URL` trỏ đến ONNX export.

### 3. BS-RoFormer (đã tích hợp, adapter raw-waveform)
- Band-Split + Rotary Position Embedding Transformer — ZFTurbo / lucidrains.
- Input: band-split STFT + rotary PE, SDR vocals ~12.9 dB (SOTA MUSDB18-HQ).
- Adapter [roformer-separator.ts](../src/lib/audio/roformer-separator.ts)
  giả định export raw waveform I/O `[1, 2, T] → [1, 2, T]` (vocals), bám
  theo các community conversion phổ biến nhất. Band-split + rotary PE nằm
  trong graph ONNX, không cần code riêng.
- Overlap-add Hann crossfade, per-channel normalize, residual instrumental.
- Segment mặc định 524288 (~11.9s @ 44.1kHz), tự probe fixed input dim
  từ `session.inputMetadata` nếu có.
- Enable: set `NEXT_PUBLIC_AI_ROFORMER_URL` hoặc dán URL qua **Cài đặt
  mô hình AI** (admin panel trên trang).

## Kỹ thuật nâng cao đã áp dụng

### Test-Time Augmentation (TTA)
File: [src/lib/audio/ai-separator.ts](../src/lib/audio/ai-separator.ts)
function `separateWithTTA`.

- Chạy model 2 lần: (1) tín hiệu gốc, (2) L↔R swap + polarity invert.
- Un-flip pass 2 rồi trung bình.
- Gain thực tế: +0.3-0.5 dB SDR. Artifact bất đối xứng kênh bị triệt tiêu.
- Trade-off: 2x thời gian inference.
- Preset **"Tối đa"** kích hoạt TTA.

### Ensemble averaging
File: [src/lib/audio/ai-ensemble.ts](../src/lib/audio/ai-ensemble.ts).

- Trung bình vocals từ nhiều model đã train độc lập (MDX-A + MDX-B).
- Residual instrumental = mix - avg(vocals) → giữ phase coherent.
- Gain: +0.2-0.4 dB, giảm artifact per-model.

### HTDemucs overlap override
File: [src/lib/audio/htdemucs-separator.ts](../src/lib/audio/htdemucs-separator.ts).

- Mặc định 0.25, preset ultra nâng 0.5 → giảm seam artifact.
- Cost tăng tuyến tính theo số segment.

### Loudness equalization
File: [src/lib/audio/loudness.ts](../src/lib/audio/loudness.ts).

- Normalize mỗi stem về RMS của mix gốc, max 8× gain, tanh soft-clip 0.94.
- Tránh trường hợp vocal stem quá nhỏ / instrumental quá to.

## Giới hạn vật lý

- SOTA tổng thể (BS-RoFormer + ensemble + TTA) dừng ở ~13.5 dB SDR vocals.
  100% "sạch" chỉ tồn tại khi source ban đầu đã tách sẵn.
- Bottleneck trình duyệt: WebGPU FP16 giảm chất lượng so với CUDA FP32 ~0.1 dB.
- Model size: BS-RoFormer 170 MB (so với MDX 58 MB) → download đau với
  user lần đầu. IndexedDB cache giảm đau này.

## Preset hiện tại

| Preset | Models | TTA | Overlap | Slowdown | SDR ước tính |
|--------|--------|-----|---------|----------|--------------|
| Nhanh | mdx_a | - | - | 1× | ~10.6 dB |
| Cao cấp | mdx_b | - | - | 1.1× | ~10.8 dB |
| Tốt nhất | mdx_a + mdx_b | - | - | 2× | ~11.2 dB |
| Tối đa | mdx_a + mdx_b | ✓ | 0.5 | 4× | ~11.6 dB |

(Bật HTDemucs / RoFormer sẽ thêm preset tương ứng.)

## Env cần thiết

```bash
# MDX-Net (mặc định có fallback HF)
NEXT_PUBLIC_AI_MDX_A_URL=<onnx url>   # optional override
NEXT_PUBLIC_AI_MDX_B_URL=<onnx url>   # optional override

# HTDemucs (bắt buộc để kích hoạt)
NEXT_PUBLIC_AI_HTDEMUCS_URL=<onnx url>

# BS-RoFormer (bắt buộc + cần adapter)
NEXT_PUBLIC_AI_ROFORMER_URL=<onnx url>
```

Proxy tự động qua `/api/ai-models/[id]` để bypass CORS của HuggingFace.
