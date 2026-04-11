-- Allow admins to delete audit log rows (manual cleanup + app-driven retention purge).

drop policy if exists "audit_logs_delete_admin" on public.audit_logs;
create policy "audit_logs_delete_admin"
  on public.audit_logs for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

grant delete on public.audit_logs to authenticated;
