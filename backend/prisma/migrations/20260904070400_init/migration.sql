-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DRIVER', 'SUPERVISOR', 'ROOT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "cedula" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "Visible" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" SERIAL NOT NULL,
    "identity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "Visible" INTEGER NOT NULL DEFAULT 1,
    "driverId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePosition" (
    "id" SERIAL NOT NULL,
    "identity" TEXT NOT NULL,
    "routeId" INTEGER NOT NULL,
    "Visible" INTEGER NOT NULL DEFAULT 1,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cedula_key" ON "User"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Route_driverId_createdAt_key" ON "Route"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Route_identity_name_key" ON "Route"("identity", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePosition_identity_key" ON "VehiclePosition"("identity");

-- CreateIndex
CREATE INDEX "VehiclePosition_routeId_timestamp_idx" ON "VehiclePosition"("routeId", "timestamp");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePosition" ADD CONSTRAINT "VehiclePosition_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
