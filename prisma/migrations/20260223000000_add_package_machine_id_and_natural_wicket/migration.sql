-- AlterEnum: Add NATURAL to PackageWicketType
ALTER TYPE "PackageWicketType" ADD VALUE IF NOT EXISTS 'NATURAL';

-- AlterTable: Add machineId to Package (IF NOT EXISTS)
DO $$ BEGIN
  ALTER TABLE "Package" ADD COLUMN "machineId" "MachineId";
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
