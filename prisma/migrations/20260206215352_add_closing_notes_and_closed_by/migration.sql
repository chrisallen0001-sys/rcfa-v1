-- AlterTable
ALTER TABLE "rcfa" ADD COLUMN     "closed_by_user_id" UUID,
ADD COLUMN     "closing_notes" TEXT;

-- AddForeignKey
ALTER TABLE "rcfa" ADD CONSTRAINT "rcfa_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
