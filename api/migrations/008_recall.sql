-- Memory Buddy: recall of real experiences ("Tell me three things you did at the weekend") is a new practice mode.
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen','think','recall'));
