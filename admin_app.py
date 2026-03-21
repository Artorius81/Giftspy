import os
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from sqladmin import Admin, ModelView, action
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy import create_engine
from dotenv import load_dotenv

from database.models import User, Case, ChatHistory

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///agency.db")
engine = create_engine(DATABASE_URL, connect_args={} if "postgresql" in DATABASE_URL else {"check_same_thread": False})

from database.auto_migrate import perform_auto_migration
perform_auto_migration(engine)

app = FastAPI()

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "giftspy2026")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-123")

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")
        
        if password == ADMIN_PASSWORD:
            request.session.update({"token": "admin_session"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not token:
            return False
        return True

authentication_backend = AdminAuth(secret_key=SECRET_KEY)
admin = Admin(app, engine, authentication_backend=authentication_backend, title="Giftspy Admin Panel")

class UserView(ModelView, model=User):
    column_list = [User.id, User.balance, User.registered_at]
    name = "Пользователь"
    name_plural = "Пользователи"
    can_create = True
    can_edit = True
    can_delete = True

class CaseView(ModelView, model=Case):
    column_list = [Case.id, Case.customer_id, Case.target, Case.status, Case.created_at]
    column_searchable_list = [Case.target, Case.status, Case.customer_id]
    column_sortable_list = [Case.id, Case.created_at, Case.status]
    name = "Дело"
    name_plural = "Дела"
    can_create = True
    can_edit = True
    can_delete = True

    @action(
        name="force_ai_reply",
        label="Заставить ответить",
        confirmation_message="Вы уверены, что хотите заставить ИИ ответить на последнее сообщение?",
        add_in_detail=True,
        add_in_list=True,
    )
    async def force_ai_reply(self, request: Request):
        pks = request.query_params.get("pks", "").split(",")
        if not pks:
            return

        from main import ai_service, client, _process_target_input, _find_case_for_sender
        from database import db
        import logging

        for pk in pks:
            case = await db.get_case_by_id(int(pk))
            if not case: continue
            
            # Находим последнее сообщение от пользователя
            history = await db.get_chat_history(case[0])
            last_user_msg = next((m for s, m in reversed(history) if s == 'user'), None)
            
            if last_user_msg:
                # Т.к. у нас нет объекта 'event' из Telethon, мы просто вызываем генерацию напрямую
                # и отправляем через клиент
                try:
                    from services.scheduler import resolve_target
                    target_entity = await resolve_target(client, case[2])
                    if not target_entity: continue

                    chat_session = await ai_service.restore_chat_from_db(case[0], case[3], case[4], case[5], case[6])
                    ai_text = await ai_service.generate_response(chat_session, last_user_msg)
                    
                    if ai_text:
                        await client.send_message(target_entity, ai_text)
                        await db.save_chat_message(case[0], 'ai', ai_text)
                        
                        # Обновляем шпионское сообщение
                        from main import update_spy_message
                        from bot.keyboards.common import resolve_target_display_name
                        display_name = await resolve_target_display_name(case[1], case[2])
                        await update_spy_message(case[0], case[1], display_name, case[5])
                except Exception as e:
                    logging.error(f"Admin Force Reply Error: {e}")

        return RedirectResponse(url=request.url_for("admin:list", identity=self.identity))

    @action(
        name="force_report",
        label="Закрыть принудительно",
        confirmation_message="Сгенерировать финальный отчет и закрыть дело прямо сейчас?",
        add_in_detail=True,
    )
    async def force_report(self, request: Request):
        pks = request.query_params.get("pks", "").split(",")
        from main import ai_service, db
        from services.ai_detective import AIDetectiveService

        for pk in pks:
            case = await db.get_case_by_id(int(pk))
            if not case: continue
            
            chat_session = await ai_service.restore_chat_from_db(case[0], case[3], case[4], case[5], case[6])
            report_text = await ai_service.generate_final_report(chat_session)
            if report_text:
                await db.update_case_status(case[0], 'done', report_text)
        
        return RedirectResponse(url=request.url_for("admin:list", identity=self.identity))

class ChatHistoryView(ModelView, model=ChatHistory):
    column_list = [ChatHistory.id, ChatHistory.case_id, ChatHistory.sender, ChatHistory.message, ChatHistory.timestamp]
    column_searchable_list = [ChatHistory.message, ChatHistory.sender, ChatHistory.case_id]
    column_sortable_list = [ChatHistory.id, ChatHistory.timestamp, ChatHistory.case_id]
    name = "История чата"
    name_plural = "Истории чата"
    page_size = 100
    page_size_options = [25, 50, 100, 500]
    can_create = False
    can_edit = True
    can_delete = True

admin.add_view(UserView)
admin.add_view(CaseView)
admin.add_view(ChatHistoryView)
