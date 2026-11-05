-- Think Buddy: problem-solving role-plays are a new practice mode.
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen','think'));
