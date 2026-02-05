-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "rcfa" ALTER COLUMN "rcfa_number" DROP DEFAULT;
DROP SEQUENCE "rcfa_number_seq";
