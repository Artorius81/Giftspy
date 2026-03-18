from aiogram import Router, F
from aiogram.types import CallbackQuery

router = Router()

@router.callback_query(F.data.startswith("rate_good_"))
async def process_good_rating(callback: CallbackQuery):
    case_id = callback.data.split("_")[2]
    
    # В будущем тут можно сохранять оценку в БД, обучать ИИ и т.п.
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("✨ Супер! Мы очень рады, что смогли помочь. \nЖелаем прекрасного праздника! 🎁")
    await callback.answer("Оценка сохранена!")

@router.callback_query(F.data.startswith("rate_bad_"))
async def process_bad_rating(callback: CallbackQuery):
    case_id = callback.data.split("_")[2]
    
    # В будущем: возврат бонусной звезды или анализ логов
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("😔 Жаль, что детективу не удалось выяснить самое важное.\nМы проанализируем это дело, чтобы стать лучше!")
    await callback.answer("Ваш отзыв учтен")
