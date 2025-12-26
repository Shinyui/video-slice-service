# Video Slice Service (Backend)

這是一個基於 Node.js 的後端服務，專門用於處理影片上傳、自動轉碼為 HLS (HTTP Live Streaming) 格式，並將結果儲存至 MinIO (S3 相容物件儲存)。

## 功能特色

- **斷點續傳**: 支援 [Tus 協議](https://tus.io/)，提供穩定可靠的大檔案續傳功能。
- **影片處理**: 使用 FFmpeg 自動將上傳的 MP4 檔案轉碼為 HLS 格式 (`.m3u8` + `.ts` 切片)。
- **物件儲存**: 將處理後的檔案自動上傳至 MinIO/S3。
- **併發控制**: 內建隊列機制，可限制同時進行的轉碼與上傳任務數量，避免伺服器過載。
- **進度追蹤**: 提供 FFmpeg 轉碼與 MinIO 上傳的即時進度日誌。

## 前置需求

- **Node.js** (建議 v18 以上)
- **FFmpeg** (必須安裝在系統路徑中)
- **Docker** (用於運行本地 MinIO)

## 安裝步驟

1. 進入後端目錄：

   ```bash
   cd backend
   ```

2. 安裝依賴套件：
   ```bash
   npm install
   ```

## 設定說明

請在根目錄建立一個 `.env` 檔案 (或修改現有的)。

**`.env` 範例設定：**

```env
PORT=3000

# === MinIO 設定 ===
# 本地開發用 (Docker):
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=test-bucket

# === 處理設定 ===
# 同時進行影片轉碼的最大數量
FFMPEG_CONCURRENCY_LIMIT=2
```

## 啟動服務

### 1. 啟動 MinIO (本地物件儲存)

如果您沒有遠端的 S3/MinIO bucket，請使用 Docker 啟動本地 MinIO：

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

- **控制台網址**: http://localhost:9001
- **API 網址**: http://localhost:9000

### 2. 啟動後端伺服器

```bash
# 開發模式 (支援熱重載)
npm run dev

# 生產模式
npm start
```

伺服器將在 `http://localhost:3000` 啟動。

## API 端點

### 上傳相關

- **POST /api/tus/**

  - 專用於 Tus 斷點續傳的端點。
  - 由 `@tus/server` 處理。
  - 上傳完成後會自動觸發影片轉碼流程。

- **POST /api/upload**
  - 簡單的 `multipart/form-data` 上傳 (影片欄位名稱: `video`)。
  - 適用於測試或簡單的一次性上傳。

### 狀態相關

- **GET /**
  - 健康檢查端點 (Health check)。

## 架構流程

1. **上傳**: 客戶端透過 Tus 協議上傳影片至 `/api/tus`。
2. **暫存**: 原始影片會先儲存在 `uploads/` 目錄。
3. **隊列**: 上傳完成後，任務會被加入記憶體隊列 (`videoService.js`)。
4. **轉碼**: FFmpeg 將影片處理為 HLS 切片，輸出至 `output/{id}/`。
5. **雲端上傳**: `storageService.js` 將 HLS 檔案上傳至 MinIO (具備併發控制)。
6. **清理**: 刪除 `uploads/` 和 `output/` 中的暫存檔案。

## 故障排除

- **ETIMEDOUT 錯誤**: 通常表示後端無法連線至 MinIO。請檢查 `.env` 中的 `MINIO_ENDPOINT` 設定，並確保 MinIO 服務正在運行。
- **FFmpeg 錯誤**: 請確認您的系統已安裝 `ffmpeg` 並且可以在終端機中直接執行。
