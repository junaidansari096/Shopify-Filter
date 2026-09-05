-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "timezone" TEXT,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "filter_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "presentation" TEXT NOT NULL DEFAULT 'checkbox-list',
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "showCounts" BOOLEAN NOT NULL DEFAULT true,
    "initialVisibleCount" INTEGER NOT NULL DEFAULT 8,
    "showMore" BOOLEAN NOT NULL DEFAULT true,
    "expandedDesktop" BOOLEAN NOT NULL DEFAULT true,
    "expandedMobile" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "filter_configurations_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appearance_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "sidebarWidth" INTEGER NOT NULL DEFAULT 260,
    "sidebarWidthMin" INTEGER NOT NULL DEFAULT 220,
    "sidebarWidthMax" INTEGER NOT NULL DEFAULT 340,
    "headingSize" TEXT NOT NULL DEFAULT '16px',
    "optionFontSize" TEXT NOT NULL DEFAULT '14px',
    "showDivider" BOOLEAN NOT NULL DEFAULT true,
    "dividerStrength" TEXT NOT NULL DEFAULT '1px',
    "checkboxRadius" TEXT NOT NULL DEFAULT '4px',
    "checkboxSize" TEXT NOT NULL DEFAULT '18px',
    "accentColor" TEXT NOT NULL DEFAULT '#032443',
    "textColor" TEXT NOT NULL DEFAULT '#1F2937',
    "mutedTextColor" TEXT NOT NULL DEFAULT '#6B7280',
    "borderColor" TEXT NOT NULL DEFAULT '#E5E7EB',
    "selectedColor" TEXT NOT NULL DEFAULT '#032443',
    "panelBackground" TEXT NOT NULL DEFAULT '#FFFFFF',
    "panelRadius" TEXT NOT NULL DEFAULT '8px',
    "spacing" TEXT NOT NULL DEFAULT '16px',
    "stickyDesktop" BOOLEAN NOT NULL DEFAULT true,
    "stickyTopOffset" INTEGER NOT NULL DEFAULT 80,
    "mobileBreakpoint" INTEGER NOT NULL DEFAULT 990,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appearance_configurations_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "showProductCount" BOOLEAN NOT NULL DEFAULT true,
    "showActiveFilters" BOOLEAN NOT NULL DEFAULT true,
    "productGridSelector" TEXT NOT NULL DEFAULT '',
    "resultsSectionSelector" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "app_settings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopDomain_key" ON "shops"("shopDomain");

-- CreateIndex
CREATE INDEX "filter_configurations_shopId_position_idx" ON "filter_configurations"("shopId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "filter_configurations_shopId_sourceKey_key" ON "filter_configurations"("shopId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "appearance_configurations_shopId_key" ON "appearance_configurations"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_shopId_key" ON "app_settings"("shopId");
