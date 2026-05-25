---
description: Как обновить Mini App на VPS
---

# Обновление Mini App

## Если изменился только фронтенд (страницы, стили, компоненты)

// turbo

1. Собрать фронтенд локально:

```bash
cd c:\projects\Giftspy\webapp\frontend
npm run build
```

1. Загрузить на VPS (напрямую в папку, которую раздает Nginx):
 
```bash
scp -r webapp/frontend/dist/* root@50.114.74.242:/var/www/giftspy/
```

Если по какой-то причине нет прямого доступа на запись в `/var/www/giftspy`, загрузите в папку проекта и скопируйте на сервере:

```bash
# Локально:
scp -r webapp/frontend/dist root@50.114.74.242:/root/Giftspy/webapp/frontend/

# На VPS сервере:
cp -r /root/Giftspy/webapp/frontend/dist/* /var/www/giftspy/
```

Готово — Nginx сразу подхватит новые файлы из правильной директории, перезагрузка не нужна.

## Если изменился бэкенд (api.py, auth.py, db.py, handlers)

1. Запушить изменения в git:

```bash
git add . && git commit -m "update" && git push
```

1. На VPS:

```bash
cd /root/Giftspy
docker-compose down
git pull
docker-compose up -d --build
docker image prune -f
```

## Если изменилось и то, и другое — выполните оба блока
