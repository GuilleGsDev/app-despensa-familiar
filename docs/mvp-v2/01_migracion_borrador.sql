-- BORRADOR PARA REVISIÓN. NO EJECUTADO. No usar db push sobre este archivo.
-- Requiere respaldo restaurado en pruebas, revisión del esquema real y UUID verificados.
-- Leer README.md de esta carpeta. No borra usuarios, recetas, alimentos ni propuestas.
begin;

-- Barrera deliberada: no basta con abrir y ejecutar el archivo por accidente.
do $$
declare
  ids uuid[];
  tabla text;
begin
  if nullif(current_setting('app.mvp_v2_respaldo', true), '') is null
     or current_setting('app.mvp_v2_revision', true) is distinct from 'verificada' then
    raise exception 'Falta referencia de respaldo comprobado y revisión del esquema (README).';
  end if;
  ids := array[
    nullif(current_setting('app.mvp_v2_tita', true), '')::uuid,
    nullif(current_setting('app.mvp_v2_guillermo', true), '')::uuid,
    nullif(current_setting('app.mvp_v2_natalia', true), '')::uuid
  ];
  if array_position(ids, null) is not null or (select count(distinct id) from unnest(ids) id) <> 3 then
    raise exception 'Faltan los tres UUID distintos, verificados contra Auth.';
  end if;
  if (select count(*) from auth.users where id = any(ids)) <> 3
     or (select count(*) from public.perfiles where id = any(ids)) <> 3 then
    raise exception 'Las tres cuentas y sus perfiles deben existir; no se crean ni reemplazan.';
  end if;
  foreach tabla in array array['alimentos','recetas','receta_ingredientes','menu_semanal','votos_menu'] loop
    if to_regclass('public.' || tabla) is null then
      raise exception 'Falta la tabla esperada: %', tabla;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='menu_semanal' and column_name='fecha' and data_type='date')
    or not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='menu_semanal' and column_name='tipo_comida' and data_type in ('text','character varying')) then
    raise exception 'Revisar tipos reales de fecha/tipo_comida antes de adaptar el borrador.';
  end if;
  if exists (select 1 from public.votos_menu group by menu_id, user_id having count(*) > 1) then
    raise exception 'Existen votos duplicados: resolverlos con respaldo, sin borrado automático.';
  end if;
  if exists (select 1 from public.menu_semanal where fecha is null or tipo_comida is null
    or tipo_comida not in ('desayuno','almuerzo','cena','once')) then
    raise exception 'Existen propuestas con fecha o comida no admitidas; revisar manualmente.';
  end if;
end $$;

-- Se preservan las cuentas y los autores históricos desconocidos quedan NULL.
alter table public.perfiles add column activo boolean not null default false;
update public.perfiles set rol = 'admin', activo = true
where id in (current_setting('app.mvp_v2_tita')::uuid, current_setting('app.mvp_v2_guillermo')::uuid);
update public.perfiles set rol = 'miembro', activo = true
where id = current_setting('app.mvp_v2_natalia')::uuid;
alter table public.perfiles add constraint perfiles_v2_rol_activo
  check (not activo or (rol is not null and rol in ('admin','miembro')));

alter table public.recetas
  add column creado_por uuid references public.perfiles(id) on delete restrict,
  add column archivada boolean not null default false;
alter table public.menu_semanal
  add column creado_por uuid references public.perfiles(id) on delete restrict;
alter table public.recetas alter column creado_por set default auth.uid();
alter table public.menu_semanal alter column creado_por set default auth.uid();
alter table public.receta_ingredientes add column unidad_medida text;
-- La versión anterior expresaba ingredientes en la unidad del alimento.
-- Solo preservamos esa unidad; NO convertimos kilos a paquetes ni cantidades.
update public.receta_ingredientes i set unidad_medida = a.unidad_medida
from public.alimentos a where a.id = i.alimento_id;
alter table public.receta_ingredientes add constraint ingredientes_v2_unidad
  check (unidad_medida is not null and unidad_medida in ('taza','un','paq','g','kg','ml','L')) not valid;
alter table public.receta_ingredientes add constraint ingredientes_v2_cantidad
  check (cantidad_requerida is not null and cantidad_requerida > 0) not valid;

