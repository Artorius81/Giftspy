from aiogram.fsm.state import State, StatesGroup

class OrderGift(StatesGroup):
    waiting_for_target = State()
    waiting_for_holiday = State()
    waiting_for_context = State()
    waiting_for_persona = State()
    waiting_for_budget = State()
    waiting_for_confirmation = State()
    editing_detail = State()

class ProfileStates(StatesGroup):
    waiting_for_nickname = State()
    waiting_for_birthday = State()
    waiting_for_description = State()
    waiting_for_photo = State()

class AddIdeaStates(StatesGroup):
    waiting_for_idea = State()

class ReminderStates(StatesGroup):
    waiting_for_custom_date = State()

class TargetStates(StatesGroup):
    waiting_for_identifier = State()
    waiting_for_name = State()
    waiting_for_habits = State()
    waiting_for_birthday = State()
    waiting_for_photo = State()
    waiting_for_edit_value = State()
