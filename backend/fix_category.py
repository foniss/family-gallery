from database import get_connection

conn = get_connection()

columns = conn.execute("PRAGMA table_info(persons)").fetchall()
column_names = [col['name'] for col in columns]

if 'category' not in column_names:
    conn.execute("ALTER TABLE persons ADD COLUMN category TEXT DEFAULT 'family'")
    conn.commit()
    print("Added category column")
else:
    print("Category column already exists")

conn.execute("UPDATE persons SET category = 'family' WHERE category IS NULL")
conn.commit()
conn.close()
print("Done - all persons set to family")