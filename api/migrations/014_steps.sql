-- Task Buddy: Step by Step. The learner does a real task one step at a time with Buddy coaching.
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen','think','recall','explain','follow','steps'));
