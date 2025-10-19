-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "type" "AttendanceType" NOT NULL DEFAULT 'CHECK_IN';