-- Sustituir únicamente CHECK de una sola columna sobre tipo_comida.
-- Si hay restricciones compuestas o un enum, adaptar tras la inspección previa.
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attname='tipo_comida'
    where c.conrelid='public.menu_semanal'::regclass and c.contype='c'
      and c.conkey=array[a.attnum] loop
    execute format('alter table public.menu_semanal drop constraint %I', r.conname);
  end loop;
end $$;
update public.menu_semanal set tipo_comida='once' where tipo_comida='cena';
alter table public.menu_semanal
  alter column fecha set not null,
  alter column tipo_comida set not null,
  add constraint menu_v2_tipo check (tipo_comida in ('desayuno','almuerzo','once')),
  add constraint menu_v2_referencia unique (id, fecha, tipo_comida);
alter table public.votos_menu
  alter column menu_id set not null,
  alter column user_id set not null,
  add constraint votos_v2_unico unique (menu_id, user_id);

-- Al retirar una propuesta no confirmada se retiran sus votos, no las cuentas.
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attname='menu_id'
    where c.conrelid='public.votos_menu'::regclass and c.contype='f'
      and c.conkey=array[a.attnum] loop
    execute format('alter table public.votos_menu drop constraint %I',r.conname);
  end loop;
end $$;
alter table public.votos_menu add constraint votos_v2_propuesta_fk
  foreign key (menu_id) references public.menu_semanal(id) on delete cascade;

-- Hereda el tipo real del ID de las propuestas (UUID o entero), sin inventarlo.
create table public.comidas_confirmadas as
select fecha, tipo_comida, id as propuesta_id,
  null::uuid as confirmado_por, null::timestamptz as confirmado_en
from public.menu_semanal with no data;
alter table public.comidas_confirmadas
  alter column fecha set not null,
  alter column tipo_comida set not null,
  alter column propuesta_id set not null,
  alter column confirmado_por set not null,
  alter column confirmado_por set default auth.uid(),
  alter column confirmado_en set not null,
  alter column confirmado_en set default now(),
  add primary key (fecha, tipo_comida),
  add foreign key (propuesta_id, fecha, tipo_comida)
    references public.menu_semanal(id, fecha, tipo_comida) on delete restrict on update restrict,
  add foreign key (confirmado_por) references public.perfiles(id) on delete restrict;

create schema if not exists despensa_private;
revoke all on schema despensa_private from public, anon;
grant usage on schema despensa_private to authenticated;
-- SECURITY INVOKER: la política de perfiles permite leer solo el perfil propio.
create function despensa_private.es_familiar_v2() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id=auth.uid() and activo and rol in ('admin','miembro'));
$$;
create function despensa_private.es_admin_v2() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id=auth.uid() and activo and rol='admin');
$$;
revoke all on function despensa_private.es_familiar_v2(), despensa_private.es_admin_v2() from public, anon;
grant execute on function despensa_private.es_familiar_v2(), despensa_private.es_admin_v2() to authenticated;

-- Autor inmutable: también protege frente a clientes que intenten reasignarlo.
create function despensa_private.proteger_autor_v2() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='INSERT' then
    new.creado_por := auth.uid();
  elsif new.creado_por is distinct from old.creado_por then
    raise exception 'No se permite cambiar el autor.';
  end if;
  return new;
end $$;
create trigger recetas_v2_autor before insert or update on public.recetas
for each row execute function despensa_private.proteger_autor_v2();
create trigger menu_v2_autor before insert or update on public.menu_semanal
for each row execute function despensa_private.proteger_autor_v2();
create function despensa_private.auditar_confirmacion_v2() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not despensa_private.es_admin_v2() then raise exception 'Solo administradores pueden confirmar.'; end if;
  new.confirmado_por := auth.uid();
  new.confirmado_en := now();
  return new;
end $$;
create trigger confirmacion_v2_autor before insert or update on public.comidas_confirmadas
for each row execute function despensa_private.auditar_confirmacion_v2();
revoke all on function despensa_private.proteger_autor_v2(), despensa_private.auditar_confirmacion_v2() from public, anon, authenticated;

