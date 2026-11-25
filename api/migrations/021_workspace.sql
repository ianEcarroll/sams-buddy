-- A school or therapist account needs a home record before it has any students. This hidden "workspace" is never shown as a
-- student: it is left out of the student list, caseload and group report.
alter table learners add column if not exists is_workspace boolean not null default false;
