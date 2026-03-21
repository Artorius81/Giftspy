from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(BigInteger, primary_key=True)
    nickname = Column(Text, default=None)
    balance = Column(Integer, default=1)
    premium_until = Column(DateTime, default=None)
    spy_mode = Column(Boolean, default=False)
    notifications_enabled = Column(Boolean, default=True)
    birthday = Column(Text, default=None)
    description = Column(Text, default=None)
    photo_file_id = Column(Text, default=None)
    registered_at = Column(DateTime, default=datetime.utcnow)

class Case(Base):
    __tablename__ = 'cases'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(BigInteger)
    target = Column(Text)
    holiday = Column(Text)
    context = Column(Text)
    persona = Column(Text)
    budget = Column(Text)
    status = Column(Text, default='pending')
    report = Column(Text)
    spy_message_id = Column(BigInteger, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    chats = relationship("ChatHistory", back_populates="case", cascade="all, delete-orphan")
    
    def __str__(self):
        return f"Case #{self.id} for {self.target}"

class ChatHistory(Base):
    __tablename__ = 'chat_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey('cases.id'))
    sender = Column(Text)
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="chats")

    def __str__(self):
        return f"{self.sender} (Case {self.case_id})"

class Target(Base):
    __tablename__ = 'targets'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(Integer)  # user who created this target
    identifier = Column(Text)   # @username or +7phone
    name = Column(Text)         # display name
    habits = Column(Text)       # hobbies, interests
    birthday = Column(Text)     # date string like "1990-05-15"
    photo_file_id = Column(Text)  # Telegram file_id of photo
    created_at = Column(DateTime, default=datetime.utcnow)
    
    wishlist = relationship("WishlistItem", back_populates="target", cascade="all, delete-orphan")

class WishlistItem(Base):
    __tablename__ = 'wishlist'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey('targets.id'))
    gift_description = Column(Text)
    category = Column(Text, default='Другое')
    added_by = Column(Text, default='user')  # 'user' or 'ai'
    case_id = Column(Integer, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    target = relationship("Target", back_populates="wishlist")

class Reminder(Base):
    __tablename__ = 'reminders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer)
    case_id = Column(Integer)
    target_name = Column(Text)
    remind_at = Column(DateTime)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
