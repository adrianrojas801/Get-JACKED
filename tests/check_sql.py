"""Fails if any migration doesn't parse, or creates a table without enabling RLS."""
import pathlib, re, sys
import pglast

ok = True
files = sorted(pathlib.Path("supabase/migrations").glob("*.sql"))
if not files:
    print("No migrations found"); sys.exit(1)
for f in files:
    sql = f.read_text()
    if not re.match(r"^\d{14}_[a-z0-9_]+\.sql$", f.name):
        print(f"{f.name}: name must look like 20261113000000_short_name.sql"); ok = False
    try:
        n = len(pglast.parse_sql(sql))
    except Exception as e:  # pglast.parser.ParseError
        print(f"{f.name}: SQL parse error: {e}"); ok = False; continue
    for t in re.findall(r"create table (?:if not exists )?([\w.]+)", sql, re.I):
        name = t.split(".")[-1]
        if not re.search(rf"alter table (?:public\.)?{name} enable row level security", sql, re.I):
            print(f"{f.name}: table {t} is created without enabling RLS"); ok = False
    if re.search(r"grant [^;]* to [^;]*\banon\b", sql, re.I):
        print(f"{f.name}: grants to anon are not allowed"); ok = False
    print(f"{f.name}: {n} statements parsed")
sys.exit(0 if ok else 1)
