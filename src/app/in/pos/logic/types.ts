export type Product = {
  id: string;
  name: string;
  price: number;
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
