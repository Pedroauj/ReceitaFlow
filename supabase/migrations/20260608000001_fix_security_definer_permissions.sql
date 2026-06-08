-- Fix: Revoke public/authenticated execute on SECURITY DEFINER functions.
-- handle_new_user is a trigger function — it must never be callable directly.
-- The email queue wrappers were already restricted in a prior migration but
-- are re-confirmed here for completeness.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Re-confirm email queue restrictions (idempotent)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM authenticated;
