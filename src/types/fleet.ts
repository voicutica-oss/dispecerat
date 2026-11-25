export type NavTab =
  | 'overview'
  | 'curse'
  | 'flota'
  | 'remorci_libere'
  | 'vize'
  | 'concedii'
  | 'istoric_remorci'
  | 'istoric';

export interface GasPayload {
  scriptVersion?: string;
  curse: string[][];
  vize: string[][];
  flota: string[][];
  concediu: string[][];
  istoric: string[][];
  istoricRemorci?: string[][];
}

export interface GasConfig {
  scriptUrl: string;
  key: string;
  user: string;
  mode: 'demo' | 'live';
}

export interface FreeTrailer {
  remorca: string;
  nefolositaDin: string;
  timestamp: number;
  ultimulSofer: string;
  flotaNote?: string;
  motiv?: string;
}

export type TripStatusType =
  | 'active'
  | 'done'
  | 'yard'
  | 'driver_wait'
  | 'swap'
  | 'unknown';

export interface TripRecord {
  rowIndex: number; // 1-indexed spreadsheet row (2 = first data row)
  cells: string[]; // 15 columns A-O: id, Nr camion, data descarcarii, tara, localitatea, detalii, observații, nume sofer, TELEFON, REZERVA, TIP AUTO, AN FABRICATIE, PERIOADA ESTIMATA, GARAJ DIN, CAMIOANE original
  camion: string;
  remorca: string;
  dataDesc: string;
  dataDescDate: Date | null;
  tara: string;
  localitate: string;
  sofer: string;
  isActive: boolean;
  statusType: TripStatusType;
}

export interface VisaRecord {
  rowIndex: number;
  cells: string[]; // 4 columns: Nr., Nume, Document, Data expirare
  expiryDate: Date | null;
  daysLeft: number | null;
  status: 'expired' | 'expiring' | 'valid' | 'unknown';
}

export type LeaveType = 'CO' | 'CM' | 'CFP' | 'L';

export interface LeaveRecord {
  nume: string;
  type: LeaveType;
  startStr: string;
  endStr: string;
  startDate: Date | null;
  endDate: Date | null;
  daysCount: number;
  isActiveToday: boolean;
  isUpcoming: boolean;
}

export interface GasMutatePayload {
  action?: 'write';
  key: string;
  user: string;
  kind: 'curse' | 'vize' | 'concediu';
  row?: number;
  values: string[];
  loc?: string;
}