-- Reemplazo revisable de políticas de estas SIETE tablas exclusivamente.
-- Guardar sus definiciones y grants originales en el respaldo antes de aplicar.
do $$
declare t text; r record; columnas text; secuencia text;
begin
  foreach t in array array['perfiles','alimentos','recetas','receta_ingredientes','menu_semanal','votos_menu','comidas_confirmadas'] loop
    execute format('alter table public.%I enable row level security',t);
    for r in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',r.policyname,t);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    select string_agg(quote_ident(attname), ',') into columnas from pg_attribute
      where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
    execute format('revoke all (%s) on public.%I from public, anon, authenticated',columnas,t);
    execute format('grant select on public.%I to authenticated',t);
    secuencia := null;
    if t <> 'comidas_confirmadas' then
      secuencia := pg_get_serial_sequence('public.'||t,'id');
    end if;
    -- La tabla nueva usa clave compuesta y no tiene id.
    if secuencia is not null and t <> 'perfiles' then
      execute format('grant usage on sequence %s to authenticated',secuencia);
    end if;
  end loop;
end $$;

create policy perfiles_v2_lectura on public.perfiles for select to authenticated using (id=auth.uid());
-- No se concede escritura de perfiles/roles a ningún usuario de la aplicación.
create policy alimentos_v2_lectura on public.alimentos for select to authenticated using (despensa_private.es_familiar_v2());
create policy alimentos_v2_alta on public.alimentos for insert to authenticated with check (despensa_private.es_admin_v2());
create policy alimentos_v2_edicion on public.alimentos for update to authenticated
  using (despensa_private.es_admin_v2()) with check (despensa_private.es_admin_v2());
grant insert (nombre,categoria,cantidad_actual,unidad_medida,cantidad_minima),
  update (nombre,categoria,cantidad_actual,unidad_medida,cantidad_minima) on public.alimentos to authenticated;

create policy recetas_v2_lectura on public.recetas for select to authenticated using (despensa_private.es_familiar_v2());
create policy recetas_v2_alta on public.recetas for insert to authenticated
  with check (despensa_private.es_familiar_v2() and creado_por=auth.uid());
create policy recetas_v2_edicion on public.recetas for update to authenticated
  using (despensa_private.es_familiar_v2() and (creado_por=auth.uid() or despensa_private.es_admin_v2()))
  with check (despensa_private.es_familiar_v2() and (creado_por=auth.uid() or despensa_private.es_admin_v2()));
grant insert (nombre,tiempo_minutos,porciones), update (nombre,tiempo_minutos,porciones,archivada)
  on public.recetas to authenticated;

create policy ingredientes_v2_lectura on public.receta_ingredientes for select to authenticated using (despensa_private.es_familiar_v2());
create policy ingredientes_v2_alta on public.receta_ingredientes for insert to authenticated with check (
  despensa_private.es_familiar_v2() and exists (select 1 from public.recetas r where r.id=receta_id
    and not r.archivada and (r.creado_por=auth.uid() or despensa_private.es_admin_v2())));
create policy ingredientes_v2_borrado on public.receta_ingredientes for delete to authenticated using (
  despensa_private.es_familiar_v2() and exists (select 1 from public.recetas r where r.id=receta_id
    and not r.archivada and (r.creado_por=auth.uid() or despensa_private.es_admin_v2())));
grant insert (receta_id,alimento_id,cantidad_requerida,unidad_medida), delete on public.receta_ingredientes to authenticated;

create policy menu_v2_lectura on public.menu_semanal for select to authenticated using (despensa_private.es_familiar_v2());
create policy menu_v2_alta on public.menu_semanal for insert to authenticated with check (
  despensa_private.es_familiar_v2() and creado_por=auth.uid()
  and exists (select 1 from public.recetas r where r.id=receta_id and not r.archivada));
create policy menu_v2_borrado on public.menu_semanal for delete to authenticated using (
  despensa_private.es_familiar_v2() and (creado_por=auth.uid() or despensa_private.es_admin_v2())
  and not exists (select 1 from public.comidas_confirmadas c where c.propuesta_id=menu_semanal.id));
grant insert (fecha,tipo_comida,receta_id,creado_por), delete on public.menu_semanal to authenticated;
-- Fecha, receta y autor de una propuesta existente no se editan, para preservar sus votos.

