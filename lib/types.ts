export type Lang = "es" | "uk" | "ru" | "en";
export type Precision = "region" | "subregion" | "city" | "neighborhood" | "exact";

export interface Area {
  id: string;
  name: string;
  level: "region" | "subregion" | "city" | "neighborhood";
  parentId: string | null;
  lat: number;
  lng: number;
  radius_km: number;
}

export interface ServiceItem {
  name: string;
  price: string;
  kind: "service" | "product";
}

export interface Provider {
  id: string;
  name: string;
  language: Lang;
  category: string;
  title_en: string;
  title_native: string;
  story_en: string;
  story_native: string;
  services: ServiceItem[];
  areaId: string;
  locationPrecision: Precision;
  address?: string;
  lat?: number;
  lng?: number;
  travelRadius: number;
  availability?: string;
  summary_en?: string;
  summary_native?: string;
  languages?: string[];
  /** Synthetic contact for order notifications; never returned by public APIs. */
  contact?: string;
  status?: "draft" | "live";
  verified: boolean;
}

export interface Message {
  id: string;
  from: "customer" | "provider";
  original: string;
  lang: Lang;
  translations: Partial<Record<Lang, string>>;
  at: number;
}

export interface Order {
  id: string;
  providerId: string;
  customerName: string;
  customerLanguage: Lang;
  item: string;
  details: string;
  status: "new" | "accepted" | "declined" | "done";
  messages: Message[];
  createdAt: number;
}

export interface DB {
  providers: Provider[];
  orders: Order[];
}
