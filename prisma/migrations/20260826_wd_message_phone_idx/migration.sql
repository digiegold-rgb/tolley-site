-- Glanceable /hq SMS inbox groups WdMessage by phone. Indexes are additive.
CREATE INDEX IF NOT EXISTS "WdMessage_phone_idx" ON "WdMessage"("phone");
CREATE INDEX IF NOT EXISTS "WdMessage_channel_createdAt_idx" ON "WdMessage"("channel", "createdAt");
