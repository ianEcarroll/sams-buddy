-- Task Buddy: "Learn the steps" becomes the default way to run a task (tester feedback, 14 Nov 2026).
-- Existing tasks were all one day old and set to "do it for real"; move them to the new default and switch
-- off the end retell, which "Learn the steps" leaves off unless the team turns it on.
update activities
   set content = (content - 'ask_end') || '{"run":"learn"}'::jsonb
 where mode = 'steps' and coalesce(content->>'run', 'practice') = 'practice';
