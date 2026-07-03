-- AlterTable
ALTER TABLE "FoodHousehold" ADD COLUMN "cuisinePreferences" TEXT[] DEFAULT ARRAY[]::TEXT[];
