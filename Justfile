default:
    @just --list

# 開發模式：啟動本地 server (使用 live-server 替代 Vite)
dev:
    live-server --port 8080 .

# 使用 http-server 啟動靜態伺服器
serve:
    http-server ./dist

# 使用 entr 監控檔案變化 (範例：監控 src 下所有檔案)
watch:
    find src/ -type f | entr -r just dev
