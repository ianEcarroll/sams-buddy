-- "Listen to a Story": a story read aloud, then questions. Records keep the score.
alter table activities drop constraint if exists activities_mode_check;
alter table activities add constraint activities_mode_check check (mode in ('story','object','conversation','task','listen'));

alter table practice_records add column if not exists score_correct int;
alter table practice_records add column if not exists score_first int;
alter table practice_records add column if not exists score_total int;
