export interface InventoryProductOption {
  id: number;
  name: string;
  reference: string;
}

export interface InventorySupplierOption {
  id: number;
  name: string;
}

export interface InventoryFormOptions {
  products: InventoryProductOption[];
  suppliers: InventorySupplierOption[];
}
