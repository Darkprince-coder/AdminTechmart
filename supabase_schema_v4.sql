--Dropped everything related to trigger

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user;

--Recreate function 

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, role, is_active)
  values (new.id, new.email, 'manager', true);

  return new;
end;
$$;

--Recreate trigger (correctly)

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();