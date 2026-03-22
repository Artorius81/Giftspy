---
description: Как обновить Mini App на VPS
---

# Обновление Mini App

## Если изменился только фронтенд (страницы, стили, компоненты):

// turbo
1. Собрать фронтенд локально:
```bash
cd c:\projects\Giftspy\webapp\frontend
npm run build
```

2. Загрузить на VPS:
```bash
scp -r webapp/frontend/dist root@50.114.74.242:/root/Giftspy/webapp/frontend/
```

Готово — Nginx сразу подхватит новые файлы, перезагрузка не нужна.

## Если изменился бэкенд (api.py, auth.py, db.py, handlers):

1. Запушить изменения в git:
```bash
git add . && git commit -m "update" && git push
```

2. На VPS:
```bash
cd /root/Giftspy
git pull
docker-compose up -d --build
```

## Если изменилось и то, и другое — выполните оба блока.
