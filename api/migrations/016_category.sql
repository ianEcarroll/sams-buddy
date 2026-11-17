-- Memory test: naming the members of a group ("Memory test: name the group" / "add a word").
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen','think','recall','category','explain','follow','steps'));
