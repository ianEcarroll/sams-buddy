-- When a therapist or school sets a student's privacy choices at sign-up, remember who. Cleared when the student saves their own.
alter table consent add column if not exists set_by uuid references adults(id) on delete set null;
