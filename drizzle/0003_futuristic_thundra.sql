CREATE INDEX "bookmark_tags_tag_id_idx" ON "bookmark_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_archived_created_idx" ON "bookmarks" USING btree ("user_id","is_archived","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "highlights_bookmark_id_idx" ON "highlights" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "tags_user_id_idx" ON "tags" USING btree ("user_id");