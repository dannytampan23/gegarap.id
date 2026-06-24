-- Provider KYC onboarding fields (5-step wizard). All additive + nullable
-- (categories has a default), so this is a non-destructive forward migration.
-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "certificateUrl" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "faceImageUrl" TEXT,
ADD COLUMN     "nik" TEXT,
ADD COLUMN     "serviceRadiusKm" INTEGER;
