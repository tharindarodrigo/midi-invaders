-- Ensure Tharinda Rodrigo admin account exists and has expected display name.
INSERT INTO "AdminUser" ("id", "name", "email", "createdAt")
VALUES ('admin-tharinda-rodrigo', 'Tharinda Rodrigo', 'tharindarodrigo@gmail.com', CURRENT_TIMESTAMP)
ON CONFLICT ("email")
DO UPDATE SET
  "name" = EXCLUDED."name";
