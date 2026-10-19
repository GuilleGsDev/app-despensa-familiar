-- SOLO LECTURA. Preparado, no ejecutado. Ejecutar únicamente tras autorizar la inspección.
-- No incluye contraseñas, tokens ni datos privados de Auth.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns where table_schema='public'
and table_name in ('perfiles','alimentos','recetas','receta_ingredientes','menu_semanal','votos_menu')
order by table_name, ordinal_position;

select c.conrelid::regclass as tabla, c.conname, pg_get_constraintdef(c.oid) as definicion
from pg_constraint c where c.connamespace='public'::regnamespace order by 1,2;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public' order by tablename, policyname;
select grantee, table_name, privilege_type from information_schema.table_privileges
where table_schema='public' order by table_name, grantee;
select grantee, table_name, column_name, privilege_type from information_schema.column_privileges
where table_schema='public' order by table_name, column_name, grantee;
select schemaname, tablename, indexname, indexdef from pg_indexes where schemaname='public';
select tgrelid::regclass as tabla, tgname, pg_get_triggerdef(oid) as definicion
from pg_trigger where not tgisinternal and tgrelid in (
  select oid from pg_class where relnamespace='public'::regnamespace);
select n.nspname, p.proname, p.prosecdef, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private','despensa_private') and p.prokind='f';
select * from pg_publication_tables where pubname='supabase_realtime';
select id, nombre, rol from public.perfiles order by nombre;
select menu_id, user_id, count(*) from public.votos_menu group by menu_id,user_id having count(*)>1;
select fecha, tipo_comida, receta_id, count(*) from public.menu_semanal
 group by fecha,tipo_comida,receta_id having count(*)>1;
