/** Linhas usadas nas telas de perfil (evita `never` quando o cliente gerado não lista a tabela). */
export type ProfileRow = {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
};

export type WorkerProfilePersonalRow = {
  cpf: string | null;
  age: number | null;
  experience_years: number | null;
  city: string | null;
  cnh_document_url: string | null;
  cnh_document_back_url: string | null;
  background_check_url: string | null;
};

export type ProfileOverviewRow = {
  full_name: string | null;
  avatar_url: string | null;
  rating: number | string | null;
  verified: boolean | null;
};

export type WorkerOverviewRow = {
  subtype: string | null;
  pix_key: string | null;
};
