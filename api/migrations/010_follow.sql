-- Listen Buddy on screen: follow a spoken instruction by moving shapes into boxes.
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen','think','recall','explain','follow'));
