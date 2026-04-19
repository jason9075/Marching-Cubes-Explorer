default:
    @just --list

# 開發模式：啟動 Vite server
dev:
    npm run dev

# 構建專案
build:
    npm run build

# 預覽構建結果
serve:
    npm run preview

# 使用 entr 監控檔案變化 (Vite 內建監控，此處為備用)
watch:
    find src/ -type f | entr -r just dev
