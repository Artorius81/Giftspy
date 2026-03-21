import logging
from sqlalchemy import inspect, text
from database.models import Base

def perform_auto_migration(engine):
    """
    Automatically creates missing tables, and adds missing columns to existing tables.
    """
    logging.info("Starting auto-migration check...")
    
    try:
        # 1. Create tables if they don't exist
        Base.metadata.create_all(engine)
        
        # 2. Check for missing columns
        inspector = inspect(engine)
        
        with engine.begin() as conn:
            for table_name in Base.metadata.tables:
                columns_in_db = [c['name'] for c in inspector.get_columns(table_name)] # Will fail if connection timeout
                table_obj = Base.metadata.tables[table_name]
                
                for column in table_obj.columns:
                    if column.name not in columns_in_db:
                        # Compile the column type for the current SQL dialect (e.g., PostgreSQL or SQLite)
                        col_type = column.type.compile(engine.dialect)
                        sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}"
                        try:
                            conn.execute(text(sql))
                            logging.info(f"Auto-migrated: Added column '{column.name}' of type '{col_type}' to table '{table_name}'")
                        except Exception as e:
                            logging.error(f"Failed to add column '{column.name}' to '{table_name}': {e}")
                            
        logging.info("Auto-migration check completed.")
    except Exception as e:
        logging.error(f"Auto-migration could not connect to database or failed: {e}")
        logging.info("Please ensure DATABASE_URL is correct or run migrations manually via Supabase Dashboard SQL Editor.")