create policy votos_v2_lectura on public.votos_menu for select to authenticated using (despensa_private.es_familiar_v2());
create policy votos_v2_alta on public.votos_menu for insert to authenticated with check (
  despensa_private.es_familiar_v2() and user_id=auth.uid()
  and exists (select 1 from public.menu_semanal m where m.id=menu_id));
create policy votos_v2_borrado on public.votos_menu for delete to authenticated using (despensa_private.es_familiar_v2() and user_id=auth.uid());
grant insert (menu_id,user_id), delete on public.votos_menu to authenticated;

create policy confirmadas_v2_lectura on public.comidas_confirmadas for select to authenticated using (despensa_private.es_familiar_v2());
create policy confirmadas_v2_alta on public.comidas_confirmadas for insert to authenticated with check (despensa_private.es_admin_v2() and confirmado_por=auth.uid());
create policy confirmadas_v2_edicion on public.comidas_confirmadas for update to authenticated
  using (despensa_private.es_admin_v2()) with check (despensa_private.es_admin_v2() and confirmado_por=auth.uid());
create policy confirmadas_v2_borrado on public.comidas_confirmadas for delete to authenticated using (despensa_private.es_admin_v2());
grant insert (fecha,tipo_comida,propuesta_id), update (fecha,tipo_comida,propuesta_id), delete
  on public.comidas_confirmadas to authenticated;

-- RPC atómica; usa el tipo real del ID existente y respeta RLS (sin SECURITY DEFINER).
create function public.guardar_receta_v2(p_id text, p_nombre text, p_tiempo integer,
  p_porciones integer, p_ingredientes jsonb) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  receta_id_actual public.recetas.id%type;
  ingrediente public.receta_ingredientes%rowtype;
begin
  if not despensa_private.es_familiar_v2() then raise exception 'Acceso familiar requerido.'; end if;
  if nullif(btrim(p_nombre),'') is null or p_tiempo is null or p_tiempo<=0
     or p_porciones is null or p_porciones<=0 then raise exception 'Receta inválida.'; end if;
  if p_ingredientes is null or jsonb_typeof(p_ingredientes)<>'array' then
    raise exception 'Ingredientes inválidos.';
  end if;
  if jsonb_array_length(p_ingredientes)=0 then raise exception 'Agrega al menos un ingrediente.'; end if;
  if p_id is null then
    insert into public.recetas(nombre,tiempo_minutos,porciones)
      values (btrim(p_nombre),p_tiempo,p_porciones) returning id into receta_id_actual;
  else
    receta_id_actual := p_id;
    -- Serializa ediciones de la misma receta; RLS impide editar recetas ajenas.
    update public.recetas set nombre=btrim(p_nombre),tiempo_minutos=p_tiempo,porciones=p_porciones
      where id=receta_id_actual and not archivada;
    if not found then raise exception 'Receta no editable.'; end if;
    delete from public.receta_ingredientes where receta_id=receta_id_actual;
  end if;
  for ingrediente in select * from jsonb_populate_recordset(null::public.receta_ingredientes,p_ingredientes) loop
    if ingrediente.alimento_id is null or ingrediente.cantidad_requerida is null
       or ingrediente.cantidad_requerida<=0 or ingrediente.unidad_medida is null
       or ingrediente.unidad_medida not in ('taza','un','paq','g','kg','ml','L') then
      raise exception 'Ingrediente inválido.';
    end if;
    insert into public.receta_ingredientes(receta_id,alimento_id,cantidad_requerida,unidad_medida)
      values (receta_id_actual,ingrediente.alimento_id,ingrediente.cantidad_requerida,ingrediente.unidad_medida);
  end loop;
  return receta_id_actual::text;
end $$;
revoke all on function public.guardar_receta_v2(text,text,integer,integer,jsonb) from public, anon;
grant execute on function public.guardar_receta_v2(text,text,integer,integer,jsonb) to authenticated;

-- Publicación de las tablas que consume React, sin duplicar entradas.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    raise exception 'Verificar publicación supabase_realtime antes de aplicar.';
  end if;
  if not exists (select 1 from pg_publication where pubname='supabase_realtime' and puballtables) then
    foreach t in array array['alimentos','recetas','receta_ingredientes','menu_semanal','votos_menu','comidas_confirmadas'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
commit;
