export type Product = {
  id: string;
  item_name: string;
  unit_price: number;
};

export type Customer = {
  id?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthdate?: string;
  gender?: string;
  phone_number?: string;
  email_address?: string;
  address?: string;
};

export type Basket = {
  id: string;
  name: string;
    machine_id?: string | null;
  weightKg: number;
  washCount: number;
  dryCount: number;
  spinCount: number;
  washPremium: boolean;
  dryPremium: boolean;
  iron: boolean;
  fold: boolean;
  notes: string;
};

export type ReceiptBasketLine = {
  id: string;
  name: string;
  weightKg: number;
  breakdown: { wash: number; dry: number; spin: number };
  total: number;
};

export type ReceiptProductLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
};

export type LaundryService = {
  id: string;
  service_type: string;
  name: string;
  description: string | null;
  base_duration_minutes: number;
  rate_per_kg: number;
  is_active: boolean;
};
