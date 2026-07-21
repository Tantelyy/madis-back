interface DatedInventory {
  id: number;
  createdAt: Date;
}

export function selectLatestInventory<TInventory extends DatedInventory>(
  inventories: readonly TInventory[],
): TInventory | null {
  return inventories.reduce<TInventory | null>((latestInventory, inventory) => {
    if (!latestInventory) {
      return inventory;
    }

    const dateDifference =
      inventory.createdAt.getTime() - latestInventory.createdAt.getTime();

    if (dateDifference > 0) {
      return inventory;
    }

    if (dateDifference === 0 && inventory.id > latestInventory.id) {
      return inventory;
    }

    return latestInventory;
  }, null);
}
