-- Explain Buddy: "Tell me how you make…" explanations are a new practice mode.
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen','think','recall','explain'));
