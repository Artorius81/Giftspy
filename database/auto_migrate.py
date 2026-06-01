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
                            
            # 3. Backfill case_number for already existing cases where it is null
            try:
                null_cases = conn.execute(text("SELECT id FROM cases WHERE case_number IS NULL")).fetchall()
                if null_cases:
                    logging.info(f"Backfilling case_number for {len(null_cases)} cases...")
                    for r in null_cases:
                        c_id = r[0]
                        # Deterministic generation
                        val = (c_id * 1234567) ^ 987654321
                        p = "abcdefghijklmnopqrstuvwxyz"[(val % 26)]
                        m = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[((val // 26) % 26)]
                        d1 = "0123456789"[((val // 676) % 10)]
                        d2 = "0123456789"[((val // 6760) % 10)]
                        d3 = "0123456789"[((val // 67600) % 10)]
                        s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[((val // 676000) % 26)]
                        c_num = f"{p}{m}{d1}{d2}{d3}{s}"
                        if c_id == 1:
                            c_num = "oX874F"
                        elif c_id == 2:
                            c_num = "kM391P"
                        elif c_id == 3:
                            c_num = "zW802T"
                        
                        conn.execute(text("UPDATE cases SET case_number = :num WHERE id = :id"), {"num": c_num, "id": c_id})
                    logging.info("Backfilling case_numbers completed successfully!")
            except Exception as backfill_err:
                logging.error(f"Failed to backfill case_numbers: {backfill_err}")
                
        logging.info("Auto-migration check completed.")
    except Exception as e:
        logging.error(f"Auto-migration could not connect to database or failed: {e}")
        logging.info("Please ensure DATABASE_URL is correct or run migrations manually via Supabase Dashboard SQL Editor.")
